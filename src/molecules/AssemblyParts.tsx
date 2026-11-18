import {useEffect, useMemo, useState} from "react";
import styled from "styled-components";
import {Actions, Button, CardHead, CardShell, Check, Field, Gap, Status, colors} from "../ui";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {EditSite, addAssemblyPart, applyEdits, deleteListItem, findItemSites} from "../utils/layoutEdit";

// The other 3D models of an assembly (assemblies.<name>.parts), in its 3D view: a line each, to set its name, the
// module of the pcb it sits at, its height and its model, to delete it, or to add one. The view draws them once
// ergogen has placed them.

const ATTRS = ['name', 'model', 'module', 'z'] as const;
type Attr = typeof ATTRS[number];

// at the 3D view's bottom right
const Card = styled(CardShell)`
  right: 0.5rem;
  bottom: 0.5rem;
  z-index: 1;
  width: min(20rem, calc(100% - 1rem));
  max-height: 45%;

  /* one part: a rule above all but the first */
  .part + .part {
    margin-top: 0.6rem;
    padding-top: 0.6rem;
    border-top: 1px solid ${colors.rule};
  }
`;

type Props = { assembly: string };

// what a model path shows as: without the quotes it may be written in
const unquote = (raw: string | undefined) => (raw ?? '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

const AssemblyParts = ({assembly}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const text = configContext?.configInput ?? '';
    const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
    useEffect(() => setDrafts({}), [text]);
    const [folded, setFolded] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const path = ['assemblies', assembly, 'parts'];
    const parts = useMemo(() => {
        const found = findItemSites(text, path, [...ATTRS]);
        return typeof found === 'string' ? [] : found;
    }, [text, assembly]); // eslint-disable-line react-hooks/exhaustive-deps
    // the modules of the assembly's board: a mirrored pcb has the ones of the pcb it mirrors
    const modules = useMemo(() => {
        try {
            const config = yaml.load(text) as any;
            const pcb = config?.assemblies?.[assembly]?.pcb;
            const board = typeof pcb === 'string' ? pcb : pcb?.name;
            const own = config?.pcbs?.[board]?.mirror?.from ?? board;
            return Object.keys(config?.pcbs?.[own]?.modules ?? {});
        } catch (e: unknown) {
            return [];
        }
    }, [text, assembly]);
    // The other half's assembly: the one whose board is this board's mirror (or the board it mirrors). Its parts
    // follow these when they are the same, name for name, so an edit lands on the same part there.
    const other = useMemo(() => {
        try {
            const config = yaml.load(text) as any;
            const boardOf = (a: any) => typeof a?.pcb === 'string' ? a.pcb : a?.pcb?.name;
            const board = boardOf(config?.assemblies?.[assembly]);
            const pcbs = config?.pcbs ?? {};
            const mirror = Object.keys(pcbs).find(p => p !== board && (pcbs[p]?.mirror?.from === board || pcbs[board]?.mirror?.from === p));
            const name = mirror && Object.keys(config?.assemblies ?? {}).find(a => a !== assembly && boardOf(config.assemblies[a]) === mirror);
            if (!name) return null;
            const names = (a: string) => JSON.stringify(((config.assemblies[a]?.parts ?? []) as any[]).map(p => p?.name ?? ''));
            return {name, same: names(name) === names(assembly)};
        } catch (e: unknown) {
            return null;
        }
    }, [text, assembly]);
    const [bothChoice, setBoth] = useState(true);
    const both = !!other?.same && bothChoice;
    const otherPath = other ? ['assemblies', other.name, 'parts'] : null;

    if (!configContext) return null;

    const write = (make: () => string, message: string) => {
        try {
            configContext.setConfigInput(make());
            setNote(`${message}; it is being placed again`);
        } catch (err: unknown) {
            setNote(`Can't do that: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    const rawOf = (site: EditSite | string) => typeof site === 'string' ? undefined : site.raw;
    const set = (index: number, attr: Attr, value: string) => {
        const site = parts[index].sites[attr];
        if (typeof site === 'string') return setNote(`Can't set ${attr}: ${site}`);
        const written = attr === 'model' ? JSON.stringify(value) : value;
        if (written === site.raw || (attr === 'model' && value === unquote(site.raw))) return;
        write(() => {
            const next = applyEdits(text, [{site, value: written}]);
            if (!both || !otherPath) return next;
            // the same part of the other half, found again in the changed text
            const theirs = findItemSites(next, otherPath, [...ATTRS]);
            const there = typeof theirs === 'string' ? null : theirs[index]?.sites[attr];
            return there && typeof there !== 'string' ? applyEdits(next, [{site: there, value: written}]) : next;
        }, `#${index} ${attr}: ${value}${both ? `, on ${other?.name} too` : ''}`);
    };
    // a box written on Enter or when left
    const box = (index: number, attr: Attr, className: string, placeholder: string, title: string) => {
        const id = `${index}.${attr}`;
        const site = parts[index].sites[attr];
        const shown = attr === 'model' ? unquote(rawOf(site)) : rawOf(site) ?? '';
        const commit = () => {
            const typed = drafts[id];
            if (typed === undefined) return;
            setDrafts({...drafts, [id]: undefined});
            if (typed.trim() !== '') set(index, attr, typed.trim());
        };
        return (
            <input className={className} value={drafts[id] ?? shown} placeholder={placeholder} title={title}
                   disabled={typeof site === 'string'}
                   onChange={e => setDrafts({...drafts, [id]: e.target.value})}
                   onKeyDown={e => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') setDrafts({...drafts, [id]: undefined}); }}
                   onBlur={commit}/>
        );
    };

    return (
        <Card onPointerDown={e => e.stopPropagation()}>
            <CardHead title={`Parts of ${assembly}: ${parts.length}`} subtitle="other 3D models on the board" folded={folded} onFold={setFolded} foldAt="left"
                      actions={!folded && (
                          <Button $variant="go" title="Another 3D model on the board, e.g. a module board on standoffs"
                                  onClick={() => write(() => {
                                      const part = {name: `part${parts.length + 1}`, model: '', module: modules[0], z: '0'};
                                      const next = addAssemblyPart(text, assembly, part);
                                      return both && other ? addAssemblyPart(next, other.name, part) : next;
                                  }, `a part added${both ? `, on ${other?.name} too` : ''}: give it a model`)}>+ Part</Button>
                      )}/>
            {!folded && <div className="body">
                {other && (
                    <Check title={other.same ? `Every change here is made to ${other.name}'s parts too` : `${other.name}'s parts are not the same as these, so they are changed one by one`}>
                        <input type="checkbox" checked={both} disabled={!other.same} onChange={e => setBoth(e.target.checked)}/>
                        {other.same ? `both halves: ${other.name} too` : `${other.name} has other parts: this half only`}
                    </Check>
                )}
                {parts.map((part, index) => {
                    const module = rawOf(part.sites.module);
                    return (
                        <div key={String(part.key)} className="part">
                            <Field label="Name">{box(index, 'name', 'name', 'name', 'what it is called in the view')}</Field>
                            <Field label="At">
                                <select value={module ?? ''} title="the module of the pcb it sits at, turned with it"
                                        disabled={typeof part.sites.module === 'string'}
                                        onChange={e => e.target.value && set(index, 'module', e.target.value)}>
                                    {!module && <option value="">the board's origin</option>}
                                    {module && !modules.includes(module) && <option value={module}>{module}</option>}
                                    {modules.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </Field>
                            <Field label="Z" unit="mm">{box(index, 'z', 'z', '0', "the height of the model's z = 0, in mm")}</Field>
                            <Field label="Model">{box(index, 'model', 'model', 'github:owner/repo/model.glb, https://…, or ${VAR}/…',
                                'its model: a path as footprints name them (glb, step, wrl), a URL, or github:owner/repo/file')}</Field>
                            <Actions>
                                <Gap/>
                                <Button $variant="danger" title={`Delete part #${index}`}
                                        onClick={() => window.confirm(`Delete part #${index} of ${assembly}${both ? ` and of ${other?.name}` : ''}?`) && write(() => {
                                            const next = deleteListItem(text, path, index);
                                            return both && otherPath ? deleteListItem(next, otherPath, index) : next;
                                        }, `#${index} deleted${both ? `, on ${other?.name} too` : ''}`)}>Delete</Button>
                            </Actions>
                        </div>
                    );
                })}
                {note && <Status>{note}</Status>}
            </div>}
        </Card>
    );
};

export default AssemblyParts;
