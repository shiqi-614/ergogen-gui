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
const CTRL = 2;

const camera = page => page.ev(`(() => { const c = ${viewer}.viewport.camera; return {x: c.center.x, y: c.center.y, zoom: c.zoom} })()`);
// a point of the board with nothing over it: no box, none of KiCanvas's own buttons
const bareSpot = page => page.ev(`(() => {
    const deepest = (x, y) => { let root = document, hit = null; for (;;) { const next = root.elementFromPoint(x, y); if (!next || next === hit || !next.shadowRoot) return next ?? hit; hit = next; root = next.shadowRoot; } };
    const r = ${viewer}.canvas.getBoundingClientRect();
    for (let y = r.top + 50; y < r.bottom - 50; y += 20) for (let x = r.left + 50; x < r.right - 50; x += 20) {
        if (document.elementFromPoint(x, y)?.tagName === 'KICANVAS-EMBED' && ['CANVAS', 'KC-UI-FOCUS-OVERLAY'].includes(deepest(x, y)?.tagName)) return [x, y];
    }
    return null;
})()`);

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
            // every frame until the new board is on show: a board shown, no loading cover over it, and the corner note
            // that it is being updated
            await page.ev(`(() => { window.__blank = 0; window.__updating = 0; const look = () => {
                const shown = [...document.querySelectorAll('kicanvas-embed')].filter(e => e.style.visibility !== 'hidden').length;
                if (!shown || document.body.textContent.includes('Loading the PCB preview')) window.__blank++;
                if (document.body.textContent.includes('Updating the board…')) window.__updating++;
                window.__looking = requestAnimationFrame(look);
            }; look(); })()`);
            await page.drag(box, [box[0] + 40, box[1]]);
            await waitForBoard(page, 'USB_J1', before);
            assert(await page.ev(`(() => { cancelAnimationFrame(window.__looking); return window.__blank })()`) === 0,
                'the board should stay on show while the next one is made, with no loading cover');
            assert(await page.ev(`window.__updating`) > 0, 'a note should say the board is being updated');
            await page.until(`!document.body.textContent.includes('Updating the board…')`, 30, 'the note to go once the board is updated');
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
            await page.press('+ Module');
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
            await page.until(`(() => { const w = jsyaml.load(${config}).pcbs.ergo_cai_right.modules.usb.where; return Math.abs(Number(w.shift[1]) - ${Number(where.shift[1]) + 1}) < 1e-6 })()`,
                30, 'usb to be moved');
            const moved = (await right(page)).modules.usb.where;
            near(Number(moved.shift[0]), Number(where.shift[0]) + 0.3, 1e-6, 'three steps right are 0.3 mm');
            await waitForBoard(page, 'USB_J1', before);
            const after = await boardFootprint(page, 'USB_J1');
            near(after[0] - before[0], 0.3, 1e-6, 'USB_J1 should move 0.3 mm right');
            near(after[1] - before[1], -1, 1e-6, 'and 1 mm up');
            // then turned, about the module's point, which USB_J1 is not on: only its turn is checked
            await page.until(`!!document.querySelector('svg polygon.module.chosen')`, 120, 'usb still picked');
            await page.key(']', 'BracketRight', 221);
            await page.until(`jsyaml.load(${config}).pcbs.ergo_cai_right.modules.usb.where.rotate === -5`, 30, 'usb to be turned');
            await page.until(`(() => { const f = ${viewer}?.board?.footprints.find(f => f.reference === 'USB_J1'); return f && Math.abs(f.at.rotation - (${before[2]} - 5)) < 1e-6 })()`, 120, 'USB_J1 to turn');
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
    {
        name: 'pcb: the wheel and the right button zoom and pan the board over the boxes being edited, also after an edit',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Modules');
            // KiCanvas's own controls (its defaults): Ctrl + wheel, a trackpad's pinch, zooms; the wheel scrolls; the right
            // button drags
            const zoomsAt = async (at, what) => {
                const before = await camera(page);
                await page.wheel(at, -120, CTRL);
                await page.until(`${viewer}.viewport.camera.zoom > ${before.zoom * 1.05}`, 5, `Ctrl + wheel ${what} to zoom in`);
            };
            const usb = await page.titled('modules.usb:');
            await zoomsAt(usb, 'over the usb box');
            let before = await camera(page);
            await page.wheel(await page.titled('modules.usb:'), 120);
            await page.until(`Math.abs(${viewer}.viewport.camera.center.y - ${before.y}) > 1`, 5, 'the wheel over the usb box to scroll the board');
            before = await camera(page);
            const at = await page.titled('modules.usb:');
            await page.drag(at, [at[0] + 80, at[1]], {button: 'right'});
            await page.until(`Math.abs(${viewer}.viewport.camera.center.x - ${before.x}) > 1`, 5, 'a right-button drag over the usb box to pan the board');
            assert(!(await page.ev(`!!document.querySelector('svg polygon.module.chosen')`)), 'the right button should pick nothing');
            // after an edit the board is made again, in a new KiCanvas: it zooms at once, with no click on it first
            await page.click(await page.titled('modules.usb:'));
            await page.until(`!!document.querySelector('svg polygon.module.chosen')`, 10, 'usb to be picked');
            const fp = await boardFootprint(page, 'USB_J1');
            await arrow(page, 'ArrowRight');
            await waitForBoard(page, 'USB_J1', fp);
            const bare = await bareSpot(page);
            assert(bare, 'there should be a point of the board with nothing over it');
            await zoomsAt(bare, 'on the board, beside the boxes,');
            await zoomsAt(await page.titled('modules.usb:'), 'over the usb box');
            await page.press('Footprints');
            await page.until(`document.querySelectorAll('svg polygon.footprint').length > 30`, 10, 'the footprints\' boxes');
            await zoomsAt(await reachableTitled(page, 'footprints.keys1'), 'over a key');
        },
    },
    {
        name: 'pcb: a module inside a bigger module\'s box is picked where it is, and a click again picks the one under it',
        async run(page, {url}) {
            await freshApp(page, url);
            // RowStaggerSplit's inner strip: the MCU, on the back, inside the boxes of the 18650 and of the e-paper, which
            // comes last in the config
            await page.click(await page.center(`document.querySelector('.example-menu__control')`, 'the example menu'));
            await page.click(await page.center(`[...document.querySelectorAll('.example-menu__option')].find(o => o.textContent === 'RowStaggerSplit')`, 'RowStaggerSplit'));
            await page.until(`${config}.includes('row_stagger_left')`, 30, 'RowStaggerSplit in the editor');
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ PCBs'))?.click()`);
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('row_stagger_left') && b.textContent.includes('kicad_pcb'))`, 120, 'its boards');
            await openPcb(page, 'row_stagger_left');
            await page.press('Edit parts');
            await page.press('Modules');
            const mcu = await page.titled('modules.mcu:');
            const picked = `document.querySelector('svg polygon.module.chosen')?.querySelector('title').textContent.split(':')[0]`;
            // the smallest first, then each one under it, and round again
            for (const next of ['mcu', 'battery', 'e-paper', 'mcu']) {
                await page.click(mcu);
                await page.until(`${picked} === ${JSON.stringify(`modules.${next}`)}`, 10, `a click on the MCU's middle to pick ${next}, not ${await page.ev(picked)}`);
            }
            // picked, it is dragged from where it is, and the e-paper over it stays
            const modules = async () => (await parsed(page)).pcbs.row_stagger_left.modules;
            const before = await modules();
            await page.drag(mcu, [mcu[0], mcu[1] + 40]);
            await page.until(`JSON.stringify(jsyaml.load(${config}).pcbs.row_stagger_left.modules.mcu.where.shift) !== ${JSON.stringify(JSON.stringify(before.mcu.where.shift))}`, 30, 'the MCU to be moved');
            assert(JSON.stringify((await modules())['e-paper'].where) === JSON.stringify(before['e-paper'].where), 'the e-paper should stay where it is');
        },
    },
    {
        name: 'pcb: a moved module\'s box goes to its new place at once and stays there until the board is made again',
        async run(page, {url}) {
            await freshApp(page, url);
            await editParts(page, 'Modules');
            await page.click(await page.titled('modules.usb:'));
            await page.until(`!!document.querySelector('svg polygon.module.chosen')`, 10, 'usb to be picked');
            const scale = await pxPerMm(page);
            // the usb box's left edge on screen, from where the board's origin is (a new board settles its view by a pixel
            // or so as it comes), null while the box is not drawn
            const left = `(() => { const box = document.querySelector('svg polygon.module.chosen'); const v = ${viewer};
                return box ? box.getBoundingClientRect().left - v.viewport.camera.world_to_screen({x: 0, y: 0}).x - v.canvas.getBoundingClientRect().left : null })()`;
            // every frame from the edit on, the box is where the edit put it, until the board made again has USB_J1 there too
            const moves = async (edit, dx, what) => {
                const fp = await boardFootprint(page, 'USB_J1');
                const to = await page.ev(left) + dx * scale;
                await page.ev(`(() => { window.__frames = []; const look = () => {
                    window.__frames.push([performance.now(), ${left}]);
                    window.__watching = requestAnimationFrame(look);
                }; look(); })()`);
                await edit();
                const done = await page.ev(`performance.now()`);
                await waitForBoard(page, 'USB_J1', fp);
                await page.until(`!document.body.textContent.includes('Updating the board…')`, 60, 'the board to be updated');
                const frames = (await page.ev(`(() => { cancelAnimationFrame(window.__watching); return window.__frames })()`)).filter(([t]) => t >= done);
                const off = frames.filter(([, x]) => x === null || Math.abs(x - to) > 1.5);
                assert(frames.length > 5 && !off.length, `${what}: from the edit on the usb box should be at ${to.toFixed(1)}; ${off.length} of ${frames.length} frames had it at ${JSON.stringify([...new Set(off.map(([, x]) => x === null ? null : +x.toFixed(1)))].slice(0, 5))}`);
                near((await boardFootprint(page, 'USB_J1'))[0] - fp[0], dx, 0.06, `${what}: USB_J1 should be where the box went`);
                // and once the view has settled, the box is where the board has USB_J1
                await page.until(`Math.abs(${left} - ${to}) < 0.6`, 5, `${what}: the box to be where the board has USB_J1`);
            };
            await moves(async () => { for (let i = 0; i < 3; i++) await arrow(page, 'ArrowRight', true); }, 3, 'three steps of 1 mm');
            const box = await page.titled('modules.usb:');
            await moves(() => page.drag(box, [box[0] - 40, box[1]]), -40 / scale, 'a drag');
            const input = `[...document.querySelectorAll('label.field')].find(l => l.textContent.startsWith('Shift X'))?.querySelector('input')`;
            await page.until(`!!${input}`, 10, 'the x box');
            const x = Number(await page.ev(`${input}.value`));
            await page.ev(`(() => { const i = ${input}; i.focus(); i.select(); })()`);
            await page.type(String(Number((x - 5).toFixed(2))));
            await moves(() => page.key('Enter', 'Enter', 13), -5, 'a typed Shift X');
        },
    },
];
