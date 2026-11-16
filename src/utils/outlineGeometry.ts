// Where ergogen puts an outline's anchors, worked out in the browser so the layout editor can draw
// and drag them. It follows ergogen's anchor rules for the common case (a ref, or the previous
// anchor, then orient, shift and rotate) and skips anything fancier, like aggregates.

export type Placed = { x: number, y: number, r: number, mirrored: boolean };
export type Evaluate = (expr: string) => number;
type PointLike = { x: number, y: number, r: number, meta?: { mirrored?: boolean } };

// An anchor in the config, where it ends up, and the frame (degrees) its shift is applied in
export type OutlineHandle = {
    kind: 'vertex' | 'center',
    key: string,
    // the key the anchor is written relative to, when it names one
    ref?: string,
    path: (string | number)[],
    label: string,
    at: Placed,
    frame: number,
    polygon?: string,
    index?: number,
};

export type Polygon = { id: string, handles: OutlineHandle[] };

const ORIGIN: Placed = {x: 0, y: 0, r: 0, mirrored: false};

const rotate = (x: number, y: number, degrees: number): [number, number] => {
    const a = degrees * Math.PI / 180;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

const refOf = (raw: any): string | undefined => {
    const ref = typeof raw === 'string' ? raw : raw?.ref;
    if (typeof ref === 'string') return ref;
    return Array.isArray(ref) && ref.length === 1 && typeof ref[0] === 'string' ? ref[0] : undefined;
};

export const resolveAnchor = (
    raw: any, points: Record<string, PointLike>, start: Placed, evaluate: Evaluate
): { at: Placed, frame: number } | null => {
    if (typeof raw === 'string') raw = {ref: raw};
    if (raw === undefined || raw === null) return {at: {...start}, frame: start.r};
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (raw.aggregate !== undefined || raw.affect !== undefined) return null;

    let ref = raw.ref;
    if (Array.isArray(ref)) {
        if (ref.length !== 1) return null;
        ref = ref[0];
    }
    let p: Placed;
    if (ref === undefined) {
        p = {...start};
    } else if (typeof ref === 'string' && points[ref]) {
        const q = points[ref];
        p = {x: q.x, y: q.y, r: q.r, mirrored: !!q.meta?.mirrored};
    } else {
        return null;
    }

    const value = (v: unknown) => typeof v === 'number' ? v : evaluate(String(v));
    // a mirrored point turns and shifts the other way
    const sign = p.mirrored ? -1 : 1;
    if (raw.orient !== undefined) p.r += sign * value(raw.orient);
    const frame = p.r;
    if (raw.shift !== undefined) {
        const [sx, sy] = Array.isArray(raw.shift) ? raw.shift.map(value) : [value(raw.shift), value(raw.shift)];
        const [dx, dy] = rotate(sign * sx, sy, p.r);
        p.x += dx;
        p.y += dy;
    }
    if (raw.rotate !== undefined) p.r += sign * value(raw.rotate);
    if (![p.x, p.y, p.r].every(Number.isFinite)) return null;
    return {at: p, frame};
};

// The draggable anchors of one outline: every point of its polygons, and the where of its other parts
export const outlineHandles = (
    config: any, outline: string, points: Record<string, PointLike>, evaluate: Evaluate
): { handles: OutlineHandle[], polygons: Polygon[], skipped: string[] } => {
    const handles: OutlineHandle[] = [];
    const polygons: Polygon[] = [];
    const skipped: string[] = [];
    const parts = config?.outlines?.[outline];
    if (!parts || typeof parts !== 'object') return {handles, polygons, skipped};
    const entries: [string | number, any][] = Array.isArray(parts) ? parts.map((part, i) => [i, part]) : Object.entries(parts);

    for (const [key, part] of entries) {
        if (!part || typeof part !== 'object') continue;
        const name = `${outline}.${key}`;
        try {
            if (part.what === 'polygon' && part.where === undefined && Array.isArray(part.points)) {
                const polygon: Polygon = {id: name, handles: []};
                // each point starts from the one before it, so a point this can't place ends the polygon here
                let last = ORIGIN;
                for (let i = 0; i < part.points.length; i++) {
                    const placed = resolveAnchor(part.points[i], points, last, evaluate);
                    if (!placed) {
                        skipped.push(`${name}.points[${i}]`);
                        break;
                    }
                    const path = ['outlines', outline, key, 'points', i];
                    polygon.handles.push({
                        kind: 'vertex', key: path.join('.'), path, label: `${name}.points[${i}]`, ref: refOf(part.points[i]),
                        at: placed.at, frame: placed.frame, polygon: name, index: i,
                    });
                    last = placed.at;
                }
                if (polygon.handles.length === part.points.length) polygons.push(polygon);
                handles.push(...polygon.handles);
            } else if (part.where && typeof part.where === 'object' && !Array.isArray(part.where)) {
                const placed = resolveAnchor(part.where, points, ORIGIN, evaluate);
                if (!placed) {
                    skipped.push(`${name}.where`);
                    continue;
                }
                const path = ['outlines', outline, key, 'where'];
                handles.push({kind: 'center', key: path.join('.'), path, label: `${name}.where`, ref: refOf(part.where), at: placed.at, frame: placed.frame});
            }
        } catch (e: unknown) {
            skipped.push(name);
        }
    }
    return {handles, polygons, skipped};
};

// Edges that are within a few degrees of horizontal or vertical without being exactly so:
// usually a typo in the numbers rather than a design choice. Below 0.0001° (0.0001 mm over 50 mm)
// is float noise, not a typo.
export const nearMisses = (polygon: Polygon, limit = 3) => {
    const misses: { from: OutlineHandle, to: OutlineHandle, off: number }[] = [];
    const list = polygon.handles;
    list.forEach((from, i) => {
        const to = list[(i + 1) % list.length];
        const angle = Math.atan2(to.at.y - from.at.y, to.at.x - from.at.x) * 180 / Math.PI;
        const off = Math.min(...[-180, -90, 0, 90, 180].map(t => Math.abs(angle - t)));
        if (off > 1e-4 && off < limit) misses.push({from, to, off});
    });
    return misses;
};
