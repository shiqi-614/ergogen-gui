// Shifts the way ergogen writes them: relative to a key, in the key's own frame (turned with it, and
// with x the other way on a mirrored key). In ergogen's coordinates, y up. The layout and the pcb
// editors both place and move things this way.

export type Vec = { x: number, y: number };
export type KeyFrame = { r: number, mirrored: boolean };
type KeyPoint = { x: number, y: number, r: number, meta?: { mirrored?: boolean } };

export const rotate = (v: Vec, degrees: number): Vec => {
    const a = degrees * Math.PI / 180;
    return {x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a)};
};

export const frameOf = (key?: KeyPoint): KeyFrame => ({r: key?.r ?? 0, mirrored: !!key?.meta?.mirrored});

// an offset on the board as a shift in a frame, and back
export const toFrame = (delta: Vec, frame: KeyFrame): Vec => {
    const local = rotate(delta, -frame.r);
    return frame.mirrored ? {x: -local.x, y: local.y} : local;
};

export const fromFrame = (local: Vec, frame: KeyFrame): Vec =>
    rotate({x: frame.mirrored ? -local.x : local.x, y: local.y}, frame.r);

// the key nearest to a point, of those keep lets through
export const nearestKey = <P extends KeyPoint>(points: Record<string, P>, at: Vec, keep: (name: string, p: P) => boolean = () => true): string | null => {
    let ref: string | null = null, best = Infinity;
    for (const [name, p] of Object.entries(points)) {
        if (!keep(name, p)) continue;
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        if (d < best) [ref, best] = [name, d];
    }
    return ref;
};

const round = (value: number, step: number) => Math.round(value / step) * step;

// A point as a shift from a key, rounded to step (exact without one), and where that shift lands
export const shiftFrom = (key: KeyPoint, at: Vec, step?: number): { shift: [number, number], at: Vec } => {
    const frame = frameOf(key);
    const local = toFrame({x: at.x - key.x, y: at.y - key.y}, frame);
    const shift: [number, number] = step ? [round(local.x, step), round(local.y, step)] : [local.x, local.y];
    const moved = fromFrame({x: shift[0], y: shift[1]}, frame);
    return {shift, at: {x: key.x + moved.x, y: key.y + moved.y}};
};
