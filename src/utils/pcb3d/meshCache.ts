// Converted 3D models, kept in IndexedDB so a model is downloaded and converted once: STEP files take OpenCascade
// up to a few seconds each. Without IndexedDB (some private windows) nothing is kept and nothing fails.

// a model's triangles in mm, and its colour as the renderer takes it: linear, not sRGB (OpenCascade and glTF give
// linear colours; vrml.ts converts VRML's); parts of one model may share position and normal arrays
export type MeshPart = {
    position: Float32Array,
    normal: Float32Array | null,
    index: Uint32Array,
    color: [number, number, number] | null,
};

const DB = 'ergogen-3d-models';
const STORE = 'meshes';

let opening: Promise<IDBDatabase | null> | null = null;
const database = () => opening || (opening = new Promise(resolve => {
    try {
        const request = indexedDB.open(DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    } catch {
        resolve(null);
    }
}));

export const cacheGet = async (key: string): Promise<MeshPart[] | null> => {
    const db = await database();
    if (!db) return null;
    return new Promise(resolve => {
        const request = db.transaction(STORE).objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
};

export const cachePut = async (key: string, parts: MeshPart[]): Promise<void> => {
    const db = await database();
    if (!db) return;
    return new Promise(resolve => {
        const transaction = db.transaction(STORE, 'readwrite');
        transaction.objectStore(STORE).put(parts, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
    });
};
