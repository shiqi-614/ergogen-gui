import {useEffect, useMemo, useRef, useState} from "react";
import styled from "styled-components";
import {Button, CardHead, CardShell, Field, Tip, colors} from "../../ui";
import {
    EditSite, PartAttr, applyEdits, deleteOutline, deleteOutlinePart, findPartSites, isPlainNumber, outlineReferences,
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
};

// The settings of each part of an outline: how it joins the parts before it, and the expand and
// fillet ergogen applies to everything up to and including it
// at the layout editor's top right
const Card = styled(CardShell)`
  top: 0.75rem;
  right: 0.75rem;
  width: 16rem;
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
`;

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
            <CardHead title={outline} subtitle={`${parts.length} part${parts.length === 1 ? '' : 's'}, drag its points on the board`}
                      folded={folded} onFold={onFold}/>
            {!folded && <div className="body">
                {parts.map((part, index) => {
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
                        <div key={id}>
                            <PartHead first={index === 0}>
                                <span>{typeof part.key === 'number' ? `#${part.key}` : part.key} {part.what}</span>
                                <Button $variant="ghost" title="Delete this part" onClick={() => removePart(part.key, part.what)}>×</Button>
                            </PartHead>
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
                        </div>
                    );
                })}
                <Tip>Expand and fillet apply to the outline up to and including their part.</Tip>
            </div>}
        </Card>
    );
};

export default OutlinePanel;
