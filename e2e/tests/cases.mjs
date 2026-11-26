// A case's parts, in its own preview (Project → Cases), and which 3D board view shows the case
import {assert, config, freshApp, openPcb, outlineMenu, parsed, pressNew, deleteFromList} from '../app.mjs';

const openCase = async (page, name) => {
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Cases'))?.click()`);
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(`${name}.stl`)})?.click()`);
    // its parts, once it is made: until then their counts are blank
    await page.until(`[...document.querySelectorAll('strong')].some(s => s.textContent.startsWith(${JSON.stringify(`${name}: `)}) && s.textContent.includes('in order'))
        && ![...document.querySelectorAll('.line .count')].some(c => c.textContent === '')`, 120, `${name}'s parts`);
};
// a case drawn: a canvas of its own (Monaco, hidden or not, has some too)
const drawn = `[...document.querySelectorAll('canvas')].some(c => !c.closest('.monaco-editor'))`;
const setConfig = (page, text) => page.ev(`window.monaco.editor.getModels()[0].setValue(${JSON.stringify(text)})`);
const says = text => `document.body.textContent.includes(${JSON.stringify(text)})`;
const lines = `document.querySelectorAll('.line').length`;
const line = i => `document.querySelectorAll('.line')[${i}]`;
const caseParts = async (page, name) => (await parsed(page)).cases[name];

export const tests = [
    {
        name: 'cases: a case\'s parts are edited in its own preview',
        async run(page, {url}) {
            await freshApp(page, url);
            await openCase(page, 'right_top');
            const before = await caseParts(page, 'right_top');
            await page.until(`${lines} === ${before.length}`, 30, 'a line for every part');
            assert(await page.ev(`[...document.querySelectorAll('.line')].every(l => /×\\d+|none|off/.test(l.textContent))`), 'every line should say how many it matched');
            assert(await page.ev(`!document.querySelector('.settings')`), 'no part should be open yet');

            // open part 1 and type a thickness
            await page.ev(`${line(1)}.click()`);
            const thick = `document.querySelector('.settings input[title="extrude"]')`;
            await page.until(`!!${thick}`, 10, 'its settings');
            await page.ev(`(() => { const i = ${thick}; i.focus(); i.select(); })()`);
            await page.type('4');
            await page.key('Enter', 'Enter', 13);
            await page.until(`jsyaml.load(${config}).cases.right_top[1].extrude === 4`, 30, 'the thickness in the config');

            // and a shift, which the part didn't have
            const shift = `document.querySelector('.settings input[title="shift"]')`;
            await page.until(`!!${shift}`, 120, 'its shift box');
            await page.ev(`(() => { const i = ${shift}; i.focus(); i.select(); })()`);
            await page.type('[5, 0, 0]');
            await page.key('Enter', 'Enter', 13);
            await page.until(`JSON.stringify(jsyaml.load(${config}).cases.right_top[1].shift) === '[5,0,0]'`, 30, 'the shift in the config');

            // move it down, and it stays open
            await page.until(`!!document.querySelector('.settings button[title="Move it down"]')`, 120, 'its settings again');
            await page.ev(`document.querySelector('.settings button[title="Move it down"]').click()`);
            await page.until(`jsyaml.load(${config}).cases.right_top[2].name === ${JSON.stringify(before[1].name)}`, 30, 'part 1 to move down');

            // a part added at the end opens, and is deleted from its settings
            await page.press('+ Outline', 120);
            await page.until(`jsyaml.load(${config}).cases.right_top.length === ${before.length + 1}`, 30, 'a new part');
            await page.until(`${lines} === ${before.length + 1} && !!document.querySelector('.settings button[title="Delete this part"]')`, 120, 'it open');
            await page.ev(`document.querySelector('.settings button[title="Delete this part"]').click()`);
            await page.until(`jsyaml.load(${config}).cases.right_top.length === ${before.length}`, 30, 'the new part to go');
        },
    },
    {
        name: 'cases: a part made of an earlier case is added from its menu, and deleted',
        async run(page, {url}) {
            await freshApp(page, url);
            const names = Object.keys((await parsed(page)).cases);
            const name = names[1], earlier = names[0];
            await openCase(page, name);
            const before = await caseParts(page, name);
            const menu = `[...document.querySelectorAll('select')].find(s => (s.title || '').startsWith('A part that is another case'))`;
            await page.until(`!!${menu} && [...${menu}.options].map(o => o.value).join() === ${JSON.stringify(',' + earlier)}`, 60, `the menu offering only ${earlier}`);
            await page.choose(menu, earlier);
            await page.until(`(p => p.length === ${before.length + 1} && p[${before.length}].what === 'case' && p[${before.length}].name === ${JSON.stringify(earlier)})(jsyaml.load(${config}).cases.${name})`, 30, `${earlier} as a part of ${name}`);
            await page.until(`${lines} === ${before.length + 1} && !!document.querySelector('.settings button[title="Delete this part"]')`, 180, 'it open');
            await page.ev(`window.confirm = () => true; document.querySelector('.settings button[title="Delete this part"]').click()`);
            await page.until(`jsyaml.load(${config}).cases.${name}.length === ${before.length}`, 30, 'the part to go');
        },
    },
    {
        name: 'cases: a mirrored case edits the case it mirrors',
        async run(page, {url}) {
            await freshApp(page, url);
            await openCase(page, 'left_top');
            const source = await caseParts(page, 'right_top');
            await page.until(`${lines} === ${source.length}`, 30, "a line for every part of right_top");
            assert(await page.ev(`document.body.textContent.includes("left_top is right_top mirrored")`), 'it should say whose parts these are');
            await page.ev(`${line(1)}.click()`);
            await page.until(`!!document.querySelector('.settings select[title="how it joins the parts before it"]')`, 10, 'its settings');
            await page.choose(`document.querySelector('.settings select[title="how it joins the parts before it"]')`, 'intersect');
            await page.until(`jsyaml.load(${config}).cases.right_top[1].operation === 'intersect'`, 30, 'right_top to change');
            assert(!(await parsed(page)).cases.left_top.length, 'left_top should still just mirror right_top');
        },
    },
    {
        name: 'cases: a board\'s 3D view is the board alone, its assembly\'s has the case',
        async run(page, {url}) {
            await freshApp(page, url);
            await openPcb(page, 'ergo_cai_right');
            await page.press('3D');
            await page.until(`!!document.querySelector('canvas') && [...document.querySelectorAll('button')].some(b => b.textContent.includes('.glb'))`, 60, 'the board in 3D');
            await new Promise(r => setTimeout(r, 1500));
            assert(!(await page.ev(`document.body.textContent.includes('Case (')`)), "the board's own 3D view should show no case");
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Assemblies'))?.click()`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'ergocai_right')?.click()`);
            await page.until(`document.body.textContent.includes('Case (ergocai_right)')`, 120, 'the assembly with its case');
            assert(!(await page.ev(`[...document.querySelectorAll('button')].some(b => b.title?.startsWith('The parts '))`)), 'the assembly should not edit parts');
        },
    },
    {
        name: 'cases: a case not made yet shows as being made, then its model, never as missing',
        async run(page, {url}) {
            await freshApp(page, url);
            // what the page says, frame by frame, from the click until the model is drawn
            await page.ev(`(() => { const seen = window.e2eSeen = {making: 0, missing: 0, offWhileMaking: 0};
                const look = () => {
                    const making = ${says('Generating right_middle…')};
                    if (making) seen.making++;
                    if (${says('No STL')}) seen.missing++;
                    if (making && [...document.querySelectorAll('.line .count')].some(c => c.textContent === 'off')) seen.offWhileMaking++;
                    if (!seen.done) requestAnimationFrame(look);
                };
                look(); })()`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Cases'))?.click()`);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'right_middle.stl').click()`);
            await page.until(`${drawn} && !${says('Generating right_middle…')}`, 120, 'right_middle drawn');
            const seen = await page.ev(`(() => { window.e2eSeen.done = true; return window.e2eSeen; })()`);
            assert(seen.making > 0, 'it should say right_middle is being made');
            assert(!seen.missing, `it should never say there is no STL (${seen.missing} frames did)`);
            assert(!seen.offWhileMaking, `its parts should not read "off" while it is made (${seen.offWhileMaking} frames did)`);
        },
    },
    {
        name: 'cases: a case that cannot be made, or comes out empty, says why; one taken out of the config gives way to the layout editor',
        async run(page, {url}) {
            await freshApp(page, url);
            await openCase(page, 'right_middle');
            await page.until(drawn, 120, 'right_middle drawn');
            const original = await page.ev(config);
            // its first part made of an outline the config does not have: ergogen leaves the case out, and says why
            const at = original.indexOf('\n  right_middle:\n');
            await setConfig(page, original.slice(0, at) + original.slice(at).replace('name: combo', 'name: e2e_missing'));
            await page.until(says('No STL: right_middle could not be made: Field "cases.right_middle.0.name" did not match any outline!'), 120, 'why right_middle is not there');
            assert(!(await page.ev(drawn)), 'the old model should go');
            // a case whose parts cut each other away: made, and empty
            const hollow = original.replace(/^cases:.*$/m, '$&\n  e2e_hollow:\n    - name: board\n      extrude: 2\n    - name: board\n      extrude: 2\n      operation: subtract');
            await setConfig(page, hollow);
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'e2e_hollow.stl')`, 60, 'e2e_hollow in the list');
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'e2e_hollow.stl').click()`);
            await page.until(says('No STL: e2e_hollow comes out empty, its parts make no solid'), 120, 'e2e_hollow said to be empty');
            // then not made at all: only why it is not, not also what was wrong with the STL before
            await setConfig(page, hollow.replace('  e2e_hollow:\n    - name: board', '  e2e_hollow:\n    - name: e2e_missing'));
            await page.until(says('No STL: e2e_hollow could not be made: Field "cases.e2e_hollow.0.name" did not match any outline!'), 120, 'why e2e_hollow is not made');
            const shown = await page.ev(`[...document.querySelectorAll('div')].filter(d => !d.childElementCount && d.textContent.startsWith('No STL')).map(d => d.textContent)`);
            assert(shown.length === 1, `one "No STL" should show: ${JSON.stringify(shown)}`);
            await setConfig(page, original);
            await page.until(`!!${outlineMenu}`, 30, 'the layout editor, e2e_hollow gone');
        },
    },
    {
        name: 'cases: a new case is copied, mirrored and stacked, and deleted with what uses it',
        async run(page, {url}) {
            await freshApp(page, url);
            await page.until(`!!document.querySelector('button[title="A new case"]')`, 60, 'the Cases section');
            await pressNew(page, 'case');
            await page.ev(`document.querySelector('input[placeholder="case name"]').focus()`);
            await page.type('right_lid');
            const top = (await caseParts(page, 'right_top')).length;
            // a copy of the first case (right_top), mirrored as left_lid, at the top of ergocai_right
            assert(await page.ev(`document.querySelector('select[title="the case whose parts it starts with"]').value`) === 'right_top', 'it should start as a copy of right_top');
            await page.press('Add');
            await page.until(`!!jsyaml.load(${config}).cases.right_lid`, 30, 'the new case');
            const c = await parsed(page);
            assert(c.cases.right_lid.length === top, `right_lid should have right_top's ${top} parts, has ${c.cases.right_lid.length}`);
            assert(c.cases.left_lid?.mirror?.from === 'right_lid', 'left_lid should mirror right_lid');
            assert(c.assemblies.ergocai_right.stack.at(-1) === 'right_lid', `right_lid should top ergocai_right: ${c.assemblies.ergocai_right.stack}`);
            assert(c.assemblies.ergocai_left.stack.at(-1) === 'left_lid', `left_lid should top ergocai_left: ${c.assemblies.ergocai_left.stack}`);
            // it opens, once it is made
            await page.until(`document.body.innerText.includes('right_lid: ${top} parts')`, 120, "right_lid's parts");

            const said = await deleteFromList(page, 'Cases', 'right_lid');
            await page.until(`!jsyaml.load(${config}).cases.right_lid`, 30, 'right_lid to go');
            const after = await parsed(page);
            assert(!after.cases.left_lid, 'left_lid should go with it');
            assert(!after.assemblies.ergocai_right.stack.includes('right_lid') && !after.assemblies.ergocai_left.stack.includes('left_lid'), 'the stacks should no longer have them');
            assert(said.includes('the mirrored case left_lid'), `the confirmation should name the mirrored case: ${said}`);
        },
    },
];
