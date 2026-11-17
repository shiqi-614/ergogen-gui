// What the layout editor's parts share: the keys ergogen places and how a drag moves them before
// ergogen recomputes them, where a column is anchored, and the points-only ergogen run itself
import yaml from "js-yaml";
import {EditSite, Length, parseLength} from "../../utils/layoutEdit";
import {rotate} from "../../utils/keyFrame";

export {rotate};

export type Meta = {
    name: string,
    width: number,
    height: number,
    orient: number,
    rotate: number,
    shift: [number, number],
    padding: number,
    stagger: number,
    spread: number,
    splay: number,
    mirrored?: boolean,
    row: string,
    zone: { name: string },
    col: { name: string },
};
export type Point = { x: number, y: number, r: number, meta: Meta };
export type Points = Record<string, Point>;
export type Units = Record<string, number>;
// a column, and the row and half (mirrored or not) of the key it was picked by
export type Column = { zone: string, col: string, row?: string, mirrored?: boolean };
export type View = { x: number, y: number, w: number, h: number };
export type Vec = { x: number, y: number };
export type Side = 'source' | 'mirror';
export type Site = EditSite | string;

// What a drag has done to keys that ergogen hasn't recomputed yet: rotate them around
// their side's pivot, then move them, in board millimetres. Mirrored keys do the mirror image.
// mirrorDx moves every mirrored key, for when the drag moves the mirror axis itself.
export type Transform = { names: Set<string>, dx: number, dy: number, angle: number, pivots: Partial<Record<Side, Vec>>, mirrorDx?: number };

// where ergogen anchors a column: the pivot of its splay, and the direction its rows go (degrees)
export type Frame = { pivot: Vec, theta: number, top: number };

export const round = (value: number, step: number) => Math.round(value / step) * step;
export const format = (value: number) => String(Number(value.toFixed(2)));
export const radians = (degrees: number) => degrees * Math.PI / 180;

export const rotateAround = (v: Vec, pivot: Vec, degrees: number): Vec => {
    const turned = rotate({x: v.x - pivot.x, y: v.y - pivot.y}, degrees);
    return {x: pivot.x + turned.x, y: pivot.y + turned.y};
};

export type Computed = { points: Points, units: Units, config: any, paths: Record<string, string>, outlineError?: string };

// Only the points (and the outlines, when one is shown) are needed to draw the layout. That still
// takes ergogen a few hundred milliseconds, so a drag moves things itself and ergogen runs on release.
export const computePoints = async (text: string, withOutlines: boolean): Promise<Computed> => {
    const config: any = yaml.load(text);
    if (!config || typeof config !== 'object') throw new Error('The config is empty');
    // ergogen changes the config it is given (it deletes each zone's anchor, for one), and the drags
    // read the config afterwards, so it gets a copy
    const copy = (value: unknown) => value === undefined ? {} : JSON.parse(JSON.stringify(value));
    const input = (outlines: unknown) => ({
        points: copy(config.points), units: copy(config.units), variables: copy(config.variables), outlines, pcbs: {},
    });
    if (withOutlines && config.outlines) {
        try {
            const results = await window.ergogen.processBasic(input(copy(config.outlines)), true, () => {});
            const paths: Record<string, string> = {};
            for (const [name, outline] of Object.entries(results.outlines ?? {}) as [string, any][]) {
                // origin [0, 0] keeps ergogen's coordinates, with y flipped like the view
                paths[name] = String((window as any).makerjs.exporter.toSVGPathData(outline.raw, {origin: [0, 0]}));
            }
            return {points: results.points, units: results.units ?? {}, config, paths};
        } catch (e: unknown) {
            // a broken outline shouldn't hide the keys
            const results = await window.ergogen.processBasic(input({}), true, () => {});
            return {points: results.points, units: results.units ?? {}, config, paths: {}, outlineError: String(e)};
        }
    }
    const results = await window.ergogen.processBasic(input({}), true, () => {});
    return {points: results.points, units: results.units ?? {}, config, paths: {}};
};

export const evaluator = (units: Units) => (expr: string): number => (window as any).math.evaluate(expr, {...units});

export const fitView = (points: Points): View | null => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of Object.values(points)) {
        const reach = Math.hypot(p.meta.width, p.meta.height) / 2;
        minX = Math.min(minX, p.x - reach);
        maxX = Math.max(maxX, p.x + reach);
        minY = Math.min(minY, p.y - reach);
        maxY = Math.max(maxY, p.y + reach);
    }
    if (minX === Infinity) return null;
    const margin = 20;
    // the drawing is flipped (ergogen's y points up), so the view's y range is flipped too
    return {x: minX - margin, y: -maxY - margin, w: maxX - minX + 2 * margin, h: maxY - minY + 2 * margin};
};

export const sameColumn = (p: Point, column: Column | null) =>
    !!column && p.meta.zone.name === column.zone && p.meta.col.name === column.col;

export const sideOf = (p: Point): Side => p.meta.mirrored ? 'mirror' : 'source';
export const signOf = (p: Point) => p.meta.mirrored ? -1 : 1;

export const place = (name: string, p: Point, t: Transform | null): { x: number, y: number, r: number } => {
    const axis = t?.mirrorDx && p.meta.mirrored ? t.mirrorDx : 0;
    if (!t?.names.has(name)) return axis ? {x: p.x + axis, y: p.y, r: p.r} : p;
    const sign = signOf(p);
    const pivot = t.pivots[sideOf(p)];
    const turned = t.angle && pivot ? rotateAround(p, pivot, sign * t.angle) : p;
    return {x: turned.x + sign * t.dx + axis, y: turned.y + t.dy, r: p.r + sign * t.angle};
};

// the order of a column's rows, as ergogen combines the zone's rows with the column's own
export const rowOrder = (config: any, column: Column): string[] => {
    const zone = config?.points?.zones?.[column.zone];
    const col = zone?.columns?.[column.col];
    const names = Object.keys(zone?.rows ?? {});
    for (const row of Object.keys(col?.rows ?? {})) if (!names.includes(row)) names.push(row);
    return names;
};

export const columnOrder = (config: any, zone: string): string[] =>
    Object.keys(config?.points?.zones?.[zone]?.columns ?? {});

// Works back from a key to its column's anchor: ergogen stacks the rows from there by their
// padding, then shifts each key in its own rotation. Mirrored keys are the mirror image of this.
export const columnFrame = (keys: Point[], rows: string[]): Frame | null => {
    const p = keys[0];
    if (!p) return null;
    const sign = signOf(p);
    const theta = p.r - sign * (p.meta.orient + p.meta.rotate);
    const [sx, sy] = p.meta.shift ?? [0, 0];
    const shift = rotate({x: sign * sx, y: sy}, p.r - sign * p.meta.rotate);
    const up = rotate({x: 0, y: Math.max(rows.indexOf(p.meta.row), 0) * p.meta.padding}, theta);
    const pivot = {x: p.x - shift.x - up.x, y: p.y - shift.y - up.y};
    // how far up the column reaches, for the rotate handle
    const along = rotate({x: 0, y: 1}, theta);
    const top = Math.max(...keys.map(k => (k.x - pivot.x) * along.x + (k.y - pivot.y) * along.y + k.meta.height / 2));
    return {pivot, theta, top};
};

export const editableLength = (site: Site | undefined, units: Units): { site: EditSite, like: Length | null } | string => {
    if (site === undefined) return 'unknown column';
    if (typeof site === 'string') return site;
    if (site.raw === undefined) return {site, like: null};
    const like = parseLength(site.raw, units);
    return like ? {site, like} : `it is "${site.raw}" in the config, change it in the panel`;
};
