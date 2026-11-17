// What a 3D view of a .kicad_pcb needs from it: the board's outline, holes and pads, and every footprint's 3D
// models with where the footprint sits. Coordinates stay KiCad's: mm, y pointing down.
import {child, children, head, isList, num, parseSexpr, SExpr, xy, xyz} from "../sexpr";

export type Pt = [number, number];

export type Model3d = {
    // as the footprint gives it, e.g. ${KICAD8_3DMODEL_DIR}/Resistor_SMD.3dshapes/R_0603_1608Metric.wrl
    path: string,
    offset: [number, number, number],
    scale: [number, number, number],
    rotate: [number, number, number],
    opacity: number,
};

export type PlacedFootprint = {
    reference: string,
    at: Pt,
    // degrees, counter-clockwise as KiCad shows it
    angle: number,
    back: boolean,
    models: Model3d[],
};

// copper of one pad or via, as a polygon on the board
export type Copper = { outline: Pt[], front: boolean, back: boolean };

// a round hole has w === h; a slot is w long along `angle` (degrees) and h wide
export type Hole = { at: Pt, w: number, h: number, angle: number };

export type BoardData = {
    thickness: number,
    // closed loops of the board edge, the outer one and any cut-outs
    outline: Pt[][],
    holes: Hole[],
    copper: Copper[],
    footprints: PlacedFootprint[],
};

const DEG = Math.PI / 180;

// a footprint's own coordinates to the board's (KiCad stores pads and graphics relative to the footprint)
type Place = (p: Pt) => Pt;
export const placer = (at: Pt, angle: number): Place => {
    const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG);
    return ([x, y]) => [at[0] + x * c + y * s, at[1] - x * s + y * c];
};
const identity: Place = p => p;

const circlePoints = (centre: Pt, radius: number, segments: number, from = 0, sweep = 360): Pt[] => {
    const points: Pt[] = [];
    const whole = Math.abs(sweep) >= 360;
    const steps = whole ? segments : Math.max(1, Math.ceil(segments * Math.abs(sweep) / 360));
    for (let i = 0; i <= (whole ? steps - 1 : steps); i++) {
        const a = (from + sweep * i / steps) * DEG;
        points.push([centre[0] + radius * Math.cos(a), centre[1] + radius * Math.sin(a)]);
    }
    return points;
};

// the arc through start, mid and end, as points from start to end
export const arcPoints = (start: Pt, mid: Pt, end: Pt, segmentsPerCircle = 72): Pt[] => {
    const [ax, ay] = start, [bx, by] = mid, [cx, cy] = end;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return [start, end];
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    const radius = Math.hypot(ax - ux, ay - uy);
    const angle = (p: Pt) => Math.atan2(p[1] - uy, p[0] - ux) / DEG;
    const a0 = angle(start), a1 = angle(mid), a2 = angle(end);
    const ccw = (x: number) => ((x % 360) + 360) % 360;
    // go the way that passes mid
    let sweep = ccw(a2 - a0);
    if (ccw(a1 - a0) > sweep) sweep -= 360;
    const points = circlePoints([ux, uy], radius, segmentsPerCircle, a0, sweep);
    points[0] = start;
    points[points.length - 1] = end;
    return points;
};

const near = (a: Pt, b: Pt, tolerance: number) => Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;

// Joins lines and arcs end to end into closed loops; whatever doesn't close is left out, as KiCad would refuse
// the board edge anyway.
export const chainLoops = (paths: Pt[][], tolerance = 0.01): Pt[][] => {
    const open = paths.filter(p => p.length > 1).map(p => p.slice());
    const loops: Pt[][] = [];
    while (open.length) {
        let line = open.pop() as Pt[];
        let grew = true;
        while (grew && !near(line[0], line[line.length - 1], tolerance)) {
            grew = false;
            const end = line[line.length - 1];
            for (let i = 0; i < open.length; i++) {
                const next = open[i];
                if (near(end, next[0], tolerance)) {
                    line = line.concat(next.slice(1));
                } else if (near(end, next[next.length - 1], tolerance)) {
                    line = line.concat(next.slice(0, -1).reverse());
                } else {
                    continue;
                }
                open.splice(i, 1);
                grew = true;
                break;
            }
        }
        if (line.length > 3 && near(line[0], line[line.length - 1], tolerance)) loops.push(line.slice(0, -1));
    }
    return loops;
};

const layerOf = (node: SExpr[]) => {
    const layer = child(node, 'layer');
    return typeof layer?.[1] === 'string' ? layer[1] : '';
};

// one Edge.Cuts item (gr_* on the board, fp_* in a footprint): an open path, or a closed loop
const edgeItem = (item: SExpr[], place: Place): { path?: Pt[], loop?: Pt[] } => {
    const kind = (head(item) || '').replace(/^(gr|fp)_/, '');
    const start = child(item, 'start'), end = child(item, 'end');
    if (kind === 'line') return {path: [place(xy(start)), place(xy(end))]};
    if (kind === 'arc') {
        const mid = child(item, 'mid');
        if (mid) return {path: arcPoints(place(xy(start)), place(xy(mid)), place(xy(end)))};
        // KiCad 5: start is the centre, end the arc's start, angle its sweep (clockwise on screen)
        const centre = xy(start), from = xy(end);
        const r = Math.hypot(from[0] - centre[0], from[1] - centre[1]);
        const a0 = Math.atan2(from[1] - centre[1], from[0] - centre[0]) / DEG;
        return {path: circlePoints(centre, r, 72, a0, num(child(item, 'angle')?.[1])).map(place)};
    }
    if (kind === 'circle') {
        const centre = xy(child(item, 'center')), edge = xy(end);
        return {loop: circlePoints(centre, Math.hypot(edge[0] - centre[0], edge[1] - centre[1]), 72).map(place)};
    }
    if (kind === 'rect') {
        const [x0, y0] = xy(start), [x1, y1] = xy(end);
        return {loop: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => place(p as Pt))};
    }
    if (kind === 'poly') return {loop: polyPoints(child(item, 'pts')).map(place)};
    return {};
};

const polyPoints = (pts: SExpr[] | undefined): Pt[] => {
    const points: Pt[] = [];
    for (const p of (pts || []).filter(isList)) {
        if (head(p) === 'xy') points.push(xy(p));
        else if (head(p) === 'arc') points.push(...arcPoints(xy(child(p, 'start')), xy(child(p, 'mid')), xy(child(p, 'end'))).slice(points.length ? 1 : 0));
    }
    return points;
};

const roundRect = (w: number, h: number, r: number): Pt[] => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (r < 1e-6) return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const x = w / 2 - r, y = h / 2 - r;
    return [
        ...circlePoints([x, y], r, 32, 0, 90),
        ...circlePoints([-x, y], r, 32, 90, 90),
        ...circlePoints([-x, -y], r, 32, 180, 90),
        ...circlePoints([x, -y], r, 32, 270, 90),
    ];
};

// a pad's copper around its own centre, before it is turned
const padShape = (shape: string, w: number, h: number, pad: SExpr[]): Pt[][] => {
    if (shape === 'circle') return [circlePoints([0, 0], w / 2, 32)];
    if (shape === 'oval') return [roundRect(w, h, Math.min(w, h) / 2)];
    if (shape === 'roundrect') return [roundRect(w, h, num(child(pad, 'roundrect_rratio')?.[1], 0.25) * Math.min(w, h))];
    if (shape === 'custom') {
        const anchor = child(child(pad, 'options'), 'anchor')?.[1];
        const shapes = [anchor === 'circle' ? circlePoints([0, 0], w / 2, 32) : roundRect(w, h, 0)];
        for (const p of (child(pad, 'primitives') || []).filter(isList)) {
            if (head(p) === 'gr_poly') shapes.push(polyPoints(child(p, 'pts')));
            else if (head(p) === 'gr_rect') {
                const [x0, y0] = xy(child(p, 'start')), [x1, y1] = xy(child(p, 'end'));
                shapes.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
            } else if (head(p) === 'gr_circle') {
                const c = xy(child(p, 'center')), e = xy(child(p, 'end'));
                shapes.push(circlePoints(c, Math.hypot(e[0] - c[0], e[1] - c[1]), 32));
            }
        }
        return shapes.filter(s => s.length > 2);
    }
    // rect, and trapezoid without its slant
    return [roundRect(w, h, 0)];
};

const copperSides = (layers: SExpr[] | undefined) => {
    const names = (layers || []).slice(1).filter((l): l is string => typeof l === 'string');
    const any = names.some(l => l === '*.Cu' || l === 'F&B.Cu');
    return {front: any || names.includes('F.Cu'), back: any || names.includes('B.Cu')};
};

const readPad = (pad: SExpr[], place: Place, board: BoardData) => {
    const type = pad[2], shape = typeof pad[3] === 'string' ? pad[3] : 'rect';
    const at = child(pad, 'at');
    const centre = place(xy(at));
    const angle = num(at?.[3]);
    const [w, h] = xy(child(pad, 'size'));
    // pad-local to board: the pad's angle in a board file is its own plus the footprint's
    const turn = placer(centre, angle);
    const drill = child(pad, 'drill');
    if (drill) {
        const oval = drill[1] === 'oval';
        const dw = num(drill[oval ? 2 : 1]), dh = oval ? num(drill[3], dw) : dw;
        if (dw > 0) {
            const offset = child(drill, 'offset');
            board.holes.push({at: offset ? turn(xy(offset)) : centre, w: Math.max(dw, dh), h: Math.min(dw, dh), angle: dw >= dh ? angle : angle + 90});
        }
    }
    if (type === 'np_thru_hole') return;
    const sides = copperSides(child(pad, 'layers'));
    if (!sides.front && !sides.back) return;
    for (const outline of padShape(shape, w, h, pad)) board.copper.push({outline: outline.map(turn), ...sides});
};

const readModel = (node: SExpr[]): Model3d | null => {
    const path = node[1];
    if (typeof path !== 'string' || !path) return null;
    if (node.includes('hide') || child(node, 'hide')?.[1] === 'yes') return null;
    // KiCad 5 gave the offset in inches, as (at (xyz ...))
    const offset = child(node, 'offset');
    const legacy = child(node, 'at');
    const [ox, oy, oz] = offset ? xyz(child(offset, 'xyz')) : legacy ? xyz(child(legacy, 'xyz')).map(v => v * 25.4) : [0, 0, 0];
    return {
        path,
        offset: [ox, oy, oz],
        scale: xyz(child(child(node, 'scale'), 'xyz'), 1),
        rotate: xyz(child(child(node, 'rotate'), 'xyz')),
        opacity: num(child(node, 'opacity')?.[1], 1),
    };
};

const referenceOf = (fp: SExpr[]) => {
    const property = children(fp, 'property').find(p => p[1] === 'Reference');
    const text = children(fp, 'fp_text').find(t => t[1] === 'reference');
    const value = (property || [])[2] ?? (text || [])[2];
    return typeof value === 'string' ? value : '';
};

export const readBoard = (text: string): BoardData => {
    const pcb = parseSexpr(text).find(n => head(n) === 'kicad_pcb') as SExpr[] | undefined;
    if (!pcb) throw new Error('not a KiCad board');
    const board: BoardData = {
        thickness: num(child(child(pcb, 'general'), 'thickness')?.[1], 1.6),
        outline: [], holes: [], copper: [], footprints: [],
    };
    const paths: Pt[][] = [];
    const addEdge = (item: SExpr[], place: Place) => {
        if (layerOf(item) !== 'Edge.Cuts') return;
        const {path, loop} = edgeItem(item, place);
        if (path) paths.push(path);
        if (loop && loop.length > 2) board.outline.push(loop);
    };
    for (const item of pcb.filter(isList)) {
        const kind = head(item);
        if (kind && kind.startsWith('gr_')) addEdge(item, identity);
        else if (kind === 'via') {
            const at = xy(child(item, 'at'));
            const size = num(child(item, 'size')?.[1]), drill = num(child(item, 'drill')?.[1]);
            if (drill > 0) board.holes.push({at, w: drill, h: drill, angle: 0});
            board.copper.push({outline: circlePoints(at, size / 2, 16), front: true, back: true});
        } else if (kind === 'footprint' || kind === 'module') {
            const at = child(item, 'at');
            const fp: PlacedFootprint = {
                reference: referenceOf(item),
                at: xy(at),
                angle: num(at?.[3]),
                back: layerOf(item) === 'B.Cu',
                models: children(item, 'model').map(readModel).filter((m): m is Model3d => !!m),
            };
            board.footprints.push(fp);
            const place = placer(fp.at, fp.angle);
            for (const c of item.filter(isList)) {
                const k = head(c) || '';
                if (k === 'pad') readPad(c, place, board);
                else if (k.startsWith('fp_')) addEdge(c, place);
            }
        }
    }
    board.outline.push(...chainLoops(paths));
    return board;
};
