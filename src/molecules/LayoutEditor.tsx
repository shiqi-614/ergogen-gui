import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useConfigContext} from "../context/ConfigContext";
import {
    ATTRS, AnchorShift, Attr, Edit, EditSite, Length,
    addOutline, appendOutline, applyEdits, findAnchorShift, findShift, findSite, formatLength,
    insertPolygonPoint, isPlainNumber, nudge, parseLength, plateLines, removePolygonPoint,
} from "../utils/layoutEdit";
import {OutlineHandle, Polygon, keyHull, nearMisses, outlineHandles} from "../utils/outlineGeometry";
import {
    Column, Frame, Point, Points, Side, Site, Transform, Units, Vec, View,
    columnFrame, columnOrder, computePoints, editableLength, evaluator, fitView, format, place, radians, rotate,
    round, rowOrder, sameColumn, sideOf, signOf,
} from "./layout/geometry";
import {
    Canvas, CenterHandle, Container, EdgeTarget, ErrorText, Key, OutlineBar, RotateHandle, StatusBar, VertexHandle,
} from "./layout/styles";
import {fromFrame, nearestKey, shiftFrom, toFrame} from "../utils/keyFrame";
import ColumnPanel from "./layout/ColumnPanel";
import OutlinePanel from "./layout/OutlinePanel";
import {OutlineRequest} from "./NewOutline";

type ColumnDrag = {
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

type RotateDrag = {
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

type ZoneDrag = {
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
type HandleDrag = {
    kind: 'handle',
    handle: OutlineHandle,
    sourceText: string,
    start: Vec,
    shift: AnchorShift,
    // the polygon points before and after this one, to line it up with, with their shifts as written
    neighbors: { handle: OutlineHandle, raw: [string | undefined, string | undefined] }[],
    text?: string,
};

type Drag = ColumnDrag | RotateDrag | ZoneDrag | HandleDrag;

// where a dragged outline handle is now, and the lines it snapped to
type HandleAt = { key: string, at: Vec, guides: [Vec, Vec][] };

// A point of an outline being drawn: written as a shift from its nearest key, like hand-written ones
type DrawnPoint = { ref: string, shift: [number, number], at: Vec };
type Drawing = { name: string, points: DrawnPoint[] };
type Cursor = { point: DrawnPoint, guides: [Vec, Vec][], closes: boolean };

// six decimals: enough for a snapped point to stay exactly in line, and short for round ones
const exactText = (v: number) => String(Number(v.toFixed(6)));

const HELP = 'Click a key to select its column. Drag it up/down for stagger, sideways for spread '
    + '(Shift: with the columns after it), the green handle for splay, Alt-drag to move the zone. '
    + 'Pick an outline at the top left to drag its points.';

type Props = {
    // a new outline to make (from the Downloads list), once the keys are known; onRequestDone when it is
    request?: OutlineRequest | null,
    onRequestDone?: () => void,
};

const LayoutEditor = ({request, onRequestDone}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const configInput = configContext?.configInput ?? '';

    const [points, setPoints] = useState<Points | null>(null);
    const [units, setUnits] = useState<Units>({});
    const [error, setError] = useState<string | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    const [selected, setSelected] = useState<Column | null>(null);
    const [view, setView] = useState<View | null>(null);
    const [transform, setTransform] = useState<Transform | null>(null);
    // the panel at the top right, folded down to its title (it can cover points near the board's top)
    const [panelFolded, setPanelFolded] = useState(false);
    const [outline, setOutline] = useState<string>('');
    const [paths, setPaths] = useState<Record<string, string>>({});
    const [handleAt, setHandleAt] = useState<HandleAt | null>(null);
    const [drawing, setDrawing] = useState<Drawing | null>(null);
    const [cursor, setCursor] = useState<Cursor | null>(null);
    // the outline point clicked last, which Delete removes
    const [chosenPoint, setChosenPoint] = useState<string | null>(null);
    // Enter, Backspace and Escape while drawing; set each render so it sees the current state
    const onDrawingKey = useRef<(e: KeyboardEvent) => void>();
    useEffect(() => {
        const listener = (e: KeyboardEvent) => onDrawingKey.current?.(e);
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, []);
    const showOutlines = useRef(false);
    showOutlines.current = outline !== '';

    const svgRef = useRef<SVGSVGElement>(null);
    const boardRef = useRef<SVGGElement>(null);
    const drag = useRef<Drag | null>(null);
    const lastConfig = useRef<any>(null);

    // one ergogen run at a time; while one runs, only the newest text waits for the next
    const runner = useRef<{ busy: boolean, pending: string | null }>({busy: false, pending: null});
    const run = useCallback((text: string) => {
        const state = runner.current;
        state.pending = text;
        if (state.busy) return;
        state.busy = true;
        (async () => {
            while (state.pending !== null) {
                const next = state.pending;
                state.pending = null;
                try {
                    const {points, units, config, paths, outlineError} = await computePoints(next, showOutlines.current);
                    lastConfig.current = config;
                    setPoints(points);
                    setUnits(units);
                    setPaths(paths);
                    if (!drag.current) {
                        setTransform(null);
                        setHandleAt(null);
                    }
                    setView(view => view ?? fitView(points));
                    setError(outlineError ? `outlines: ${outlineError}` : null);
                } catch (e: unknown) {
                    setError(String(e));
                }
            }
            state.busy = false;
        })();
    }, []);

    useEffect(() => {
        if (drag.current) return;
        const timer = setTimeout(() => run(configInput), 150);
        return () => clearTimeout(timer);
    }, [configInput, outline, run]);

    // the shown outline's draggable anchors, and its edges that are almost straight
    const outlineInfo = useMemo(() => {
        if (!outline || !points) return null;
        const {handles, polygons, skipped} = outlineHandles(lastConfig.current, outline, points, evaluator(units));
        return {handles, polygons, skipped, misses: polygons.flatMap(polygon => nearMisses(polygon))};
    }, [outline, points, units]);

    // the selected column's keys on each side, and where each side's column is anchored
    const columnInfo = useMemo(() => {
        if (!points || !selected) return null;
        const keys = Object.values(points).filter(p => sameColumn(p, selected));
        const rows = rowOrder(lastConfig.current, selected);
        const frames: Partial<Record<Side, Frame>> = {};
        for (const side of ['source', 'mirror'] as Side[]) {
            const frame = columnFrame(keys.filter(p => sideOf(p) === side), rows);
            if (frame) frames[side] = frame;
        }
        const order = columnOrder(lastConfig.current, selected.zone);
        const nextCol = order[order.indexOf(selected.col) + 1];
        const nextKey = nextCol && Object.values(points).find(p => sameColumn(p, {zone: selected.zone, col: nextCol}));
        const effectiveOf = (p: Point) => ({stagger: p.meta.stagger, spread: p.meta.spread, splay: p.meta.splay});
        return {
            frames,
            effective: keys[0] && effectiveOf(keys[0]),
            next: nextKey ? {col: nextCol, effective: effectiveOf(nextKey)} : undefined,
        };
    }, [points, selected]);

    // a requested outline is made once the keys (and the outlines there are) have been worked out
    const createOutline = useRef<(request: OutlineRequest) => void>();
    useEffect(() => {
        if (!request || !points) return;
        createOutline.current?.(request);
        onRequestDone?.();
    }, [request, points]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!configContext) return null;

    // pointer position in board millimetres (y up)
    const toBoard = (e: React.PointerEvent): Vec => {
        const matrix = boardRef.current?.getScreenCTM()?.inverse();
        const svg = svgRef.current;
        if (!matrix || !svg) return {x: 0, y: 0};
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const {x, y} = pt.matrixTransform(matrix);
        return {x, y};
    };

    const zoneKeys = (zone: string, keep: (col: number) => boolean = () => true) => {
        const order = columnOrder(lastConfig.current, zone);
        return new Set(Object.entries(points ?? {})
            .filter(([, q]) => q.meta.zone.name === zone && keep(order.indexOf(q.meta.col.name)))
            .map(([name]) => name));
    };

    const startZoneDrag = (e: React.PointerEvent, p: Point) => {
        const zone = p.meta.zone.name;
        const anchor = findAnchorShift(configInput, zone);
        if (typeof anchor === 'string') {
            setHint(`Can't move zone ${zone}: ${anchor}`);
            return;
        }
        const base = anchor.raw.map(raw => raw === undefined ? {mm: 0} : parseLength(raw, units));
        if (!base[0] || !base[1]) {
            setHint(`Can't move zone ${zone}: its shift is [${anchor.raw.join(', ')}], change it in the panel`);
            return;
        }
        const config = lastConfig.current?.points?.zones?.[zone] ?? {};
        const ref = config.anchor?.ref ?? config['anchor.ref'];
        const orient = config.anchor?.orient ?? config['anchor.orient'];
        const frame = (typeof ref === 'string' ? points?.[ref]?.r ?? 0 : 0) + (typeof orient === 'number' ? orient : 0);
        const mirrorRef = lastConfig.current?.points?.mirror?.ref;
        drag.current = {
            kind: 'zone',
            zone,
            sourceText: configInput,
            start: toBoard(e),
            mirrored: !!p.meta.mirrored,
            frame,
            base: base as [Length, Length],
            anchor,
            names: zoneKeys(zone),
            movesAxis: typeof mirrorRef === 'string' && points?.[mirrorRef]?.meta.zone.name === zone,
        };
    };

    const startColumnDrag = (e: React.PointerEvent, p: Point) => {
        const column = {zone: p.meta.zone.name, col: p.meta.col.name};
        const order = columnOrder(lastConfig.current, column.zone);
        const from = Math.max(order.indexOf(column.col), 0);
        const sitesOf = (col: string) =>
            Object.fromEntries(ATTRS.map(attr => [attr, findSite(configInput, column.zone, col, attr)])) as Record<Attr, Site>;
        const nextCol = order[from + 1];
        const nextKey = nextCol && Object.values(points ?? {}).find(q => sameColumn(q, {zone: column.zone, col: nextCol}));
        const sign = signOf(p);
        drag.current = {
            kind: 'column',
            column,
            sourceText: configInput,
            start: toBoard(e),
            // the source column's direction: a mirrored key turns the other way
            theta: radians(sign * p.r - p.meta.orient - p.meta.rotate),
            mirrored: !!p.meta.mirrored,
            firstCol: from === 0,
            own: zoneKeys(column.zone, i => i === from),
            withRest: zoneKeys(column.zone, i => i >= from),
            base: {stagger: p.meta.stagger, spread: p.meta.spread, splay: p.meta.splay},
            sites: sitesOf(column.col),
            next: nextKey ? {
                col: nextCol,
                base: {stagger: nextKey.meta.stagger, spread: nextKey.meta.spread, splay: nextKey.meta.splay},
                sites: sitesOf(nextCol),
            } : undefined,
        };
    };

    const startKeyDrag = (e: React.PointerEvent, p: Point) => {
        e.stopPropagation();
        setSelected({zone: p.meta.zone.name, col: p.meta.col.name});
        setHint(null);
        if (e.button !== 0) return;
        svgRef.current?.setPointerCapture(e.pointerId);
        if (e.altKey) startZoneDrag(e, p);
        else startColumnDrag(e, p);
    };

    const startRotate = (e: React.PointerEvent, side: Side) => {
        e.stopPropagation();
        if (e.button !== 0 || !selected || !columnInfo) return;
        const frame = columnInfo.frames[side];
        const site = findSite(configInput, selected.zone, selected.col, 'splay');
        if (!frame) return;
        if (typeof site === 'string' || (site.raw !== undefined && !isPlainNumber(site.raw))) {
            setHint(`Can't rotate ${selected.col}: ${typeof site === 'string' ? site : `its splay is "${site.raw}", change it in the panel`}`);
            return;
        }
        svgRef.current?.setPointerCapture(e.pointerId);
        const now = toBoard(e);
        const order = columnOrder(lastConfig.current, selected.zone);
        const from = Math.max(order.indexOf(selected.col), 0);
        drag.current = {
            kind: 'rotate',
            sourceText: configInput,
            sign: side === 'mirror' ? -1 : 1,
            pivot: frame.pivot,
            startAngle: Math.atan2(now.y - frame.pivot.y, now.x - frame.pivot.x),
            base: columnInfo.effective?.splay ?? 0,
            site,
            withRest: zoneKeys(selected.zone, i => i >= from),
            pivots: {source: columnInfo.frames.source?.pivot, mirror: columnInfo.frames.mirror?.pivot},
        };
    };

    const moveColumn = (d: ColumnDrag, e: React.PointerEvent) => {
        const now = toBoard(e);
        let dx = now.x - d.start.x;
        const dy = now.y - d.start.y;
        if (d.mirrored) dx = -dx;
        // the movement along and across the column
        const across = dx * Math.cos(d.theta) + dy * Math.sin(d.theta);
        const along = -dx * Math.sin(d.theta) + dy * Math.cos(d.theta);
        if (!d.axis) {
            if (Math.hypot(across, along) < 1) return;
            // spread does nothing on a zone's first column
            d.axis = d.firstCol || Math.abs(along) >= Math.abs(across) ? 'stagger' : 'spread';
        }
        const axis = d.axis;
        // Shift drags the columns after this one along, as ergogen's own stagger and spread do
        const alone = !e.shiftKey && !!d.next;
        const own = editableLength(d.sites[axis], units);
        if (typeof own === 'string') return setHint(`Can't drag the ${axis} of ${d.column.col}: ${own}`);
        const next = alone && d.next ? editableLength(d.next.sites[axis], units) : null;
        if (typeof next === 'string') return setHint(`Can't keep ${d.next?.col} in place: ${next}. Hold Shift to move it too`);

        const value = round(d.base[axis] + (axis === 'stagger' ? along : across), 0.1);
        const change = value - d.base[axis];
        // back from the column's frame to the board's
        const move = rotate(axis === 'stagger' ? {x: 0, y: change} : {x: change, y: 0}, d.theta * 180 / Math.PI);
        setTransform({names: alone ? d.own : d.withRest, dx: move.x, dy: move.y, angle: 0, pivots: {}});
        const edits: Edit[] = [{site: own.site, value: formatLength(value, own.like)}];
        if (next && d.next) edits.push({site: next.site, value: formatLength(d.next.base[axis] - change, next.like)});
        d.text = applyEdits(d.sourceText, edits);
        setHint(`${axis}: ${format(value)} mm` + (next && d.next ? `, ${d.next.col} ${format(d.next.base[axis] - change)} so the columns after it stay put` : ''));
    };

    const moveRotate = (d: RotateDrag, e: React.PointerEvent) => {
        const now = toBoard(e);
        let turned = (Math.atan2(now.y - d.pivot.y, now.x - d.pivot.x) - d.startAngle) * 180 / Math.PI;
        turned = ((turned + 540) % 360) - 180;
        // on the mirrored side the column turns the other way
        const value = round(d.base + d.sign * turned, 0.5);
        setTransform({names: d.withRest, dx: 0, dy: 0, angle: value - d.base, pivots: d.pivots});
        d.text = applyEdits(d.sourceText, [{site: d.site, value: format(value)}]);
        setHint(`splay: ${format(value)}°, the columns after it turn with it`);
    };

    const moveZone = (d: ZoneDrag, e: React.PointerEvent) => {
        const now = toBoard(e);
        const dx = (now.x - d.start.x) * (d.mirrored ? -1 : 1);
        const dy = now.y - d.start.y;
        // the anchor's shift is in its ref point's frame
        const local = rotate({x: dx, y: dy}, -d.frame);
        const shift = {x: round(local.x, 0.1), y: round(local.y, 0.1)};
        const move = rotate(shift, d.frame);
        // ergogen mirrors across the x of the mirror's anchor: when that moves by dx, every mirrored key moves by 2 dx
        setTransform({names: d.names, dx: move.x, dy: move.y, angle: 0, pivots: {}, mirrorDx: d.movesAxis ? 2 * move.x : 0});
        const x = formatLength(d.base[0].mm + shift.x, d.base[0]);
        const y = formatLength(d.base[1].mm + shift.y, d.base[1]);
        d.text = applyEdits(d.sourceText, d.anchor.edits(x, y));
        setHint(`zone ${d.zone} anchor shift: [${x}, ${y}]`);
    };

    const startHandleDrag = (e: React.PointerEvent, handle: OutlineHandle) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        const shift = findShift(configInput, handle.path);
        if (typeof shift === 'string') {
            setHint(`Can't move ${handle.label}: ${shift}`);
            return;
        }
        svgRef.current?.setPointerCapture(e.pointerId);
        const polygon = outlineInfo?.polygons.find(p => p.id === handle.polygon)?.handles ?? [];
        const index = polygon.indexOf(handle);
        const neighbors = (index < 0 || polygon.length < 2 ? [] : [
            polygon[(index - 1 + polygon.length) % polygon.length],
            polygon[(index + 1) % polygon.length],
        ]).map(n => {
            const written = findShift(configInput, n.path);
            return {handle: n, raw: typeof written === 'string' ? [undefined, undefined] : written.raw} as HandleDrag['neighbors'][number];
        });
        drag.current = {kind: 'handle', handle, sourceText: configInput, start: toBoard(e), shift, neighbors};
        setChosenPoint(handle.kind === 'vertex' ? handle.key : null);
        setHint(`${handle.label}: shift [${shift.raw.map(v => v ?? '0').join(', ')}]`);
    };

    const moveHandle = (d: HandleDrag, e: React.PointerEvent) => {
        const now = toBoard(e);
        const {at, frame} = d.handle;
        const wanted = {x: at.x + now.x - d.start.x, y: at.y + now.y - d.start.y};
        // line up with a neighbouring point when within a few pixels of it
        const snap = 6 / (boardRef.current?.getScreenCTM()?.a || 1);
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
        d.text = applyEdits(d.sourceText, d.shift.edits(x, y));
        const moved = fromFrame(local, {r: frame, mirrored: at.mirrored});
        setHandleAt({key: d.handle.key, at: {x: at.x + moved.x, y: at.y + moved.y}, guides: guides.map(([n]) => [n, wanted])});
        setHint(`${d.handle.label}: shift [${x}, ${y}]` + (guides.length ? ', lined up with the next point' : ''));
    };

    const moveDrag = (e: React.PointerEvent) => {
        const d = drag.current;
        if (d?.kind === 'column') moveColumn(d, e);
        else if (d?.kind === 'rotate') moveRotate(d, e);
        else if (d?.kind === 'zone') moveZone(d, e);
        else if (d?.kind === 'handle') moveHandle(d, e);
    };

    const endDrag = () => {
        const d = drag.current;
        drag.current = null;
        if (d?.text && d.text !== d.sourceText) configContext.setConfigInput(d.text);
        else {
            setTransform(null);
            setHandleAt(null);
        }
    };

    const outlineNames = Object.keys(lastConfig.current?.outlines ?? {});
    const nameProblem = (name: string) =>
        !/^[A-Za-z_][\w-]*$/.test(name) ? 'Use letters, digits, _ or -, starting with a letter'
            : outlineNames.includes(name) ? `There already is an outline called ${name}` : null;

    // a new outline: drawn point by point, or written from a template and opened
    const create = ({name, template, both}: OutlineRequest) => {
        const problem = nameProblem(name);
        if (problem) return setHint(problem);
        setSelected(null);
        setHint(null);
        if (template === 'draw') return setDrawing({name, points: []});
        try {
            let text: string;
            if (template === 'hull') {
                const corners = keyHull(points ?? {}, both);
                if (corners.length < 3) return setHint('There are no keys to wrap an outline around');
                text = addOutline(configInput, name, corners.map(c => ({ref: c.ref, shift: [exactText(c.shift[0]), exactText(c.shift[1])]})));
            } else {
                text = appendOutline(configInput, name, plateLines(template === 'plate-mx' ? 14 : 13.8, both));
            }
            configContext.setConfigInput(text);
            setOutline(name);
            setHint(`Added outline ${name}` + (template === 'hull' ? ': click an edge to add a point, select a point and press Delete to remove it' : ''));
        } catch (e: unknown) {
            setError(String(e));
        }
    };
    createOutline.current = create;

    // where a point at wanted goes: written as a shift from the nearest key, in that key's frame
    // (to 0.1 mm, or exactly when it has been lined up with another point)
    const placeNear = (wanted: Vec, exact: boolean): DrawnPoint | null => {
        if (!points) return null;
        const ref = nearestKey(points, wanted);
        if (!ref) return null;
        return {ref, ...shiftFrom(points[ref], wanted, exact ? undefined : 0.1)};
    };

    // A click on an outline edge adds a point there, between the edge's two points
    const insertOnEdge = (e: React.PointerEvent, polygon: Polygon, index: number) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        const from = polygon.handles[index].at;
        const to = polygon.handles[(index + 1) % polygon.handles.length].at;
        const click = toBoard(e);
        // onto the edge itself, so the new point keeps the line where it was
        const [dx, dy] = [to.x - from.x, to.y - from.y];
        const t = Math.min(1, Math.max(0, ((click.x - from.x) * dx + (click.y - from.y) * dy) / (dx * dx + dy * dy || 1)));
        const point = placeNear({x: from.x + t * dx, y: from.y + t * dy}, false);
        const first = polygon.handles[0];
        if (!point || first.kind !== 'vertex') return;
        const list = first.path.slice(0, -1);
        try {
            configContext.setConfigInput(insertPolygonPoint(configInput, list, index + 1,
                {ref: point.ref, shift: [exactText(point.shift[0]), exactText(point.shift[1])]}));
            setChosenPoint([...list, index + 1].join('.'));
            setHint(`Added a point to ${polygon.id}; drag it into place, or press Delete to remove it`);
        } catch (err: unknown) {
            setHint(`Can't add a point here: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const removeChosenPoint = () => {
        const handle = outlineInfo?.handles.find(h => h.key === chosenPoint);
        if (!handle || handle.kind !== 'vertex' || handle.index === undefined) return false;
        const polygon = outlineInfo?.polygons.find(p => p.id === handle.polygon);
        if (!polygon || polygon.handles.length <= 3) {
            setHint('A polygon needs at least 3 points');
            return true;
        }
        try {
            configContext.setConfigInput(removePolygonPoint(configInput, handle.path.slice(0, -1), handle.index));
            setHint(`Removed ${handle.label}`);
        } catch (err: unknown) {
            setHint(`Can't remove ${handle.label}: ${err instanceof Error ? err.message : String(err)}`);
        }
        setChosenPoint(null);
        return true;
    };

    // The point a click would add: snapped level with the last or first point when close to it,
    // then written as a shift from the nearest key, in that key's frame
    const pointAt = (e: React.PointerEvent, d: Drawing): Cursor | null => {
        if (!points) return null;
        const pxPerMm = boardRef.current?.getScreenCTM()?.a || 1;
        const wanted = toBoard(e);
        const first = d.points[0];
        if (first && d.points.length >= 3 && Math.hypot(wanted.x - first.at.x, wanted.y - first.at.y) < 8 / pxPerMm) {
            return {point: first, guides: [], closes: true};
        }
        const guides: [Vec, Vec][] = [];
        const snapped = {x: false, y: false};
        for (const n of [d.points[d.points.length - 1], first].filter(Boolean) as DrawnPoint[]) {
            if (!snapped.x && Math.abs(wanted.x - n.at.x) < 6 / pxPerMm) {
                wanted.x = n.at.x;
                snapped.x = true;
                guides.push([n.at, wanted]);
            }
            if (!snapped.y && Math.abs(wanted.y - n.at.y) < 6 / pxPerMm) {
                wanted.y = n.at.y;
                snapped.y = true;
                guides.push([n.at, wanted]);
            }
        }
        // snapped points keep the precision that lines them up
        const point = placeNear(wanted, snapped.x || snapped.y);
        if (!point) return null;
        return {point, guides: guides.map(([n]) => [n, point.at]), closes: false};
    };

    const finishDrawing = (d: Drawing) => {
        if (d.points.length < 3) return setHint('An outline needs at least 3 points');
        try {
            const text = addOutline(configInput, d.name, d.points.map(p => ({ref: p.ref, shift: [exactText(p.shift[0]), exactText(p.shift[1])]})));
            configContext.setConfigInput(text);
            setOutline(d.name);
            setHint(`Added outline ${d.name}; drag its points to adjust them`);
        } catch (e: unknown) {
            setError(String(e));
        }
        setDrawing(null);
        setCursor(null);
    };

    const drawClick = (e: React.PointerEvent) => {
        e.stopPropagation();
        if (!drawing || e.button !== 0) return;
        const next = pointAt(e, drawing);
        if (!next) return;
        if (next.closes) return finishDrawing(drawing);
        setDrawing({...drawing, points: [...drawing.points, next.point]});
    };

    onDrawingKey.current = e => {
        if ((e.target as HTMLElement)?.closest?.('input, textarea, select, .monaco-editor')) return;
        if (!drawing) {
            if ((e.key === 'Delete' || e.key === 'Backspace') && chosenPoint && removeChosenPoint()) e.preventDefault();
            return;
        }
        if (e.key === 'Enter') finishDrawing(drawing);
        else if (e.key === 'Backspace') setDrawing({...drawing, points: drawing.points.slice(0, -1)});
        else if (e.key === 'Escape') {
            setDrawing(null);
            setCursor(null);
            setHint('Drawing cancelled');
        } else return;
        e.preventDefault();
    };

    // a dragged handle shows where it is going; its polygon follows it
    const handlePosition = (h: OutlineHandle): Vec => handleAt?.key === h.key ? handleAt.at : h.at;

    const commit = (text: string) => configContext.setConfigInput(text);

    // the rotate handle sits above each side's column, on the line from its pivot
    const handles = selected && columnInfo && !transform
        ? (Object.entries(columnInfo.frames) as [Side, Frame][]).map(([side, frame]) => {
            const tip = rotate({x: 0, y: frame.top + 6}, frame.theta);
            return {side, pivot: frame.pivot, handle: {x: frame.pivot.x + tip.x, y: frame.pivot.y + tip.y}};
        })
        : [];

    return (
        <Container>
            <Canvas
                ref={svgRef}
                viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : '0 0 100 100'}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerDown={() => { setSelected(null); setChosenPoint(null); }}
            >
                {outline && paths[outline] && (
                    // ergogen's own result for the outline, already in the view's flipped coordinates
                    <path d={paths[outline]} fill="rgba(255, 159, 28, 0.08)" stroke="#ff9f1c" strokeWidth={0.5}
                          fillRule="evenodd" opacity={handleAt ? 0.35 : 1} pointerEvents="none"/>
                )}
                <g ref={boardRef} transform="scale(1 -1)">
                    {points && Object.entries(points).map(([name, p]) => {
                        const at = place(name, p, transform);
                        return (
                            <g key={name} transform={`translate(${at.x} ${at.y}) rotate(${at.r})`}>
                                <Key
                                    x={-p.meta.width / 2 + 0.5}
                                    y={-p.meta.height / 2 + 0.5}
                                    width={p.meta.width - 1}
                                    height={p.meta.height - 1}
                                    rx={1}
                                    selected={sameColumn(p, selected)}
                                    onPointerDown={e => startKeyDrag(e, p)}
                                >
                                    <title>{name}</title>
                                </Key>
                            </g>
                        );
                    })}
                    {outlineInfo?.polygons.filter(() => !!handleAt).map(polygon => (
                        <polygon key={polygon.id} points={polygon.handles.map(h => { const v = handlePosition(h); return `${v.x},${v.y}`; }).join(' ')}
                                 fill="none" stroke="#ff9f1c" strokeWidth={0.4} strokeDasharray="1.5 1" pointerEvents="none"/>
                    ))}
                    {!handleAt && outlineInfo?.misses.map(({from, to}) => (
                        <line key={`${from.key}-${to.key}`} x1={from.at.x} y1={from.at.y} x2={to.at.x} y2={to.at.y}
                              stroke="#ff4d4d" strokeWidth={1.2} pointerEvents="none">
                            <title>Almost straight</title>
                        </line>
                    ))}
                    {handleAt?.guides.map(([a, b], i) => (
                        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4dabf7" strokeWidth={0.4} strokeDasharray="1 1" pointerEvents="none"/>
                    ))}
                    {!handleAt && !drawing && outlineInfo?.polygons.map(polygon => polygon.handles.map((h, i) => {
                        const next = polygon.handles[(i + 1) % polygon.handles.length];
                        return (
                            <EdgeTarget key={`edge-${h.key}`} x1={h.at.x} y1={h.at.y} x2={next.at.x} y2={next.at.y}
                                        onPointerDown={e => insertOnEdge(e, polygon, i)}>
                                <title>Click to add a point here</title>
                            </EdgeTarget>
                        );
                    }))}
                    {outlineInfo?.handles.map(h => {
                        const v = handlePosition(h);
                        const title = <title>{h.label}</title>;
                        return h.kind === 'vertex'
                            ? <VertexHandle key={h.key} x={v.x - 1.2} y={v.y - 1.2} width={2.4} height={2.4} chosen={h.key === chosenPoint}
                                            onPointerDown={e => startHandleDrag(e, h)}>{title}</VertexHandle>
                            : <CenterHandle key={h.key} cx={v.x} cy={v.y} r={1.5}
                                            onPointerDown={e => startHandleDrag(e, h)}>{title}</CenterHandle>;
                    })}
                    {drawing && (() => {
                        const line = [...drawing.points.map(p => p.at), ...(cursor && !cursor.closes ? [cursor.point.at] : [])];
                        return (
                            <g pointerEvents="none">
                                <polyline points={line.map(v => `${v.x},${v.y}`).join(' ')} fill="none" stroke="#ff9f1c" strokeWidth={0.5}/>
                                {line.length >= 3 && (
                                    <line x1={line[line.length - 1].x} y1={line[line.length - 1].y} x2={line[0].x} y2={line[0].y}
                                          stroke="#ff9f1c" strokeWidth={0.4} strokeDasharray="1.5 1"/>
                                )}
                                {drawing.points.map((p, i) => (
                                    <rect key={i} x={p.at.x - 1.2} y={p.at.y - 1.2} width={2.4} height={2.4} fill="#ff9f1c"
                                          stroke={i === 0 && cursor?.closes ? '#ffffff' : 'none'} strokeWidth={0.6}/>
                                ))}
                                {cursor?.guides.map(([a, b], i) => (
                                    <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4dabf7" strokeWidth={0.4} strokeDasharray="1 1"/>
                                ))}
                            </g>
                        );
                    })()}
                    {handles.map(({side, pivot, handle}) => (
                        <g key={side}>
                            <line x1={pivot.x} y1={pivot.y} x2={handle.x} y2={handle.y}
                                  stroke="#28a745" strokeWidth={0.4} strokeDasharray="1 1"/>
                            <circle cx={pivot.x} cy={pivot.y} r={0.8} fill="#28a745"/>
                            <RotateHandle cx={handle.x} cy={handle.y} r={2.2} onPointerDown={e => startRotate(e, side)}>
                                <title>Drag to change the splay</title>
                            </RotateHandle>
                        </g>
                    ))}
                </g>
                {drawing && view && (
                    // takes every click while drawing, so the keys under it don't start drags
                    <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="transparent" style={{cursor: 'crosshair'}}
                          onPointerDown={drawClick}
                          onPointerMove={e => setCursor(pointAt(e, drawing))}
                          onPointerLeave={() => setCursor(null)}/>
                )}
            </Canvas>

            {!selected && outline && !drawing && (
                <OutlinePanel outline={outline} text={configInput} onCommit={commit} folded={panelFolded} onFold={setPanelFolded}
                              onDeleted={name => { setOutline(''); setHint(`Deleted outline ${name}; undo in the editor brings it back`); }}/>
            )}

            {selected && (
                <ColumnPanel
                    column={selected}
                    text={configInput}
                    units={units}
                    effective={columnInfo?.effective}
                    next={columnInfo?.next}
                    onCommit={commit}
                    folded={panelFolded}
                    onFold={setPanelFolded}
                />
            )}

            <OutlineBar onPointerDown={e => e.stopPropagation()}>
                <select value={outline} disabled={!!drawing} onChange={e => setOutline(e.target.value)}
                        title="New outlines: the + on the Downloads list's Outlines">
                    <option value="">Outline: none</option>
                    {outlineNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                {drawing && (
                    <div className="row">
                        <button onClick={() => finishDrawing(drawing)} disabled={drawing.points.length < 3}>Finish</button>
                        <button className="secondary" onClick={() => { setDrawing(null); setCursor(null); }}>Cancel</button>
                    </div>
                )}
                {outlineInfo && outlineInfo.misses.length > 0 && (
                    <ErrorText>{outlineInfo.misses.length} edge{outlineInfo.misses.length > 1 ? 's' : ''} almost straight (red)</ErrorText>
                )}
                {outlineInfo && outlineInfo.skipped.length > 0 && (
                    <span title={outlineInfo.skipped.join('\n')}>{outlineInfo.skipped.length} part(s) can't be dragged</span>
                )}
            </OutlineBar>

            <StatusBar>
                <button onClick={() => points && setView(fitView(points))}>Fit</button>
                {error ? <ErrorText>{error}</ErrorText> : <span>{drawing
                    ? `Drawing ${drawing.name}: click to add points (each one is a shift from its nearest key), `
                        + 'click the first point or press Enter to finish, Backspace to undo, Esc to cancel'
                    : hint ?? HELP}</span>}
            </StatusBar>
        </Container>
    );
};

export default LayoutEditor;
