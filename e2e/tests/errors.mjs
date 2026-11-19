// A part of the page that fails to draw takes only itself down
import {assert, config, deleteFromList, freshApp} from '../app.mjs';

const broken = `[...document.querySelectorAll('[data-error-boundary]')].map(b => b.dataset.errorBoundary)`;
// a dev build of React also reports an error a boundary caught as uncaught: the one thrown on purpose is expected
const expected = page => { page.errors = page.errors.filter(e => !e.includes('broken on purpose')); };

export const tests = [
    {
        name: "errors: a case's parts panel that fails leaves the case, the list and the editor working",
        async run(page, {url}) {
            await freshApp(page, url);
            await page.ev(`window.__breakArea = "the case's parts"`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Cases'))?.click()`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent === 'right_top.stl')?.click()`);
            await page.until(`${broken}.includes("the case's parts")`, 60, 'the panel to show its error');
            assert(await page.ev(`!!document.querySelector('canvas')`), 'the case should still be drawn');
            assert(await page.ev(`[...document.querySelectorAll('button')].some(b => b.textContent === 'right_middle.stl')`), 'the Downloads list should still be there');
            assert(await page.ev(`!!window.monaco.editor.getModels()[0]`), 'the config editor should still be there');
            // fixed, it comes back
            await page.ev(`window.__breakArea = undefined`);
            await page.press('Try again');
            await page.until(`${broken}.length === 0 && document.querySelectorAll('.line').length > 0`, 30, 'the panel back');
            expected(page);
        },
    },
    {
        name: 'errors: a Downloads list that fails leaves the preview and the editor working',
        async run(page, {url}) {
            await freshApp(page, url);
            await page.ev(`window.__breakArea = 'the Downloads list'`);
            // a change to the config draws the list again
            await page.ev(`(() => { const m = window.monaco.editor.getModels()[0]; m.applyEdits([{range: m.getFullModelRange(), text: m.getValue() + '\\n'}]) })()`);
            await page.until(`${broken}.includes('the Downloads list')`, 30, 'the list to show its error');
            assert(await page.ev(`!!document.querySelector('img, svg')`), 'the preview should still be there');
            await page.ev(`window.__breakArea = undefined`);
            await page.press('Try again');
            await page.until(`${broken}.length === 0 && [...document.querySelectorAll('button')].some(b => b.textContent.startsWith('▸ PCBs'))`, 30, 'the list back');
            expected(page);
        },
    },
    {
        name: 'errors: a pcb ergogen cannot make is shown as failed, and everything else is still made',
        async run(page, {url}) {
            await freshApp(page, url);
            // a pcb whose board edge is an outline the config does not have
            await page.ev(`(() => { const m = window.monaco.editor.getModels()[0]; const t = m.getValue(); const i = t.indexOf('\\ncases:');
                m.applyEdits([{range: m.getFullModelRange(), text: t.slice(0, i) + '\\n  e2e_broken:\\n    outlines:\\n      edge:\\n        outline: no_such_outline' + t.slice(i)}]) })()`);
            await page.until(`'e2e_broken' in jsyaml.load(${config}).pcbs`, 30, 'the broken pcb in the config');
            await page.until(`/pcbs.e2e_broken could not be made/.test(document.querySelector('[data-ergogen-error]')?.textContent ?? '')`, 120, 'the error to name it');
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ PCBs'))?.click()`);
            await page.until(`!!document.querySelector('[data-failed="e2e_broken"]')`, 10, 'its row, marked failed');
            assert(/e2e_broken.outlines.edge.outline/.test(await page.ev(`document.querySelector('[data-failed="e2e_broken"]').title`)), 'its row should say why');
            assert(await page.ev(`[...document.querySelectorAll('button')].some(b => b.textContent === 'ergo_cai_right.kicad_pcb')`), 'the other boards should still be made');
            // the editor underlines the line that names the missing outline, and the row goes there
            const line = await page.ev(`window.monaco.editor.getModels()[0].getValue().split('\\n').findIndex(l => l.includes('outline: no_such_outline')) + 1`);
            await page.until(`window.monaco.editor.getModelMarkers({owner: 'ergogen'}).some(m => m.startLineNumber === ${line})`, 30, 'the error marked on its line');
            await page.ev(`document.querySelector('[data-failed="e2e_broken"]').click()`);
            await page.until(`window.monaco.editor.getEditors()[0].getPosition().lineNumber === ${line}`, 10, 'the editor to show that line');
            // the page starts with the editor hidden: the jump shows it
            assert(await page.ev(`!!document.querySelector('.monaco-editor')?.offsetParent`), 'the jump should show the editor');
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Cases'))?.click()`);
            assert(await page.ev(`[...document.querySelectorAll('button')].some(b => b.textContent === 'right_top.stl')`), 'the cases should still be made');
            // deleted from its row, the error goes
            await deleteFromList(page, 'PCBs', 'e2e_broken');
            await page.until(`!document.querySelector('[data-ergogen-error]')`, 120, 'the error to go');
        },
    },
];
