// New and deleted pcbs and assemblies, from the Downloads list's "+" and their own views
import {assert, config, freshApp, parsed, pressNew} from '../app.mjs';

const dialogBox = placeholder => `document.querySelector('[role="dialog"] input[placeholder="${placeholder}"]')`;
const check = (page, label) => page.ev(`[...document.querySelectorAll('[role="dialog"] .checks label')].find(l => l.textContent.trim().replace(/\\d+$/, '').trim() === ${JSON.stringify(label)}).querySelector('input').click()`);

export const tests = [
    {
        name: 'boards: a new pcb is copied and mirrored, and deleted with its mirror',
        async run(page, {url}) {
            await freshApp(page, url);
            await pressNew(page, 'PCB');
            await page.ev(`${dialogBox('pcb name')}.focus()`);
            await page.type('test_right');
            assert(await page.ev(`${dialogBox('its mirrored name')}.value`) === 'test_left', 'the mirrored pcb should be test_left');
            await page.press('Add');
            await page.until(`!!jsyaml.load(${config}).pcbs.test_right`, 30, 'the new pcb');
            const c = await parsed(page);
            assert(JSON.stringify(Object.keys(c.pcbs.test_right.footprints)) === JSON.stringify(Object.keys(c.pcbs.ergo_cai_right.footprints)),
                "test_right should have ergo_cai_right's footprints");
            assert(c.pcbs.test_left?.mirror?.from === 'test_right', 'test_left should mirror test_right');
            await page.until(`!![...document.querySelectorAll('button')].find(b => b.textContent === 'Delete PCB')`, 180, 'its board');
            await page.press('Delete PCB');
            await page.until(`!jsyaml.load(${config}).pcbs.test_right`, 30, 'test_right to go');
            assert(!(await parsed(page)).pcbs.test_left, 'test_left should go with it');
            assert(page.dialogs?.some(d => d.includes('the mirrored pcb test_left')), 'the confirmation should name the mirrored pcb');
        },
    },
    {
        name: 'boards: a new empty pcb, only an outline for its edge, is made',
        async run(page, {url}) {
            await freshApp(page, url);
            await pressNew(page, 'PCB');
            await page.ev(`${dialogBox('pcb name')}.focus()`);
            await page.type('test_right');
            await page.choose(`document.querySelector('[role="dialog"] select[title="how it starts"]')`, 'empty');
            await page.press('Add');
            await page.until(`!!jsyaml.load(${config}).pcbs.test_right`, 30, 'the new pcb');
            const c = await parsed(page);
            assert(JSON.stringify(c.pcbs.test_right) === JSON.stringify({outlines: {edge: {outline: 'board'}}}), `test_right: ${JSON.stringify(c.pcbs.test_right)}`);
            // ergogen makes a board without footprints or modules, and its mirror
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent === 'test_left.kicad_pcb')`, 180, 'both boards');
            assert(!(await page.ev(`/Error/.test(document.body.innerText)`)), 'there should be no error');
        },
    },
    {
        name: 'boards: a new assembly stacks a board with cases, for both halves, and is deleted',
        async run(page, {url}) {
            await freshApp(page, url);
            await pressNew(page, 'assembly');
            await page.ev(`${dialogBox('assembly name')}.focus()`);
            await page.type('test_right');
            await page.choose(`document.querySelector('[role="dialog"] select[title="the pcb it holds"]')`, 'ergo_cai_right');
            await check(page, 'right_buttom');
            await check(page, 'right_top');
            await page.choose(`document.querySelector('[role="dialog"] select[title^="the case whose top"]')`, 'right_buttom');
            await page.ev(`document.querySelector('[role="dialog"] input[title^="The same with"]').click()`);
            // a module board on the e-paper socket, 30 mm up
            await page.press('+ Part');
            await page.ev(`document.querySelector('[role="dialog"] .part input[placeholder="name"]').focus()`);
            await page.type('panel');
            await page.choose(`document.querySelector('[role="dialog"] .part select')`, 'e-paper');
            await page.ev(`document.querySelector('[role="dialog"] .part input.short').select()`);
            await page.type('30');
            await page.ev(`document.querySelector('[role="dialog"] .part input.model').focus()`);
            await page.type('github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb');
            await page.press('Add');
            await page.until(`!!jsyaml.load(${config}).assemblies.test_right`, 30, 'the new assembly');
            const {assemblies} = await parsed(page);
            const parts = [{name: 'panel', model: 'github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb', module: 'e-paper', z: 30}];
            assert(JSON.stringify(assemblies.test_right) === JSON.stringify({stack: ['right_buttom', 'right_top'], pcb: {name: 'ergo_cai_right', top: 'right_buttom'}, parts}),
                `test_right: ${JSON.stringify(assemblies.test_right)}`);
            assert(JSON.stringify(assemblies.test_left) === JSON.stringify({stack: ['left_buttom', 'left_top'], pcb: {name: 'ergo_cai_left', top: 'left_buttom'}, parts}),
                `test_left: ${JSON.stringify(assemblies.test_left)}`);
            await page.until(`!![...document.querySelectorAll('button')].find(b => b.textContent === 'Delete assembly')`, 180, 'its 3D view');
            await page.press('Delete assembly');
            await page.until(`!jsyaml.load(${config}).assemblies.test_right`, 30, 'test_right to go');
            const after = await parsed(page);
            assert(after.assemblies.test_left && after.pcbs.ergo_cai_right && after.cases.right_top, 'only the assembly should go');
        },
    },
    {
        name: "boards: an assembly's parts are set, added and deleted in its 3D view",
        async run(page, {url}) {
            await freshApp(page, url);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Assemblies'))?.click()`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'ergocai_right')?.click()`);
            await page.until(`document.body.textContent.includes('Parts of ergocai_right: 1')`, 120, 'the parts panel');
            const parts = `jsyaml.load(${config}).assemblies.ergocai_right.parts`;
            const box = (i, cls) => `document.querySelectorAll('.part')[${i}].querySelector('input.${cls}')`;
            await page.ev(`${box(0, 'z')}.select()`);
            await page.type('31');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${parts}[0].z === 31`, 30, 'the height to be written');
            await page.press('+ Part');
            await page.until(`${parts}.length === 2`, 30, 'a second part');
            await page.until(`document.querySelectorAll('.part').length === 2`, 30, 'its line');
            await page.ev(`${box(1, 'model')}.focus()`);
            await page.type('github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${parts}[1].model === 'github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb'`, 30, 'its model');
            await page.ev(`document.querySelector('button[title="Delete part #1"]').click()`);
            await page.until(`${parts}.length === 1 && ${parts}[0].name === 'e-paper'`, 30, 'the second part to go');
        },
    },
];
