// Keys and columns in the layout editor
import {assert, freshApp, keyCenters, near, openLayout, parsed} from '../app.mjs';

const stagger = async (page, col) => (await parsed(page)).points.zones.matrix.columns[col].key?.stagger;

// the largest distance any key moved between two snapshots
const furthest = (a, b, keys = Object.keys(b)) =>
    Math.max(...keys.filter(k => a[k] && b[k]).map(k => Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1])));

export const tests = [
    {
        name: 'layout: dragging a column moves only that column',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const [col3, col4] = [await stagger(page, 'col3'), await stagger(page, 'col4')];
            const before = await keyCenters(page);
            const key = before.matrix_col3_row2;
            await page.drag(key, [key[0], key[1] - 40]);
            await page.until(`jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.columns.col3.key.stagger !== ${col3}`, 30, 'col3 stagger to change');
            const [col3After, col4After] = [await stagger(page, 'col3'), await stagger(page, 'col4')];
            assert(col3After > col3, `col3 should move up: stagger ${col3} -> ${col3After}`);
            near(col4After, col4 - (col3After - col3), 0.01, 'col4 should take the opposite change');
            await new Promise(r => setTimeout(r, 1500));
            const after = await keyCenters(page);
            assert(furthest(before, after, ['matrix_col5_row2', 'matrix_col6_row2', 'mirror_matrix_col5_row2']) < 1, 'the columns after col4 should stay put');
            assert(furthest(before, after, ['matrix_col3_row2']) > 20, 'col3 should have moved');
        },
    },
    {
        name: 'layout: turning a column (splay) previews what ergogen makes',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const key = (await keyCenters(page)).matrix_col3_row2;
            await page.click(key);
            const handles = await page.ev(`[...document.querySelectorAll('circle')].filter(c => c.getAttribute('r') === '2.2').map(c => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })`);
            assert(handles.length === 2, `a rotate handle on each half, found ${handles.length}`);
            const handle = handles.sort((a, b) => Math.abs(a[0] - key[0]) - Math.abs(b[0] - key[0]))[0];
            await page.mouse('mousePressed', handle[0], handle[1]);
            for (let i = 1; i <= 10; i++) await page.cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: handle[0] - 4 * i, y: handle[1] + i / 2, button: 'left', buttons: 1});
            await new Promise(r => setTimeout(r, 300));
            const during = await keyCenters(page);
            await page.mouse('mouseReleased', handle[0] - 40, handle[1] + 5);
            await page.until(`jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.columns.col3.key.splay !== undefined`, 30, 'col3 to get a splay');
            await new Promise(r => setTimeout(r, 2000));
            const after = await keyCenters(page);
            assert(furthest(during, after) < 1.5, `the preview should match ergogen, off by up to ${furthest(during, after).toFixed(1)} px`);
        },
    },
    {
        name: 'layout: Alt-dragging the thumbs moves them, and the mirror with them',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const shiftBefore = (await parsed(page)).points.zones.thumbs.anchor.shift;
            const thumb = (await keyCenters(page)).thumbs_col1_row5;
            await page.mouse('mousePressed', thumb[0], thumb[1], 1);
            for (let i = 1; i <= 10; i++) await page.cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: thumb[0] + 3 * i, y: thumb[1] - 2 * i, modifiers: 1, button: 'left', buttons: 1});
            await new Promise(r => setTimeout(r, 300));
            const during = await keyCenters(page);
            await page.mouse('mouseReleased', thumb[0] + 30, thumb[1] - 20, 1);
            await page.until(`JSON.stringify(jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.thumbs.anchor.shift) !== ${JSON.stringify(JSON.stringify(shiftBefore))}`, 30, 'the thumbs anchor to move');
            const shiftAfter = (await parsed(page)).points.zones.thumbs.anchor.shift;
            assert(shiftAfter.every(v => /kx$/.test(String(v))), `the shift should stay in kx: ${shiftAfter}`);
            await new Promise(r => setTimeout(r, 2000));
            const after = await keyCenters(page);
            assert(furthest(during, after) < 1.5, `the preview (mirror included) should match ergogen, off by up to ${furthest(during, after).toFixed(1)} px`);
        },
    },
];
