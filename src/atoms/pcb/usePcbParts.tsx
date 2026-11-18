import React, {useEffect, useMemo, useRef, useState} from "react";
import yaml from "js-yaml";
import {Field} from "../../ui";
import {useConfigContext} from "../../context/ConfigContext";
import {
    AnchorShift, EditSite, addPcbOutline, appendEntry, pcbOutlines, applyEdits, deleteEntry, findChildShift, findChildValue, findShift, findValue,
    findWhereList, isPlainNumber, keyFootprintLines, nudge, partLines,
} from "../../utils/layoutEdit";
import {pcbPartHandles} from "../../utils/outlineGeometry";
import {Instance, Shape, footprintInstances, moduleBoxes} from "../../utils/pcbGeometry";
import {frameOf, fromFrame, nearestKey, shiftFrom, toFrame} from "../../utils/keyFrame";

// Edits a pcb's parts on its KiCanvas preview. Modules are boxed around their footprints: drag one to
// move it (its where.shift), × deletes it, a new one is placed with a click. Footprints are picked by
// clicking one of them, which picks its whole config entry: one placed by an anchor moves like a module,
// one that follows keys moves and turns on every key at once (its adjust), and the keys it is on can be
// clicked in and out. Moves are written in the frame of the key they are relative to, the way the values
// were written. A pcb mirrored from another has that pcb's parts, so it edits those. After every edit
// the preview regenerates.

type Vec = { x: number, y: number };
type Tab = 'modules' | 'footprints' | 'outline';
type Half = 'source' | 'mirror';
type Points = Record<string, { x: number, y: number, r: number, meta?: { mirrored?: boolean, index?: number, name?: string } }>;


// a drag: of a module, a footprint (all of its entry's instances follow), or a turn of a footprint
type Moving =
    { kind: 'module', module: string, start: Vec, delta: Vec }
    | { kind: 'footprint', name: string, instance: Instance, start: Vec, delta: Vec }
    | { kind: 'turn', name: string, instance: Instance, center: Vec, startAngle: number, angle: number };

// a part being added: named and given its file, then placed with the next click (or put on keys)
type Adding = { tab: Tab, name: string, file: string, onKeys: boolean, placing: boolean };






const round = (value: number, step: number) => Math.round(value / step) * step;
const short = (value: number) => String(Number(value.toFixed(2)));

// The state and the actions of a pcb's parts editor (PcbEditor): what is picked, dragged and typed, and the edits
// they write. Null while the board regenerates (its state stays: the editor stays mounted).
export const usePcbParts = (viewer: any, pcb: string) => {
    const configContext = useConfigContext();
    const [active, setActive] = useState(false);
    const [tab, setTab] = useState<Tab>('modules');
    const [moving, setMoving] = useState<Moving | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [adding, setAdding] = useState<Adding | null>(null);
    // the footprint entry picked last, and whether its keys are being chosen
    const [chosen, setChosen] = useState<string | null>(null);
    const [choosingKeys, setChoosingKeys] = useState(false);
    // the module picked last, and the footprint picked last (its frame is the one keys and typing use)
    const [chosenModule, setChosenModule] = useState<string | null>(null);
    const [chosenInstance, setChosenInstance] = useState<string | null>(null);
    // what is typed into the x / y / rotate boxes and not yet written
    const [fields, setFields] = useState<{ x?: string, y?: string, rotate?: string }>({});
    // arrow keys and [ ] while a part is picked; set each render so it sees the current state
    const onKey = useRef<((e: KeyboardEvent) => void) | undefined>();
    useEffect(() => {
        const listener = (e: KeyboardEvent) => onKey.current?.(e);
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, []);
    // the outline under the pointer in the board outline list, drawn on the board
    const [hoverOutline, setHoverOutline] = useState<string | null>(null);
    const [listFolded, setListFolded] = useState(false);
    // the module or footprint entry pointed at in the card's list, lit on the board
    const [lit, setLit] = useState<string | null>(null);
    // bumped whenever KiCanvas' camera moves, so the boxes follow a pan or zoom
    const [, setFrame] = useState(0);
    const layer = useRef<SVGSVGElement>(null);

    const results = configContext?.results;
    const pcbResults = results?.pcbs?.[pcb];
    const source: string = results?.config?.pcbs?.[pcb]?.mirror?.from ?? pcb;
    const half: Half = source === pcb ? 'source' : 'mirror';
    const points: Points = results?.points ?? {};

    const modules = useMemo(() => moduleBoxes(viewer?.board?.footprints ?? [], pcbResults?.modules ?? {}), [viewer, pcbResults]);

    const instances = useMemo(
        () => footprintInstances(viewer?.board?.footprints ?? [], pcbResults?.footprints ?? {}, results?.config?.pcbs?.[source]?.footprints ?? {}),
        [viewer, pcbResults, results, source]);

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

    if (!configContext || !viewer) {
        // nothing to nudge while the board regenerates
        onKey.current = undefined;
        return null;
    }
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

    // a move on the board (KiCad dx, dy: y down) as a shift in the frame of the key at keyName (y up), and back
    const keyFrame = (keyName?: string) => frameOf(keyName ? points[keyName] : undefined);
    const toLocal = (delta: Vec, frame: { r: number, mirrored: boolean }) => {
        const local = toFrame({x: delta.x, y: -delta.y}, frame);
        return {x: round(local.x, 0.1), y: round(local.y, 0.1)};
    };
    const fromLocal = (local: Vec, frame: { r: number, mirrored: boolean }): Vec => {
        const board = fromFrame(local, frame);
        return {x: board.x, y: -board.y};
    };

    const writeShift = (shift: AnchorShift | string, local: Vec, label: string) => {
        if (typeof shift === 'string') throw new Error(shift);
        const x = nudge(shift.raw[0], local.x, units);
        const y = nudge(shift.raw[1], local.y, units);
        write(applyEdits(text(), shift.edits(x, y)), `${label}: shift [${x}, ${y}]`);
    };

    // The part picked for typing and keys: a module, or a footprint entry (in the frame of the instance clicked)
    type Target = { section: 'modules' | 'footprints', name: string, keyName?: string };
    const target: Target | null = tab === 'modules' && chosenModule ? {section: 'modules', name: chosenModule}
        : tab === 'footprints' && chosen && !choosingKeys ? {
            section: 'footprints', name: chosen,
            keyName: (instances.find(i => i.key === chosenInstance && i.name === chosen) ?? instances.find(i => i.name === chosen))?.keyName,
        } : null;

    // where a part's shift and rotate are written, and the frame its shift is in: a part placed by an
    // anchor has them in its where, a footprint that follows keys in its adjust
    const placement = (t: Target) => {
        if (t.section === 'footprints' && followsKeys(t.name)) {
            const path = entryPath('footprints', t.name);
            return {shift: findChildShift(text(), path, 'adjust'), rotate: findChildValue(text(), path, 'adjust', 'rotate'), frame: keyFrame(t.keyName), what: 'adjust'};
        }
        const handle = anchorHandle(t.section, t.name);
        if (!handle) return null;
        return {
            shift: findShift(text(), handle.path), rotate: findChildValue(text(), entryPath(t.section, t.name), 'where', 'rotate'),
            frame: {r: handle.frame, mirrored: !!handle.at.mirrored}, what: 'where',
        };
    };

    // moves a part by a step on the board (KiCad's dx, dy), written to 0.01 mm in its frame
    const nudgePart = (t: Target, delta: Vec) => {
        try {
            const p = placement(t);
            if (!p) throw new Error(`${t.section}.${t.name} isn't placed by a ref + shift where`);
            if (typeof p.shift === 'string') throw new Error(p.shift);
            const local = toFrame({x: delta.x, y: -delta.y}, p.frame);
            const x = nudge(p.shift.raw[0], round(local.x, 0.01), units);
            const y = nudge(p.shift.raw[1], round(local.y, 0.01), units);
            write(applyEdits(text(), p.shift.edits(x, y)), `${t.name}: ${p.what}.shift [${x}, ${y}]`);
        } catch (err: unknown) {
            fail(`move ${t.name}`, err);
        }
    };

    // turns a part by degrees that look clockwise on the board (whose y is down): a negative angle,
    // unless it is on a mirrored key
    const turnPart = (t: Target, degrees: number) => {
        try {
            const p = placement(t);
            if (!p) throw new Error(`${t.section}.${t.name} isn't placed by a ref + shift where`);
            if (typeof p.rotate === 'string') throw new Error(p.rotate);
            if (p.rotate.raw !== undefined && !isPlainNumber(p.rotate.raw)) throw new Error(`its rotate is "${p.rotate.raw}", type a new one`);
            const value = short((p.rotate.raw === undefined ? 0 : Number(p.rotate.raw)) + (p.frame.mirrored ? 1 : -1) * degrees);
            write(applyEdits(text(), [{site: p.rotate, value}]), `${t.name}: ${p.what}.rotate ${value}°`);
        } catch (err: unknown) {
            fail(`turn ${t.name}`, err);
        }
    };

    onKey.current = e => {
        if (!active || !target || moving || adding) return;
        if ((e.target as HTMLElement)?.closest?.('input, textarea, select, .monaco-editor')) return;
        const step = e.shiftKey ? 1 : 0.1;
        const moves: Record<string, Vec> = {ArrowLeft: {x: -step, y: 0}, ArrowRight: {x: step, y: 0}, ArrowUp: {x: 0, y: -step}, ArrowDown: {x: 0, y: step}};
        if (moves[e.key]) nudgePart(target, moves[e.key]);
        else if (e.key === '[' || e.key === ']') turnPart(target, e.key === ']' ? 5 : -5);
        else return;
        e.preventDefault();
    };

    // the x / y / rotate boxes: typed values (numbers or expressions) are written as they are
    const typedPlacement = target ? (() => {
        try {
            return placement(target);
        } catch (e: unknown) {
            return null;
        }
    })() : null;
    const commitFields = () => {
        if (!target || !typedPlacement) return;
        const {shift, rotate: rotateSite} = typedPlacement;
        try {
            let next = text();
            if (typeof shift !== 'string' && (fields.x !== undefined || fields.y !== undefined)) {
                const x = (fields.x ?? shift.raw[0] ?? '0').trim() || '0', y = (fields.y ?? shift.raw[1] ?? '0').trim() || '0';
                if (x !== (shift.raw[0] ?? '0') || y !== (shift.raw[1] ?? '0')) next = applyEdits(next, shift.edits(x, y));
            }
            if (typeof rotateSite !== 'string' && fields.rotate !== undefined) {
                // sites are places in the text, so the rotate is found again after the shift was written
                const site = findChildValue(next, entryPath(target.section, target.name), typedPlacement.what, 'rotate');
                if (typeof site !== 'string' && fields.rotate.trim() !== (site.raw ?? '')) next = applyEdits(next, [{site, value: fields.rotate.trim() || '0'}]);
            }
            setFields({});
            if (next !== text()) write(next, `${target.name}: ${typedPlacement.what} set`);
        } catch (err: unknown) {
            fail(`set ${target.name}`, err);
        }
    };
    const field = (key: 'x' | 'y' | 'rotate', label: string, unit: string) => {
        const p = typedPlacement;
        const site = key === 'rotate' ? p?.rotate : p?.shift;
        const raw = !site || typeof site === 'string' ? undefined : key === 'rotate' ? (site as EditSite).raw : (site as AnchorShift).raw[key === 'x' ? 0 : 1];
        return (
            <Field key={key} label={label} unit={unit}>
                <input value={fields[key] ?? raw ?? ''} placeholder="0" disabled={!site || typeof site === 'string'}
                       title={typeof site === 'string' ? site : undefined}
                       onChange={e => setFields({...fields, [key]: e.target.value})}
                       onKeyDown={e => { if (e.key === 'Enter') commitFields(); else if (e.key === 'Escape') setFields({}); }}
                       onBlur={commitFields}/>
            </Field>
        );
    };
    // where the picked part is: its shift from what it is placed at, and its turn
    const placementFields = () => !target || moving ? null : <>
        {field('x', 'Shift X', 'mm')}
        {field('y', 'Shift Y', 'mm')}
        {field('rotate', 'Rotate', '°')}
    </>;

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
        if (Math.hypot(done.delta.x, done.delta.y) < 0.05) {
            // a click without a drag picks the module
            if (done.kind === 'module') {
                setChosenModule(done.module);
                setFields({});
                setNote(null);
            }
            return;
        }
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
            // from a key on this board's half
            const ref = nearestKey(points, at, (_, p) => !!p.meta?.mirrored === (half === 'mirror'));
            if (!ref) throw new Error('there are no keys on this board to place it from');
            const placed = shiftFrom(points[ref], at, 0.1).shift;
            const shift: [string, string] = [short(placed[0]), short(placed[1])];
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

    return {
        pcb,
        active,
        adding,
        boardOutlines,
        choosingKeys,
        chosen,
        chosenConfig,
        chosenModule,
        config,
        describeWhere,
        drop,
        followsKeys,
        footprintFiles,
        ghostFor,
        half,
        hoverOutline,
        instances,
        keyList,
        knobFor,
        layer,
        listFolded,
        lit,
        moduleFiles,
        modules,
        move,
        moving,
        note,
        onScreen,
        outlineNames,
        outlinePath,
        outlineTarget,
        place,
        placementFields,
        points,
        remove,
        screenDelta,
        setActive,
        setAdding,
        setChoosingKeys,
        setChosen,
        setChosenInstance,
        setChosenModule,
        setFields,
        setHoverOutline,
        setListFolded,
        setLit,
        setMoving,
        setNote,
        setSide,
        setTab,
        source,
        start,
        startAdding,
        tab,
        target,
        text,
        toScreen,
        toWorld,
        toggleKey,
        toggleOutline,
    };
};

export type PcbParts = NonNullable<ReturnType<typeof usePcbParts>>;
