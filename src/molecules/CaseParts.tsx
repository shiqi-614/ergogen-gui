import {useEffect, useMemo, useState} from "react";
import styled from "styled-components";
import {Actions, AddMenu, Button, CardHead, CardShell, Field, Gap, Status, Tip, colors} from "../ui";
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

const ATTRS = ['name', 'operation', 'extrude', 'expand', 'shift', 'rotate', 'layers', 'side', 'cut', 'asym'] as const;
type Attr = typeof ATTRS[number];

const OPERATIONS = ['add', 'subtract', 'intersect'];
const ASYMS = ['both', 'source', 'clone'];
const SIDES = ['front', 'back', 'both'];
const CUTS = ['box', 'outline'];
const SIGN: Record<string, string> = {add: '+', subtract: '−', intersect: '∩'};
// the colours the view draws a part's shape in
export const OPERATION_COLOURS: Record<string, number> = {add: 0x4dabf7, subtract: 0xff4d4d, intersect: 0xffd43b};
const css = (colour: number) => `#${colour.toString(16).padStart(6, '0')}`;

// at the case preview's top left, under its file name
const Card = styled(CardShell)`
  top: 2.6rem;
  left: 0.5rem;
  width: min(21rem, calc(100% - 1rem));

  /* a part on one line: what it does, what it is made of, how thick, how much it matched */
  .line {
    display: grid;
    grid-template-columns: 1.1rem 1fr auto auto;
    align-items: center;
    gap: 0.4rem;
    margin: 0 -0.3rem;
    padding: 0.15rem 0.3rem;
    border-radius: 0.2rem;
    cursor: pointer;
  }

  .line:hover, .line.lit {
    background: rgba(255, 159, 28, 0.12);
  }

  .line.open {
    background: rgba(255, 159, 28, 0.2);
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
    color: ${colors.muted};
  }

  .count.none {
    color: ${colors.dangerInk};
  }

  .settings {
    margin: 0.35rem 0 0.6rem;
    padding: 0.5rem 0.55rem 0.1rem;
    border-radius: 0.25rem;
    background: rgba(0, 0, 0, 0.2);
  }
`;

type Props = {
    // the case shown, e.g. left_top
    caseName: string,
    // its parts as ergogen made them, for what they matched and their shapes; none while the case is not made
    made?: MadePart[],
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
    // the cases a part can be made of: those before this one (ergogen makes the cases in order), but its own
    const earlier = (() => {
        const names = Object.keys(config?.cases ?? {});
        return names.slice(0, Math.max(0, names.indexOf(source))).filter(name => name !== source);
    })();

    if (!configContext) return null;
    // a case written in a way the panel can't edit: why
    if (typeof parts === 'string') return <Card><CardHead title={caseName} folded={folded} onFold={setFolded} foldAt="left"/>{!folded && <div className="body"><Tip>{parts}</Tip></div>}</Card>;

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
    // a new part at the end, as thick as the case's first, opened to be set; a case part is that case as it is
    const add = (what: 'outline' | 'pcb' | 'case', caseOf?: string) => {
        const thick = made?.find(m => m.extrude !== null)?.extrude ?? 3;
        const name = what === 'outline' ? outlines[0] ?? 'board' : what === 'pcb' ? '/footprints.keys/' : caseOf;
        const lines = what === 'case' ? [`what: case`, `name: ${name}`, 'operation: add']
            : [`what: ${what}`, `name: ${name}`, `extrude: ${thick}`, 'operation: subtract'];
        try {
            write(appendListItem(text, path, lines),
                `a ${what} part added at the end`);
            setOpen(String(parts.length));
        } catch (err: unknown) {
            fail('add a part', err);
        }
    };

    return (
        <Card onMouseLeave={() => setHover(null)}>
            <CardHead title={`${caseName}: ${parts.length} part${parts.length === 1 ? '' : 's'}, in order`} folded={folded} onFold={setFolded} foldAt="left"
                      subtitle={source !== caseName ? `${caseName} is ${source} mirrored: these are ${source}'s parts` : undefined}/>
            {!folded && <div className="body">
                {parts.map((part, index) => {
                    const key = String(part.key);
                    const result = made?.find(m => m.part === key);
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
                                    {result ? (result.matched ? `×${result.matched}` : 'none') : made ? 'off' : ''}
                                </span>
                            </div>
                            {isOpen && (
                                <div className="settings">
                                    <Field label={part.what === 'outline' ? 'Outline' : part.what === 'pcb' ? 'Footprints' : 'Case'}>
                                        {part.what === 'outline' && outlines.includes(name)
                                            ? select(index, 'name', outlines, name, 'the outline it is made from')
                                            : box(index, 'name', '', part.what === 'pcb' ? '/footprints.keys/' : '')}
                                    </Field>
                                    <Field label="Operation">{select(index, 'operation', OPERATIONS, 'add', 'how it joins the parts before it')}</Field>
                                    {part.what !== 'case' && <Field label="Thick" unit="mm">{box(index, 'extrude', '', '1')}</Field>}
                                    {part.what !== 'case' && <Field label="Expand" unit="mm">{box(index, 'expand', '', '0')}</Field>}
                                    <Field label="Shift" unit="mm">{box(index, 'shift', '', '[0, 0, 0]')}</Field>
                                    <Field label="Rotate" unit="°">{box(index, 'rotate', '', '[0, 0, 0]')}</Field>
                                    {source !== caseName && <Tip>On {caseName} it shifts the other way in x, and turns the other way about y and z.</Tip>}
                                    {part.what === 'pcb' && <Field label="Layers">{box(index, 'layers', '', '[F.CrtYd]')}</Field>}
                                    {part.what === 'pcb' && <Field label="Side">{select(index, 'side', SIDES, 'front', "the footprints it cuts: on the board's front, its back (a bottom plate's holes), or both")}</Field>}
                                    {part.what === 'pcb' && <Field label="Cut">{select(index, 'cut', CUTS, 'box', 'what each footprint cuts: the box round what it draws on the layers, or the closed shapes it draws there')}</Field>}
                                    <Field label="Halves">{select(index, 'asym', ASYMS, 'both', 'which halves it is on: both, the source one, or the mirrored one')}</Field>
                                    {made && !result && <Tip>Not on this half (its asym leaves it off).</Tip>}
                                    <Actions>
                                        <Button disabled={index === 0} title="Move it up" onClick={() => move(index, -1)}>↑</Button>
                                        <Button disabled={index === parts.length - 1} title="Move it down" onClick={() => move(index, 1)}>↓</Button>
                                        <Gap/>
                                        <Button $variant="danger" title="Delete this part" onClick={() => remove(index)}>Delete</Button>
                                    </Actions>
                                </div>
                            )}
                        </div>
                    );
                })}
                <Actions>
                    <Button $variant="go" onClick={() => add('outline')} title="A part made from an outline, at the end">+ Outline</Button>
                    <Button $variant="go" onClick={() => add('pcb')} title="A part made from footprints' shapes, at the end">+ Footprints</Button>
                    <AddMenu label="+ Case" title="A part that is another case as it is, at the end (only a case before this one)"
                             options={earlier} onPick={name => add('case', name)}/>
                </Actions>
                {note && <Status>{note}</Status>}
            </div>}
        </Card>
    );
};

export default CaseParts;
