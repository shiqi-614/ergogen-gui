// New and deleted pcbs and assemblies, from the Downloads list's "+" and their own views
import {assert, config, freshApp, parsed, pressNew, deleteFromList} from '../app.mjs';

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
            await page.until(`!!document.querySelector('kicanvas-embed[loaded]')`, 180, 'its board');
            const said = await deleteFromList(page, 'PCBs', 'test_right');
            await page.until(`!jsyaml.load(${config}).pcbs.test_right`, 30, 'test_right to go');
            assert(!(await parsed(page)).pcbs.test_left, 'test_left should go with it');
            assert(said.includes('the mirrored pcb test_left'), `the confirmation should name the mirrored pcb: ${said}`);
            assert(await page.ev(`!document.querySelector('kicanvas-embed')`), 'the preview should leave the deleted board');
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
            const parts = [{name: 'panel', model: 'github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb', at_module: 'e-paper', z: 30}];
            assert(JSON.stringify(assemblies.test_right) === JSON.stringify({stack: ['right_buttom', 'right_top'], pcb: {name: 'ergo_cai_right', top: 'right_buttom'}, parts}),
                `test_right: ${JSON.stringify(assemblies.test_right)}`);
            assert(JSON.stringify(assemblies.test_left) === JSON.stringify({stack: ['left_buttom', 'left_top'], pcb: {name: 'ergo_cai_left', top: 'left_buttom'}, parts}),
                `test_left: ${JSON.stringify(assemblies.test_left)}`);
            await page.until(`!!document.querySelector('canvas')`, 180, 'its 3D view');
            await deleteFromList(page, 'Assemblies', 'test_right');
            await page.until(`!jsyaml.load(${config}).assemblies.test_right`, 30, 'test_right to go');
            const after = await parsed(page);
            assert(after.assemblies.test_left && after.pcbs.ergo_cai_right && after.cases.right_top, 'only the assembly should go');
        },
    },
    {
        name: "boards: an assembly's parts are set, added and deleted in its 3D view, on both halves when they match",
        async run(page, {url}) {
            await freshApp(page, url);
            const before = await parsed(page);
            const right0 = before.assemblies.ergocai_right.parts ?? [], left0 = before.assemblies.ergocai_left.parts ?? [];
            const n = right0.length;
            // the other half follows while both have the same parts, name for name
            const same = JSON.stringify(right0.map(p => p.name)) === JSON.stringify(left0.map(p => p.name));
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Assemblies'))?.click()`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'ergocai_right')?.click()`);
            // an assembly is 3D only: its card has the case's heights and, in a tab beside them, its parts
            await page.until(`[...document.querySelectorAll('[role="tab"]')].some(t => t.textContent === 'Parts')`, 120, 'the parts tab');
            assert(!(await page.ev(`!!document.querySelector('[aria-label="Board view"]')`)), 'an assembly should have no 2D view to switch to');
            await page.ev(`[...document.querySelectorAll('[role="tab"]')].find(t => t.textContent === 'Parts').click()`);
            await page.until(`document.body.textContent.includes('${n} part${n === 1 ? '' : 's'}: other 3D models')`, 30, 'the parts panel');
            assert(await page.ev(`document.querySelector('label input[type=checkbox][disabled]') === null`) === same,
                same ? 'both halves should be ticked' : 'the other half should be left alone');
            const parts = `jsyaml.load(${config}).assemblies.ergocai_right.parts`;
            const left = `(jsyaml.load(${config}).assemblies.ergocai_left.parts ?? [])`;
            const box = (i, cls) => `document.querySelectorAll('.part')[${i}].querySelector('input.${cls}')`;
            await page.ev(`${box(0, 'z')}.select()`);
            await page.type('31');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${parts}[0].z === 31`, 30, 'the height to be written');
            await page.until(`${left}[0]?.z ${same ? '===' : '!=='} 31`, 30, same ? 'the other half to follow' : 'the other half to stay');
            await page.press('+ Part');
            await page.until(`${parts}.length === ${n + 1} && ${left}.length === ${same ? n + 1 : left0.length}`, 30, 'a new part');
            assert((await parsed(page)).assemblies.ergocai_right.parts[n].at_module, 'a new part should sit at a module (at_module)');
            await page.until(`document.querySelectorAll('.part').length === ${n + 1}`, 30, 'its line');
            await page.ev(`${box(n, 'model')}.focus()`);
            await page.type('github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb');
            await page.key('Enter', 'Enter', 13);
            await page.until(`${parts}[${n}].model === 'github:shiqi-614/ErgoCai.modules/e-paper/2.13inch/2.13inch.glb'`, 30, 'its model');
            await page.ev(`document.querySelector('button[title="Delete part #${n}"]').click()`);
            await page.until(`${parts}.length === ${n} && ${left}.length === ${left0.length}`, 30, 'the new part to go');
            assert(JSON.stringify((await parsed(page)).assemblies.ergocai_right.parts.map(p => p.name)) === JSON.stringify(right0.map(p => p.name)),
                'the parts should be back as they were, but for the height');
        },
    },
    {
        name: "boards: a case is put on an assembly's stack and taken off it in its 3D view; the board's own stays",
        async run(page, {url}) {
            await freshApp(page, url);
            const stack = `jsyaml.load(${config}).assemblies.ergocai_right.stack.map(e => typeof e === 'string' ? e : e.name)`;
            const before = await page.ev(stack);
            const board = (await parsed(page)).assemblies.ergocai_right.pcb.top;
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Assemblies'))?.click()`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'ergocai_right')?.click()`);
            const menu = `document.querySelector('select[title="Put another case on top of the stack"]')`;
            await page.until(`!!${menu}`, 180, 'the menu of cases');
            const extra = await page.ev(`[...${menu}.options].map(o => o.value).find(v => v)`);
            assert(extra && !before.includes(extra), `the menu should offer a case not in the stack: ${extra}`);
            await page.choose(menu, extra);
            await page.until(`JSON.stringify(${stack}) === ${JSON.stringify(JSON.stringify([...before, extra]))}`, 30, `${extra} on top of the stack`);
            const remove = `document.querySelector('button[title^="Take ${extra} out"]')`;
            await page.until(`!!${remove}`, 180, `its row`);
            await page.ev(`${remove}.click()`);
            await page.until(`JSON.stringify(${stack}) === ${JSON.stringify(JSON.stringify(before))}`, 30, `${extra} off the stack again`);
            await page.until(`!!document.querySelector('button[title^="The board is placed by ${board}"]')`, 180, 'the rows again');
            assert(await page.ev(`document.querySelector('button[title^="The board is placed by ${board}"]').disabled`), `${board} holds the board: its × should be off`);
            // the bottom case up one, and back
            const [first, second] = before;
            await page.ev(`document.querySelector('button[title="Move ${first} up the stack"]').click()`);
            await page.until(`JSON.stringify(${stack}.slice(0, 2)) === ${JSON.stringify(JSON.stringify([second, first]))}`, 30, `${first} up one`);
            await page.until(`!!document.querySelector('button[title="Move ${first} down the stack"]') && !document.querySelector('button[title="Move ${first} down the stack"]').disabled`, 180, 'its row again');
            await page.ev(`document.querySelector('button[title="Move ${first} down the stack"]').click()`);
            await page.until(`JSON.stringify(${stack}) === ${JSON.stringify(JSON.stringify(before))}`, 30, `${first} back at the bottom`);
            // the board placed by another case's top, and back
            const placed = `jsyaml.load(${config}).assemblies.ergocai_right.pcb.top`;
            const placeMenu = `[...document.querySelectorAll('select')].find(s => (s.title || '').startsWith('the case part whose top'))`;
            await page.until(`!!${placeMenu}`, 180, 'the placement menu');
            await page.choose(placeMenu, first);
            await page.until(`${placed} === ${JSON.stringify(first)}`, 30, `the board level with ${first}`);
            await page.until(`!!${placeMenu}`, 180, 'the placement menu again');
            await page.choose(placeMenu, board);
            await page.until(`${placed} === ${JSON.stringify(board)}`, 30, `the board back level with ${board}`);
        },
    },
];
