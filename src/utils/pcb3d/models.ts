// A footprint's 3D model as triangles in mm: its address (sources.ts), downloaded, converted (STEP and IGES in the
// worker, VRML by vrml.ts, glTF by three.js's loader) and kept (meshCache.ts). Files in a GitHub repo are read
// through ergogen.js, at the commit its footprints come from, and kept under their blob id, so a library commit that
// leaves a model alone doesn't convert it again.
import {BufferAttribute, BufferGeometry, Matrix4, Mesh, Object3D} from "three";
import {cacheGet, cachePut, MeshPart} from "./meshCache";
import {addressOf, formatOf, ModelAddress, parseSources, Source, SOURCES_FILE} from "./sources";
import {convertStep} from "./stepWorker";
import {vrmlParts} from "./vrml";

type Github = {
    checkRepo: (repo: string) => Promise<string | null>,
    blobOf: (repo: string, path: string) => string | null | undefined,
    rawUrl: (repo: string, ref: string, path: string) => string,
};

// bump when the conversion changes, so kept models are converted again (v3: colours linear)
const CACHE_VERSION = 'v3';

const github = (): Github => {
    const access = window.ergogen?.github;
    if (!access) throw new Error('this ergogen.js has no GitHub access for 3D models');
    return access;
};

export const loadSources = async (): Promise<Source[]> => {
    const gh = github();
    const commit = await gh.checkRepo(SOURCES_FILE.repo);
    const url = gh.rawUrl(SOURCES_FILE.repo, commit || 'main', SOURCES_FILE.file);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${SOURCES_FILE.repo}/${SOURCES_FILE.file}: HTTP ${response.status}`);
    return parseSources(await response.text());
};

// glTF counts in metres with y up, the view in mm with z up
const GLTF_TO_VIEW = new Matrix4().makeScale(1000, 1000, 1000).multiply(new Matrix4().makeRotationX(Math.PI / 2));

// every mesh of a glTF file, where its nodes put it; its colours are linear already
export const gltfParts = async (buffer: ArrayBuffer): Promise<MeshPart[]> => {
    const {GLTFLoader} = await import("three/examples/jsm/loaders/GLTFLoader");
    const gltf: any = await new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
    gltf.scene.updateMatrixWorld(true);
    const parts: MeshPart[] = [];
    gltf.scene.traverse((object: Object3D) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const geometry = (mesh.geometry as BufferGeometry).clone();
        geometry.applyMatrix4(new Matrix4().multiplyMatrices(GLTF_TO_VIEW, mesh.matrixWorld));
        if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
        const position = geometry.getAttribute('position') as BufferAttribute;
        const index = geometry.getIndex();
        const material: any = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        parts.push({
            position: Float32Array.from(position.array as ArrayLike<number>),
            normal: Float32Array.from((geometry.getAttribute('normal') as BufferAttribute).array as ArrayLike<number>),
            index: index ? Uint32Array.from(index.array as ArrayLike<number>) : Uint32Array.from({length: position.count}, (_, i) => i),
            color: material?.color ? [material.color.r, material.color.g, material.color.b] : null,
        });
        geometry.dispose();
    });
    return parts;
};

const convert = async (buffer: ArrayBuffer, format: 'step' | 'iges' | 'vrml' | 'gltf') => mergeByColour(
    format === 'vrml' ? vrmlParts(new TextDecoder().decode(buffer))
        : format === 'gltf' ? await gltfParts(buffer)
            : await convertStep(buffer, format));

const colourKey = (part: MeshPart) => part.color ? part.color.map(c => c.toFixed(3)).join(',') : '';

// One part per colour, each with only the corners it uses: KiCad's VRML files split a resistor into 26 shapes,
// and every part is a draw call.
export const mergeByColour = (parts: MeshPart[]): MeshPart[] => {
    const groups: Record<string, MeshPart[]> = {};
    parts.forEach(p => (groups[colourKey(p)] = groups[colourKey(p)] || []).push(p));
    return Object.keys(groups).map(key => {
        const list = groups[key];
        let corners = 0, size = 0;
        const renumbered = list.map(p => {
            const to = new Map<number, number>();
            for (let j = 0; j < p.index.length; j++) if (!to.has(p.index[j])) to.set(p.index[j], corners + to.size);
            corners += to.size;
            size += p.index.length;
            return to;
        });
        const position = new Float32Array(corners * 3);
        const normal = list.every(p => p.normal) ? new Float32Array(corners * 3) : null;
        const index = new Uint32Array(size);
        let at = 0;
        list.forEach((p, k) => {
            const to = renumbered[k];
            to.forEach((n, o) => {
                position.set(p.position.subarray(3 * o, 3 * o + 3), 3 * n);
                if (normal) normal.set((p.normal as Float32Array).subarray(3 * o, 3 * o + 3), 3 * n);
            });
            for (let j = 0; j < p.index.length; j++) index[at++] = to.get(p.index[j]) as number;
        });
        return {position, normal, index, color: list[0].color};
    });
};

// where a model is downloaded from, and the key it is kept under (null: not kept)
const locate = async (address: ModelAddress): Promise<{ url: string, key: string | null }> => {
    if (!('repo' in address)) return {url: address.url, key: `${CACHE_VERSION}|${address.url}`};
    const gh = github();
    const commit = await gh.checkRepo(address.repo);
    const blob = gh.blobOf(address.repo, address.file);
    if (blob === null) throw new Error(`${address.repo} has no ${address.file}`);
    // without GitHub's list of files there is no blob id to keep it under
    return {url: gh.rawUrl(address.repo, commit || 'main', address.file), key: blob ? `${CACHE_VERSION}|git:${blob}` : null};
};

const download = async (url: string, key: string | null, format: 'step' | 'iges' | 'vrml' | 'gltf') => {
    const kept = key ? await cacheGet(key) : null;
    if (kept) return kept;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const parts = await convert(await response.arrayBuffer(), format);
    if (!parts.length) throw new Error('it has no shapes');
    if (key) await cachePut(key, parts);
    return parts;
};

// one load per model and page: the left and right boards share most of theirs
const loaded = new Map<string, Promise<MeshPart[]>>();

export const loadModel = async (path: string, sources: Source[]): Promise<MeshPart[]> => {
    const address = addressOf(path, sources);
    if (!address) throw new Error(`no address for it in ${SOURCES_FILE.file}`);
    const format = formatOf('repo' in address ? address.file : address.url);
    if (!format) throw new Error('not a STEP, IGES, VRML or glTF file');
    const {url, key} = await locate(address);
    const id = key || url;
    if (!loaded.has(id)) {
        loaded.set(id, download(url, key, format).catch(error => {
            loaded.delete(id);
            throw error;
        }));
    }
    return loaded.get(id) as Promise<MeshPart[]>;
};
