// Steps through the app that several tests share

// the app on the example config: localStorage keeps the last config, so it is emptied first
export const freshApp = async (page, url) => {
    await page.goto(url);
    await page.ev(`localStorage.clear()`);
    await page.goto(url);
    await page.until(`!![...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ PCBs'))`, 300, 'the first preview');
    await page.until(`!!window.monaco?.editor.getModels()[0]`, 60, 'the config editor');
};

// demo.svg, the points and outlines, is shown in the layout editor (the page opens on it)
export const openLayout = async page => {
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ Config & points'))?.click()`);
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('demo.dxf'))?.click()`);
    await page.until(`document.querySelectorAll('svg title').length > 60`, 60, 'the layout to draw its keys');
};

export const openPcb = async (page, name) => {
    // the project section header reads "▸ PCBs" and a count; open it when it is closed
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ PCBs'))?.click()`);
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(name)}) && b.textContent.includes('kicad_pcb')).click()`);
    await page.until(`!!document.querySelector('kicanvas-embed[loaded]') && !![...document.querySelectorAll('button')].find(b => b.textContent === 'Edit parts')`, 120, `the ${name} board`);
};

// the config in the editor
export const config = `window.monaco.editor.getModels()[0].getValue()`;

// lines lines of the config from the first line that contains text
export const lines = (text, count) =>
    `(() => { const t = ${config}; const i = t.indexOf(${JSON.stringify(text)}); return i < 0 ? null : t.slice(i).split('\\n').slice(0, ${count}).join('\\n') })()`;

// the KiCanvas board viewer, and one of its footprints' position and angle
export const viewer = `document.querySelector('kicanvas-embed[loaded]')?.shadowRoot.querySelector('kc-board-app').shadowRoot.querySelector('kc-board-viewer').viewer`;
export const boardFootprint = (page, reference) =>
    page.ev(`(() => { const f = ${viewer}?.board?.footprints.find(f => f.reference === ${JSON.stringify(reference)}); return f ? [f.at.position.x, f.at.position.y, f.at.rotation] : null })()`);

// waits for the board to regenerate after an edit: a footprint moves or turns
export const waitForBoard = async (page, reference, before) => {
    await page.until(`(() => { const f = ${viewer}?.board?.footprints.find(f => f.reference === ${JSON.stringify(reference)}); return !!f && JSON.stringify([f.at.position.x, f.at.position.y, f.at.rotation]) !== ${JSON.stringify(JSON.stringify(before))} })()`,
        120, `${reference} to move on the regenerated board`);
};

// the screen positions of the keys of the layout (their <title> is the key's name)
export const keyCenters = page => page.ev(`Object.fromEntries([...document.querySelectorAll('svg title')]
    .filter(t => /^(mirror_)?(matrix|thumbs)_col\\d_row\\d$/.test(t.textContent))
    .map(t => { const r = t.parentElement.getBoundingClientRect(); return [t.textContent, [r.left + r.width / 2, r.top + r.height / 2]] }))`);

export const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

export const near = (a, b, tolerance, message) =>
    assert(Math.abs(a - b) <= tolerance, `${message}: ${a} is not within ${tolerance} of ${b}`);

// the config, parsed
export const parsed = page => page.ev(`jsyaml.load(${config})`);

// the outline menu at the top left of the layout
export const outlineMenu = `[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.textContent === 'Outline: none'))`;

// the "+" on a project section's header, which opens its new-item form
export const pressNew = (page, section) =>
    page.ev(`[...document.querySelectorAll('button[title="A new ${section}"]')][0].click()`);

// After a test: the config it leaves has to make ergogen run without an error: this waits for the last run.
export const settled = async page => {
    await new Promise(r => setTimeout(r, 600));
    await page.until(`!document.querySelector('[aria-label="Generating"]')`, 180, 'the last ergogen run to finish');
    const error = await page.ev(`document.querySelector('[data-ergogen-error]')?.textContent ?? null`);
    if (error) throw new Error(`the config the test left makes ergogen fail: ${error.slice(0, 300)}`);
    // the preview leaves the cases out unless one is on show: the whole config, cases and all, has to make too
    const left = await page.ev(`(async () => {
        const c = jsyaml.load(window.monaco.editor.getModels()[0].getValue()) ?? {};
        const pick = ['points', 'units', 'variables', 'outlines', 'pcbs', 'cases', 'assemblies'];
        const input = Object.fromEntries(pick.map(k => [k, {...c[k]}]));
        try {
            const r = await window.ergogen.process({...input, is_preview: true}, true, () => {}, {tolerant: true});
            return Object.entries(r.errors ?? {}).map(([k, v]) => k + ': ' + v).join(' | ');
        } catch (e) { return String(e); }
    })()`);
    if (left) throw new Error(`the config the test left does not make in full: ${left.slice(0, 300)}`);
    const broken = await page.ev(`[...document.querySelectorAll('[data-error-boundary]')].map(b => b.textContent).join(' | ')`);
    if (broken) throw new Error(`part of the page failed to draw: ${broken.slice(0, 300)}`);
};

// Deletes an item from its row in the project list (its section opened), saying yes in the dialog. Returns what
// the dialog said goes with it.
export const deleteFromList = async (page, section, name) => {
    await page.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ ${section}'))?.click()`);
    await page.until(`!!document.querySelector('button[title="Delete ${name}"]')`, 30, `the delete button of ${name}`);
    await page.ev(`document.querySelector('button[title="Delete ${name}"]').click()`);
    await page.until(`!![...document.querySelectorAll('[role="dialog"] .buttons button')].find(b => b.textContent === 'Delete')`, 10, 'the confirmation');
    const said = await page.ev(`document.querySelector('[role="dialog"]').innerText`);
    await page.ev(`[...document.querySelectorAll('[role="dialog"] .buttons button')].find(b => b.textContent === 'Delete').click()`);
    return said;
};

// the middle of an svg element titled <prefix>…, one the pointer can reach (not under a panel)
export const reachableTitled = (page, prefix) => page.center(`[...document.querySelectorAll('svg title')]
    .filter(t => t.textContent.startsWith(${JSON.stringify(prefix)})).map(t => t.parentElement)
    .find(e => { const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit === e || e.contains(hit); })`,
    `a reachable element titled "${prefix}"`);
