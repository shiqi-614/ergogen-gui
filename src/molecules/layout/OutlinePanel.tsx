import {useEffect, useMemo, useRef, useState} from "react";
import styled from "styled-components";
import yaml from "js-yaml";
import {Actions, AddMenu, Button, CardHead, CardShell, Field, Gap, Tip, colors} from "../../ui";
import {ConfirmDelete} from "../DeleteItem";
import {
    EditSite, PartAttr, appendEntry, appendListItem, applyEdits, deleteOutline, deleteOutlinePart, findLineValue, findListValues,
    findPartSites, findShift, insertPolygonPoint, isPlainNumber, moveListItem, nextName, outlineReferences, removePolygonPoint,
} from "../../utils/layoutEdit";

const OPERATIONS = ['add', 'subtract', 'intersect', 'stack'];
const JOINTS = ['round', 'pointy', 'beveled'];
// "3]" is ergogen's shorthand for expand 3 with beveled joints
const JOINT_SUFFIXES = [')', '>', ']'];

type OutlinePanelProps = {
    outline: string,
    text: string,
    onCommit: (text: string) => void,
    onDeleted: (name: string) => void,
    // folded down to its title, out of the way of the points under it
    folded: boolean,
    onFold: (folded: boolean) => void,
    // the outline as a DXF, to download
    dxf?: string,
    // the part pointed at ("board.0"), or one of its points ("board.0.points[3]"), for the layout to light, or null
    onLight?: (part: string | null) => void,
    // the point picked on the board ("board.0.points[3]"), and picking one from the panel
    chosenPoint?: string | null,
    onChoosePoint?: (label: string) => void,
    // the points' names, offered as a point's ref, and opening another outline (the template one extends)
    pointNames?: string[],
    onPick?: (outline: string) => void,
};

// what a part is, in a few words: a polygon's points, the outline an outline part is made of, a shape's size
const describe = (part: any): string => {
    if (!part || typeof part !== 'object') return typeof part === 'string' ? part : ''
    const where = part.where !== undefined ? ', on its where' : ''
    switch (part.what) {
        // its points are listed below it
        case 'polygon': return where.slice(2)
        case 'outline': return `of outline ${part.name}${where}`
        case 'rectangle': return `${Array.isArray(part.size) ? part.size.join(' × ') : part.size ?? '?'}${where}`
        case 'circle': case 'hexagon': return `radius ${part.radius ?? '?'}${where}`
        default: return where.slice(2)
    }
}

// a value of the config as it is written, on one line and unquoted: "ref: matrix_col0_row0, shift: [1, 2 + u]"
const flow = (value: unknown): string => Array.isArray(value) ? `[${value.map(flow).join(', ')}]`
    : value && typeof value === 'object' ? `{${oneLine(value)}}` : String(value);
const oneLine = (value: unknown): string => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).map(([key, v]) => `${key}: ${flow(v)}`).join(', ') : flow(value);

// the ref menu's last entry: type the ref instead
const TYPE_IT = '\u0000type';

// a name as it shows: without the quotes it may be written in
const unquote = (raw: string | undefined) => (raw ?? '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

// what the panel's fields already edit, or the head already says
const SHOWN = new Set(['what', 'operation', 'expand', 'joints', 'fillet', 'points']);

// a part's contents, as the config writes them: its other fields, and a polygon's points, one a line
const Contents = styled.div`
  margin: -0.1rem 0 0.5rem;
  font-size: 0.75rem;
  color: ${colors.muted};

  > div, li {
    display: flex;
    gap: 0.4rem;
    overflow: hidden;
    white-space: nowrap;
  }

  b {
    color: ${colors.text};
    font-weight: normal;
    flex: none;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* the points' toggle and their × (the panel's own buttons are the shared Button) */
  button.toggle, button.remove {
    padding: 0;
    border: none;
    background: none;
    color: ${colors.muted};
    font: inherit;
    cursor: pointer;
  }

  ol {
    margin: 0.15rem 0 0;
    padding: 0;
    list-style: none;
    max-height: 20rem;
    overflow-y: auto;
  }

  li {
    padding: 0 0.2rem;
    border-radius: 0.2rem;
    cursor: pointer;
  }

  /* a point's (or a where's) ref, x and y, each a box */
  input.anchor {
    min-width: 0;
    flex: 1 1 0;
    padding: 0.05rem 0.25rem;
    border: 1px solid transparent;
    border-radius: 0.2rem;
    background: rgba(255, 255, 255, 0.06);
    color: ${colors.text};
    font: inherit;
  }

  /* a point (or a where): its name, then "ref" and the point on one line, "x" and "y" on the next */
  li.anchors, div.anchors {
    display: grid;
    grid-template-columns: 2.4rem auto 1fr auto 1fr auto;
    gap: 0.15rem 0.3rem;
    padding: 0.15rem 0.2rem;
  }

  .anchors > b { grid-column: 1; grid-row: 1; }
  .anchors .ref-label { grid-column: 2; grid-row: 1; }
  .anchors .ref { grid-column: 3 / 6; grid-row: 1; }
  .anchors .x-label { grid-column: 2; grid-row: 2; }
  .anchors .x { grid-column: 3; grid-row: 2; }
  .anchors .y-label { grid-column: 4; grid-row: 2; }
  .anchors .y { grid-column: 5; grid-row: 2; }
  .anchors .remove { grid-column: 6; grid-row: 1; }

  .anchors > span {
    display: flex;
    min-width: 0;
  }

  .label {
    color: ${colors.muted};
  }

  select.anchor {
    flex: 1 1 0;
    min-width: 0;
    padding: 0.05rem 0.15rem;
  }

  button.remove:disabled {
    opacity: 0.3;
    cursor: default;
  }

  input.anchor:focus {
    border-color: #ff9f1c;
    outline: none;
  }

  li, .anchor-row {
    align-items: center;
    margin-bottom: 0.1rem;
  }

  li:hover, li.chosen {
    background: rgba(255, 159, 28, 0.25);
    color: ${colors.strong};
  }
`;

// how an outline is made from a template, or what fills one in
const Template = styled.div`
  margin-bottom: 0.6rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid ${colors.rule};
  font-size: 0.8rem;
  color: ${colors.muted};

  > div {
    margin-bottom: 0.4rem;
  }

  button.link {
    padding: 0;
    border: none;
    background: none;
    color: #ff9f1c;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  input.anchor {
    width: 100%;
  }
`;

// The settings of each part of an outline: how it joins the parts before it, and the expand and
// fillet ergogen applies to everything up to and including it
// at the layout editor's top right
const Card = styled(CardShell)`
  top: 0.75rem;
  right: 0.75rem;
  width: 20rem;
`;

// a part's name and its ×, a rule above all but the first
const PartHead = styled.div<{ first: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: ${p => p.first ? '0' : '0.7rem'} 0 0.4rem;
  padding-top: ${p => p.first ? '0' : '0.6rem'};
  border-top: ${p => p.first ? 'none' : `1px solid ${colors.rule}`};
  color: ${colors.strong};
  font-weight: bold;

  small {
    color: ${colors.muted};
    font-weight: normal;
  }
`;

const OutlinePanel = ({outline, text, onCommit, onDeleted, folded, onFold, dxf, onLight, chosenPoint, onChoosePoint, pointNames = [], onPick}: OutlinePanelProps) => {
    const found = useMemo(() => findPartSites(text, outline), [text, outline]);
    // $params, $extends and $args are no parts: they make it a template, or an outline filled in from one
    const parts = typeof found === 'string' ? found : found.filter(part => !String(part.key).startsWith('$'));
    // the parts as the config has them, for what each is
    const written = useMemo(() => {
        try {
            return (yaml.load(text) as any)?.outlines?.[outline] ?? {};
        } catch (e: unknown) {
            return {};
        }
    }, [text, outline]);
    const all = useMemo(() => {
        try {
            return (yaml.load(text) as any)?.outlines ?? {};
        } catch (e: unknown) {
            return {};
        }
    }, [text]);
    // the outlines an outline part can be made of: every other one
    const others = Object.keys(all).filter(name => name !== outline);
    // a template ($params), and the outlines filled in from it; or the template this one is filled in from ($args)
    const template = typeof written?.$extends === 'string' ? written.$extends.replace(/^outlines\./, '') : null;
    const params: string[] = (template ? all[template]?.$params : written?.$params) ?? [];
    const users = Object.keys(all).filter(name => all[name]?.$extends === `outlines.${outline}`);
    const argSites = useMemo(() => template ? findListValues(text, ['outlines', outline, '$args']) : [], [text, outline, template]);
    const [deleting, setDeleting] = useState(false);
    // the parts whose points are listed
    const [opened, setOpened] = useState<Record<string, boolean>>({});
    const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
    // the refs being typed instead of picked
    const [typing, setTyping] = useState<Record<string, boolean>>({});
    useEffect(() => setDrafts({}), [text, outline]);
    // A slider writes once it rests, so a drag is one edit (and one undo), not dozens. Every write
    // goes onto the newest text, the waiting slider value first, so neither undoes the other.
    const latest = useRef(text);
    useEffect(() => { latest.current = text; }, [text]);
    const timer = useRef<number>();
    const pending = useRef<{ key: string | number, attr: PartAttr, value: string } | null>(null);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    // an outline written in a way the panel can't edit: why
    if (typeof parts === 'string') return (
        <Card><CardHead title={outline} folded={folded} onFold={onFold}/>{!folded && <div className="body"><Tip>{parts}</Tip></div>}</Card>
    );

    // Deleting asks first, and names what uses the outline: those go too, so the config stays valid.
    // The editor's undo (Ctrl+Z / Cmd+Z) brings it all back.
    const removeOutline = () => {
        const users = outlineReferences(text, outline);
        const question = users.length
            ? `Delete outline ${outline}? It is used by:\n${users.map(u => `  ${u.label}`).join('\n')}\nThose will be deleted too.`
            : `Delete outline ${outline}?`;
        if (!window.confirm(question)) return;
        try {
            commitText(deleteOutline(flush(latest.current), outline, true));
            onDeleted(outline);
        } catch (e: unknown) {
            window.alert(`Can't delete ${outline}: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const removePart = (key: string | number, what: string) => {
        if (parts.length === 1) return removeOutline();
        if (!window.confirm(`Delete part ${typeof key === 'number' ? `#${key}` : key} (${what}) of ${outline}?`)) return;
        try {
            commitText(deleteOutlinePart(flush(latest.current), outline, key));
        } catch (e: unknown) {
            window.alert(`Can't delete that part: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    // A new part at the end, at the key the outline's first part starts from (or the first key): a triangle, a
    // 10 mm square, a 5 mm circle, or another outline as it is
    const refOf = (): string => {
        const first = Array.isArray(written) ? written[0] : Object.values(written ?? {})[0] as any;
        const ref = first?.where?.ref ?? first?.points?.[0]?.ref;
        return typeof ref === 'string' ? ref : Array.isArray(ref) && typeof ref[0] === 'string' ? ref[0] : pointNames[0] ?? 'matrix';
    };
    const addPart = (what: 'polygon' | 'rectangle' | 'circle' | 'outline', made?: string) => {
        const ref = refOf();
        const lines = what === 'polygon' ? ['what: polygon', 'operation: add', 'points:',
                ...[[-5, -5], [5, -5], [0, 5]].flatMap(([x, y]) => [`  - ref: ${ref}`, `    shift: [${x}, ${y}]`])]
            : what === 'rectangle' ? ['what: rectangle', 'operation: add', 'size: [10, 10]', 'where:', `  ref: ${ref}`]
            : what === 'circle' ? ['what: circle', 'operation: add', 'radius: 5', 'where:', `  ref: ${ref}`]
            : ['what: outline', 'operation: add', `name: ${made}`];
        try {
            const base = flush(latest.current);
            commitText(Array.isArray(written) ? appendListItem(base, ['outlines', outline], lines)
                : appendEntry(base, ['outlines', outline], nextName(Object.keys(written ?? {}), 'part'), lines));
        } catch (e: unknown) {
            window.alert(`Can't add a part: ${e instanceof Error ? e.message : String(e)}`);
        }
    };
    // a part up or down the list (the order is how they join: each one's operation applies to those before it)
    const movePart = (index: number, delta: number) => {
        try {
            commitText(moveListItem(flush(latest.current), ['outlines', outline], index, delta));
        } catch (e: unknown) {
            window.alert(`Can't move that part: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const applyTo = (base: string, key: string | number, attr: PartAttr, value: string) => {
        const site = (() => { const now = findPartSites(base, outline); return typeof now === 'string' ? undefined : now.find(p => p.key === key)?.sites[attr]; })();
        return site && typeof site !== 'string' ? applyEdits(base, [{site, value}]) : base;
    };
    const flush = (base: string) => {
        window.clearTimeout(timer.current);
        const waiting = pending.current;
        pending.current = null;
        return waiting ? applyTo(base, waiting.key, waiting.attr, waiting.value) : base;
    };
    const commitText = (next: string) => {
        if (next === latest.current) return;
        latest.current = next;
        onCommit(next);
    };
    const write = (key: string | number, attr: PartAttr, site: EditSite | string, value: string, delay = 0) => {
        if (typeof site === 'string') return;
        const other = pending.current && (pending.current.key !== key || pending.current.attr !== attr);
        if (delay && !other) {
            pending.current = {key, attr, value};
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => commitText(flush(latest.current)), delay);
            return;
        }
        const base = flush(latest.current);
        if (delay) {
            commitText(base);
            pending.current = {key, attr, value};
            timer.current = window.setTimeout(() => commitText(flush(latest.current)), delay);
            return;
        }
        commitText(applyTo(base, key, attr, value));
    };
    const rawOf = (site: EditSite | string) => typeof site === 'string' ? undefined : site.raw;
    const reason = (site: EditSite | string) => typeof site === 'string' ? `Can't edit here: ${site}` : undefined;

    // A point, or a part's where: its ref and shift, as written, each in a box that takes what the config can
    // (a name, a list of names, an expression like "1ky + funnelLip"); Enter or leaving the box writes it
    const typed = (id: string, shown: string, title: string, onSet: (value: string) => void, list?: string) => (
        <input className="anchor" value={drafts[id] ?? shown} title={title} list={list}
               onChange={e => setDrafts({...drafts, [id]: e.target.value})}
               onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
               onBlur={() => {
                   const value = drafts[id];
                   if (value === undefined) return;
                   setDrafts({...drafts, [id]: undefined});
                   if (value.trim() !== '' && value !== shown) onSet(value.trim());
               }}
               onClick={e => e.stopPropagation()}/>
    );
    // the ref as a menu of points when it names one (or [one]); anything else (several, an expression) is typed
    const refControl = (id: string, shown: string, onSet: (value: string) => void) => {
        const listed = /^\[\s*([^,\]]+?)\s*\]$/.exec(shown);
        const one = (listed ? listed[1] : shown).trim();
        if (typing[id] || !pointNames.includes(one)) return <>
            {typed(id, shown, 'ref: the point it is from, typed: a key, or [a, b] for their middle', onSet, 'outline-panel-points')}
        </>;
        return (
            <select className="anchor" value={one} title="ref: the point it is from" onClick={e => e.stopPropagation()}
                    onChange={e => {
                        if (e.target.value === TYPE_IT) return setTyping({...typing, [id]: true});
                        onSet(listed ? `[${e.target.value}]` : e.target.value);
                    }}>
                {pointNames.map(name => <option key={name} value={name}>{name}</option>)}
                <option value={TYPE_IT}>type it…</option>
            </select>
        );
    };
    // A point, or a part's where: its ref and shift x and y, labelled, each set as written
    const anchorBoxes = (path: (string | number)[], id: string) => {
        const ref = findLineValue(text, path, 'ref');
        const shift = findShift(text, path);
        if (typeof ref === 'string' || typeof shift === 'string') return null;
        const [x, y] = shift.raw;
        const setShift = (index: 0 | 1, value: string) => {
            const base = flush(latest.current);
            const now = findShift(base, path);
            if (typeof now === 'string') return;
            const next: [string, string] = [now.raw[0] ?? '0', now.raw[1] ?? '0'];
            next[index] = value;
            commitText(applyEdits(base, now.edits(next[0], next[1])));
        };
        const setRef = (value: string) => {
            const base = flush(latest.current);
            const site = findLineValue(base, path, 'ref');
            if (typeof site !== 'string') commitText(applyEdits(base, [{site, value}]));
        };
        return <>
            <span className="label ref-label">ref</span>
            <span className="ref">{refControl(`${id}.ref`, ref.raw ?? '', setRef)}</span>
            <span className="label x-label">x</span>
            <span className="x">{typed(`${id}.x`, x ?? '0', 'shift x, from that point: mm, a unit like 1kx, or an expression', v => setShift(0, v))}</span>
            <span className="label y-label">y</span>
            <span className="y">{typed(`${id}.y`, y ?? '0', 'shift y, from that point', v => setShift(1, v))}</span>
        </>;
    };

    // a polygon's points: one more after the last (beside it), or one less (it keeps 3)
    const pointsPath = (key: string | number) => ['outlines', outline, key, 'points'];
    const addPoint = (key: string | number, points: unknown[]) => {
        const base = flush(latest.current);
        const last = findShift(base, [...pointsPath(key), points.length - 1]);
        const ref = findLineValue(base, [...pointsPath(key), points.length - 1], 'ref');
        if (typeof last === 'string' || typeof ref === 'string') return;
        const x = last.raw[0] ?? '0';
        const moved = isPlainNumber(x) ? String(Number(x) + 5) : `${x} + 5`;
        try {
            commitText(insertPolygonPoint(base, pointsPath(key), points.length, {ref: ref.raw ?? '', shift: [moved, last.raw[1] ?? '0']}));
        } catch (e: unknown) {
            window.alert(`Can't add a point: ${e instanceof Error ? e.message : String(e)}`);
        }
    };
    const removePoint = (key: string | number, index: number) => {
        try {
            commitText(removePolygonPoint(flush(latest.current), pointsPath(key), index));
        } catch (e: unknown) {
            window.alert(`Can't delete that point: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    // a number with a slider; expressions ("studSize") are typed in the box and leave the slider alone
    const numberField = (label: string, id: string, raw: string | undefined, max: number, min: number, disabled: string | undefined,
                         toText: (value: string) => string, site: EditSite | string, key: string | number, attr: PartAttr) => {
        const shown = drafts[id] ?? raw ?? '';
        const value = shown === '' ? 0 : isPlainNumber(shown) ? Number(shown) : NaN;
        const commitTyped = () => {
            const typed = drafts[id]?.trim();
            if (typed === undefined || typed === (raw ?? '') || typed === '') return;
            write(key, attr, site, toText(typed));
        };
        return (
            <>
                <Field label={label} unit="mm">
                    <input value={shown} placeholder="0" disabled={!!disabled} title={disabled}
                           onChange={e => setDrafts({...drafts, [id]: e.target.value})}
                           onKeyDown={e => e.key === 'Enter' && commitTyped()} onBlur={commitTyped}/>
                </Field>
                <input type="range" min={min} max={max} step={0.1} value={Number.isNaN(value) ? 0 : value}
                       disabled={!!disabled || Number.isNaN(value)}
                       title={Number.isNaN(value) ? `"${shown}" is an expression: change it in the box` : undefined}
                       onChange={e => {
                           setDrafts({...drafts, [id]: e.target.value});
                           // nothing to write while it stays at the default
                           if (raw !== undefined || Number(e.target.value) !== 0) write(key, attr, site, toText(e.target.value), 250);
                       }}/>
            </>
        );
    };

    return (
        <Card onPointerDown={e => e.stopPropagation()}>
            <CardHead title={outline} subtitle={template ? `filled in from ${template}` : `${parts.length} part${parts.length === 1 ? '' : 's'}, drag its points on the board`}
                      folded={folded} onFold={onFold}
/>
            {deleting && <ConfirmDelete kind="outline" name={outline} onDone={deleted => { setDeleting(false); if (deleted) onDeleted(outline); }}/>}
            {!folded && <div className="body">
                <datalist id="outline-panel-points">{pointNames.map(name => <option key={name} value={name}/>)}</datalist>
                {template && (
                    <Template>
                        <div>Filled in from the template <button className="link" title={`Edit ${template}`} onClick={() => onPick?.(template)}>{template}</button>:
                            its parts are edited there, its values here.</div>
                        {typeof argSites === 'string' ? <Tip>Can't edit its $args: {argSites}</Tip> : argSites.map((site, i) => (
                            <Field key={i} label={params[i] ?? `$args[${i}]`}>
                                {typed(`$args.${i}`, site.raw ?? '', `the value of ${params[i] ?? `parameter ${i}`}: a word or an expression`,
                                    value => {
                                        const base = flush(latest.current);
                                        const now = findListValues(base, ['outlines', outline, '$args']);
                                        if (typeof now !== 'string' && now[i]) commitText(applyEdits(base, [{site: now[i], value}]));
                                    })}
                            </Field>
                        ))}
                    </Template>
                )}
                {!template && params.length > 0 && (
                    <Template>
                        <div>A template, of {params.join(', ')}: ergogen makes it only as the outlines that fill it in
                            {users.length ? <>: {users.map((u, i) => <span key={u}>{i ? ', ' : ''}<button className="link" title={`Edit ${u}`} onClick={() => onPick?.(u)}>{u}</button></span>)}</> : ' (none yet)'}.
                        </div>
                    </Template>
                )}
                {parts.map((part, index) => {
                    const id = String(part.key);
                    const {name, operation, expand, joints, fillet} = part.sites;
                    const made = unquote(rawOf(name));
                    const expandRaw = rawOf(expand);
                    const shorthand = expandRaw ? /^(.*?)\s*([)>\]])$/.exec(expandRaw.trim()) : null;
                    const suffix = shorthand?.[2];
                    const jointsRaw = rawOf(joints);
                    const joint = suffix ? JOINTS[JOINT_SUFFIXES.indexOf(suffix)]
                        : jointsRaw === undefined ? 'round' : JOINTS[Number(jointsRaw)] ?? jointsRaw;
                    const field = (attr: PartAttr) => `${id}.${attr}`;
                    const raw = Array.isArray(written) ? written[part.key as number] : written[part.key];
                    // a short polygon's points are listed from the start
                    const open = opened[id] ?? (Array.isArray(raw?.points) && raw.points.length <= 6);
                    // each listed point's boxes, or null for one written otherwise (a name, a list)
                    const boxed = open && Array.isArray(raw?.points) ? raw.points.map((point: unknown, i: number) =>
                        point && typeof point === 'object' && !Array.isArray(point)
                            ? anchorBoxes(['outlines', outline, part.key, 'points', i], `${id}.points.${i}`) : null) : [];
                    return (
                        <div key={id} onMouseEnter={() => onLight?.(`${outline}.${part.key}`)} onMouseLeave={() => onLight?.(null)}>
                            <PartHead first={index === 0}>
                                <span title={`${outline}.${part.key}`}>{typeof part.key === 'number' ? `#${part.key}` : part.key} {part.what}
                                    <small> {describe(raw)}</small></span>
                            </PartHead>
                            {raw && typeof raw === 'object' && (
                                <Contents>
                                    {Object.entries(raw).filter(([key]) => !SHOWN.has(key) && !(key === 'name' && part.what === 'outline')).map(([key, value]) => {
                                        const boxes = key === 'where' && value && typeof value === 'object' && !Array.isArray(value)
                                            && anchorBoxes(['outlines', outline, part.key, 'where'], `${id}.where`);
                                        return boxes
                                            ? <div key={key} className="anchors"><b>{key}</b>{boxes}</div>
                                            : <div key={key}><b>{key}</b><span title={oneLine(value)}>{oneLine(value)}</span></div>;
                                    })}
                                    {Array.isArray(raw.points) && <>
                                        <button className="toggle" title={open ? 'Hide its points' : 'List its points, as the config writes them'}
                                                onClick={() => setOpened({...opened, [id]: !open})}>
                                            {open ? '▾' : '▸'} {raw.points.length} points
                                        </button>
                                        {open && (
                                            <ol>
                                                {raw.points.map((point: unknown, i: number) => {
                                                    const label = `${outline}.${part.key}.points[${i}]`;
                                                    return (
                                                        <li key={i} className={[boxed[i] ? 'anchors' : '', label === chosenPoint ? 'chosen' : ''].join(' ').trim() || undefined}
                                                            title={`${label}: click to pick it on the board`}
                                                            onMouseEnter={() => onLight?.(label)} onMouseLeave={() => onLight?.(`${outline}.${part.key}`)}
                                                            onClick={() => onChoosePoint?.(label)}>
                                                            <b>{i}</b>
                                                            {boxed[i] || <span>{oneLine(point)}</span>}
                                                            <button className="remove" title={raw.points.length > 3 ? `Delete point ${i}` : 'A polygon needs at least 3 points'}
                                                                    disabled={raw.points.length <= 3}
                                                                    onClick={e => { e.stopPropagation(); removePoint(part.key, i); }}>×</button>
                                                        </li>
                                                    );
                                                })}
                                            </ol>
                                        )}
                                        {open && <Actions>
                                            <Button $variant="go" title="One more point, after the last (5 mm to its right): set it here or drag it on the board"
                                                    onClick={() => addPoint(part.key, raw.points)}>+ Point</Button>
                                        </Actions>}
                                    </>}
                                </Contents>
                            )}
                            {part.what === 'outline' && (
                                <Field label="Outline">
                                    <select value={made} disabled={!!reason(name)} title={reason(name) ?? 'the outline this part is made of'}
                                            onChange={e => write(part.key, 'name', name, e.target.value)}>
                                        {!others.includes(made) && <option value={made}>{made || 'none'}</option>}
                                        {others.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </Field>
                            )}
                            <Field label="Operation">
                                <select value={rawOf(operation) ?? 'add'} disabled={!!reason(operation)} title={reason(operation)}
                                        onChange={e => write(part.key, 'operation', operation, e.target.value)}>
                                    {OPERATIONS.map(op => <option key={op} value={op}>{op}</option>)}
                                </select>
                            </Field>
                            {numberField('Expand', field('expand'), shorthand ? shorthand[1] : expandRaw, 10, -10, reason(expand),
                                value => `${value}${suffix ?? ''}`, expand, part.key, 'expand')}
                            <Field label="Joints">
                                <select value={joint} disabled={!!reason(suffix ? expand : joints)}
                                        onChange={e => suffix && shorthand
                                            ? write(part.key, 'expand', expand, `${shorthand[1]}${JOINT_SUFFIXES[JOINTS.indexOf(e.target.value)]}`)
                                            : write(part.key, 'joints', joints, e.target.value)}>
                                    {JOINTS.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                            </Field>
                            {numberField('Fillet', field('fillet'), rawOf(fillet), 10, 0, reason(fillet), value => value, fillet, part.key, 'fillet')}
                            <Actions>
                                {Array.isArray(written) && <>
                                    <Button disabled={index === 0} title="Move it up: before the part above" onClick={() => movePart(index, -1)}>↑</Button>
                                    <Button disabled={index === parts.length - 1} title="Move it down: after the part below" onClick={() => movePart(index, 1)}>↓</Button>
                                </>}
                                <Gap/>
                                <Button $variant="danger" title="Delete this part" onClick={() => removePart(part.key, part.what)}>Delete</Button>
                            </Actions>
                        </div>
                    );
                })}
                {!template && (
                    <Actions>
                        <Button $variant="go" title="A triangle at the end, round the first part's key: move its points, add more" onClick={() => addPart('polygon')}>+ Polygon</Button>
                        <Button $variant="go" title="A 10 mm square at the end, on the first part's key" onClick={() => addPart('rectangle')}>+ Rectangle</Button>
                        <Button $variant="go" title="A 5 mm circle at the end, on the first part's key" onClick={() => addPart('circle')}>+ Circle</Button>
                        <AddMenu label="+ Outline" title="Another outline as a part, at the end" options={others} onPick={name => addPart('outline', name)}/>
                    </Actions>
                )}
                {parts.length > 0 && <Tip>Expand and fillet apply to the outline up to and including their part.</Tip>}
                <Actions>
                    {dxf && <Button as="a" title={`Download ${outline}.dxf`} download={`${outline}.dxf`}
                                    href={URL.createObjectURL(new Blob([dxf], {type: 'application/dxf'}))}>DXF</Button>}
                    <Gap/>
                    <Button $variant="danger" title={`Delete outline ${outline}`} onClick={() => setDeleting(true)}>Delete</Button>
                </Actions>
            </div>}
        </Card>
    );
};

export default OutlinePanel;
