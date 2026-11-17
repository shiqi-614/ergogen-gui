// A case's parts, in its own preview (Downloads → Cases), and which 3D board view shows the case
import {assert, config, freshApp, openPcb, parsed} from '../app.mjs';

const openCase = async (page, name) => {
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Cases'))?.click()`);
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(`${name}.stl`)})?.click()`);
    await page.until(`[...document.querySelectorAll('span')].some(s => s.textContent.startsWith(${JSON.stringify(`${name}: `)}) && s.textContent.includes('in order'))`, 120, `${name}'s parts`);
};
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

            // move it down, and it stays open
            await page.until(`!!document.querySelector('.settings button[title="Move it down"]')`, 120, 'its settings again');
            await page.ev(`document.querySelector('.settings button[title="Move it down"]').click()`);
            await page.until(`jsyaml.load(${config}).cases.right_top[2].name === ${JSON.stringify(before[1].name)}`, 30, 'part 1 to move down');

            // a part added at the end opens, and is deleted from its settings
            await page.press('+ outline', 120);
            await page.until(`jsyaml.load(${config}).cases.right_top.length === ${before.length + 1}`, 30, 'a new part');
            await page.until(`${lines} === ${before.length + 1} && !!document.querySelector('.settings button.remove')`, 120, 'it open');
            await page.ev(`document.querySelector('.settings button.remove').click()`);
            await page.until(`jsyaml.load(${config}).cases.right_top.length === ${before.length}`, 30, 'the new part to go');
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
];
