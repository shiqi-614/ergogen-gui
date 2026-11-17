// Outlines in the layout editor
import {assert, config, freshApp, openLayout, outlineMenu, parsed, pressNew} from '../app.mjs';

const pick = (page, name) => page.choose(outlineMenu, name);
const redEdges = `document.querySelectorAll('svg line[stroke="#ff4d4d"]').length`;
const points = async (page, outline) => (await parsed(page)).outlines[outline]?.[0]?.points;

export const tests = [
    {
        name: 'outlines: a dragged point lines up with its neighbour',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            await pick(page, 'board');
            await page.until(`!!document.querySelector('svg path[fill-rule="evenodd"]')`, 60, 'the board outline');
            // a point that is level with the next one, and not under a panel
            const index = await page.ev(`(() => {
                const handles = [...document.querySelectorAll('svg title')].filter(t => /^board\\.0\\.points\\[\\d+\\]$/.test(t.textContent)).map(t => t.parentElement);
                const y = h => +h.getAttribute('y');
                const visible = h => { const r = h.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === h; };
                return handles.findIndex((h, i) => visible(h) && Math.abs(y(h) - y(handles[(i + 1) % handles.length])) < 0.01);
            })()`);
            assert(index >= 0, 'the board outline should have a visible point level with the next one');
            const before = (await points(page, 'board'))[index].shift;
            const handle = await page.titled(`board.0.points[${index}]`);
            await page.drag(handle, [handle[0] - 25, handle[1] + 3]);
            await page.until(`JSON.stringify(jsyaml.load(${config}).outlines.board[0].points[${index}].shift) !== ${JSON.stringify(JSON.stringify(before))}`, 30, 'the point to move');
            const after = (await points(page, 'board'))[index].shift;
            assert(String(after[1]) === String(before[1]), `y should stay as written (lined up): ${before[1]} -> ${after[1]}`);
            assert(String(after[0]) !== String(before[0]), 'x should change');
        },
    },
    {
        name: 'outlines: an almost straight edge is flagged, and snapping straightens it',
        async run(page, {url}) {
            await freshApp(page, url);
            // an outline whose top edge is 0.01 mm off level
            await page.ev(`(() => { const m = window.monaco.editor.getModels()[0]; const t = m.getValue(); const i = t.indexOf('\\noutlines:\\n') + '\\noutlines:\\n'.length;
                const p = m.getPositionAt(i); m.applyEdits([{range: new window.monaco.Range(p.lineNumber, 1, p.lineNumber, 1),
                text: '  e2e_tilt:\\n    - what: polygon\\n      points:\\n        - ref: matrix_col3_row2\\n          shift: [0, 10]\\n        - ref: matrix_col3_row2\\n          shift: [20, 10.01]\\n        - ref: matrix_col3_row2\\n          shift: [20, -10]\\n'}]) })()`);
            await openLayout(page);
            await pick(page, 'e2e_tilt');
            await page.until(`${redEdges} === 1`, 60, 'one red edge');
            // out of the way of the points
            await page.press('▾');
            const handle = await page.titled('e2e_tilt.0.points[1]');
            await page.drag(handle, [handle[0] + 1, handle[1] + 1], {steps: 4});
            await page.until(`String(jsyaml.load(${config}).outlines.e2e_tilt[0].points[1].shift[1]) === '10'`, 30, 'the point to snap to y 10');
            await page.until(`${redEdges} === 0`, 60, 'no red edge');
        },
    },
    {
        name: 'outlines: a hull from a template, then a point added and deleted',
        async run(page, {url}) {
            await freshApp(page, url);
            // from the + on the Downloads list's Outlines, into the layout editor
            await page.until(`!!document.querySelector('button[title="A new outline"]')`, 60, 'the Outlines section');
            await pressNew(page, 'outline');
            await page.ev(`document.querySelector('input[placeholder="outline name"]').focus()`);
            await page.type('e2e_hull');
            await page.choose(`document.querySelector('select[title="how it starts"]')`, 'hull');
            await page.press('Add');
            await page.until(`!!jsyaml.load(${config}).outlines.e2e_hull`, 30, 'the hull outline');
            await page.until(`${outlineMenu}?.value === 'e2e_hull'`, 60, 'the layout editor to open the new outline');
            const count = (await points(page, 'e2e_hull')).length;
            assert(count >= 4, `the hull should have a few corners, has ${count}`);
            await page.until(`[...document.querySelectorAll('svg title')].filter(t => t.textContent === 'Click to add a point here').length === ${count}`, 60, 'its edges');
            assert(await page.ev(redEdges) === 0, 'a hull of key corners should have no almost straight edge');
            const edge = await page.ev(`(() => { const l = [...document.querySelectorAll('svg title')].find(t => t.textContent === 'Click to add a point here').parentElement;
                const p = new DOMPoint((+l.getAttribute('x1') + +l.getAttribute('x2')) / 2, (+l.getAttribute('y1') + +l.getAttribute('y2')) / 2).matrixTransform(l.getScreenCTM()); return [p.x, p.y] })()`);
            await page.click(edge);
            await page.until(`jsyaml.load(${config}).outlines.e2e_hull[0].points.length === ${count + 1}`, 30, 'a point to be added');
            await page.key('Delete', 'Delete', 46);
            await page.until(`jsyaml.load(${config}).outlines.e2e_hull[0].points.length === ${count}`, 30, 'the point to be deleted');
        },
    },
    {
        name: 'outlines: a new drawn outline starts drawing in the layout editor',
        async run(page, {url}) {
            await freshApp(page, url);
            await page.until(`!!document.querySelector('button[title="A new outline"]')`, 60, 'the Outlines section');
            await pressNew(page, 'outline');
            await page.ev(`document.querySelector('input[placeholder="outline name"]').focus()`);
            await page.type('e2e_drawn');
            await page.press('Draw');
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Finish' && b.disabled)`, 60, 'drawing to start');
            assert(await page.ev(`${outlineMenu}.disabled`), 'the outline menu should wait while drawing');
            await page.press('Cancel');
            assert(!(await parsed(page)).outlines.e2e_drawn, 'nothing should be written until it is finished');
        },
    },
    {
        name: 'outlines: deleting an outline deletes what uses it',
        async run(page, {url}) {
            await freshApp(page, url);
            // an outline that a case part cuts out
            const config0 = await parsed(page);
            const used = Object.keys(config0.outlines).find(name => name !== 'board' && Object.values(config0.cases ?? {})
                .some(parts => Array.isArray(parts) && parts.some(p => p.what === 'outline' && p.name === name)));
            assert(used, 'the example should have an outline a case uses');
            await openLayout(page);
            await pick(page, used);
            await page.press('Delete outline');
            await page.until(`!jsyaml.load(${config}).outlines[${JSON.stringify(used)}]`, 30, `${used} to be deleted`);
            const after = await parsed(page);
            const left = Object.values(after.cases ?? {}).some(parts => Array.isArray(parts) && parts.some(p => p.what === 'outline' && p.name === used));
            assert(!left, `no case part should still use ${used}`);
            assert(page.dialogs?.some(d => d.includes('It is used by')), 'the confirmation should say what uses it');
        },
    },
    {
        name: 'outlines: the panel folds away from the points it covers',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            await pick(page, 'board');
            await page.until(`!!document.querySelector('svg path[fill-rule="evenodd"]')`, 60, 'the board outline');
            // a point the panel is over: it can't be reached until the panel is folded
            const covered = `[...document.querySelectorAll('svg title')].filter(t => /^board\\.0\\.points\\[\\d+\\]$/.test(t.textContent)).map(t => t.parentElement)
                .filter(h => { const r = h.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) !== h; })`;
            const hidden = await page.ev(`${covered}.map(h => h.querySelector('title').textContent)`);
            assert(hidden.length > 0, 'the panel should cover some point of the board outline');
            await page.press('▾');
            assert(await page.ev(`${covered}.length`) === 0, 'with the panel folded every point should be reachable');
            const label = hidden[0];
            const index = Number(/\[(\d+)\]/.exec(label)[1]);
            const before = JSON.stringify((await points(page, 'board'))[index].shift);
            const handle = await page.titled(label);
            await page.drag(handle, [handle[0] + 20, handle[1] + 20]);
            await page.until(`JSON.stringify(jsyaml.load(${config}).outlines.board[0].points[${index}].shift) !== ${JSON.stringify(before)}`, 30, `${label} to move`);
            await page.press('▸');
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Delete outline')`, 10, 'the panel to open again');
        },
    },
];
