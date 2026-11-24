// The example menu, in the page's header
import {config, freshApp} from '../app.mjs';

export const tests = [
    {
        name: 'examples: another example is picked with the config editor hidden',
        async run(page, {url}) {
            await freshApp(page, url);
            // the page opens with the editor hidden down to its strip
            await page.until(`!![...document.querySelectorAll('button')].find(b => b.textContent === '▸ Config')`, 10, 'the hidden editor');
            await page.click(await page.center(`document.querySelector('.example-menu__control')`, 'the example menu'));
            await page.click(await page.center(`[...document.querySelectorAll('.example-menu__option')].find(o => o.textContent === 'Tiny20')`, 'Tiny20 in its list'));
            await page.until(`${config}.includes('rotate: 5') && !${config}.includes('funnelNarrow')`, 30, 'Tiny20 in the editor');
        },
    },
];
