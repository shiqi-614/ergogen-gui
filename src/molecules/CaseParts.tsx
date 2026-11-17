import {useEffect, useMemo, useState} from "react";
import styled from "styled-components";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {EditSite, appendListItem, applyEdits, deleteListItem, findItemSites, moveListItem} from "../utils/layoutEdit";

// The parts of one case (cases.<name>), in its preview: a line each, in order, saying what it does (+ add,
// − subtract, ∩ intersect), what it is made from, how thick it is and how many outlines or footprints it matched.
// Clicking a line opens the part's settings; pointing at one (or the open one) shows its shape in the view. A
// case mirrored from another (mirror: from:) is made of that case's parts, so those are the ones edited.

// a part as ergogen made it (cases.js): its outline is the 2D shape it extruded, null when it matched nothing
export type MadePart = {
    part: string, what: string, name: string, operation: string, extrude: number | null,
    shift: number[], rotate: number[], matched: number, outline: any,
};

const ATTRS = ['name', 'operation', 'extrude', 'expand', 'layers', 'asym'] as const;
type Attr = typeof ATTRS[number];

const OPERATIONS = ['add', 'subtract', 'intersect'];
const ASYMS = ['both', 'source', 'clone'];
const SIGN: Record<string, string> = {add: '+', subtract: '−', intersect: '∩'};
// the colours the view draws a part's shape in
export const OPERATION_COLOURS: Record<string, number> = {add: 0x4dabf7, subtract: 0xff4d4d, intersect: 0xffd43b};
const css = (colour: number) => `#${colour.toString(16).padStart(6, '0')}`;

const Panel = styled.div`
  position: absolute;
  top: 2.6rem;
  left: 0.5rem;
  width: min(21rem, calc(100% - 1rem));
  max-height: calc(100% - 4rem);
  overflow: auto;
  padding: 0.4rem 0.5rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.65);
  color: #dddddd;
  font-size: 0.8rem;

  .title {
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
    color: #ffffff;
  }

  .title button {
    padding: 0;
    background: transparent;
    color: #bbbbbb;
  }

  .line {
    display: grid;
    grid-template-columns: 1.1rem 1fr auto auto;
    align-items: center;
    gap: 0.4rem;
    padding: 0.1rem 0.25rem;
    border-radius: 0.2rem;
    cursor: pointer;
  }

  .line:hover, .line.lit {
    background: rgba(255, 255, 255, 0.1);
  }

  .line.open {
    background: rgba(255, 255, 255, 0.16);
  }

  .sign {
    font-weight: bold;
    text-align: center;
  }

  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .thick, .count {
    color: #999999;
  }

  .count.none {
    color: #ff8a80;
  }

  .settings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin: 0.15rem 0 0.35rem 1.5rem;
    color: #aaaaaa;
  }

  .settings span {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }

  .settings .wide {
    flex-basis: 100%;
  }

  .settings .wide select, .settings .wide input {
    flex-grow: 1;
    min-width: 0;
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

  button {
    padding: 0 0.4rem;
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
    margin-top: 0.35rem;
  }

  .note {
    margin-top: 0.25rem;
    color: #999999;
  }
`;

type Props = {
    // the case shown, e.g. left_top
    caseName: string,
    // its parts as ergogen made them, for what they matched and their shapes
    made: MadePart[],
    // the part pointed at, or the open one, by its index in the case's parts ("3"), for the view to show
    onLight: (part: string | null) => void,
};

const CaseParts = ({caseName, made, onLight}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const text = configContext?.configInput ?? '';
    const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
    useEffect(() => setDrafts({}), [text]);
    const [note, setNote] = useState<string | null>(null);
    const [folded, setFolded] = useState(false);
    // the part whose settings are open, and the one pointed at
    const [open, setOpen] = useState<string | null>(null);
    const [hover, setHover] = useState<string | null>(null);
    const lit = hover ?? open;
    useEffect(() => onLight(folded ? null : lit), [lit, folded]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (typeof parts === 'string') return <Panel><span className="note">{parts}</span></Panel>;

    const write = (next: string, message: string) => {
        configContext.setConfigInput(next);
        setNote(`${message}; the case is being made again`);
    };
    const fail = (what: string, err: unknown) => setNote(`Can't ${what}: ${err instanceof Error ? err.message : String(err)}`);
    const rawOf = (site: EditSite | string) => typeof site === 'string' ? undefined : site.raw;

    const set = (index: number, attr: Attr, value: string) => {
        const site = parts[index].sites[attr];
        if (typeof site === 'string') return fail(`change ${attr}`, site);
        if (value === (site.raw ?? '')) return;
        write(applyEdits(text, [{site, value}]), `#${index} ${attr}: ${value}`);
    };
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
    const select = (index: number, attr: Attr, options: string[], fallback: string, title: string) => {
        const site = parts[index].sites[attr];
        return (
            <select value={rawOf(site) ?? fallback} disabled={typeof site === 'string'} title={title}
                    onChange={e => set(index, attr, e.target.value)}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        );
    };

    const move = (index: number, delta: number) => {
        try {
            write(moveListItem(text, path, index, delta), `#${index} moved ${delta < 0 ? 'up' : 'down'}`);
            setOpen(String(index + delta));
        } catch (err: unknown) {
            fail('move it', err);
        }
    };
    const remove = (index: number) => {
        if (!window.confirm(`Delete part #${index} of ${source}?`)) return;
        try {
            write(deleteListItem(text, path, index), `#${index} deleted`);
            setOpen(null);
        } catch (err: unknown) {
            fail('delete it', err);
        }
    };
    // a new part at the end, as thick as the case's first, opened to be set
    const add = (what: 'outline' | 'pcb') => {
        const thick = made.find(m => m.extrude !== null)?.extrude ?? 3;
        const name = what === 'outline' ? outlines[0] ?? 'board' : '/footprints.keys/';
        try {
            write(appendListItem(text, path, [`what: ${what}`, `name: ${name}`, `extrude: ${thick}`, 'operation: subtract']),
                `a ${what} part added at the end`);
            setOpen(String(parts.length));
        } catch (err: unknown) {
            fail('add a part', err);
        }
    };

    return (
        <Panel onMouseLeave={() => setHover(null)}>
            <div className="title">
                <button title={folded ? 'Show the parts' : 'Fold the parts away'} onClick={() => setFolded(!folded)}>{folded ? '▸' : '▾'}</button>
                <span>{caseName}: {parts.length} part{parts.length === 1 ? '' : 's'}, in order</span>
            </div>
            {!folded && source !== caseName && <div className="note">{`${caseName} is ${source} mirrored: these are ${source}'s parts`}</div>}
            {!folded && parts.map((part, index) => {
                const key = String(part.key);
                const result = made.find(m => m.part === key);
                const operation = rawOf(part.sites.operation) ?? 'add';
                const name = rawOf(part.sites.name) ?? '';
                const isOpen = open === key;
                return (
                    <div key={key}>
                        <div className={`line${lit === key ? ' lit' : ''}${isOpen ? ' open' : ''}`}
                             title={`#${index} ${part.what} ${name}: click for its settings`}
                             onMouseEnter={() => setHover(key)} onClick={() => setOpen(isOpen ? null : key)}>
                            <span className="sign" style={{color: css(OPERATION_COLOURS[operation] ?? 0xdddddd)}}>{SIGN[operation] ?? '?'}</span>
                            <span className="name">{name}</span>
                            <span className="thick">{rawOf(part.sites.extrude) ?? (part.what === 'case' ? '' : '1')}{part.what === 'case' ? '' : ' mm'}</span>
                            <span className={`count${result && !result.matched ? ' none' : ''}`}>
                                {result ? (result.matched ? `×${result.matched}` : 'none') : 'off'}
                            </span>
                        </div>
                        {isOpen && (
                            <div className="settings">
                                <span className="wide">
                                    {part.what}
                                    {part.what === 'outline' && outlines.includes(name)
                                        ? select(index, 'name', outlines, name, 'the outline it is made from')
                                        : box(index, 'name', '', part.what === 'pcb' ? '/footprints.keys/' : '')}
                                </span>
                                <span>{select(index, 'operation', OPERATIONS, 'add', 'how it joins the parts before it')}</span>
                                {part.what !== 'case' && <span>thick {box(index, 'extrude', 'short', '1')}</span>}
                                {part.what !== 'case' && <span>expand {box(index, 'expand', 'short', '0')}</span>}
                                {part.what === 'pcb' && <span>layers {box(index, 'layers', 'short', '[F.CrtYd]')}</span>}
                                <span>{select(index, 'asym', ASYMS, 'both', 'which halves it is on: both, the source one, or the mirrored one')}</span>
                                <span>
                                    <button disabled={index === 0} title="Move it up" onClick={() => move(index, -1)}>↑</button>
                                    <button disabled={index === parts.length - 1} title="Move it down" onClick={() => move(index, 1)}>↓</button>
                                    <button className="remove" title="Delete this part" onClick={() => remove(index)}>×</button>
                                </span>
                                {!result && <span className="note wide">not on this half (its asym leaves it off)</span>}
                            </div>
                        )}
                    </div>
                );
            })}
            {!folded && (
                <div className="add">
                    <button onClick={() => add('outline')} title="A part made from an outline, at the end">+ outline</button>
                    <button onClick={() => add('pcb')} title="A part made from footprints' shapes, at the end">+ footprints</button>
                </div>
            )}
            {!folded && note && <div className="note">{note}</div>}
        </Panel>
    );
};

export default CaseParts;
