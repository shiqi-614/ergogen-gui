// Parts and the board outline in the KiCanvas pcb preview
import {assert, boardFootprint, config, freshApp, near, openPcb, parsed, reachableTitled, viewer, waitForBoard} from '../app.mjs';

const right = async page => (await parsed(page)).pcbs.ergo_cai_right;
// how many screen pixels a millimetre is on the board just now
const pxPerMm = page => page.ev(`(() => { const c = ${viewer}.viewport.camera; return c.world_to_screen({x: 10, y: 0}).x - c.world_to_screen({x: 0, y: 0}).x })() / 10`);

const editParts = async (page, tab) => {
    await openPcb(page, 'ergo_cai_right');
    await page.press('Edit parts');
    await page.press(tab);
};

const ARROWS = {ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40};
const arrow = (page, key, shift = false) => page.key(key, key, ARROWS[key], shift ? 8 : 0);

export const tests = [
    {
        name: 'pcb: dragging a module box moves the module on the board',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Modules');
            const before = await boardFootprint(page, 'USB_J1');
            const shift = (await right(page)).modules.usb.where.shift;
            const box = await page.titled('modules.usb:');
            const scale = await pxPerMm(page);
            await page.drag(box, [box[0] + 40, box[1]]);
            await waitForBoard(page, 'USB_J1', before);
            const after = await boardFootprint(page, 'USB_J1');
            const moved = (await right(page)).modules.usb.where.shift;
            near(after[0] - before[0], 40 / scale, 0.1, 'USB_J1 should move as far as the box was dragged');
            near(after[1], before[1], 1e-6, 'USB_J1 should stay at the same height');
            near(Number(moved[0]) - Number(shift[0]), after[0] - before[0], 0.01, 'the shift should change by the move');
        },
    },
    {
        name: 'pcb: a module is added with a click and deleted in its card',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Modules');
            const boxes = await page.ev(`document.querySelectorAll('svg polygon.module').length`);
            await page.press('+ Add module');
            await page.ev(`document.querySelector('input[placeholder="module name"]').focus()`);
            await page.type('e2e_mod');
            await page.press('Place');
            const usb = await page.titled('modules.usb:');
            await page.click([usb[0] - 40, usb[1] + 40]);
            await page.until(`!!jsyaml.load(${config}).pcbs.ergo_cai_right.modules.e2e_mod`, 30, 'the new module');
            const added = (await right(page)).modules.e2e_mod.where;
            assert(typeof added.ref === 'string' && added.shift.length === 2, `it should be placed from a key: ${JSON.stringify(added)}`);
            await page.until(`document.querySelectorAll('svg polygon.module').length === ${boxes + 1}`, 120, 'its box');
            // picked, it is deleted in the card
            await page.click(await page.titled('modules.e2e_mod:'));
            await page.until(`!!document.querySelector('button[title="Delete module e2e_mod"]')`, 10, 'its card');
            await page.ev(`document.querySelector('button[title="Delete module e2e_mod"]').click()`);
            await page.until(`!jsyaml.load(${config}).pcbs.ergo_cai_right.modules.e2e_mod`, 30, 'the module to be deleted');
        },
    },
    {
        name: 'pcb: footprints that follow keys move together, each on its key',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Footprints');
            const [d1, d5] = [await boardFootprint(page, 'D1'), await boardFootprint(page, 'D5')];
            const adjust = (await right(page)).footprints.diodes.adjust;
            const diode = await reachableTitled(page, 'footprints.diodes');
            await page.click(diode);
            await page.until(`document.querySelectorAll('svg polygon.footprint.chosen').length > 30`, 10, 'every diode to be picked');
            await page.drag(diode, [diode[0], diode[1] + 30]);
            await waitForBoard(page, 'D1', d1);
            const moved = (await right(page)).footprints.diodes.adjust;
            assert(JSON.stringify(moved.shift) !== JSON.stringify(adjust.shift), 'adjust.shift should change');
            assert(moved.rotate === adjust.rotate, 'adjust.rotate should stay');
            const [d1b, d5b] = [await boardFootprint(page, 'D1'), await boardFootprint(page, 'D5')];
            near(d1b[0] - d1[0], d5b[0] - d5[0], 0.01, 'D1 and D5 (both on unturned keys) should move alike in x');
            near(d1b[1] - d1[1], d5b[1] - d5[1], 0.01, 'and in y');
            assert(Math.hypot(d1b[0] - d1[0], d1b[1] - d1[1]) > 1, 'they should have moved');
        },
    },
    {
        name: 'pcb: the keys a footprint is on are clicked in and out',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Footprints');
            const where = (await right(page)).footprints.stab.where;
            await page.click(await page.titled('footprints.stab'));
            await page.press('Choose keys');
            await page.until(`document.querySelectorAll('svg circle.key.member').length === ${where.length}`, 10, 'the keys stab is on');
            await page.click(await page.titled('matrix_col3_row2:'));
            await page.until(`jsyaml.load(${config}).pcbs.ergo_cai_right.footprints.stab.where.includes('matrix_col3_row2')`, 30, 'the key to be added');
            await page.until(`!!document.querySelector('svg circle.key')`, 120, 'the keys again');
            await page.click(await page.titled('matrix_col3_row2:'));
            await page.until(`JSON.stringify(jsyaml.load(${config}).pcbs.ergo_cai_right.footprints.stab.where) === ${JSON.stringify(JSON.stringify(where))}`, 30, 'the key to be taken off');
        },
    },
    {
        name: 'pcb: a footprint on every key (where: true) has its keys chosen too, written out as a list',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Footprints');
            assert((await right(page)).footprints.keys1.where === true, 'the example should have keys1 on every key');
            // from the list: on the board, a mounting hole sits on one of its keys
            await page.ev(`[...document.querySelectorAll('span')].find(e => e.textContent === 'keys1').click()`);
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Choose keys')`, 10, 'keys1 to be picked');
            await page.press('Choose keys');
            await page.until(`document.querySelectorAll('svg circle.key.member').length > 10`, 10, 'the keys keys1 is on');
            const members = await page.ev(`[...document.querySelectorAll('svg circle.key.member')].map(c => c.querySelector('title').textContent.split(':')[0])`);
            const off = members[0];
            await page.click(await page.titled(`${off}:`));
            await page.until(`Array.isArray(jsyaml.load(${config}).pcbs.ergo_cai_right.footprints.keys1.where)`, 30, 'the keys to be written as a list');
            const where = (await right(page)).footprints.keys1.where;
            assert(!where.includes(off) && where.length === members.length - 1, `keys1 should be on all but ${off}: ${where}`);
        },
    },
    {
        name: 'pcb: an outline is checked into the board edge and out again',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Board edge');
            const names = await page.ev(`[...document.querySelectorAll('label')].filter(l => l.querySelector('input[type=checkbox]') && !l.querySelector('input').checked).map(l => l.textContent)`);
            assert(names.length, 'some outline should not be in the board edge yet');
            const name = names[names.length - 1];
            const entries = async () => Object.values((await right(page)).outlines ?? {}).map(e => e.outline);
            const before = await entries();
            await page.ev(`[...document.querySelectorAll('label')].find(l => l.textContent === ${JSON.stringify(name)}).scrollIntoView({block: 'center'})`);
            await page.click(await page.center(`[...document.querySelectorAll('label')].find(l => l.textContent === ${JSON.stringify(name)})`));
            await page.until(`Object.values(jsyaml.load(${config}).pcbs.ergo_cai_right.outlines).some(e => e.outline === ${JSON.stringify(name)})`, 30, `${name} in the board edge`);
            await page.until(`[...document.querySelectorAll('label')].some(l => l.textContent === ${JSON.stringify(name)} && l.querySelector('input').checked)`, 120, 'its box checked');
            await page.ev(`[...document.querySelectorAll('label')].find(l => l.textContent === ${JSON.stringify(name)}).scrollIntoView({block: 'center'})`);
            await page.click(await page.center(`[...document.querySelectorAll('label')].find(l => l.textContent === ${JSON.stringify(name)})`));
            await page.until(`!Object.values(jsyaml.load(${config}).pcbs.ergo_cai_right.outlines).some(e => e.outline === ${JSON.stringify(name)})`, 30, `${name} out of the board edge`);
            assert(JSON.stringify(await entries()) === JSON.stringify(before), 'the board edge should be back as it was');
            await page.ev(`document.querySelector('button[title="Fold the card away"]').click()`);
            await page.until(`![...document.querySelectorAll('label')].some(l => l.querySelector('input[type=checkbox]'))`, 10, 'the list to fold');
            await page.ev(`document.querySelector('button[title="Show the card"]').click()`);
            await page.until(`[...document.querySelectorAll('label')].some(l => l.querySelector('input[type=checkbox]'))`, 10, 'the list to open again');
        },
    },
    {
        name: 'pcb: a picked module moves with the arrow keys and turns with [ ]',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Modules');
            const before = await boardFootprint(page, 'USB_J1');
            const where = (await right(page)).modules.usb.where;
            await page.click(await page.titled('modules.usb:'));
            await page.until(`!!document.querySelector('svg polygon.module.chosen')`, 10, 'usb to be picked');
            for (let i = 0; i < 3; i++) await arrow(page, 'ArrowRight');
            await arrow(page, 'ArrowUp', true);
            await page.key(']', 'BracketRight', 221);
            await page.until(`(() => { const w = jsyaml.load(${config}).pcbs.ergo_cai_right.modules.usb.where; return w.rotate === -5 && Math.abs(Number(w.shift[1]) - ${Number(where.shift[1]) + 1}) < 1e-6 })()`,
                30, 'usb to be moved and turned');
            const moved = (await right(page)).modules.usb.where;
            near(Number(moved.shift[0]), Number(where.shift[0]) + 0.3, 1e-6, 'three steps right are 0.3 mm');
            await waitForBoard(page, 'USB_J1', before);
            await page.until(`(() => { const f = ${viewer}?.board?.footprints.find(f => f.reference === 'USB_J1'); return f && Math.abs(f.at.rotation - (${before[2]} - 5)) < 1e-6 })()`, 120, 'USB_J1 to turn');
            const after = await boardFootprint(page, 'USB_J1');
            near(after[0] - before[0], 0.3, 1e-6, 'USB_J1 should move 0.3 mm right');
            near(after[1] - before[1], -1, 1e-6, 'and 1 mm up');
        },
    },
    {
        name: 'pcb: exact values typed for a footprint are written as typed',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Footprints');
            await page.click(await reachableTitled(page, 'footprints.diodes'));
            const box = label => `[...document.querySelectorAll('label.field')].find(l => l.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('input')`;
            await page.until(`!!${box('Shift X')}`, 10, 'the x box');
            assert(await page.ev(`${box('Shift X')}.value`) === String((await right(page)).footprints.diodes.adjust.shift[0]), 'the x box should show the shift as written');
            for (const [label, value] of [['Shift X', '1.5'], ['Rotate', '90']]) {
                await page.ev(`(() => { const i = ${box(label)}; i.focus(); i.select(); })()`);
                await page.type(value);
                await page.key('Enter', 'Enter', 13);
                await page.until(`!!${box(label)}`, 120, 'the boxes again');
            }
            await page.until(`(() => { const a = jsyaml.load(${config}).pcbs.ergo_cai_right.footprints.diodes.adjust; return a.shift[0] === 1.5 && a.rotate === 90 })()`, 30, 'the typed values');
        },
    },
];
