import {useEffect, useMemo, useRef, useState} from "react";
import {
    EditSite, PartAttr, applyEdits, deleteOutline, deleteOutlinePart, findPartSites, isPlainNumber, outlineReferences,
} from "../../utils/layoutEdit";
import {Panel} from "./styles";

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
};

// The settings of each part of an outline: how it joins the parts before it, and the expand and
// fillet ergogen applies to everything up to and including it
const OutlinePanel = ({outline, text, onCommit, onDeleted, folded, onFold}: OutlinePanelProps) => {
    const parts = useMemo(() => findPartSites(text, outline), [text, outline]);
    const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
    useEffect(() => setDrafts({}), [text, outline]);
    // A slider writes once it rests, so a drag is one edit (and one undo), not dozens. Every write
    // goes onto the newest text, the waiting slider value first, so neither undoes the other.
    const latest = useRef(text);
    useEffect(() => { latest.current = text; }, [text]);
    const timer = useRef<number>();
    const pending = useRef<{ key: string | number, attr: PartAttr, value: string } | null>(null);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    if (typeof parts === 'string') return <Panel><h4>{outline}</h4><span className="note">{parts}</span></Panel>;

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

    // a number with a slider; expressions ("studSize") are typed in the box and leave the slider alone
    const numberField = (id: string, raw: string | undefined, max: number, min: number, disabled: string | undefined,
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
                <input value={shown} placeholder="0" disabled={!!disabled} title={disabled}
                       onChange={e => setDrafts({...drafts, [id]: e.target.value})}
                       onKeyDown={e => e.key === 'Enter' && commitTyped()} onBlur={commitTyped}/>
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
        <Panel onPointerDown={e => e.stopPropagation()}>
            <div className="title">
                <div className="name">
                    <button className="fold" title={folded ? 'Show the panel' : 'Fold the panel away'} onClick={() => onFold(!folded)}>{folded ? '▸' : '▾'}</button>
                    <h4>{outline}</h4>
                </div>
            </div>
            {!folded && parts.map(part => {
                const id = String(part.key);
                const {operation, expand, joints, fillet} = part.sites;
                const expandRaw = rawOf(expand);
                const shorthand = expandRaw ? /^(.*?)\s*([)>\]])$/.exec(expandRaw.trim()) : null;
                const suffix = shorthand?.[2];
                const jointsRaw = rawOf(joints);
                const joint = suffix ? JOINTS[JOINT_SUFFIXES.indexOf(suffix)]
                    : jointsRaw === undefined ? 'round' : JOINTS[Number(jointsRaw)] ?? jointsRaw;
                const field = (attr: PartAttr) => `${id}.${attr}`;
                return (
                    <div className="part" key={id}>
                        <div className="title">
                            <h4>{typeof part.key === 'number' ? `#${part.key}` : part.key} {part.what}</h4>
                            <button className="remove" title="Delete this part" onClick={() => removePart(part.key, part.what)}>×</button>
                        </div>
                        <label>
                            <span>operation</span>
                            <select value={rawOf(operation) ?? 'add'} disabled={!!reason(operation)} title={reason(operation)}
                                    onChange={e => write(part.key, 'operation', operation, e.target.value)}>
                                {OPERATIONS.map(op => <option key={op} value={op}>{op}</option>)}
                            </select>
                        </label>
                        <label><span>expand (mm)</span></label>
                        {numberField(field('expand'), shorthand ? shorthand[1] : expandRaw, 10, -10, reason(expand),
                            value => `${value}${suffix ?? ''}`, expand, part.key, 'expand')}
                        <label>
                            <span>joints</span>
                            <select value={joint} disabled={!!reason(suffix ? expand : joints)}
                                    onChange={e => suffix && shorthand
                                        ? write(part.key, 'expand', expand, `${shorthand[1]}${JOINT_SUFFIXES[JOINTS.indexOf(e.target.value)]}`)
                                        : write(part.key, 'joints', joints, e.target.value)}>
                                {JOINTS.map(j => <option key={j} value={j}>{j}</option>)}
                            </select>
                        </label>
                        <label><span>fillet (mm)</span></label>
                        {numberField(field('fillet'), rawOf(fillet), 10, 0, reason(fillet), value => value, fillet, part.key, 'fillet')}
                    </div>
                );
            })}
            {!folded && <span className="note">expand and fillet apply to the outline up to and including their part</span>}
        </Panel>
    );
};

export default OutlinePanel;
