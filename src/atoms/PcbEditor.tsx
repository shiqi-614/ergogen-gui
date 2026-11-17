import React, {useEffect, useMemo, useRef, useState} from "react";
import styled from "styled-components";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {
    AnchorShift, addPcbOutline, appendEntry, pcbOutlines, applyEdits, deleteEntry, findChildShift, findChildValue, findShift, findValue,
    findWhereList, isPlainNumber, keyFootprintLines, nudge, partLines,
} from "../utils/layoutEdit";
import {pcbPartHandles} from "../utils/outlineGeometry";

// Edits a pcb's parts on its KiCanvas preview. Modules are boxed around their footprints: drag one to
// move it (its where.shift), × deletes it, a new one is placed with a click. Footprints are picked by
// clicking one of them, which picks its whole config entry: one placed by an anchor moves like a module,
// one that follows keys moves and turns on every key at once (its adjust), and the keys it is on can be
// clicked in and out. Moves are written in the frame of the key they are relative to, the way the values
// were written. A pcb mirrored from another has that pcb's parts, so it edits those. After every edit
// the preview regenerates.

type Vec = { x: number, y: number };
// a footprint's (or module's) outline in KiCad's board coordinates (y down): the corners of its
// box in its own frame, so a turned part has a turned box
type Shape = { corners: Vec[], center: Vec };
type Tab = 'modules' | 'footprints' | 'outline';
type Half = 'source' | 'mirror';
type Points = Record<string, { x: number, y: number, r: number, meta?: { mirrored?: boolean, index?: number, name?: string } }>;

// one footprint on the board: which config entry it is, and the key it is on (or relative to)
type Instance = { key: string, name: string, point: { x: number, y: number, r: number }, keyName?: string, box: Shape };

// a drag: of a module, a footprint (all of its entry's instances follow), or a turn of a footprint
type Moving =
    { kind: 'module', module: string, start: Vec, delta: Vec }
    | { kind: 'footprint', name: string, instance: Instance, start: Vec, delta: Vec }
    | { kind: 'turn', name: string, instance: Instance, center: Vec, startAngle: number, angle: number };

// a part being added: named and given its file, then placed with the next click (or put on keys)
type Adding = { tab: Tab, name: string, file: string, onKeys: boolean, placing: boolean };

type Props = {
    // the board viewer inside <kicanvas-embed>, once it has drawn the board; null while it regenerates
    viewer: any,
    // which pcb the board is
    pcb: string,
};

const Layer = styled.svg<{ active: boolean }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;

  .target {
    pointer-events: ${p => p.active ? 'all' : 'none'};
  }

  polygon.module {
    fill: rgba(77, 171, 247, 0.06);
    stroke: #4dabf7;
    stroke-width: 1;
    stroke-dasharray: 4 3;
    cursor: move;
  }

  polygon.module:hover {
    fill: rgba(77, 171, 247, 0.18);
  }

  polygon.footprint {
    fill: transparent;
    stroke: rgba(255, 159, 28, 0.35);
    stroke-width: 0.8;
    cursor: pointer;
  }

  polygon.footprint:hover {
    fill: rgba(255, 159, 28, 0.12);
  }

  polygon.footprint.chosen {
    fill: rgba(255, 159, 28, 0.15);
    stroke: #ff9f1c;
    stroke-width: 1.5;
    cursor: move;
  }

  polygon.ghost {
    fill: rgba(77, 171, 247, 0.25);
    stroke: #ffffff;
    stroke-width: 1.5;
    pointer-events: none;
  }

  circle.knob {
    fill: #ff9f1c;
    stroke: #ffffff;
    stroke-width: 1;
    cursor: grab;
  }

  circle.key {
    fill: rgba(30, 30, 30, 0.6);
    stroke: #ff9f1c;
    stroke-width: 1.5;
    cursor: pointer;
  }

  circle.key.member {
    fill: #ff9f1c;
  }

  rect.catcher {
    fill: transparent;
    pointer-events: all;
    cursor: crosshair;
  }

  g.remove {
    cursor: pointer;
  }

  g.remove circle {
    fill: #a33a3a;
  }

  g.remove:hover circle {
    fill: #d64545;
  }

  g.remove text {
    fill: #ffffff;
    stroke: none;
    font-size: 11px;
  }

  text {
    fill: #9ccfff;
    font-size: 12px;
    font-family: sans-serif;
    paint-order: stroke;
    stroke: #1e1e1e;
    stroke-width: 3px;
    pointer-events: none;
  }
`;

// the outlines the board edge can be made of, under the toolbar
const OutlineList = styled.div`
  position: absolute;
  top: 5.2rem;
  left: 0.5rem;
  max-height: calc(100% - 7rem);
  overflow-y: auto;
  padding: 0.5rem 0.7rem;
  border-radius: 0.25rem;
  background: rgba(30, 30, 30, 0.92);
  color: #dddddd;
  font-size: 0.85rem;

  label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0;
    cursor: pointer;
  }

  label:hover {
    color: #ffffff;
  }

  .note {
    max-width: 16rem;
    margin-top: 0.4rem;
    color: #8a8a8a;
    font-size: 0.8rem;
  }
`;

// below the Preview / Layout switch at the top of the pane
const Toolbar = styled.div`
  position: absolute;
  top: 2.75rem;
  left: 0.5rem;
  right: 3.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #dddddd;

  button {
    padding: 0.25rem 0.7rem;
    border: none;
    border-radius: 0.2rem;
    background: #595959;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }

  button.on {
    background: #4dabf7;
  }

  button.add {
    background: #28a745;
  }

  button.danger {
    background: #a33a3a;
  }

  .tabs {
    display: flex;
    border-radius: 0.2rem;
    overflow: hidden;
  }

  .tabs button {
    border-radius: 0;
  }

  span {
    padding: 0.2rem 0.5rem;
    border-radius: 0.2rem;
    background: rgba(30, 30, 30, 0.85);
  }

  input, select {
    padding: 0.2rem 0.4rem;
    border: 1px solid #595959;
    border-radius: 0.2rem;
    background: #1e1e1e;
    color: #ffffff;
    font: inherit;
  }

  input {
    width: 8rem;
  }

  select {
    max-width: 14rem;
  }
`;

const rotate = (v: Vec, degrees: number): Vec => {
    const a = degrees * Math.PI / 180;
    return {x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a)};
};

const round = (value: number, step: number) => Math.round(value / step) * step;
const short = (value: number) => String(Number(value.toFixed(2)));

// KiCanvas' footprint at an ergogen point: the preview board puts ergogen's (x, y) at KiCad's (x, -y)
const boardFootprint = (footprints: any[], reference: string, point: Vec) => footprints.find(f => f.reference === reference
    && Math.abs(f.at.position.x - point.x) < 1e-3 && Math.abs(f.at.position.y + point.y) < 1e-3);

// KiCad turns a footprint's local coordinates by its angle, counter-clockwise on a board whose y is down
const toBoard = (at: Vec, angle: number, local: Vec): Vec => {
    const a = angle * Math.PI / 180;
    return {x: at.x + local.x * Math.cos(a) + local.y * Math.sin(a), y: at.y - local.x * Math.sin(a) + local.y * Math.cos(a)};
};
const toLocalFrame = (at: Vec, angle: number, board: Vec): Vec => {
    const a = angle * Math.PI / 180, dx = board.x - at.x, dy = board.y - at.y;
    return {x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a)};
};

// the box around local points, turned onto the board
const shapeOf = (at: Vec, angle: number, local: Vec[]): Shape | null => {
    if (!local.length) return null;
    const xs = local.map(p => p.x), ys = local.map(p => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const corners = [{x: x0, y: y0}, {x: x1, y: y0}, {x: x1, y: y1}, {x: x0, y: y1}].map(c => toBoard(at, angle, c));
    return {corners, center: toBoard(at, angle, {x: (x0 + x1) / 2, y: (y0 + y1) / 2})};
};

const layerName = (layer: any) => String(typeof layer === 'string' ? layer : layer?.name ?? '');

// A KiCanvas footprint's outline, from its items in its own coordinates: the courtyard when it has
// one (the area it needs), its pads and drawings when it doesn't
const footprintShape = (f: any): Shape | null => {
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
const moduleShape = (at: Vec, angle: number, shapes: Shape[]): Shape | null =>
    shapeOf(at, angle, shapes.flatMap(s => s.corners.map(c => toLocalFrame(at, angle, c))));

// The references ergogen's preview board gives footprints (src/kicad/preview_pcb.js): a footprint
// whose name starts with "key" is SW<key index>, "diode" D<key index>, others keep their name. Of
// several key (or diode) footprints on one key only the last is on the board.
const ROLES: [string, string][] = [['key', 'SW'], ['diode', 'D']];

const PcbEditor = ({viewer, pcb}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const [active, setActive] = useState(false);
    const [tab, setTab] = useState<Tab>('modules');
    const [moving, setMoving] = useState<Moving | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [adding, setAdding] = useState<Adding | null>(null);
    // the footprint entry picked last, and whether its keys are being chosen
    const [chosen, setChosen] = useState<string | null>(null);
    const [choosingKeys, setChoosingKeys] = useState(false);
    // the outline under the pointer in the board outline list, drawn on the board
    const [hoverOutline, setHoverOutline] = useState<string | null>(null);
    // bumped whenever KiCanvas' camera moves, so the boxes follow a pan or zoom
    const [, setFrame] = useState(0);
    const layer = useRef<SVGSVGElement>(null);

    const results = configContext?.results;
    const pcbResults = results?.pcbs?.[pcb];
    const source: string = results?.config?.pcbs?.[pcb]?.mirror?.from ?? pcb;
    const half: Half = source === pcb ? 'source' : 'mirror';
    const points: Points = results?.points ?? {};

    const modules = useMemo(() => {
        const footprints: any[] = viewer?.board?.footprints ?? [];
        return Object.entries((pcbResults?.modules ?? {}) as Record<string, { point?: { x: number, y: number, r: number }, footprints?: Record<string, { point: Vec }> }>).flatMap(([module, data]) => {
            const shapes = Object.entries(data.footprints ?? {})
                .map(([reference, fp]) => boardFootprint(footprints, reference, fp.point))
                .filter(Boolean).map(footprintShape).filter(Boolean) as Shape[];
            // the module's own point: KiCad's (x, -y), and its angle as is
            const at = data.point ? {x: data.point.x, y: -data.point.y} : shapes[0]?.center;
            const box = at && moduleShape(at, data.point?.r ?? 0, shapes);
            return box ? [{module, box}] : [];
        });
    }, [viewer, pcbResults]);

    const instances = useMemo((): Instance[] => {
        const footprints: any[] = viewer?.board?.footprints ?? [];
        const entries = Object.entries((pcbResults?.footprints ?? {}) as Record<string, { point: any, config: any }>);
        const configs = Object.entries(results?.config?.pcbs?.[source]?.footprints ?? {});
        const nameOf = (key: string, config: any) => configs.find(([, c]) => c === config)?.[0] ?? key.replace(/_\d+$/, '');
        const role = (name: string) => ROLES.find(([prefix]) => name.startsWith(prefix));
        const last: Record<string, string> = {};
        for (const [key, entry] of entries) {
            const r = role(nameOf(key, entry.config));
            if (r) last[`${r[0]}|${entry.point.meta?.name}`] = key;
        }
        return entries.flatMap(([key, entry]) => {
            const name = nameOf(key, entry.config);
            const r = role(name);
            if (r && last[`${r[0]}|${entry.point.meta?.name}`] !== key) return [];
            const reference = r ? r[1] + entry.point.meta?.index : key;
            const board = boardFootprint(footprints, reference, entry.point);
            const box = board && footprintShape(board);
            if (!box) return [];
            return [{key, name, point: {x: entry.point.x, y: entry.point.y, r: entry.point.r}, keyName: entry.point.meta?.name, box}];
        });
    }, [viewer, pcbResults, results, source]);

    // follow KiCanvas' camera: redraw when where a fixed world point lands on screen changes
    useEffect(() => {
        if (!viewer) return;
        let last = '';
        let id = 0;
        const tick = () => {
            const camera = viewer.viewport?.camera;
            if (camera) {
                const a = camera.world_to_screen({x: 0, y: 0}), b = camera.world_to_screen({x: 100, y: 100});
                const key = `${a.x},${a.y},${b.x},${b.y}`;
                if (key !== last) {
                    last = key;
                    setFrame(n => n + 1);
                }
            }
            id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [viewer]);

    if (!configContext || !viewer) return null;
    const camera = viewer.viewport.camera;

    // where the canvas is inside this layer: KiCanvas works in canvas pixels
    const canvasOffset = (): Vec => {
        const canvas: HTMLCanvasElement | undefined = viewer.canvas ?? viewer.viewport?.canvas;
        const own = layer.current?.getBoundingClientRect();
        const rect = canvas?.getBoundingClientRect();
        return own && rect ? {x: rect.left - own.left, y: rect.top - own.top} : {x: 0, y: 0};
    };
    const offset = canvasOffset();
    const toScreen = (v: Vec): Vec => {
        const s = camera.world_to_screen(v);
        return {x: s.x + offset.x, y: s.y + offset.y};
    };
    const toWorld = (e: React.PointerEvent): Vec => {
        const own = layer.current?.getBoundingClientRect();
        const w = camera.screen_to_world({x: e.clientX - (own?.left ?? 0) - offset.x, y: e.clientY - (own?.top ?? 0) - offset.y});
        return {x: w.x, y: w.y};
    };
    // a shape on screen: its corners (as polygon points), the box around them, and its middle
    const onScreen = (shape: Shape) => {
        const corners = shape.corners.map(toScreen);
        const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
        const bounds = {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)};
        return {points: corners.map(c => `${c.x},${c.y}`).join(' '), bounds, center: toScreen(shape.center)};
    };
    // how far a move on the board goes on screen
    const screenDelta = (delta: Vec): Vec => {
        const a = toScreen({x: 0, y: 0}), b = toScreen(delta);
        return {x: b.x - a.x, y: b.y - a.y};
    };

    const text = () => configContext.configInput ?? '';
    const config = (): any => yaml.load(text());
    const units = results?.units ?? {};
    const evaluate = (expr: string) => (window as any).math.evaluate(expr, {...units});
    const write = (next: string, message: string) => {
        configContext.setConfigInput(next);
        setNote(`${message}, the preview is updating`);
    };
    const fail = (what: string, err: unknown) => setNote(`Can't ${what}: ${err instanceof Error ? err.message : String(err)}`);
    const entryPath = (section: string, name: string) => ['pcbs', source, section, name];

    // the GitHub files parts of a section are made of, from every pcb, to pick a new one from
    const partFiles = (section: string) => {
        try {
            return Array.from(new Set(Object.values(config()?.pcbs ?? {}).flatMap((p: any) =>
                Object.values(p?.[section] ?? {}).map((m: any) => m?.what?.github?.repo && m?.what?.github?.file
                    ? `${m.what.github.repo}|${m.what.github.file}` : null)).filter(Boolean) as string[]))
                .sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1]));
        } catch (e: unknown) {
            return [];
        }
    };

    // The part a move or turn of a footprint (or module) writes to: placed by an anchor, or following keys
    const anchorHandle = (section: string, name: string) =>
        pcbPartHandles(config(), source, points, evaluate).handles.find(h => h.section === section && h.name === name && h.half === half);
    const followsKeys = (name: string) => {
        const where = config()?.pcbs?.[source]?.footprints?.[name]?.where;
        return !(where && typeof where === 'object' && !Array.isArray(where));
    };

    // a move on the board (KiCad dx, dy) as a shift in the frame of the key at keyName: ergogen's y is up
    const keyFrame = (keyName?: string) => {
        const key = keyName ? points[keyName] : undefined;
        return {r: key?.r ?? 0, mirrored: !!key?.meta?.mirrored};
    };
    const toLocal = (delta: Vec, frame: { r: number, mirrored: boolean }) => {
        const local = rotate({x: delta.x, y: -delta.y}, -frame.r);
        if (frame.mirrored) local.x = -local.x;
        return {x: round(local.x, 0.1), y: round(local.y, 0.1)};
    };
    const fromLocal = (local: Vec, frame: { r: number, mirrored: boolean }): Vec => {
        const board = rotate({x: frame.mirrored ? -local.x : local.x, y: local.y}, frame.r);
        return {x: board.x, y: -board.y};
    };

    const writeShift = (shift: AnchorShift | string, local: Vec, label: string) => {
        if (typeof shift === 'string') throw new Error(shift);
        const x = nudge(shift.raw[0], local.x, units);
        const y = nudge(shift.raw[1], local.y, units);
        write(applyEdits(text(), shift.edits(x, y)), `${label}: shift [${x}, ${y}]`);
    };

    const start = (e: React.PointerEvent, next: Moving) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        (e.target as Element).setPointerCapture(e.pointerId);
        setMoving(next);
        setNote(null);
    };

    const move = (e: React.PointerEvent) => {
        if (!moving) return;
        const now = toWorld(e);
        if (moving.kind === 'turn') {
            const angle = Math.atan2(now.y - moving.center.y, now.x - moving.center.x) * 180 / Math.PI - moving.startAngle;
            setMoving({...moving, angle: round(((angle + 540) % 360) - 180, 5)});
        } else {
            setMoving({...moving, delta: {x: now.x - moving.start.x, y: now.y - moving.start.y}});
        }
    };

    const drop = () => {
        const done = moving;
        setMoving(null);
        if (!done) return;
        if (done.kind === 'turn') {
            if (!done.angle) return;
            try {
                // the board's y is down, so a turn that looks clockwise is a negative angle; mirrored keys turn the other way
                const sign = keyFrame(done.instance.keyName).mirrored ? 1 : -1;
                const anchored = !followsKeys(done.name);
                const site = findChildValue(text(), entryPath('footprints', done.name), anchored ? 'where' : 'adjust', 'rotate');
                if (typeof site === 'string') throw new Error(site);
                if (site.raw !== undefined && !isPlainNumber(site.raw)) throw new Error(`its rotate is "${site.raw}", change it in the editor`);
                const value = short((site.raw === undefined ? 0 : Number(site.raw)) + sign * done.angle);
                write(applyEdits(text(), [{site, value}]), `${done.name}: ${anchored ? 'where' : 'adjust'}.rotate ${value}°`);
            } catch (err: unknown) {
                fail(`turn ${done.name}`, err);
            }
            return;
        }
        if (Math.hypot(done.delta.x, done.delta.y) < 0.05) return;
        try {
            if (done.kind === 'module') {
                const handle = anchorHandle('modules', done.module);
                if (!handle) throw new Error(`modules.${done.module} isn't placed by a ref + shift where`);
                writeShift(findShift(text(), handle.path), toLocal(done.delta, {r: handle.frame, mirrored: !!handle.at.mirrored}), done.module);
            } else if (!followsKeys(done.name)) {
                const handle = anchorHandle('footprints', done.name);
                if (!handle) throw new Error(`footprints.${done.name} isn't placed by a ref + shift where`);
                writeShift(findShift(text(), handle.path), toLocal(done.delta, {r: handle.frame, mirrored: !!handle.at.mirrored}), done.name);
            } else {
                // every instance takes the same shift, in its own key's frame
                const local = toLocal(done.delta, keyFrame(done.instance.keyName));
                writeShift(findChildShift(text(), entryPath('footprints', done.name), 'adjust'), local, `${done.name}: adjust`);
            }
        } catch (err: unknown) {
            fail(`move ${done.kind === 'module' ? done.module : done.name}`, err);
        }
    };

    const remove = (section: string, name: string) => {
        if (!window.confirm(`Delete ${section === 'modules' ? 'module' : 'footprint'} ${name}?`)) return;
        try {
            write(deleteEntry(text(), ['pcbs', source, section], name), `Deleted ${name}; undo in the editor brings it back`);
            if (name === chosen) setChosen(null);
        } catch (err: unknown) {
            fail(`delete ${name}`, err);
        }
    };

    const section = (t: Tab) => t === 'modules' ? 'modules' : 'footprints';

    const startAdding = () => {
        if (!adding) return;
        const name = adding.name.trim();
        if (!/^[A-Za-z_][\w-]*$/.test(name)) return setNote('Name it with letters, digits, _ or -, starting with a letter');
        if (config()?.pcbs?.[source]?.[section(adding.tab)]?.[name]) return setNote(`There already is a ${section(adding.tab)}.${name}`);
        if (!adding.file.includes('|')) return setNote('Pick the file it is made of');
        const [repo, file] = adding.file.split('|');
        if (adding.tab === 'footprints' && adding.onKeys) {
            // on no keys yet: they are clicked in next
            try {
                write(appendEntry(text(), ['pcbs', source, 'footprints'], name, keyFootprintLines(repo, file, [])), `Added ${name}: click the keys it goes on`);
                setChosen(name);
                setChoosingKeys(true);
            } catch (err: unknown) {
                fail(`add ${name}`, err);
            }
            setAdding(null);
            return;
        }
        setAdding({...adding, name, placing: true});
        setNote(null);
    };

    // The click that places a new part: on the nearest key of this board's half, shifted to the click
    const place = (e: React.PointerEvent) => {
        if (!adding?.placing || e.button !== 0) return;
        e.stopPropagation();
        const click = toWorld(e);
        const at = {x: click.x, y: -click.y};
        try {
            let ref = '', best = Infinity;
            for (const [name, p] of Object.entries(points)) {
                if (!!p.meta?.mirrored !== (half === 'mirror')) continue;
                const d = Math.hypot(p.x - at.x, p.y - at.y);
                if (d < best) [ref, best] = [name, d];
            }
            const key = points[ref];
            if (!key) throw new Error('there are no keys on this board to place it from');
            const local = rotate({x: at.x - key.x, y: at.y - key.y}, -key.r);
            const sign = key.meta?.mirrored ? -1 : 1;
            const shift: [string, string] = [short(round(sign * local.x, 0.1)), short(round(local.y, 0.1))];
            const [repo, file] = adding.file.split('|');
            // the config names the key on the source half
            const name = ref.replace(/^mirror_/, '');
            write(appendEntry(text(), ['pcbs', source, section(adding.tab)], adding.name, partLines(repo, file, name, shift)),
                `Added ${adding.name} at ${name} [${shift.join(', ')}]`);
            if (adding.tab === 'footprints') setChosen(adding.name);
        } catch (err: unknown) {
            fail(`add ${adding.name}`, err);
        }
        setAdding(null);
    };

    // the keys of this board's half, and which of them the chosen footprint is on
    const keyList = chosen ? findWhereList(text(), entryPath('footprints', chosen)) : null;
    const toggleKey = (keyName: string) => {
        if (!chosen || !keyList || typeof keyList === 'string') return;
        const name = keyName.replace(/^mirror_/, '');
        const names = keyList.names.includes(name) ? keyList.names.filter(n => n !== name) : [...keyList.names, name];
        write(applyEdits(text(), [{site: keyList.site, value: `[${names.join(', ')}]`}]),
            `${chosen}: ${keyList.names.includes(name) ? 'off' : 'on'} ${name}, on ${names.length} key${names.length === 1 ? '' : 's'}`);
    };

    const chosenConfig = chosen ? config()?.pcbs?.[source]?.footprints?.[chosen] : null;
    const describeWhere = (where: any) => where === true ? 'on every key'
        : Array.isArray(where) ? `on ${where.length} key${where.length === 1 ? '' : 's'}`
            : typeof where === 'string' ? `on ${where}`
                : where && typeof where === 'object' ? `at ${Array.isArray(where.ref) ? where.ref[0] : where.ref ?? 'a point'}` : 'nowhere';
    const setSide = (side: string) => {
        if (!chosen) return;
        const site = findValue(text(), entryPath('footprints', chosen), 'side');
        if (typeof site === 'string') return fail(`turn ${chosen} over`, site);
        write(applyEdits(text(), [{site, value: side}]), `${chosen}: ${side}`);
    };

    const ghostFor = (instance: Instance): { dx: number, dy: number, angle: number } | null => {
        if (!moving) return null;
        if (moving.kind === 'turn') {
            if (instance.name !== moving.name) return null;
            // instances on mirrored keys turn the other way
            const flip = keyFrame(instance.keyName).mirrored !== keyFrame(moving.instance.keyName).mirrored;
            return {dx: 0, dy: 0, angle: flip ? -moving.angle : moving.angle};
        }
        if (moving.kind !== 'footprint' || instance.name !== moving.name) return null;
        if (instance.key === moving.instance.key || !followsKeys(moving.name)) {
            return instance.key === moving.instance.key ? {dx: moving.delta.x, dy: moving.delta.y, angle: 0} : null;
        }
        const local = toLocal(moving.delta, keyFrame(moving.instance.keyName));
        const d = fromLocal(local, keyFrame(instance.keyName));
        return {dx: d.x, dy: d.y, angle: 0};
    };

    // The board edge: the outlines pcbs.<pcb>.outlines names, stacked. A pcb mirrored from another
    // without outlines of its own takes that pcb's, mirrored, so those are the ones to change.
    const outlineTarget = (() => {
        try {
            return config()?.pcbs?.[pcb]?.outlines !== undefined ? pcb : source;
        } catch (e: unknown) {
            return source;
        }
    })();
    const boardOutlines = tab === 'outline' ? pcbOutlines(text(), outlineTarget) : [];
    const outlineNames = (() => {
        try {
            return Object.keys(config()?.outlines ?? {});
        } catch (e: unknown) {
            return [];
        }
    })();
    const toggleOutline = (name: string) => {
        if (typeof boardOutlines === 'string') return;
        try {
            const entries = boardOutlines.filter(e => e.outline === name);
            const next = entries.length
                ? entries.reduce((t, e) => deleteEntry(t, ['pcbs', outlineTarget, 'outlines'], e.key), text())
                : addPcbOutline(text(), outlineTarget, name);
            write(next, `${outlineTarget}'s board edge ${entries.length ? 'no longer has' : 'now has'} ${name}`);
        } catch (err: unknown) {
            fail(`change the board edge`, err);
        }
    };
    // an outline drawn on the board: ergogen's path is in KiCad's coordinates already (y down), so it
    // only needs the camera's world-to-screen mapping, which is a scale and a move
    const outlinePath = (name: string) => {
        const raw = results?.outlines?.[name]?.raw;
        const makerjs = (window as any).makerjs;
        if (!raw || !makerjs) return null;
        const a = toScreen({x: 0, y: 0}), b = toScreen({x: 1, y: 0}), c = toScreen({x: 0, y: 1});
        return {d: String(makerjs.exporter.toSVGPathData(raw, {origin: [0, 0]})), transform: `matrix(${b.x - a.x} ${b.y - a.y} ${c.x - a.x} ${c.y - a.y} ${a.x} ${a.y})`};
    };

    const footprintFiles = partFiles('footprints');
    const moduleFiles = partFiles('modules');
    const knobFor = chosen && !moving && !choosingKeys ? instances.find(i => i.name === chosen) : undefined;

    return (
        <>
            <Layer ref={layer} active={active && !adding?.placing} onPointerMove={move} onPointerUp={drop} onPointerCancel={() => setMoving(null)}>
                {active && tab === 'modules' && modules.map(({module, box}) => {
                    const shape = onScreen(box);
                    const rect = shape.bounds;
                    const shift = moving?.kind === 'module' && moving.module === module ? screenDelta(moving.delta) : null;
                    const label = shift ? {x: rect.x + shift.x, y: rect.y + shift.y} : rect;
                    return (
                        <g key={module}>
                            <polygon className="module target" points={shape.points}
                                     onPointerDown={e => start(e, {kind: 'module', module, start: toWorld(e), delta: {x: 0, y: 0}})}>
                                <title>{`modules.${module}: drag to move it`}</title>
                            </polygon>
                            {shift && <polygon className="ghost" points={shape.points} transform={`translate(${shift.x} ${shift.y})`}/>}
                            <text x={label.x + (moving || adding ? 3 : 15)} y={label.y - 4}>{module}</text>
                            {!moving && !adding && (
                                <g className="remove target" transform={`translate(${rect.x + 6} ${rect.y - 8})`}
                                   onPointerDown={e => { e.stopPropagation(); remove('modules', module); }}>
                                    <title>{`Delete module ${module}`}</title>
                                    <circle r={6}/>
                                    <text x={-3} y={4}>×</text>
                                </g>
                            )}
                        </g>
                    );
                })}
                {active && tab === 'footprints' && !choosingKeys && instances.map(instance => {
                    const shape = onScreen(instance.box);
                    const ghost = ghostFor(instance);
                    const isChosen = instance.name === chosen;
                    return (
                        <g key={instance.key}>
                            <polygon className={`footprint target${isChosen ? ' chosen' : ''}`} points={shape.points}
                                  onPointerDown={e => {
                                      if (!isChosen) {
                                          e.stopPropagation();
                                          setChosen(instance.name);
                                          setNote(null);
                                          return;
                                      }
                                      start(e, {kind: 'footprint', name: instance.name, instance, start: toWorld(e), delta: {x: 0, y: 0}});
                                  }}>
                                <title>{`footprints.${instance.name}${isChosen ? ': drag to move' : ': click to pick'}`}</title>
                            </polygon>
                            {ghost && (() => {
                                const d = screenDelta({x: ghost.dx, y: ghost.dy});
                                return <polygon className="ghost" points={shape.points}
                                                transform={`translate(${d.x} ${d.y}) rotate(${ghost.angle} ${shape.center.x} ${shape.center.y})`}/>;
                            })()}
                        </g>
                    );
                })}
                {active && tab === 'footprints' && knobFor && (() => {
                    const rect = onScreen(knobFor.box).bounds;
                    // the turn is measured around the footprint's middle, in board coordinates
                    const center = knobFor.box.center;
                    const knob = {x: rect.x + rect.w / 2, y: rect.y - 14};
                    return (
                        <circle className="knob target" cx={knob.x} cy={knob.y} r={6}
                                onPointerDown={e => {
                                    const now = toWorld(e);
                                    start(e, {kind: 'turn', name: knobFor.name, instance: knobFor, center,
                                        startAngle: Math.atan2(now.y - center.y, now.x - center.x) * 180 / Math.PI, angle: 0});
                                }}>
                            <title>{`Drag to turn ${knobFor.name}`}</title>
                        </circle>
                    );
                })()}
                {active && tab === 'footprints' && choosingKeys && keyList && typeof keyList !== 'string' && Object.entries(points)
                    .filter(([, p]) => !!p.meta?.mirrored === (half === 'mirror'))
                    .map(([keyName, p]) => {
                        const at = toScreen({x: p.x, y: -p.y});
                        const member = keyList.names.includes(keyName.replace(/^mirror_/, ''));
                        return (
                            <circle key={keyName} className={`key target${member ? ' member' : ''}`} cx={at.x} cy={at.y} r={7}
                                    onPointerDown={e => { e.stopPropagation(); toggleKey(keyName); }}>
                                <title>{`${keyName.replace(/^mirror_/, '')}: click to ${member ? 'take it off' : 'put it on'}`}</title>
                            </circle>
                        );
                    })}
                {moving?.kind === 'turn' && (
                    <text x={onScreen(moving.instance.box).bounds.x} y={onScreen(moving.instance.box).bounds.y - 24}>{`${moving.angle}°`}</text>
                )}
                {active && tab === 'outline' && hoverOutline && half === 'source' && (() => {
                    const path = outlinePath(hoverOutline);
                    return path && <path d={path.d} transform={path.transform} fill="rgba(255, 159, 28, 0.12)" stroke="#ff9f1c"
                                         strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" fillRule="evenodd"/>;
                })()}
                {adding?.placing && <rect className="catcher" x={0} y={0} width="100%" height="100%" onPointerDown={place}/>}
            </Layer>
            <Toolbar>
                <button className={active ? 'on' : ''} onClick={() => { setActive(!active); setNote(null); setAdding(null); setChoosingKeys(false); }}>
                    {active ? 'Done' : 'Edit parts'}
                </button>
                {active && (
                    <div className="tabs">
                        {(['modules', 'footprints', 'outline'] as Tab[]).map(t => (
                            <button key={t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setAdding(null); setChoosingKeys(false); setNote(null); }}>
                                {t === 'modules' ? 'Modules' : t === 'footprints' ? 'Footprints' : 'Board outline'}
                            </button>
                        ))}
                    </div>
                )}
                {active && !adding && !choosingKeys && tab !== 'outline' && (
                    <button className="add" onClick={() => setAdding({tab, name: '', file: (tab === 'modules' ? moduleFiles : footprintFiles)[0] ?? '', onKeys: true, placing: false})}>
                        {tab === 'modules' ? '+ Add module' : '+ Add footprint'}
                    </button>
                )}
                {adding && !adding.placing && (
                    <>
                        <input autoFocus placeholder={`${adding.tab === 'modules' ? 'module' : 'footprint'} name`} value={adding.name}
                               onChange={e => setAdding({...adding, name: e.target.value})}
                               onKeyDown={e => e.key === 'Enter' ? startAdding() : e.key === 'Escape' && setAdding(null)}/>
                        <select value={adding.file} onChange={e => setAdding({...adding, file: e.target.value})} title={adding.file.replace('|', '/')}>
                            {(adding.tab === 'modules' ? moduleFiles : footprintFiles).map(f =>
                                <option key={f} value={f}>{f.split('|')[1].split('/').slice(-2).join('/')}</option>)}
                        </select>
                        {adding.tab === 'footprints' && (
                            <select value={adding.onKeys ? 'keys' : 'point'} onChange={e => setAdding({...adding, onKeys: e.target.value === 'keys'})}>
                                <option value="keys">on keys</option>
                                <option value="point">at a point</option>
                            </select>
                        )}
                        <button className="add" onClick={startAdding}>{adding.tab === 'footprints' && adding.onKeys ? 'Add' : 'Place'}</button>
                        <button onClick={() => setAdding(null)}>Cancel</button>
                    </>
                )}
                {adding?.placing && (
                    <>
                        <span>Click on the board where {adding.name} goes</span>
                        <button onClick={() => setAdding(null)}>Cancel</button>
                    </>
                )}
                {active && tab === 'footprints' && chosen && !adding && (
                    <>
                        <span>{`${chosen} (${String(chosenConfig?.what?.github?.file ?? '').split('/').pop()}), ${describeWhere(chosenConfig?.where)}`}</span>
                        <select value={String(chosenConfig?.side ?? 'front').toLowerCase()} onChange={e => setSide(e.target.value)}>
                            <option value="front">front</option>
                            <option value="back">back</option>
                        </select>
                        {keyList && typeof keyList !== 'string' && (
                            <button className={choosingKeys ? 'on' : ''} onClick={() => setChoosingKeys(!choosingKeys)}>
                                {choosingKeys ? 'Keys chosen' : 'Choose keys'}
                            </button>
                        )}
                        <button className="danger" onClick={() => remove('footprints', chosen)}>Delete</button>
                        <button onClick={() => { setChosen(null); setChoosingKeys(false); }}>Deselect</button>
                    </>
                )}
                {moving && moving.kind !== 'turn' && (
                    <span>{`${moving.kind === 'module' ? moving.module : moving.name}: ${moving.delta.x.toFixed(1)}, ${(-moving.delta.y).toFixed(1)} mm`}</span>
                )}
                {!moving && note && <span>{note}</span>}
                {!moving && !note && active && !adding && tab === 'modules' && <span>Drag a module's box to move it, × deletes it</span>}
                {!moving && !note && active && !adding && tab === 'footprints' && !chosen && <span>Click a footprint to pick it and the others like it</span>}
                {!moving && !note && active && tab === 'footprints' && chosen && !choosingKeys && (
                    <span>{followsKeys(chosen) ? 'Drag one to move them all on their keys, the knob turns them' : 'Drag it to move it, the knob turns it'}</span>
                )}
                {!moving && !note && active && choosingKeys && <span>Click keys to put {chosen} on them or take it off</span>}
            </Toolbar>
            {active && tab === 'outline' && (
                <OutlineList onMouseLeave={() => setHoverOutline(null)}>
                    {typeof boardOutlines === 'string' ? <span>{boardOutlines}</span> : outlineNames.map(name => (
                        <label key={name} onMouseEnter={() => setHoverOutline(name)}>
                            <input type="checkbox" checked={boardOutlines.some(e => e.outline === name)} onChange={() => toggleOutline(name)}/>
                            {name}
                        </label>
                    ))}
                    <div className="note">
                        {`The board edge of ${outlineTarget} is the checked outlines stacked; a closed shape inside the board becomes a cut-out.`}
                        {outlineTarget !== pcb && ` ${pcb} takes them from ${outlineTarget}, mirrored.`}
                        {half === 'source' ? ' Point at one to see it on the board.' : ''}
                    </div>
                </OutlineList>
            )}
        </>
    );
};

export default PcbEditor;
