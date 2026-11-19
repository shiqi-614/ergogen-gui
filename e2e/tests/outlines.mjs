// Outlines in the layout editor
import {assert, config, freshApp, near, openLayout, outlineMenu, parsed, pressNew} from '../app.mjs';

// an outline from the menu, once the layout editor has it (it reads the config again after an edit)
const pick = async (page, name) => {
    await page.until(`[...${outlineMenu}.options].some(o => o.value === ${JSON.stringify(name)})`, 60, `${name} in the outline menu`);
    await page.choose(outlineMenu, name);
};
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
            // from the + beside the layout editor's outline menu
            await openLayout(page);
            await page.until(`!!document.querySelector('button[title="A new outline"]')`, 60, 'the + of the outline menu');
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
        name: 'outlines: an outline part (outlines.expand: board, expanded) has its outline and expand set in the panel',
        async run(page, {url}) {
            await freshApp(page, url);
            const part = async () => (await parsed(page)).outlines.expand[0];
            assert((await part()).name === 'board', 'the example should have outlines.expand made of board');
            await openLayout(page);
            await pick(page, 'expand');
            const menu = `[...document.querySelectorAll('select')].find(s => s.title === 'the outline this part is made of')`;
            await page.until(`${menu}?.value === 'board'`, 30, 'the outline it is made of');
            await page.choose(menu, 'cut');
            await page.until(`jsyaml.load(${config}).outlines.expand[0].name === 'cut'`, 30, 'its outline to be written');
            await page.choose(menu, 'board');
            await page.until(`jsyaml.load(${config}).outlines.expand[0].name === 'board'`, 30, 'and back');
            const box = `[...document.querySelectorAll('input[placeholder="0"]')].find(i => i.value === '8')`;
            await page.until(`!!${box}`, 30, 'its expand of 8');
            await page.ev(`${box}.select()`);
            await page.type('6');
            await page.key('Enter', 'Enter', 13);
            await page.until(`jsyaml.load(${config}).outlines.expand[0].expand === 6`, 30, 'its expand to be written');
        },
    },
    {
        name: "outlines: a point's shift, a where's ref and a template's args are typed in the panel",
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            const typeInto = async (input, value) => {
                await page.ev(`${input}.scrollIntoView({block: 'center'}); ${input}.select()`);
                await page.type(value);
                await page.key('Enter', 'Enter', 13);
            };
            const boxes = `[...document.querySelectorAll('input.anchor')]`;
            const menus = `[...document.querySelectorAll('select.anchor')]`;
            // a polygon's point: its y (point 0's x and y are the first boxes), an expression kept as typed
            await pick(page, 'usb_and_swith');
            await page.until(`${boxes}.length >= 16 && ${menus}.length >= 8`, 30, 'the boxes of its points');
            await typeInto(`${boxes}[1]`, '1ky + 6 + funnelLip + funnelDepth');
            await page.until(`jsyaml.load(${config}).outlines.usb_and_swith[0].points[0].shift[1] === '1ky + 6 + funnelLip + funnelDepth'`, 30, 'its y to be written');
            // its ref, from the menu of points
            await page.choose(`${menus}[0]`, 'matrix_col2_row0');
            await page.until(`jsyaml.load(${config}).outlines.usb_and_swith[0].points[0].ref === 'matrix_col2_row0'`, 30, 'its ref to be written');
            // a point more, and that one deleted again
            const count = `jsyaml.load(${config}).outlines.usb_and_swith[0].points.length`;
            await page.ev(`[...document.querySelectorAll('button.add')][0].click()`);
            await page.until(`${count} === 5`, 30, 'a fifth point');
            await page.until(`!!document.querySelector('button[title="Delete point 4"]')`, 30, 'its row');
            await page.ev(`document.querySelector('button[title="Delete point 4"]').click()`);
            await page.until(`${count} === 4`, 30, 'the point to go');
            // a template's part: the ref of its where, written as the list it was
            await pick(page, '_pcb_mounts');
            await page.until(`document.body.textContent.includes('A template, of __what__, __radius__')`, 30, 'the template');
            await page.until(`${menus}.some(m => m.value === 'matrix_col0_row0')`, 30, 'the ref of pcb_pos1');
            await page.choose(`${menus}.find(m => m.value === 'matrix_col0_row0')`, 'matrix_col1_row0');
            await page.until(`JSON.stringify(jsyaml.load(${config}).outlines._pcb_mounts.pcb_pos1.where.ref) === '["matrix_col1_row0"]'`, 30, 'its ref to be written');
            // an outline filled in from it: its args, and the way back to the template
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent === 'pcb_stud_mounting').click()`);
            await page.until(`${outlineMenu}.value === 'pcb_stud_mounting'`, 10, 'pcb_stud_mounting to open');
            await page.until(`${boxes}.some(i => i.value === 'studSize')`, 30, 'its args');
            await typeInto(`${boxes}.find(i => i.value === 'studSize')`, 'screwSize');
            await page.until(`jsyaml.load(${config}).outlines.pcb_stud_mounting.$args[1] === 'screwSize'`, 30, 'its arg to be written');
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent === '_pcb_mounts').click()`);
            await page.until(`${outlineMenu}.value === '_pcb_mounts'`, 10, 'the template to open');
        },
    },
    {
        name: 'outlines: a part pointed at in the panel lights up where its points are, not mirrored',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            await pick(page, 'board');
            await page.until(`[...document.querySelectorAll('svg title')].some(t => /^board\\.0\\.points\\[\\d+\\]$/.test(t.textContent))`, 60, 'its points');
            await page.ev(`[...document.querySelectorAll('div')].find(d => d.querySelector(':scope > div > span[title="board.0"]'))
                .dispatchEvent(new MouseEvent('mouseover', {bubbles: true}))`);
            const lit = `document.querySelector('polygon[stroke-dasharray="2 1"]')`;
            await page.until(`!!${lit}`, 10, 'the part to light up');
            const [litBox, pointsBox] = await page.ev(`(() => {
                const r = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
                const hs = [...document.querySelectorAll('svg title')].filter(t => /^board\\.0\\.points\\[\\d+\\]$/.test(t.textContent)).map(t => r(t.parentElement));
                return [r(${lit}), [Math.min(...hs.map(h => h[0])), Math.min(...hs.map(h => h[1])), Math.max(...hs.map(h => h[2])), Math.max(...hs.map(h => h[3]))]];
            })()`);
            for (let i = 0; i < 4; i++) near(litBox[i], pointsBox[i], 4, `the lit part's edge ${i} should be at its points'`);
        },
    },
    {
        name: 'outlines: a new drawn outline starts drawing in the layout editor',
        async run(page, {url}) {
            await freshApp(page, url);
            await openLayout(page);
            await page.until(`!!document.querySelector('button[title="A new outline"]')`, 60, 'the + of the outline menu');
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
            // from the Delete in the outline's own panel
            await openLayout(page);
            await pick(page, used);
            await page.until(`!!document.querySelector('button[title="Delete outline ${used}"]')`, 60, `the panel of ${used}`);
            await page.ev(`document.querySelector('button[title="Delete outline ${used}"]').click()`);
            await page.until(`!![...document.querySelectorAll('[role="dialog"] .buttons button')].find(b => b.textContent === 'Delete')`, 10, 'the confirmation');
            const said = await page.ev(`document.querySelector('[role="dialog"]').innerText`);
            await page.ev(`[...document.querySelectorAll('[role="dialog"] .buttons button')].find(b => b.textContent === 'Delete').click()`);
            await page.until(`!jsyaml.load(${config}).outlines[${JSON.stringify(used)}]`, 30, `${used} to be deleted`);
            const after = await parsed(page);
            const left = Object.values(after.cases ?? {}).some(parts => Array.isArray(parts) && parts.some(p => p.what === 'outline' && p.name === used));
            assert(!left, `no case part should still use ${used}`);
            assert(said.includes('These go with it'), `the confirmation should say what uses it: ${said}`);
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
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent === '▾')`, 10, 'the panel to open again');
        },
    },
];
