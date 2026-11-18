import {AnchorShift, Attr, Edit, EditSite, Length, applyEdits, formatLength, nudge} from "../../utils/layoutEdit";
import {OutlineHandle} from "../../utils/outlineGeometry";
import {fromFrame, toFrame} from "../../utils/keyFrame";
import {Column, Side, Site, Transform, Units, Vec, editableLength, format, rotate, round} from "./geometry";

// What dragging in the layout editor does, kept apart from the editor that runs it: a drag starts with what it
// moves and the config as it was, and every step works out, from where the pointer is now, how the view shows
// it (a transform of the keys, or where an outline point is), the config text it comes to, and the hint.

export type ColumnDrag = {
    kind: 'column',
    column: Column,
    sourceText: string,
    start: Vec,
    theta: number,
    mirrored: boolean,
    firstCol: boolean,
    own: Set<string>,
    withRest: Set<string>,
    base: Record<Attr, number>,
    sites: Record<Attr, Site>,
    // stagger and spread add up column by column: moving one column alone takes
    // the opposite change on the next one, so the columns after it stay put
    next?: { col: string, base: Record<Attr, number>, sites: Record<Attr, Site> },
    axis?: 'stagger' | 'spread',
    text?: string,
};

export type RotateDrag = {
    kind: 'rotate',
    sourceText: string,
    sign: number,
    pivot: Vec,
    startAngle: number,
    base: number,
    site: EditSite,
    withRest: Set<string>,
    pivots: Partial<Record<Side, Vec>>,
    text?: string,
};

export type ZoneDrag = {
    kind: 'zone',
    zone: string,
    sourceText: string,
    start: Vec,
    mirrored: boolean,
    // the frame the anchor's shift is in: its ref point's rotation plus its orient (radians)
    frame: number,
    base: [Length, Length],
    anchor: AnchorShift,
    names: Set<string>,
    // the global mirror is anchored on a key of this zone, so its axis moves with the zone
    movesAxis: boolean,
    text?: string,
};

// an outline polygon point, or the where of an outline part
export type HandleDrag = {
    kind: 'handle',
    handle: OutlineHandle,
    sourceText: string,
    start: Vec,
    shift: AnchorShift,
    // the polygon points before and after this one, to line it up with, with their shifts as written
    neighbors: { handle: OutlineHandle, raw: [string | undefined, string | undefined] }[],
    text?: string,
};

// one key, by its own shift: in its own frame (the column's turn, before the key's own rotate), x the other way
// on a mirrored key; the key on the other half moves with it
export type KeyDrag = {
    kind: 'key',
    name: string,
    sourceText: string,
    start: Vec,
    sign: number,
    frame: number,
    raw: [string | undefined, string | undefined],
    site: EditSite,
    names: Set<string>,
    text?: string,
};

export type Drag = ColumnDrag | RotateDrag | ZoneDrag | HandleDrag | KeyDrag;

// where a dragged outline handle is now, and the lines it snapped to
export type HandleAt = { key: string, at: Vec, guides: [Vec, Vec][] };

// one step of a drag: what the view shows (undefined: leave it), the config text it comes to, and the hint
export type DragStep = { transform?: Transform | null, handleAt?: HandleAt, text?: string, hint: string };

// where the pointer is, in board coordinates; Shift; how close (in board units) an outline point snaps
export type DragInput = { now: Vec, shiftKey: boolean, snap: number, units: Units };

const moveColumn = (d: ColumnDrag, {now, shiftKey, units}: DragInput): DragStep | null => {
    let dx = now.x - d.start.x;
    const dy = now.y - d.start.y;
    if (d.mirrored) dx = -dx;
    // the movement along and across the column
    const across = dx * Math.cos(d.theta) + dy * Math.sin(d.theta);
    const along = -dx * Math.sin(d.theta) + dy * Math.cos(d.theta);
    if (!d.axis) {
        if (Math.hypot(across, along) < 1) return null;
        // spread does nothing on a zone's first column
        d.axis = d.firstCol || Math.abs(along) >= Math.abs(across) ? 'stagger' : 'spread';
    }
    const axis = d.axis;
    // Shift drags the columns after this one along, as ergogen's own stagger and spread do
    const alone = !shiftKey && !!d.next;
    const own = editableLength(d.sites[axis], units);
    if (typeof own === 'string') return {hint: `Can't drag the ${axis} of ${d.column.col}: ${own}`};
    const next = alone && d.next ? editableLength(d.next.sites[axis], units) : null;
    if (typeof next === 'string') return {hint: `Can't keep ${d.next?.col} in place: ${next}. Hold Shift to move it too`};

    const value = round(d.base[axis] + (axis === 'stagger' ? along : across), 0.1);
    const change = value - d.base[axis];
    // back from the column's frame to the board's
    const move = rotate(axis === 'stagger' ? {x: 0, y: change} : {x: change, y: 0}, d.theta * 180 / Math.PI);
    const edits: Edit[] = [{site: own.site, value: formatLength(value, own.like)}];
    if (next && d.next) edits.push({site: next.site, value: formatLength(d.next.base[axis] - change, next.like)});
    return {
        transform: {names: alone ? d.own : d.withRest, dx: move.x, dy: move.y, angle: 0, pivots: {}},
        text: applyEdits(d.sourceText, edits),
        hint: `${axis}: ${format(value)} mm` + (next && d.next ? `, ${d.next.col} ${format(d.next.base[axis] - change)} so the columns after it stay put` : ''),
    };
};

const moveRotate = (d: RotateDrag, {now}: DragInput): DragStep => {
    let turned = (Math.atan2(now.y - d.pivot.y, now.x - d.pivot.x) - d.startAngle) * 180 / Math.PI;
    turned = ((turned + 540) % 360) - 180;
    // on the mirrored side the column turns the other way
    const value = round(d.base + d.sign * turned, 0.5);
    return {
        transform: {names: d.withRest, dx: 0, dy: 0, angle: value - d.base, pivots: d.pivots},
        text: applyEdits(d.sourceText, [{site: d.site, value: format(value)}]),
        hint: `splay: ${format(value)}°, the columns after it turn with it`,
    };
};

const moveZone = (d: ZoneDrag, {now}: DragInput): DragStep => {
    const dx = (now.x - d.start.x) * (d.mirrored ? -1 : 1);
    const dy = now.y - d.start.y;
    // the anchor's shift is in its ref point's frame
    const local = rotate({x: dx, y: dy}, -d.frame);
    const shift = {x: round(local.x, 0.1), y: round(local.y, 0.1)};
    const move = rotate(shift, d.frame);
    const x = formatLength(d.base[0].mm + shift.x, d.base[0]);
    const y = formatLength(d.base[1].mm + shift.y, d.base[1]);
    return {
        // ergogen mirrors across the x of the mirror's anchor: when that moves by dx, every mirrored key moves by 2 dx
        transform: {names: d.names, dx: move.x, dy: move.y, angle: 0, pivots: {}, mirrorDx: d.movesAxis ? 2 * move.x : 0},
        text: applyEdits(d.sourceText, d.anchor.edits(x, y)),
        hint: `zone ${d.zone} anchor shift: [${x}, ${y}]`,
    };
};

const moveKey = (d: KeyDrag, {now, units}: DragInput): DragStep => {
    const local = rotate({x: now.x - d.start.x, y: now.y - d.start.y}, -d.frame);
    const shift = {x: round(d.sign * local.x, 0.1), y: round(local.y, 0.1)};
    const move = rotate({x: d.sign * shift.x, y: shift.y}, d.frame);
    const x = nudge(d.raw[0], shift.x, units), y = nudge(d.raw[1], shift.y, units);
    return {
        // the transform moves the source half's way: x the other way for a key dragged on the mirrored half
        transform: {names: d.names, dx: d.sign * move.x, dy: move.y, angle: 0, pivots: {}},
        text: applyEdits(d.sourceText, [{site: d.site, value: `[${x}, ${y}]`}]),
        hint: `${d.name} shift: [${x}, ${y}]`,
    };
};

const moveHandle = (d: HandleDrag, {now, snap, units}: DragInput): DragStep => {
    const {at, frame} = d.handle;
    const wanted = {x: at.x + now.x - d.start.x, y: at.y + now.y - d.start.y};
    // line up with a neighbouring point when within a few pixels of it
    const guides: [Vec, Vec][] = [];
    const snappedTo: { x?: HandleDrag['neighbors'][number], y?: HandleDrag['neighbors'][number] } = {};
    for (const n of d.neighbors) {
        if (!snappedTo.x && Math.abs(wanted.x - n.handle.at.x) < snap) {
            wanted.x = n.handle.at.x;
            snappedTo.x = n;
            guides.push([n.handle.at, wanted]);
        }
        if (!snappedTo.y && Math.abs(wanted.y - n.handle.at.y) < snap) {
            wanted.y = n.handle.at.y;
            snappedTo.y = n;
            guides.push([n.handle.at, wanted]);
        }
    }
    const snapped = {x: !!snappedTo.x, y: !!snappedTo.y};
    // from the board to the frame the shift is in; a mirrored anchor shifts x the other way
    const local = toFrame({x: wanted.x - at.x, y: wanted.y - at.y}, {r: frame, mirrored: at.mirrored});
    // in a turned frame a snapped board axis mixes both shift values, so both stay exact
    const turned = Math.abs(((frame % 90) + 90) % 90) > 1e-9;
    const exact = turned && (snapped.x || snapped.y) ? {x: true, y: true} : snapped;
    if (!exact.x) local.x = round(local.x, 0.1);
    if (!exact.y) local.y = round(local.y, 0.1);
    // Lined up with a point on the same, unturned key: write the same text it has ("1ky + 3"),
    // so the edge is exactly straight and stays so when the keys move
    const copies = (n: HandleDrag['neighbors'][number] | undefined, axis: 0 | 1) =>
        !!n && n.handle.ref !== undefined && n.handle.ref === d.handle.ref && n.raw[axis] !== undefined
        && Math.abs(frame % 360) < 1e-9 && Math.abs(n.handle.frame % 360) < 1e-9;
    const x = copies(snappedTo.x, 0) ? snappedTo.x!.raw[0]! : nudge(d.shift.raw[0], local.x, units, exact.x);
    const y = copies(snappedTo.y, 1) ? snappedTo.y!.raw[1]! : nudge(d.shift.raw[1], local.y, units, exact.y);
    const moved = fromFrame(local, {r: frame, mirrored: at.mirrored});
    return {
        handleAt: {key: d.handle.key, at: {x: at.x + moved.x, y: at.y + moved.y}, guides: guides.map(([n]) => [n, wanted])},
        text: applyEdits(d.sourceText, d.shift.edits(x, y)),
        hint: `${d.handle.label}: shift [${x}, ${y}]` + (guides.length ? ', lined up with the next point' : ''),
    };
};

// one step of any drag (null: nothing to do yet)
export const stepDrag = (d: Drag, input: DragInput): DragStep | null => {
    switch (d.kind) {
        case 'column': return moveColumn(d, input);
        case 'rotate': return moveRotate(d, input);
        case 'zone': return moveZone(d, input);
        case 'handle': return moveHandle(d, input);
        case 'key': return moveKey(d, input);
    }
};
