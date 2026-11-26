// The example menu, in the page's header
import {assert, config, freshApp, outlineMenu, parsed, pickExample} from '../app.mjs';

const openRow = (page, section, name) => page.ev(`(() => {
    [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ ${section}'))?.click();
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(name)}).click(); })()`);

export const tests = [
    {
        name: 'examples: another example is picked with the config editor hidden',
        async run(page, {url}) {
            await freshApp(page, url);
            // the page opens with the editor hidden down to its strip
            await page.until(`!![...document.querySelectorAll('button')].find(b => b.textContent === '▸ Config')`, 10, 'the hidden editor');
            await pickExample(page, 'Tiny20');
            await page.until(`${config}.includes('rotate: 5') && !${config}.includes('funnelNarrow')`, 30, 'Tiny20 in the editor');
        },
    },
    {
        name: 'examples: what is on show gives way to the layout editor in an example without it, and stays in one with it',
        async run(page, {url}) {
            await freshApp(page, url);
            // ErgoCai's assembly ergocai_right: RowStaggerSplit has none of that name
            await openRow(page, 'Assemblies', 'ergocai_right');
            await page.until(`document.body.textContent.includes('Case (ergocai_right)')`, 120, 'the assembly with its case');
            await pickExample(page, 'RowStaggerSplit');
            await page.until(`!!${outlineMenu} && [...${outlineMenu}.options].some(o => o.value === 'left_board')`, 60, "the layout editor, with RowStaggerSplit's outlines");
            // RowStaggerSplit's case right_middle: ErgoCai has one too, which takes its place
            const showing = async () => `[...document.querySelectorAll('strong')].some(s => s.textContent.startsWith('right_middle: ${(await parsed(page)).cases.right_middle.length} parts'))`;
            await openRow(page, 'Cases', 'right_middle.stl');
            await page.until(await showing(), 120, "RowStaggerSplit's right_middle");
            await pickExample(page, 'ErgoCai');
            await page.until(`${config}.includes('ergo_cai_right')`, 30, 'ErgoCai in the editor');
            await page.until(await showing(), 120, "ErgoCai's right_middle in its place");
            assert(!(await page.ev(`!!${outlineMenu}`)), 'the case should stay on show, not the layout editor');
        },
    },
];
