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
    {
        name: 'layout: a column and a row are added beside a key, and deleted again',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            await page.click((await keyCenters(page)).matrix_col3_row2);
            await page.press('Column');
            await page.press('+ Right');
            await page.until(`'col7' in jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.columns`, 30, 'a new column');
            const columns = Object.keys((await parsed(page)).points.zones.matrix.columns);
            assert(columns.indexOf('col7') === columns.indexOf('col3') + 1, `col7 should follow col3: ${columns}`);
            await page.until(`[...document.querySelectorAll('svg title')].some(t => t.textContent === 'matrix_col7_row2')`, 60, 'its keys');
            const keys = await keyCenters(page);
            assert(keys.matrix_col7_row2[0] > keys.matrix_col3_row2[0] && keys.matrix_col7_row2[0] < keys.matrix_col4_row2[0], 'the new column should sit between col3 and col4');
            // it is picked: deleted with its ×
            await page.ev(`document.querySelector('button[title="Delete column col7"]').click()`);
            await page.until(`!('col7' in jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.columns)`, 30, 'the column to go');

            await page.click((await keyCenters(page)).matrix_col3_row2);
            await page.press('Row');
            await page.press('+ Above');
            await page.until(`'row5' in jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.rows`, 30, 'a new row');
            const rows = Object.keys((await parsed(page)).points.zones.matrix.rows);
            assert(rows.indexOf('row5') === rows.indexOf('row2') + 1, `row5 should come after row2 (above it): ${rows}`);
            await page.until(`[...document.querySelectorAll('svg title')].some(t => t.textContent === 'matrix_col3_row5')`, 60, 'its keys');
            const withRow = await keyCenters(page);
            assert(withRow.matrix_col3_row5[1] < withRow.matrix_col3_row2[1] && withRow.matrix_col3_row5[1] > withRow.matrix_col3_row1[1], 'the new row should sit between row2 and row1');
            await page.ev(`document.querySelector('button[title="Delete row row5"]').click()`);
            await page.until(`!('row5' in jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.rows)`, 30, 'the row to go');
            const left = await parsed(page);
            assert(Object.keys(left.points.zones.matrix.columns).length === 7 && Object.keys(left.points.zones.matrix.rows).length === 5, 'the other columns and rows should stay');
        },
    },
    {
        name: "layout: a key's own width and shift are set, and it is hidden and brought back",
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const col = `jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.columns.col3`;
            const keyWidth = `(() => { const t = [...document.querySelectorAll('svg title')].find(t => t.textContent === 'matrix_col3_row2'); return t && t.parentElement.getBoundingClientRect().width })()`;
            const before = await page.ev(keyWidth);
            await page.click((await keyCenters(page)).matrix_col3_row2);
            await page.press('Key');
            const box = name => `[...document.querySelectorAll('label.field')].find(l => l.querySelector('.label').textContent === '${name}').querySelector('input')`;
            await page.ev(`${box('Width')}.focus()`);
            await page.type('1.5kx');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${col}['rows.row2.width'] === '1.5kx'`, 30, 'the width to be written');
            await page.until(`${keyWidth} > ${before} * 1.3`, 60, 'the key to widen');
            await page.ev(`${box('Shift Y')}.focus()`);
            await page.type('2');
            await page.key('Enter', 'Enter', 13);
            await page.until(`JSON.stringify(${col}['rows.row2.shift']) === '[0,2]'`, 30, 'the shift to be written');

            await page.press('Hide key');
            await page.until(`${col}['rows.row2.skip'] === true`, 30, 'skip to be written');
            await page.until(`![...document.querySelectorAll('svg title')].some(t => t.textContent === 'matrix_col3_row2')`, 60, 'the key to go');
            await page.press('Column');
            await page.press('row2 ↺');
            await page.until(`${col}['rows.row2.skip'] === false`, 30, 'skip: false');
            await page.until(`[...document.querySelectorAll('svg title')].some(t => t.textContent === 'matrix_col3_row2')`, 60, 'the key to come back');
        },
    },
    {
        name: 'layout: on the Key tab a dragged key moves alone, by its own shift',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const col = `jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points.zones.matrix.columns.col3`;
            await page.click((await keyCenters(page)).matrix_col3_row2);
            await page.press('Key');
            const before = await keyCenters(page);
            // on the mirrored half, 10 mm (a pixel is less than a mm here) to the left: the source key's shift x grows
            const key = before.mirror_matrix_col3_row2;
            await page.drag(key, [key[0] - 30, key[1]]);
            await page.until(`Array.isArray(${col}['rows.row2.shift'])`, 30, 'the shift to be written');
            const [x, y] = await page.ev(`${col}['rows.row2.shift']`);
            assert(x > 3 && Math.abs(y) < 0.5, `the shift should be [x > 3, 0], is [${x}, ${y}]`);
            await page.until(`(() => { const t = [...document.querySelectorAll('svg title')].find(t => t.textContent === 'matrix_col3_row2'); return t && t.parentElement.getBoundingClientRect().left > ${before.matrix_col3_row2[0] - 9} + 0 })()`, 60, 'the redraw');
            await new Promise(r => setTimeout(r, 1500));
            const after = await keyCenters(page);
            assert(furthest(before, after, ['matrix_col3_row1', 'matrix_col3_row3', 'matrix_col4_row2']) < 1, 'the other keys should stay put');
            assert(after.matrix_col3_row2[0] - before.matrix_col3_row2[0] > 15, 'the source key should move right, the mirror image of the drag');
            assert(before.mirror_matrix_col3_row2[0] - after.mirror_matrix_col3_row2[0] > 15, 'the dragged key should move left');
        },
    },
    {
        name: "layout: a zone's anchor and turn, a new zone, and the mirror are set on the Zone tab",
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const points = `jsyaml.load(window.monaco.editor.getModels()[0].getValue()).points`;
            const box = name => `[...document.querySelectorAll('label.field')].find(l => l.querySelector('.label')?.textContent === '${name}').querySelector('input, select')`;
            const before = await keyCenters(page);
            await page.click(before.thumbs_col0_row5);
            await page.press('Zone');
            // the thumbs turn 5° more about their anchor
            await page.ev(`${box('Turn')}.select()`);
            await page.type('30');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${points}.zones.thumbs.anchor.rotate === 30`, 30, 'the anchor rotate');
            await page.until(`(() => { const t = [...document.querySelectorAll('svg title')].find(t => t.textContent === 'thumbs_col3_row5'); return !!t })()`, 30, 'the thumbs');
            await new Promise(r => setTimeout(r, 1500));
            const turned = await keyCenters(page);
            assert(Math.hypot(turned.thumbs_col3_row5[0] - before.thumbs_col3_row5[0], turned.thumbs_col3_row5[1] - before.thumbs_col3_row5[1]) > 3, 'the thumbs should turn');
            assert(Math.hypot(turned.matrix_col3_row2[0] - before.matrix_col3_row2[0], turned.matrix_col3_row2[1] - before.matrix_col3_row2[1]) < 1, 'the matrix should stay');
            await page.choose(box('From key'), 'matrix_col2_row3');
            await page.until(`${points}.zones.thumbs.anchor.ref === 'matrix_col2_row3'`, 30, 'the anchor key');

            // a new zone of one key, starting from the picked key, and deleted again
            await page.press('+ Zone');
            await page.press('Add');
            await page.until(`'zone2' in ${points}.zones`, 30, 'the new zone');
            await page.until(`[...document.querySelectorAll('svg title')].some(t => t.textContent === 'zone2_col0_row0')`, 60, 'its key');
            await page.press('Zone');
            await page.ev(`document.querySelector('button[title="Delete zone zone2"]').click()`);
            await page.until(`!('zone2' in ${points}.zones)`, 30, 'the zone to go');

            // the mirror: the halves 1 kx further apart, then off and on again
            await page.click((await keyCenters(page)).matrix_col3_row2);
            await page.press('Zone');
            const mirrored = (await keyCenters(page)).mirror_matrix_col3_row2;
            await page.ev(`${box('Distance')}.select()`);
            await page.type('-1kx');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${points}.mirror.distance === '-1kx'`, 30, 'the distance');
            await page.until(`(() => { const t = [...document.querySelectorAll('svg title')].find(t => t.textContent === 'mirror_matrix_col3_row2'); return t && t.parentElement.getBoundingClientRect().left > ${mirrored[0]} })()`, 60, 'the mirrored half to move out');
            await page.ev(`document.querySelector('label.check input').click()`);
            await page.until(`${points}.mirror === undefined`, 30, 'the mirror to go');
            await page.until(`![...document.querySelectorAll('svg title')].some(t => t.textContent.startsWith('mirror_'))`, 60, 'the mirrored keys to go');
            await page.ev(`document.querySelector('label.check input').click()`);
            await page.until(`${points}.mirror?.ref === 'matrix_col3_row2'`, 30, 'the mirror back');
            await page.ev(`${box('Distance')}.select()`);
            await page.type('-2kx');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${points}.mirror.distance === '-2kx'`, 30, 'the distance back');
        },
    },
    {
        name: 'layout: the wheel zooms, and a double click goes back to the whole board',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const svg = `[...document.querySelectorAll('svg')].find(s => s.querySelectorAll('title').length > 60)`;
            const box = `${svg}.getAttribute('viewBox')`;
            const fitted = await page.ev(box);
            await page.ev(`(() => { const s = ${svg}; const r = s.getBoundingClientRect();
                for (let i = 0; i < 3; i++) s.dispatchEvent(new WheelEvent('wheel', {deltaY: -100, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true})); })()`);
            await page.until(`${box} !== ${JSON.stringify(fitted)}`, 10, 'the view to zoom');
            await page.ev(`${svg}.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}))`);
            await page.until(`${box} === ${JSON.stringify(fitted)}`, 10, 'the double click to show the whole board again');
        },
    },
];
