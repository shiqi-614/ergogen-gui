// The parts of the case layers, in the 3D board view of an assembly
import {assert, config, freshApp, parsed} from '../app.mjs';

const openAssembly = async (page, name) => {
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Assemblies'))?.click()`);
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(name)})?.click()`);
    await page.until(`[...document.querySelectorAll('div')].some(d => d.textContent.startsWith('Case (${name})'))`, 120, `the ${name} case in 3D`);
};
const openParts = (page, layer) => page.ev(`[...document.querySelectorAll('button')].find(b => b.title === 'The parts ${layer} is made of').click()`);
const parts = async (page, name) => (await parsed(page)).cases[name];
const rows = `document.querySelectorAll('.part').length`;

export const tests = [
    {
        name: 'cases: the parts of a case layer are edited in the 3D view',
        async run(page, {url}) {
            await freshApp(page, url);
            await openAssembly(page, 'ergocai_right');
            await openParts(page, 'right_top');
            const before = await parts(page, 'right_top');
            await page.until(`${rows} === ${before.length}`, 30, 'a row for every part of right_top');
            assert(await page.ev(`[...document.querySelectorAll('.part')].every(p => /matched|matches nothing|not on this half/.test(p.textContent))`), 'every part should say what it matched');

            // pointing at a part lights it
            await page.cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', ...await page.center(`document.querySelectorAll('.part')[1]`).then(([x, y]) => ({x, y}))});
            await page.until(`document.querySelectorAll('.part.lit').length === 1`, 10, 'the part to light');

            // a thickness typed in
            const thick = `document.querySelectorAll('.part')[1].querySelector('input[title="extrude"]')`;
            await page.ev(`(() => { const i = ${thick}; i.focus(); i.select(); })()`);
            await page.type('4');
            await page.key('Enter', 'Enter', 13);
            await page.until(`jsyaml.load(${config}).cases.right_top[1].extrude === 4`, 30, 'the thickness in the config');

            // moved up a place
            await page.until(`!!document.querySelectorAll('.part')[2]`, 120, 'the parts again');
            await page.ev(`document.querySelectorAll('.part')[2].querySelector('button[title="Move it up"]').click()`);
            await page.until(`jsyaml.load(${config}).cases.right_top[1].name === ${JSON.stringify(before[2].name)}`, 30, 'part 2 to move up');

            // added at the end, then deleted
            await page.until(`[...document.querySelectorAll('button')].some(b => b.textContent === '+ outline')`, 120, 'the add buttons');
            await page.press('+ outline');
            await page.until(`jsyaml.load(${config}).cases.right_top.length === ${before.length + 1}`, 30, 'a new part');
            await page.until(`${rows} === ${before.length + 1}`, 120, 'its row');
            await page.ev(`document.querySelectorAll('.part')[${before.length}].querySelector('button.remove').click()`);
            await page.until(`jsyaml.load(${config}).cases.right_top.length === ${before.length}`, 30, 'the new part to go');
        },
    },
    {
        name: 'cases: a mirrored case layer edits the case it mirrors',
        async run(page, {url}) {
            await freshApp(page, url);
            await openAssembly(page, 'ergocai_left');
            await openParts(page, 'left_top');
            const source = await parts(page, 'right_top');
            await page.until(`${rows} === ${source.length}`, 30, "a row for every part of right_top");
            assert(await page.ev(`document.body.textContent.includes("left_top is right_top mirrored")`), 'it should say whose parts these are');
            await page.choose(`document.querySelectorAll('.part')[1].querySelector('select[title="how it joins the parts before it"]')`, 'intersect');
            await page.until(`jsyaml.load(${config}).cases.right_top[1].operation === 'intersect'`, 30, 'right_top to change');
            assert(!(await parsed(page)).cases.left_top.length, 'left_top should still just mirror right_top');
        },
    },
];
