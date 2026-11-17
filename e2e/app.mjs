// Steps through the app that several tests share

// the app on the example config: localStorage keeps the last config, so it is emptied first
export const freshApp = async (page, url) => {
    await page.goto(url);
    await page.ev(`localStorage.clear()`);
    await page.goto(url);
    await page.until(`!![...document.querySelectorAll('button')].find(b => b.textContent.startsWith('▸ PCBs'))`, 300, 'the first preview');
    await page.until(`!!window.monaco?.editor.getModels()[0]`, 60, 'the config editor');
};

export const openLayout = async page => {
    await page.press('Layout');
    await page.until(`document.querySelectorAll('svg title').length > 60`, 60, 'the layout to draw its keys');
};

export const openPcb = async (page, name) => {
    // the Downloads section header reads "▸ PCBs" and a count; open it when it is closed
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
    page.ev(`(() => { const f = ${viewer}?.board.footprints.find(f => f.reference === ${JSON.stringify(reference)}); return f ? [f.at.position.x, f.at.position.y, f.at.rotation] : null })()`);

// waits for the board to regenerate after an edit: a footprint moves or turns
export const waitForBoard = async (page, reference, before) => {
    await page.until(`(() => { const f = ${viewer}?.board.footprints.find(f => f.reference === ${JSON.stringify(reference)}); return !!f && JSON.stringify([f.at.position.x, f.at.position.y, f.at.rotation]) !== ${JSON.stringify(JSON.stringify(before))} })()`,
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
export const outlineMenu = `[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === '__new__'))`;
