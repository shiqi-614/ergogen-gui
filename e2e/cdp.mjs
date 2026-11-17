// A small Chrome DevTools Protocol client over Node's own WebSocket, and the page helpers the
// end-to-end tests use: evaluate page JS, wait for a condition, and send real mouse and key events.

export class Cdp {
    constructor(socket) {
        this.socket = socket;
        this.id = 0;
        this.calls = new Map();
        this.listeners = new Map();
        socket.addEventListener('message', ({data}) => {
            const message = JSON.parse(data);
            if (message.id !== undefined) {
                const call = this.calls.get(message.id);
                this.calls.delete(message.id);
                if (!call) return;
                if (message.error) call.reject(new Error(`${call.method}: ${message.error.message}`));
                else call.resolve(message.result);
            } else {
                for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
            }
        });
    }

    static async connect(url) {
        const socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, {once: true});
            socket.addEventListener('error', () => reject(new Error(`can't connect to ${url}`)), {once: true});
        });
        return new Cdp(socket);
    }

    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.calls.set(id, {resolve, reject, method});
            this.socket.send(JSON.stringify({id, method, params}));
        });
    }

    on(method, listener) {
        if (!this.listeners.has(method)) this.listeners.set(method, []);
        this.listeners.get(method).push(listener);
    }

    close() {
        this.socket.close();
    }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// One browser tab, driven the way a person would: page JS for reading state, CDP input events for clicks
export class Page {
    constructor(cdp, log) {
        this.cdp = cdp;
        this.log = log;
        this.errors = [];
    }

    static async open(debugPort, log) {
        const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {method: 'PUT'})).json();
        const page = new Page(await Cdp.connect(target.webSocketDebuggerUrl), log);
        page.targetId = target.id;
        await page.cdp.send('Page.enable');
        await page.cdp.send('Runtime.enable');
        await page.cdp.send('Emulation.setDeviceMetricsOverride', {width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false});
        // confirm() before a delete: say yes
        page.cdp.on('Page.javascriptDialogOpening', ({message}) => {
            page.dialogs = [...(page.dialogs ?? []), message];
            page.cdp.send('Page.handleJavaScriptDialog', {accept: true});
        });
        page.cdp.on('Runtime.exceptionThrown', ({exceptionDetails: d}) => {
            const text = d.exception?.description ?? d.text;
            // harmless: Monaco and KiCanvas resize themselves while the layout settles
            if (!/ResizeObserver loop/.test(text)) page.errors.push(text.split('\n')[0]);
        });
        return page;
    }

    async ev(expression) {
        const r = await this.cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true, timeout: 600000});
        if (r.exceptionDetails) throw new Error(`${expression.slice(0, 100)}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result.value;
    }

    async until(expression, seconds = 60, what = expression) {
        const start = Date.now();
        for (;;) {
            if (await this.ev(expression)) return;
            if (Date.now() - start > seconds * 1000) throw new Error(`timed out after ${seconds} s waiting for ${what.slice(0, 160)}`);
            await wait(250);
        }
    }

    async goto(url) {
        await this.cdp.send('Page.navigate', {url});
        await this.until(`document.readyState === 'complete'`, 60, 'the page to load');
    }

    mouse(type, x, y, modifiers = 0) {
        return this.cdp.send('Input.dispatchMouseEvent', {type, x, y, modifiers, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1});
    }

    async click([x, y], modifiers = 0) {
        await this.cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y});
        await this.mouse('mousePressed', x, y, modifiers);
        await this.mouse('mouseReleased', x, y, modifiers);
        await wait(250);
    }

    // a drag in steps, the way a hand moves; the path can be a function of 0..1 for curves
    async drag(from, to, {steps = 12, modifiers = 0, path} = {}) {
        await this.mouse('mousePressed', from[0], from[1], modifiers);
        for (let i = 1; i <= steps; i++) {
            const [x, y] = path ? path(i / steps) : [from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps];
            await this.cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, modifiers, button: 'left', buttons: 1});
            await wait(30);
        }
        await this.mouse('mouseReleased', to[0], to[1], modifiers);
        await wait(250);
    }

    async key(key, code = key, windowsVirtualKeyCode = 0, modifiers = 0) {
        await this.cdp.send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers});
        await this.cdp.send('Input.dispatchKeyEvent', {type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers});
        await wait(100);
    }

    type(text) {
        return this.cdp.send('Input.insertText', {text});
    }

    // the middle of the element an expression finds
    async center(expression, what = expression) {
        const at = await this.ev(`(() => { const el = ${expression}; if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`);
        if (!at) throw new Error(`not on the page: ${what}`);
        return at;
    }

    // the middle of the SVG element whose <title> starts with text
    titled(text) {
        return this.center(`[...document.querySelectorAll('svg title')].find(t => t.textContent.startsWith(${JSON.stringify(text)}))?.parentElement`, `an element titled "${text}"`);
    }

    // a button by its text, once it is there (toolbars hide while a board regenerates)
    async press(text, seconds = 60) {
        const find = `[...document.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(text)})`;
        await this.until(`!!${find}`, seconds, `a "${text}" button`);
        await this.ev(`${find}.click()`);
        await wait(250);
    }

    // sets a <select> the way a person picking an option does (React listens for change)
    choose(selectExpression, value) {
        return this.ev(`(() => { const s = ${selectExpression}; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('change', {bubbles: true})); })()`);
    }

    async shot(file) {
        const {data} = await this.cdp.send('Page.captureScreenshot', {format: 'png'});
        const {writeFile} = await import('node:fs/promises');
        await writeFile(file, Buffer.from(data, 'base64'));
    }

    close() {
        this.cdp.close();
    }
}

export {wait};
