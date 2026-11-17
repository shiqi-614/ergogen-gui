// The board's body and copper as three.js geometry, cut with manifold-3d: the WebAssembly library ergogen builds
// the cases with, from the URL index.html gives it.
import {BufferAttribute, BufferGeometry} from "three";
import {BoardData, Hole, placer, Pt} from "./board";

// copper layer thickness, mm
const COPPER = 0.035;
// as the 3D view draws: linear, from sRGB
const linear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const SOLDER_MASK = [0.08, 0.3, 0.16].map(linear) as [number, number, number];
const BOARD_EDGE = [0.72, 0.65, 0.45].map(linear) as [number, number, number];

let starting: Promise<any> | null = null;
export const loadManifold = () => starting || (starting = (async () => {
    const url = (window as any).ergogenManifoldUrl;
    if (!url) throw new Error('index.html gives no manifold-3d URL');
    const wasm = await (await import(/* @vite-ignore */ url)).default();
    wasm.setup();
    return wasm;
})().catch(error => {
    starting = null;
    throw error;
}));

// Board coordinates (y down) to the 3D view's (y up), counter-clockwise as manifold's "Positive" fill rule wants
// them, so overlapping pads unite instead of cancelling out.
export const toView = (loop: Pt[]): [number, number][] => {
    const points = loop.map(([x, y]): [number, number] => [x, -y]);
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
        area += x0 * y1 - x1 * y0;
    }
    return area < 0 ? points.reverse() : points;
};

const SEGMENTS = 24;

// a round hole, or a slot: a stadium hole.w long and hole.h wide along hole.angle
export const holeOutline = (hole: Hole): Pt[] => {
    const r = hole.h / 2, straight = Math.max(0, hole.w - hole.h) / 2;
    const points: Pt[] = [];
    if (straight < 1e-6) {
        for (let i = 0; i < SEGMENTS; i++) points.push([r * Math.cos(2 * Math.PI * i / SEGMENTS), r * Math.sin(2 * Math.PI * i / SEGMENTS)]);
    } else {
        const half = SEGMENTS / 2;
        for (let i = 0; i <= half; i++) {
            const a = -Math.PI / 2 + Math.PI * i / half;
            points.push([straight + r * Math.cos(a), r * Math.sin(a)]);
        }
        for (let i = 0; i <= half; i++) {
            const a = Math.PI / 2 + Math.PI * i / half;
            points.push([-straight + r * Math.cos(a), r * Math.sin(a)]);
        }
    }
    return points.map(placer(hole.at, hole.angle));
};

// flat-shaded triangles; colour, if given, by each triangle's normal
const toGeometry = (solid: any, colourOf?: (nz: number) => [number, number, number]) => {
    const {numProp, vertProperties, triVerts} = solid.getMesh();
    const position = new Float32Array(triVerts.length * 3);
    for (let i = 0; i < triVerts.length; i++) {
        const v = triVerts[i] * numProp;
        position[3 * i] = vertProperties[v];
        position[3 * i + 1] = vertProperties[v + 1];
        position[3 * i + 2] = vertProperties[v + 2];
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.computeVertexNormals();
    if (colourOf) {
        const normal = geometry.getAttribute('normal') as BufferAttribute;
        const colour = new Float32Array(position.length);
        for (let i = 0; i < normal.count; i++) colour.set(colourOf(normal.getZ(i)), 3 * i);
        geometry.setAttribute('color', new BufferAttribute(colour, 3));
    }
    return geometry;
};

export type BoardGeometry = { body: BufferGeometry, front: BufferGeometry | null, back: BufferGeometry | null };

// the board's outline and its holes (null without any) as cross-sections, which the caller deletes
const sections = (CrossSection: any, board: BoardData) => ({
    outline: CrossSection.ofPolygons(board.outline.map(toView), 'EvenOdd'),
    holes: board.holes.length ? CrossSection.ofPolygons(board.holes.map(h => toView(holeOutline(h))), 'Positive') : null,
});

// the board's section, its outline less its holes, as seen from above (y up), for collision checks; the caller
// deletes it
export const boardSection = async (board: BoardData): Promise<any> => {
    if (!board.outline.length) throw new Error('the board has no closed outline on Edge.Cuts');
    const {CrossSection} = await loadManifold();
    const {outline, holes} = sections(CrossSection, board);
    if (!holes) return outline;
    try {
        return outline.subtract(holes);
    } finally {
        outline.delete();
        holes.delete();
    }
};

export const buildBoard = async (board: BoardData): Promise<BoardGeometry> => {
    if (!board.outline.length) throw new Error('the board has no closed outline on Edge.Cuts');
    const {CrossSection} = await loadManifold();
    const made: any[] = [];
    const keep = <T, >(x: T): T => {
        if (!made.includes(x)) made.push(x);
        return x;
    };
    try {
        const {outline, holes} = sections(CrossSection, board);
        keep(outline);
        if (holes) keep(holes);
        const body = keep(keep(holes ? outline.subtract(holes) : outline).extrude(board.thickness));
        const copper = (side: 'front' | 'back') => {
            const loops = board.copper.filter(c => c[side]).map(c => toView(c.outline));
            if (!loops.length) return null;
            let section = keep(CrossSection.ofPolygons(loops, 'Positive'));
            if (holes) section = keep(section.subtract(holes));
            const solid = keep(keep(section.extrude(COPPER)).translate([0, 0, side === 'front' ? board.thickness : -COPPER]));
            return toGeometry(solid);
        };
        return {
            body: toGeometry(body, nz => Math.abs(nz) > 0.5 ? SOLDER_MASK : BOARD_EDGE),
            front: copper('front'),
            back: copper('back'),
        };
    } finally {
        made.forEach(x => x.delete());
    }
};
