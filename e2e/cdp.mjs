// A small Chrome DevTools Protocol client over Node's own WebSocket, and the page helpers the
// end-to-end tests use: evaluate page JS, wait for a condition, and send real mouse and key events.

export class Cdp {
    constructor(socket) {
        this.socket = socket;
        this.id = 0;
        this.calls = new Map();
        this.listeners = new Map();
        socket.addEventListener('message', ({data}) => {
            const message = JSON.parse(data);
            if (message.id !== undefined) {
                const call = this.calls.get(message.id);
                this.calls.delete(message.id);
                if (!call) return;
                if (message.error) call.reject(new Error(`${call.method}: ${message.error.message}`));
                else call.resolve(message.result);
            } else {
                for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
            }
        });
    }

    static async connect(url) {
        const socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, {once: true});
            socket.addEventListener('error', () => reject(new Error(`can't connect to ${url}`)), {once: true});
        });
        return new Cdp(socket);
    }

    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.calls.set(id, {resolve, reject, method});
            this.socket.send(JSON.stringify({id, method, params}));
        });
    }

    on(method, listener) {
        if (!this.listeners.has(method)) this.listeners.set(method, []);
        this.listeners.get(method).push(listener);
    }

    close() {
        this.socket.close();
    }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// the buttons a mouse event says are down
const BUTTONS = {left: 1, right: 2, middle: 4};

// What ergogen fetches from GitHub (its footprint libraries), kept on disk for the tests: GitHub allows 60 API calls
// an hour without a token, and each test starts the app afresh. A file of a commit never changes; the rest (a
// branch's head, a file of main) is fetched again after an hour, and an old copy serves while GitHub doesn't answer.
const GITHUB_CACHE = new URL('./.cache/github/', import.meta.url);
const FRESH_MS = 60 * 60 * 1000;
const RUN_START = Date.now();

const githubCache = async () => {
    const {mkdir, readFile, writeFile} = await import('node:fs/promises');
    const {createHash} = await import('node:crypto');
    await mkdir(GITHUB_CACHE, {recursive: true});
    const fileOf = key => new URL(createHash('sha1').update(key).digest('hex') + '.json', GITHUB_CACHE);
    return {
        get: async key => { try { return JSON.parse(await readFile(fileOf(key), 'utf8')); } catch { return null; } },
        set: (key, entry) => writeFile(fileOf(key), JSON.stringify(entry)),
    };
};

// a file of a commit, or a commit's list of files
const fixed = url => /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\//.test(url)
    || /\/git\/trees\/[0-9a-f]{40}/.test(url);

const serveGithub = async (cdp, cache, {requestId, request}) => {
    const accept = request.headers.Accept ?? request.headers.accept ?? '';
    const key = `${request.method} ${request.url} ${accept}`;
    const kept = await cache.get(key);
    const fulfill = entry => cdp.send('Fetch.fulfillRequest', {
        requestId, responseCode: entry.status, body: entry.body,
        responseHeaders: [{name: 'Content-Type', value: entry.type}, {name: 'Access-Control-Allow-Origin', value: '*'}],
    });
    // a repo's head commit is asked once a run (2 API calls), so a library pushed since the last run is seen; the rest
    // stays for an hour
    const head = /\/commits\/main/.test(request.url);
    const fresh = kept && (head ? kept.at >= RUN_START : Date.now() - kept.at < FRESH_MS);
    if (kept && (fixed(request.url) || fresh)) return fulfill(kept);
    try {
        // some connections to GitHub hang: give each try 10 s
        let response;
        for (let tries = 4; !response; tries--) {
            try {
                response = await fetch(request.url, {method: request.method, headers: accept ? {Accept: accept} : {}, signal: AbortSignal.timeout(10000)});
            } catch (error) {
                if (tries <= 1) throw error;
            }
        }
        const entry = {status: response.status, type: response.headers.get('content-type') ?? 'text/plain',
            body: Buffer.from(await response.arrayBuffer()).toString('base64'), at: Date.now()};
        if (response.ok) await cache.set(key, entry);
        else if (kept) return fulfill(kept);
        return fulfill(entry);
    } catch {
        if (kept) return fulfill(kept);
        return cdp.send('Fetch.failRequest', {requestId, errorReason: 'Failed'});
    }
};

// One browser tab, driven the way a person would: page JS for reading state, CDP input events for clicks
export class Page {
    constructor(cdp, log) {
        this.cdp = cdp;
        this.log = log;
        this.errors = [];
    }

    static async open(debugPort, log) {
        const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {method: 'PUT'})).json();
        const page = new Page(await Cdp.connect(target.webSocketDebuggerUrl), log);
        page.targetId = target.id;
        await page.cdp.send('Page.enable');
        await page.cdp.send('Runtime.enable');
        const cache = await githubCache();
        page.cdp.on('Fetch.requestPaused', paused => serveGithub(page.cdp, cache, paused).catch(() => {}));
        await page.cdp.send('Fetch.enable', {patterns: [{urlPattern: 'https://api.github.com/*'}, {urlPattern: 'https://raw.githubusercontent.com/*'}]});
        await page.cdp.send('Emulation.setDeviceMetricsOverride', {width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false});
        // confirm() before a delete: say yes
        page.cdp.on('Page.javascriptDialogOpening', ({message}) => {
            page.dialogs = [...(page.dialogs ?? []), message];
            page.cdp.send('Page.handleJavaScriptDialog', {accept: true});
        });
        page.cdp.on('Runtime.exceptionThrown', ({exceptionDetails: d}) => {
            const text = d.exception?.description ?? d.text;
            // harmless: Monaco and KiCanvas resize themselves while the layout settles
            if (!/ResizeObserver loop/.test(text)) page.errors.push(text.split('\n')[0]);
        });
        return page;
    }

    async ev(expression) {
        const r = await this.cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true, timeout: 600000});
        if (r.exceptionDetails) throw new Error(`${expression.slice(0, 100)}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result.value;
    }

    async until(expression, seconds = 60, what = expression) {
        const start = Date.now();
        for (;;) {
            if (await this.ev(expression)) return;
            if (Date.now() - start > seconds * 1000) throw new Error(`timed out after ${seconds} s waiting for ${what.slice(0, 160)}`);
            await wait(250);
        }
    }

    async goto(url) {
        await this.cdp.send('Page.navigate', {url});
        await this.until(`document.readyState === 'complete'`, 60, 'the page to load');
    }

    mouse(type, x, y, modifiers = 0, button = 'left') {
        return this.cdp.send('Input.dispatchMouseEvent', {type, x, y, modifiers, button, buttons: type === 'mouseReleased' ? 0 : BUTTONS[button], clickCount: 1});
    }

    async click([x, y], modifiers = 0) {
        await this.cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
        await this.mouse('mousePressed', x, y, modifiers);
        await this.mouse('mouseReleased', x, y, modifiers);
        await wait(250);
    }

    // a drag in steps, the way a hand moves, with the left button unless another is named; the path can be a function
    // of 0..1 for curves
    async drag(from, to, {steps = 12, modifiers = 0, path, button = 'left'} = {}) {
        await this.mouse('mousePressed', from[0], from[1], modifiers, button);
        for (let i = 1; i <= steps; i++) {
            const [x, y] = path ? path(i / steps) : [from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps];
            await this.cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, modifiers, button, buttons: BUTTONS[button]});
            await wait(30);
        }
        await this.mouse('mouseReleased', to[0], to[1], modifiers, button);
        await wait(250);
    }

    // a turn of the wheel at a point: a deltaY below 0 turns it away from the user
    async wheel([x, y], deltaY, modifiers = 0) {
        await this.cdp.send('Input.dispatchMouseEvent', {type: 'mouseWheel', x, y, deltaX: 0, deltaY, modifiers});
        await wait(100);
    }

    async key(key, code = key, windowsVirtualKeyCode = 0, modifiers = 0) {
        await this.cdp.send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers});
        await this.cdp.send('Input.dispatchKeyEvent', {type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers});
        await wait(100);
    }

    type(text) {
        return this.cdp.send('Input.insertText', {text});
    }

    // the middle of the element an expression finds
    async center(expression, what = expression) {
        const at = await this.ev(`(() => { const el = ${expression}; if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`);
        if (!at) throw new Error(`not on the page: ${what}`);
        return at;
    }

    // the middle of the SVG element whose <title> starts with text
    titled(text) {
        return this.center(`[...document.querySelectorAll('svg title')].find(t => t.textContent.startsWith(${JSON.stringify(text)}))?.parentElement`, `an element titled "${text}"`);
    }

    // a button by its text, once it is there (toolbars hide while a board regenerates)
    async press(text, seconds = 60) {
        const find = `[...document.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(text)})`;
        await this.until(`!!${find}`, seconds, `a "${text}" button`);
        await this.ev(`${find}.click()`);
        await wait(250);
    }

    // sets a <select> the way a person picking an option does (React listens for change)
    choose(selectExpression, value) {
        return this.ev(`(() => { const s = ${selectExpression}; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', {bubbles: true})); })()`);
    }

    async shot(file) {
        const {data} = await this.cdp.send('Page.captureScreenshot', {format: 'png'});
        const {writeFile} = await import('node:fs/promises');
        await writeFile(file, Buffer.from(data, 'base64'));
    }

    close() {
        this.cdp.close();
    }
}

export {wait};
