// Where the parts of ergogen's preview board are, in KiCad's board coordinates (y down), for the pcb
// editor to draw boxes around them: a footprint's box comes from its own items in its own frame and
// is turned onto the board, so a turned part gets a turned box.

export type Vec = { x: number, y: number };

// a footprint's (or module's) outline: the corners of its box in its own frame, and its middle
export type Shape = { corners: Vec[], center: Vec };

// one footprint on the board: which config entry it is, and the key it is on (or relative to)
export type Instance = { key: string, name: string, point: { x: number, y: number, r: number }, keyName?: string, box: Shape };

// KiCanvas' footprint at an ergogen point: the preview board puts ergogen's (x, y) at KiCad's (x, -y)
export const boardFootprint = (footprints: any[], reference: string, point: Vec) => footprints.find(f => f.reference === reference
    && Math.abs(f.at.position.x - point.x) < 1e-3 && Math.abs(f.at.position.y + point.y) < 1e-3);

// KiCad turns a footprint's local coordinates by its angle, counter-clockwise on a board whose y is down
export const toBoard = (at: Vec, angle: number, local: Vec): Vec => {
    const a = angle * Math.PI / 180;
    return {x: at.x + local.x * Math.cos(a) + local.y * Math.sin(a), y: at.y - local.x * Math.sin(a) + local.y * Math.cos(a)};
};
export const toLocalFrame = (at: Vec, angle: number, board: Vec): Vec => {
    const a = angle * Math.PI / 180, dx = board.x - at.x, dy = board.y - at.y;
    return {x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a)};
};

// the box around local points, turned onto the board
export const shapeOf = (at: Vec, angle: number, local: Vec[]): Shape | null => {
    if (!local.length) return null;
    const xs = local.map(p => p.x), ys = local.map(p => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const corners = [{x: x0, y: y0}, {x: x1, y: y0}, {x: x1, y: y1}, {x: x0, y: y1}].map(c => toBoard(at, angle, c));
    return {corners, center: toBoard(at, angle, {x: (x0 + x1) / 2, y: (y0 + y1) / 2})};
};

export const layerName = (layer: any) => String(typeof layer === 'string' ? layer : layer?.name ?? '');

// A KiCanvas footprint's outline, from its items in its own coordinates: the courtyard when it has
// one (the area it needs), its pads and drawings when it doesn't
export const footprintShape = (f: any): Shape | null => {
    const drawingPoints = (d: any): Vec[] => {
        const out: Vec[] = [];
        for (const k of ['start', 'mid', 'end']) if (d?.[k] && typeof d[k].x === 'number') out.push({x: d[k].x, y: d[k].y});
        if (d?.center && d?.end) {
            const r = Math.hypot(d.end.x - d.center.x, d.end.y - d.center.y);
            out.push({x: d.center.x - r, y: d.center.y - r}, {x: d.center.x + r, y: d.center.y + r});
        }
        for (const list of [d?.pts, d?.polyline?.pts, d?.points]) {
            if (Array.isArray(list)) for (const p of list) if (p && typeof p.x === 'number') out.push({x: p.x, y: p.y});
        }
        return out;
    };
    const drawings: any[] = f.drawings ?? [];
    const courtyard = drawings.filter(d => layerName(d.layer).includes('CrtYd')).flatMap(drawingPoints);
    let local = courtyard;
    if (!local.length) {
        local = drawings.flatMap(drawingPoints);
        for (const pad of f.pads ?? []) {
            const w = (pad.size?.x ?? 0) / 2, h = (pad.size?.y ?? 0) / 2;
            // a pad's angle is stored absolute in a board file: its own turn is the difference
            const own = (pad.at?.rotation ?? 0) - (f.at?.rotation ?? 0);
            const c = {x: pad.at?.position?.x ?? 0, y: pad.at?.position?.y ?? 0};
            for (const corner of [{x: -w, y: -h}, {x: w, y: -h}, {x: w, y: h}, {x: -w, y: h}]) local.push(toBoard(c, own, corner));
        }
    }
    return shapeOf({x: f.at.position.x, y: f.at.position.y}, f.at.rotation ?? 0, local);
};

// A module's outline: its footprints' corners taken into the module's own frame, boxed there
export const moduleShape = (at: Vec, angle: number, shapes: Shape[]): Shape | null =>
    shapeOf(at, angle, shapes.flatMap(s => s.corners.map(c => toLocalFrame(at, angle, c))));

// The references ergogen's preview board gives footprints (src/kicad/preview_pcb.js): a footprint
// whose name starts with "key" is SW<key index>, "diode" D<key index>, others keep their name. Of
// several key (or diode) footprints on one key only the last is on the board.
export const ROLES: [string, string][] = [['key', 'SW'], ['diode', 'D']];

// a module's box around its footprints on the board, in the module's frame
export const moduleBoxes = (
    footprints: any[],
    modules: Record<string, { point?: { x: number, y: number, r: number }, footprints?: Record<string, { point: Vec }> }>,
): { module: string, box: Shape }[] =>
    Object.entries(modules).flatMap(([module, data]) => {
        const shapes = Object.entries(data.footprints ?? {})
            .map(([reference, fp]) => boardFootprint(footprints, reference, fp.point))
            .filter(Boolean).map(footprintShape).filter(Boolean) as Shape[];
        // the module's own point: KiCad's (x, -y), and its angle as is
        const at = data.point ? {x: data.point.x, y: -data.point.y} : shapes[0]?.center;
        const box = at && moduleShape(at, data.point?.r ?? 0, shapes);
        return box ? [{module, box}] : [];
    });

// Each of ergogen's footprints (pcbs.<pcb>.footprints of its results: a key per footprint per point)
// that is on the board, with the config entry it comes from (the entry object it shares)
export const footprintInstances = (
    footprints: any[],
    entries: Record<string, { point: any, config: any }>,
    configFootprints: Record<string, unknown>,
): Instance[] => {
    const list = Object.entries(entries);
    const configs = Object.entries(configFootprints);
    const nameOf = (key: string, config: unknown) => configs.find(([, c]) => c === config)?.[0] ?? key.replace(/_\d+$/, '');
    const role = (name: string) => ROLES.find(([prefix]) => name.startsWith(prefix));
    const last: Record<string, string> = {};
    for (const [key, entry] of list) {
        const r = role(nameOf(key, entry.config));
        if (r) last[`${r[0]}|${entry.point.meta?.name}`] = key;
    }
    return list.flatMap(([key, entry]) => {
        const name = nameOf(key, entry.config);
        const r = role(name);
        if (r && last[`${r[0]}|${entry.point.meta?.name}`] !== key) return [];
        const reference = r ? r[1] + entry.point.meta?.index : key;
        const board = boardFootprint(footprints, reference, entry.point);
        const box = board && footprintShape(board);
        if (!box) return [];
        return [{key, name, point: {x: entry.point.x, y: entry.point.y, r: entry.point.r}, keyName: entry.point.meta?.name, box}];
    });
};
