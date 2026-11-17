// STEP and IGES models to triangles, with occt-import-js (OpenCascade in WebAssembly, LGPL-2.1) in a worker so the
// page doesn't freeze. Its files come from jsDelivr, pinned and checked against their hashes like the scripts in
// index.html; the worker is made from a blob, since a worker script has to come from the page's own origin and the
// page's files are on jsDelivr in production.
import {MeshPart} from "./meshCache";

const OCCT = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/';
const FILES = {
    script: {url: OCCT + 'occt-import-js.js', sha384: 'Z8pO9JEhFZF+mvDKxMuLvPT85VP7nly8CqYjBatl0bMeW9OsaKCes4gEUPL4nihc'},
    wasm: {url: OCCT + 'occt-import-js.wasm', sha384: '6BbVZ7iPDgcRszsoavxGz4TaYCwC2EkeYCy1aR9XFwqMZYXDQP+0vZSTP6Yw35iD'},
};

// Runs after occt-import-js's own script, which defines occtimportjs. Splits each mesh by the colour of its faces
// (a face's own colour, else the shape's) and sends back typed arrays.
const WORKER = `
var ready = null;
self.onmessage = function (event) {
    var message = event.data;
    if (message.type === 'init') {
        ready = occtimportjs({wasmBinary: message.wasm});
        return;
    }
    ready.then(function (occt) {
        var data = new Uint8Array(message.buffer);
        var params = {linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.005, angularDeflection: 0.5};
        var result = message.format === 'iges' ? occt.ReadIgesFile(data, params) : occt.ReadStepFile(data, params);
        if (!result || !result.success) throw new Error('OpenCascade could not read it');
        var parts = [], transfer = [];
        result.meshes.forEach(function (mesh) {
            var index = mesh.index.array, triangles = index.length / 3;
            var position = new Float32Array(mesh.attributes.position.array);
            var normal = mesh.attributes.normal ? new Float32Array(mesh.attributes.normal.array) : null;
            transfer.push(position.buffer);
            if (normal) transfer.push(normal.buffer);
            var groups = {}, covered = new Uint8Array(triangles);
            var add = function (color, t) {
                var key = color ? color.join(',') : '';
                (groups[key] = groups[key] || {color: color, triangles: []}).triangles.push(t);
                covered[t] = 1;
            };
            (mesh.brep_faces || []).forEach(function (face) {
                for (var t = face.first; t <= face.last && t < triangles; t++) add(face.color || mesh.color || null, t);
            });
            for (var t = 0; t < triangles; t++) if (!covered[t]) add(mesh.color || null, t);
            Object.keys(groups).forEach(function (key) {
                var list = groups[key].triangles, sub = new Uint32Array(list.length * 3);
                for (var i = 0; i < list.length; i++) {
                    sub[3 * i] = index[3 * list[i]];
                    sub[3 * i + 1] = index[3 * list[i] + 1];
                    sub[3 * i + 2] = index[3 * list[i] + 2];
                }
                transfer.push(sub.buffer);
                parts.push({position: position, normal: normal, index: sub, color: groups[key].color});
            });
        });
        self.postMessage({id: message.id, parts: parts}, transfer);
    }).catch(function (error) {
        self.postMessage({id: message.id, error: String((error && error.message) || error)});
    });
};
`;

const base64 = (buffer: ArrayBuffer) => {
    let s = '';
    new Uint8Array(buffer).forEach(b => { s += String.fromCharCode(b); });
    return btoa(s);
};

const fetchChecked = async ({url, sha384}: { url: string, sha384: string }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    if (base64(await crypto.subtle.digest('SHA-384', data)) !== sha384) throw new Error(`${url} is not the file this page expects`);
    return data;
};

type Pending = { resolve: (parts: MeshPart[]) => void, reject: (error: Error) => void };
const pending = new Map<number, Pending>();
let nextId = 0;
let starting: Promise<Worker> | null = null;

const start = async (): Promise<Worker> => {
    const [script, wasm] = await Promise.all([fetchChecked(FILES.script), fetchChecked(FILES.wasm)]);
    const worker = new Worker(URL.createObjectURL(new Blob([script, '\n', WORKER], {type: 'text/javascript'})));
    worker.onmessage = (event: MessageEvent) => {
        const {id, parts, error} = event.data;
        const p = pending.get(id);
        pending.delete(id);
        if (error) p?.reject(new Error(error));
        else p?.resolve(parts);
    };
    worker.onerror = (event: ErrorEvent) => {
        // a crashed worker (out of memory, say) is started afresh for the next model
        const error = new Error(event.message || 'the STEP converter stopped');
        pending.forEach(p => p.reject(error));
        pending.clear();
        starting = null;
        worker.terminate();
    };
    worker.postMessage({type: 'init', wasm}, [wasm]);
    return worker;
};

export const convertStep = async (buffer: ArrayBuffer, format: 'step' | 'iges'): Promise<MeshPart[]> => {
    if (!starting) starting = start().catch(error => {
        starting = null;
        throw error;
    });
    const worker = await starting;
    const id = ++nextId;
    return new Promise((resolve, reject) => {
        pending.set(id, {resolve, reject});
        worker.postMessage({id, buffer, format}, [buffer]);
    });
};
