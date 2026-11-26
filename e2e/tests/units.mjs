// The config's units, at the top of the project list
import {assert, config, freshApp, parsed, pressNew} from '../app.mjs';

const box = name => `document.querySelector('input[aria-label="${name}"]')`;
const row = name => `${box(name)}.parentElement`;

export const tests = [
    {
        name: 'units: a value is typed and nudged, a unit added and deleted',
        async run(page, {url}) {
            await freshApp(page, url);
            await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Units'))?.click()`);
            await page.until(`!!${box('funnelWide')}`, 10, 'the units');
            assert(parseInt(await page.ev(`${row('funnelWide')}.querySelector('.uses').textContent`)) > 0, 'funnelWide should have uses');
            await page.ev(`${box('funnelWide')}.select()`);
            await page.type('30');
            await page.key('Enter', 'Enter', 13);
            await page.until(`jsyaml.load(${config}).units.funnelWide === 30`, 30, 'funnelWide to be written');
            // a plain number needs no worked-out value beside it; kx (written u) has one
            assert(await page.ev(`${row('funnelWide')}.querySelector('.value').textContent`) === '', 'a plain number should show no value beside it');
            assert(await page.ev(`${row('kx')}.querySelector('.value').textContent`) === '= 19', 'kx should show what u comes to');
            // ↑ nudges by 0.1, keeping it a plain number
            await page.ev(`${box('screwSize')}.focus()`);
            await page.key('ArrowUp', 'ArrowUp', 38);
            await page.until(`jsyaml.load(${config}).units.screwSize === 1.15`, 30, 'screwSize nudged up');

            await pressNew(page, 'unit');
            await page.ev(`document.querySelector('[role="dialog"] input[placeholder="unit name"]').focus()`);
            await page.type('e2eGap');
            await page.ev(`document.querySelector('[role="dialog"] input[placeholder^="e.g."]').focus()`);
            await page.type('funnelLip * 2');
            await page.press('Add');
            await page.until(`jsyaml.load(${config}).units.e2eGap === 'funnelLip * 2'`, 30, 'the new unit');
            await page.until(`!!${box('e2eGap')} && ${row('e2eGap')}.querySelector('.value').textContent === '= 4'`, 60, 'its value');
            await page.ev(`document.querySelector('button[title="Delete e2eGap"]').click()`);
            await page.until(`!('e2eGap' in jsyaml.load(${config}).units)`, 30, 'the unit to go');
            const after = await parsed(page);
            assert(after.units.funnelLip === 2 && after.units.kx === 'u', 'the other units should stay');
        },
    },
];
