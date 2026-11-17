import {useEffect, useMemo, useState} from "react";
import styled from "styled-components";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {EditSite, appendListItem, applyEdits, deleteListItem, findItemSites, moveListItem} from "../utils/layoutEdit";

// The parts of one case (cases.<name>) in the 3D board view's panel: what each is made from, how it joins the
// parts before it, how thick it is; in order, from the first. A part is moved up or down, deleted or added, and
// pointing at one shows its shape in the view. A case mirrored from another (mirror: from:) is made of that case's
// parts, so those are the ones edited.

// a part as ergogen made it (cases.js): its shape is what it extruded, null when it matched nothing
export type MadePart = {
    part: string, what: string, name: string, operation: string, extrude: number | null,
    shift: number[], rotate: number[], matched: number, outline: any,
};

const ATTRS = ['name', 'operation', 'extrude', 'expand', 'layers', 'asym'] as const;
type Attr = typeof ATTRS[number];

const OPERATIONS = ['add', 'subtract', 'intersect'];
const ASYMS = ['both', 'source', 'clone'];

const List = styled.div`
  margin: 0.2rem 0 0.4rem 1.2rem;
  padding-left: 0.5rem;
  border-left: 2px solid #555555;

  .part {
    padding: 0.25rem 0.3rem;
    border-radius: 0.2rem;
  }

  .part.lit {
    background: rgba(255, 255, 255, 0.08);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .head .what {
    color: #aaaaaa;
    min-width: 3.2rem;
  }

  .head select, .head input {
    flex-grow: 1;
    min-width: 0;
  }

  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.5rem;
    margin-top: 0.2rem;
    color: #aaaaaa;
  }

  .fields span {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  input, select {
    padding: 0 0.2rem;
    border: 1px solid #666666;
    border-radius: 0.2rem;
    background: #2b2b2b;
    color: #ffffff;
    font: inherit;
  }

  input.short {
    width: 3rem;
  }

  input.layers {
    width: 6.5rem;
  }

  button {
    padding: 0 0.35rem;
    border: none;
    border-radius: 0.2rem;
    background: #595959;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    color: #888888;
    cursor: default;
  }

  button.remove:hover {
    background: #a33a3a;
  }

  .add {
    display: flex;
    gap: 0.3rem;
    margin-top: 0.3rem;
  }

  .note {
    color: #999999;
  }

  .warn {
    color: #ff8a80;
  }
`;

type Props = {
    // the case shown, e.g. left_top
    caseName: string,
    // its parts as ergogen made them, for what they matched and their shapes
    made: MadePart[],
    // the part pointed at or picked, by its index in the case's parts ("3"), to show in the view
    lit: string | null,
    onLight: (part: string | null) => void,
};

const CaseParts = ({caseName, made, lit, onLight}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const text = configContext?.configInput ?? '';
    const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
    useEffect(() => setDrafts({}), [text]);
    const [note, setNote] = useState<string | null>(null);

    const config = useMemo(() => {
        try {
            return yaml.load(text) as any;
        } catch (e: unknown) {
            return null;
        }
    }, [text]);
    // a mirrored case is made of the case it mirrors
    const source: string = config?.cases?.[caseName]?.mirror?.from ?? caseName;
    const path = ['cases', source];
    const parts = useMemo(() => findItemSites(text, path, [...ATTRS]), [text, source]); // eslint-disable-line react-hooks/exhaustive-deps
    const outlines = Object.keys(config?.outlines ?? {});

    if (!configContext) return null;
    if (typeof parts === 'string') return <List><span className="note">{parts}</span></List>;

    const write = (next: string, message: string) => {
        configContext.setConfigInput(next);
        setNote(`${message}; the case is being made again`);
    };
    const fail = (what: string, err: unknown) => setNote(`Can't ${what}: ${err instanceof Error ? err.message : String(err)}`);

    const set = (index: number, attr: Attr, value: string) => {
        const site = parts[index].sites[attr];
        if (typeof site === 'string') return fail(`change ${attr}`, site);
        if (value === (site.raw ?? '')) return;
        write(applyEdits(text, [{site, value}]), `#${index} ${attr}: ${value}`);
    };
    const rawOf = (site: EditSite | string) => typeof site === 'string' ? undefined : site.raw;
    // a text box written on Enter or when left
    const box = (index: number, attr: Attr, className: string, placeholder = '') => {
        const id = `${index}.${attr}`;
        const site = parts[index].sites[attr];
        const commit = () => {
            const typed = drafts[id];
            if (typed === undefined) return;
            setDrafts({...drafts, [id]: undefined});
            if (typed.trim() !== '') set(index, attr, typed.trim());
        };
        return (
            <input className={className} value={drafts[id] ?? rawOf(site) ?? ''} placeholder={placeholder}
                   disabled={typeof site === 'string'} title={typeof site === 'string' ? site : attr}
                   onChange={e => setDrafts({...drafts, [id]: e.target.value})}
                   onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') setDrafts({...drafts, [id]: undefined}); }}
                   onBlur={commit}/>
        );
    };

    const move = (index: number, delta: number) => {
        try {
            write(moveListItem(text, path, index, delta), `#${index} moved ${delta < 0 ? 'up' : 'down'}`);
            onLight(null);
        } catch (err: unknown) {
            fail('move it', err);
        }
    };
    const remove = (index: number) => {
        if (!window.confirm(`Delete part #${index} of ${source}?`)) return;
        try {
            write(deleteListItem(text, path, index), `#${index} deleted`);
            onLight(null);
        } catch (err: unknown) {
            fail('delete it', err);
        }
    };
    // a new part at the end, as thick as the case's first
    const add = (what: 'outline' | 'pcb') => {
        const thick = made.find(m => m.extrude !== null)?.extrude ?? 3;
        const name = what === 'outline' ? outlines[0] ?? 'board' : '/footprints.keys/';
        try {
            write(appendListItem(text, path, [`what: ${what}`, `name: ${name}`, `extrude: ${thick}`, 'operation: subtract']),
                `a ${what} part added at the end`);
        } catch (err: unknown) {
            fail('add a part', err);
        }
    };

    return (
        <List onMouseLeave={() => onLight(null)}>
            {source !== caseName && <div className="note">{`${caseName} is ${source} mirrored: these are ${source}'s parts`}</div>}
            {parts.map((part, index) => {
                const key = String(part.key);
                const result = made.find(m => m.part === key);
                const site = (attr: Attr) => part.sites[attr];
                return (
                    <div key={key} className={`part${lit === key ? ' lit' : ''}`} onMouseEnter={() => onLight(key)}>
                        <div className="head">
                            <span className="what">#{index} {part.what}</span>
                            {part.what === 'outline' && typeof site('name') !== 'string' && outlines.includes(rawOf(site('name')) ?? '')
                                ? <select value={rawOf(site('name'))} onChange={e => set(index, 'name', e.target.value)} title="the outline it is made from">
                                    {outlines.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                : box(index, 'name', '', part.what === 'pcb' ? '/footprints.keys/' : '')}
                            <button disabled={index === 0} title="Move it up" onClick={() => move(index, -1)}>↑</button>
                            <button disabled={index === parts.length - 1} title="Move it down" onClick={() => move(index, 1)}>↓</button>
                            <button className="remove" title="Delete this part" onClick={() => remove(index)}>×</button>
                        </div>
                        <div className="fields">
                            <span>
                                <select value={rawOf(site('operation')) ?? 'add'} disabled={typeof site('operation') === 'string'}
                                        onChange={e => set(index, 'operation', e.target.value)} title="how it joins the parts before it">
                                    {OPERATIONS.map(op => <option key={op} value={op}>{op}</option>)}
                                </select>
                            </span>
                            {part.what !== 'case' && <span>thick {box(index, 'extrude', 'short', '1')}</span>}
                            {part.what !== 'case' && <span>expand {box(index, 'expand', 'short', '0')}</span>}
                            {part.what === 'pcb' && <span>layers {box(index, 'layers', 'layers', '[F.CrtYd]')}</span>}
                            <span>
                                <select value={rawOf(site('asym')) ?? 'both'} disabled={typeof site('asym') === 'string'}
                                        onChange={e => set(index, 'asym', e.target.value)} title="which halves it is on: both, the source one, or the mirrored one">
                                    {ASYMS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </span>
                            {result
                                ? <span className={result.matched ? '' : 'warn'}>{result.matched ? `${result.matched} matched` : 'matches nothing'}</span>
                                : <span className="note">not on this half</span>}
                        </div>
                    </div>
                );
            })}
            <div className="add">
                <button onClick={() => add('outline')} title="A part made from an outline, at the end">+ outline</button>
                <button onClick={() => add('pcb')} title="A part made from footprints' shapes, at the end">+ footprints</button>
            </div>
            {note && <div className="note">{note}</div>}
        </List>
    );
};

export default CaseParts;
