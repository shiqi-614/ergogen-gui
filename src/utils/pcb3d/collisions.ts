// Which parts of the board run into the case. ergogen extrudes every case outline straight up, so a case part is a
// prism (one that isn't is cut into slabs up to SLAB high, each taken as one): a model runs into it exactly where its
// surface between the part's bottom and top, seen from above, overlaps the part's material. That needs no closed
// solids, and models rarely are any (a STEP file's faces come apart where they meet once turned into triangles;
// KiCad's VRML shapes are open). Faces that only touch the case, like a switch's sides on the edge of its plate hole
// or the board's top under the plate, don't count: the heights and the material both shrink by TOLERANCE first.
import {Matrix4} from "three";

// mm: how far a model may reach into the case before it counts
export const TOLERANCE = 0.05;
// mm², seen from above: smaller overlaps are noise
const MIN_AREA = 0.01;
const SLAB = 1;

export type Body = {
    // a footprint reference, or "board"
    reference: string,
    // the model's file name
    model: string,
    // a model part: its corners and triangles in its own frame, and where it is
    positions?: Float32Array,
    index?: Uint32Array,
    matrix?: Matrix4,
    // the board: its section (y up, as the view has it) and the heights it spans
    section?: any,
    bottom?: number,
    top?: number,
};
export type Slab = { name: string, z0: number, z1: number, material: any, box: { min: number[], max: number[] } };
export type Collision = { body: number, reference: string, model: string, layer: string, area: number };

type V = [number, number, number];

// a case part's STL (ergogen writes closed solids) as a manifold-3d solid, moved up by z; the caller deletes it
export const stlSolid = (wasm: any, stl: ArrayBuffer, z: number): any => {
    const view = new DataView(stl);
    const count = view.getUint32(80, true);
    const vertProperties = new Float32Array(count * 9);
    for (let i = 0; i < count; i++) {
        for (let k = 0; k < 9; k++) vertProperties[9 * i + k] = view.getFloat32(84 + 50 * i + 12 + 4 * k, true);
    }
    const mesh = new wasm.Mesh({numProp: 3, vertProperties, triVerts: Uint32Array.from({length: count * 3}, (_, i) => i)});
    // an STL repeats each corner for every triangle; merging them makes the solid whole again
    mesh.merge();
    const solid = new wasm.Manifold(mesh);
    const moved = solid.translate([0, 0, z]);
    solid.delete();
    return moved;
};

// a case part from z0 to z1 as slabs of material, shrunk by TOLERANCE; the caller deletes their material
export const caseSlabs = (name: string, solid: any, z0: number, z1: number): Slab[] => {
    const low = solid.slice(z0 + TOLERANCE), high = solid.slice(z1 - TOLERANCE);
    const apart = [low.subtract(high), high.subtract(low)];
    const prism = apart[0].area() + apart[1].area() < 1e-3;
    [low, high, ...apart].forEach(x => x.delete());
    const n = prism ? 1 : Math.max(1, Math.ceil((z1 - z0) / SLAB));
    const slabs: Slab[] = [];
    for (let i = 0; i < n; i++) {
        const a = z0 + (z1 - z0) * i / n, b = z0 + (z1 - z0) * (i + 1) / n;
        const cut = solid.slice((a + b) / 2);
        const material = cut.offset(-TOLERANCE, 'Miter');
        cut.delete();
        if (material.isEmpty()) {
            material.delete();
            continue;
        }
        slabs.push({name, z0: a + TOLERANCE, z1: b - TOLERANCE, material, box: material.bounds()});
    }
    return slabs;
};

// the part of a polygon on one side of the height z
const clipAt = (polygon: V[], z: number, above: boolean): V[] => {
    const out: V[] = [];
    for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const pIn = above ? p[2] >= z : p[2] <= z, qIn = above ? q[2] >= z : q[2] <= z;
        if (pIn) out.push(p);
        if (pIn !== qIn) {
            const t = (z - p[2]) / (q[2] - p[2]);
            out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), z]);
        }
    }
    return out;
};

const signedArea = (points: [number, number][]) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
        area += x0 * y1 - x1 * y0;
    }
    return area / 2;
};

// A triangle between z0 and z1 as seen from above, counter-clockwise; one standing on edge as a strip
// TOLERANCE wide, so that a wall that only touches the (shrunk) material stays clear of it.
export const shadowOf = (triangle: V[], z0: number, z1: number): [number, number][] | null => {
    const clipped = clipAt(clipAt(triangle, z0, true), z1, false);
    if (clipped.length < 2) return null;
    const flat = clipped.map((p): [number, number] => [p[0], p[1]]);
    const area = signedArea(flat);
    if (Math.abs(area) > 1e-6) return area > 0 ? flat : flat.reverse();
    let [p, q, far] = [flat[0], flat[0], 0];
    flat.forEach(a => flat.forEach(b => {
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (d > far) [p, q, far] = [a, b, d];
    }));
    if (far < 1e-4) return null;
    const w = TOLERANCE / 2, nx = -(q[1] - p[1]) / far * w, ny = (q[0] - p[0]) / far * w;
    return [[p[0] - nx, p[1] - ny], [q[0] - nx, q[1] - ny], [q[0] + nx, q[1] + ny], [p[0] + nx, p[1] + ny]];
};

const overlapsBox = (lo: number[], hi: number[], box: Slab['box']) =>
    lo[0] <= box.max[0] && box.min[0] <= hi[0] && lo[1] <= box.max[1] && box.min[1] <= hi[1];

// Case parts that run into each other: two parts' slabs that overlap in height, where their material overlaps seen
// from above (both shrink by TOLERANCE, so parts that only touch, one on another, don't count). A part posed under or
// beside the stack (the tenting legs under the bottom plate) is a case part too: only this sees it run into another.
// Each pair once, with its largest overlap over the heights.
export const findLayerCollisions = (slabs: Slab[]): Collision[] => {
    const found: Collision[] = [];
    slabs.forEach((a, i) => slabs.slice(i + 1).forEach(b => {
        if (a.name === b.name || a.z1 <= b.z0 || b.z1 <= a.z0 || !overlapsBox(a.box.min, a.box.max, b.box)) return;
        const common = a.material.intersect(b.material);
        const overlap = common.area();
        common.delete();
        if (overlap <= MIN_AREA) return;
        const same = found.find(c => c.reference === a.name && c.layer === b.name);
        if (same) same.area = Math.max(same.area, overlap);
        else found.push({body: -1, reference: a.name, model: '', layer: b.name, area: overlap});
    }));
    return found;
};

const area = (section: any, slab: Slab) => {
    const common = section.intersect(slab.material);
    const a = common.area();
    common.delete();
    return a;
};

export const findCollisions = async (wasm: any, bodies: Body[], slabs: Slab[],
                                     progress?: (done: number, total: number) => void): Promise<Collision[]> => {
    const found: Collision[] = [];
    const add = (i: number, slab: Slab, a: number) => {
        if (a <= MIN_AREA) return;
        const b = bodies[i];
        const same = found.find(c => c.body === i && c.layer === slab.name);
        if (same) same.area += a;
        else found.push({body: i, reference: b.reference, model: b.model, layer: slab.name, area: a});
    };
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.section) {
            slabs.forEach(slab => {
                if ((b.bottom as number) < slab.z1 && slab.z0 < (b.top as number)) add(i, slab, area(b.section, slab));
            });
        } else {
            // the part's corners where the view has them
            const p = b.positions as Float32Array, e = (b.matrix as Matrix4).elements;
            const world = new Float32Array(p.length);
            const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
            for (let k = 0; k < p.length; k += 3) {
                const [x, y, z] = [p[k], p[k + 1], p[k + 2]];
                for (let r = 0; r < 3; r++) {
                    const v = e[r] * x + e[4 + r] * y + e[8 + r] * z + e[12 + r];
                    world[k + r] = v;
                    if (v < lo[r]) lo[r] = v;
                    if (v > hi[r]) hi[r] = v;
                }
            }
            const index = b.index as Uint32Array;
            slabs.forEach(slab => {
                if (hi[2] <= slab.z0 || lo[2] >= slab.z1 || !overlapsBox(lo, hi, slab.box)) return;
                const shadows: [number, number][][] = [];
                for (let t = 0; t < index.length; t += 3) {
                    const corner = (k: number): V => [world[3 * index[t + k]], world[3 * index[t + k] + 1], world[3 * index[t + k] + 2]];
                    const tri = [corner(0), corner(1), corner(2)];
                    if (Math.max(tri[0][2], tri[1][2], tri[2][2]) <= slab.z0 || Math.min(tri[0][2], tri[1][2], tri[2][2]) >= slab.z1) continue;
                    const s = shadowOf(tri, slab.z0, slab.z1);
                    if (s) shadows.push(s);
                }
                if (!shadows.length) return;
                const shadow = wasm.CrossSection.ofPolygons(shadows, 'Positive');
                add(i, slab, area(shadow, slab));
                shadow.delete();
            });
        }
        // let the page draw now and then: a board has hundreds of model parts
        if (i % 10 === 9) {
            progress?.(i + 1, bodies.length);
            await new Promise(resolve => setTimeout(resolve));
        }
    }
    return found.sort((a, b) => b.area - a.area);
};
