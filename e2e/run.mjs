// Runs the end-to-end tests: starts the dev server and a headless Chrome for Testing (both on
// loopback, on free ports, with a throwaway profile), runs every test in e2e/tests in a fresh tab,
// and stops both again.
//
//   yarn e2e                 all tests
//   yarn e2e outline pcb     only tests whose name contains one of the words
//
// CHROME_PATH picks the browser (default: the newest Chrome for Testing Playwright downloaded).
// E2E_URL tests an app that is already running instead of starting the dev server.
// A failing test leaves a screenshot in e2e/failures.

import {spawn} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {homedir, tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {Page, wait} from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const filters = process.argv.slice(2);

const freePort = () => new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
        const {port} = server.address();
        server.close(() => resolve(port));
    });
    server.on('error', reject);
});

const findChrome = () => {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const cache = join(homedir(), 'Library/Caches/ms-playwright');
    const builds = existsSync(cache) ? readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().reverse() : [];
    for (const build of builds) {
        for (const app of ['chrome-mac-arm64', 'chrome-mac']) {
            const path = join(cache, build, app, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
            if (existsSync(path)) return path;
        }
        const linux = join(cache, build, 'chrome-linux/chrome');
        if (existsSync(linux)) return linux;
    }
    throw new Error('No Chrome for Testing found: set CHROME_PATH, or run `npx playwright install chromium`');
};

// starts a process and resolves once a line of its output matches ready
const start = (command, args, ready, label) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    const timer = setTimeout(() => reject(new Error(`${label} didn't start:\n${output}`)), 60000);
    const read = chunk => {
        output += chunk;
        if (ready.test(output)) {
            clearTimeout(timer);
            resolve(child);
        }
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('exit', code => {
        clearTimeout(timer);
        reject(new Error(`${label} exited (${code}):\n${output}`));
    });
});

const stop = child => child && child.exitCode === null && child.kill('SIGTERM');

const loadTests = async () => {
    const dir = join(here, 'tests');
    const tests = [];
    for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
        const module = await import(pathToFileURL(join(dir, file)).href);
        for (const test of module.tests) tests.push(test);
    }
    return tests.filter(t => !filters.length || filters.some(f => t.name.includes(f)));
};

const main = async () => {
    const tests = await loadTests();
    if (!tests.length) throw new Error(`no test matches ${filters.join(' ')}`);
    let server = null, chrome = null;
    const profile = await mkdtemp(join(tmpdir(), 'ergogen-gui-e2e-'));
    const failed = [];
    try {
        let url = process.env.E2E_URL;
        if (!url) {
            const port = await freePort();
            server = await start(join(root, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', String(port), '--strictPort'],
                /ready in/, 'the dev server');
            url = `http://127.0.0.1:${port}/`;
        }
        const debugPort = await freePort();
        chrome = await start(findChrome(), ['--headless=new', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`,
            `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], /DevTools listening/, 'Chrome');
        console.log(`${tests.length} test${tests.length === 1 ? '' : 's'} against ${url}\n`);

        for (const test of tests) {
            const page = await Page.open(debugPort, console.log);
            const began = Date.now();
            try {
                await test.run(page, {url});
                if (page.errors.length) throw new Error(`the page threw: ${page.errors.join(' | ')}`);
                console.log(`  ✓ ${test.name} (${((Date.now() - began) / 1000).toFixed(1)} s)`);
            } catch (err) {
                failed.push(test.name);
                console.log(`  ✗ ${test.name}\n      ${String(err.message ?? err).split('\n').join('\n      ')}`);
                await mkdir(join(here, 'failures'), {recursive: true});
                await page.shot(join(here, 'failures', `${test.name.replace(/[^\w-]+/g, '_')}.png`)).catch(() => {});
            } finally {
                page.close();
                await fetch(`http://127.0.0.1:${debugPort}/json/close/${page.targetId}`).catch(() => {});
            }
        }
    } finally {
        stop(chrome);
        stop(server);
        await wait(500);
        await rm(profile, {recursive: true, force: true});
    }
    console.log(`\n${tests.length - failed.length} passed, ${failed.length} failed`);
    if (failed.length) process.exit(1);
};

main().catch(err => {
    console.error(err.message ?? err);
    process.exit(1);
});
