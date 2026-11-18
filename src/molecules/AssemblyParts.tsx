import {useEffect, useMemo, useState} from "react";
import styled from "styled-components";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {EditSite, addAssemblyPart, applyEdits, deleteListItem, findItemSites} from "../utils/layoutEdit";

// The other 3D models of an assembly (assemblies.<name>.parts), in its 3D view: a line each, to set its name, the
// module of the pcb it sits at, its height and its model, to delete it, or to add one. The view draws them once
// ergogen has placed them.

const ATTRS = ['name', 'model', 'module', 'z'] as const;
type Attr = typeof ATTRS[number];

const Panel = styled.div`
  position: absolute;
  right: 0.5rem;
  bottom: 0.5rem;
  z-index: 1;
  width: min(22rem, calc(100% - 1rem));
  max-height: 45%;
  overflow: auto;
  padding: 0.45rem 0.55rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.7);
  color: #dddddd;
  font-size: 0.8rem;

  .title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #ffffff;
  }

  .title span {
    flex-grow: 1;
  }

  .part {
    margin-top: 0.4rem;
    padding-top: 0.4rem;
    border-top: 1px solid #444444;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-bottom: 0.25rem;
  }

  input, select {
    min-width: 0;
    padding: 0.1rem 0.3rem;
    border: 1px solid #595959;
    border-radius: 0.2rem;
    background: #1e1e1e;
    color: #ffffff;
    font: inherit;
  }

  input.name {
    width: 5.5rem;
  }

  select {
    flex-grow: 1;
  }

  input.z {
    width: 3rem;
  }

  input.model {
    width: 100%;
    box-sizing: border-box;
  }

  button {
    padding: 0.1rem 0.5rem;
    border: none;
    border-radius: 0.2rem;
    background: #595959;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }

  button.fold, button.remove {
    padding: 0 0.2rem;
    background: transparent;
    color: #bbbbbb;
  }

  button.remove:hover {
    color: #ff6d6d;
  }

  .note {
    margin-top: 0.3rem;
    color: #999999;
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
        write(() => applyEdits(text, [{site, value: written}]), `#${index} ${attr}: ${value}`);
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
        <Panel onPointerDown={e => e.stopPropagation()}>
            <div className="title">
                <button className="fold" title={folded ? 'Show the parts' : 'Fold the parts away'} onClick={() => setFolded(!folded)}>{folded ? '▸' : '▾'}</button>
                <span>Parts of {assembly}: {parts.length}</span>
                {!folded && (
                    <button title="Another 3D model on the board, e.g. a module board on standoffs"
                            onClick={() => write(() => addAssemblyPart(text, assembly, {name: `part${parts.length + 1}`, model: '', module: modules[0], z: '0'}),
                                'a part added: give it a model')}>+ Part</button>
                )}
            </div>
            {!folded && parts.map((part, index) => {
                const module = rawOf(part.sites.module);
                return (
                    <div key={String(part.key)} className="part">
                        <div className="row">
                            {box(index, 'name', 'name', 'name', 'what it is called in the view')}
                            <select value={module ?? ''} title="the module of the pcb it sits at, turned with it"
                                    disabled={typeof part.sites.module === 'string'}
                                    onChange={e => e.target.value && set(index, 'module', e.target.value)}>
                                {!module && <option value="">at the board's origin</option>}
                                {module && !modules.includes(module) && <option value={module}>at {module}</option>}
                                {modules.map(m => <option key={m} value={m}>at {m}</option>)}
                            </select>
                            z {box(index, 'z', 'z', '0', "the height of the model's z = 0, in mm")}
                            <button className="remove" title={`Delete part #${index}`}
                                    onClick={() => window.confirm(`Delete part #${index} of ${assembly}?`) && write(() => deleteListItem(text, path, index), `#${index} deleted`)}>×</button>
                        </div>
                        {box(index, 'model', 'model', 'github:owner/repo/model.glb, https://…, or ${VAR}/…',
                            'its model: a path as footprints name them (glb, step, wrl), a URL, or github:owner/repo/file')}
                    </div>
                );
            })}
            {!folded && note && <div className="note">{note}</div>}
        </Panel>
    );
};

export default AssemblyParts;
