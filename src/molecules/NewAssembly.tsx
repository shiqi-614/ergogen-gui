import {useMemo, useState} from "react";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {Button, Dialog, Field} from "../ui";
import {mirrorName} from "./NewCase";
import {AssemblyPart, appendEntry, assemblyLines} from "../utils/layoutEdit";

// A new assembly (assemblies.<name>), from the "+" on the project list's Assemblies: a board and the cases
// stacked around it, from the bottom up, the board's top level with one of them; on a split board with the same
// for the other half too, made of the mirrored board and cases. Other 3D models go on it as parts, e.g. a module
// board on standoffs: each at a module of the pcb (turned with it) and a height.

type Props = {
    // the new assembly is shown, by its preview key
    onCreated: (previewKey: string) => void,
    onCancel: () => void,
};

const NewAssembly = ({onCreated, onCancel}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const text = configContext?.configInput ?? '';
    const config = useMemo(() => {
        try {
            return yaml.load(text) as any;
        } catch (e: unknown) {
            return null;
        }
    }, [text]);
    const pcbs = Object.entries(config?.pcbs ?? {}) as [string, any][];
    const cases = Object.entries(config?.cases ?? {}) as [string, any][];
    const assemblies = Object.values(config?.assemblies ?? {}) as any[];
    const held = new Set(assemblies.map(a => typeof a?.pcb === 'string' ? a.pcb : a?.pcb?.name));
    // the other half's pcb or case: the one mirrored from it, or the one it mirrors
    const counterpart = (entries: [string, any][], name: string) =>
        entries.find(([n, v]) => n !== name && v?.mirror?.from === name)?.[0]
        ?? entries.find(([n]) => n === name)?.[1]?.mirror?.from;

    const [form, setForm] = useState({
        name: '', pcb: pcbs.find(([n]) => !held.has(n))?.[0] ?? pcbs[0]?.[0] ?? '', stack: [] as string[], top: '',
        mirror: false, mirrorName: null as string | null, parts: [] as AssemblyPart[],
    });
    const [note, setNote] = useState<string | null>(null);
    if (!configContext) return null;

    const otherPcb = form.pcb ? counterpart(pcbs, form.pcb) : undefined;
    // the board's modules, a part's place: a mirrored pcb has the ones of the pcb it mirrors
    const ownBoard = config?.pcbs?.[form.pcb]?.mirror?.from ?? form.pcb;
    const modules = Object.keys(config?.pcbs?.[ownBoard]?.modules ?? {});
    const setPart = (index: number, change: Partial<AssemblyPart>) =>
        setForm({...form, parts: form.parts.map((p, i) => i === index ? {...p, ...change} : p)});
    const otherStack = form.stack.map(c => counterpart(cases, c));
    const canMirror = !!otherPcb && otherStack.every(Boolean);
    const other = form.mirrorName ?? (form.name.trim() ? mirrorName(form.name.trim()) : '');
    // the stack is the order the cases are ticked in, from the bottom up
    const toggle = (name: string, on: boolean) => {
        const stack = on ? [...form.stack, name] : form.stack.filter(n => n !== name);
        setForm({...form, stack, top: stack.includes(form.top) ? form.top : ''});
    };

    const create = () => {
        const name = form.name.trim();
        if (!/^[A-Za-z_][\w-]*$/.test(name)) return setNote('Name it with letters, digits, _ or -, starting with a letter');
        if (config?.assemblies?.[name]) return setNote(`There already is an assembly called ${name}`);
        if (!form.pcb) return setNote('An assembly needs a board');
        const mirror = form.mirror && canMirror;
        if (mirror && (config?.assemblies?.[other] || other === name || !other)) return setNote('Give the other half\'s assembly a name of its own');
        const parts = form.parts.map(p => ({name: p.name.trim(), model: p.model.trim(), at_module: p.at_module || undefined, z: p.z?.trim() || undefined}));
        if (parts.some(p => !p.model)) return setNote('Every part needs a model: github:owner/repo/file, a URL, or a path like ${ERGOCAI_MODULES}/…');
        try {
            let next = appendEntry(text, ['assemblies'], name, assemblyLines(form.stack, form.pcb, form.top || undefined, parts));
            if (mirror) {
                const top = form.top ? counterpart(cases, form.top) : undefined;
                next = appendEntry(next, ['assemblies'], other, assemblyLines(otherStack as string[], otherPcb as string, top, parts));
            }
            configContext.setConfigInput(next);
            onCreated(`assemblies.${name}`);
        } catch (err: unknown) {
            setNote(`Can't add the assembly: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <Dialog title="New assembly" onClose={onCancel}>
            <Field label="Name">
                <input autoFocus placeholder="assembly name" value={form.name}
                       onChange={e => setForm({...form, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && create()}/>
            </Field>
            <Field label="Board">
                <select value={form.pcb} title="the pcb it holds" onChange={e => setForm({...form, pcb: e.target.value})}>
                    {pcbs.map(([p]) => <option key={p} value={p}>{p}</option>)}
                </select>
            </Field>
            <Field label="Stack">
                <div className="controls checks" title="the cases stacked around the board, from the bottom up">
                    {cases.map(([c]) => (
                        <label key={c}>
                            <input type="checkbox" checked={form.stack.includes(c)} onChange={e => toggle(c, e.target.checked)}/> {c}
                            {form.stack.includes(c) && <span className="order">{form.stack.indexOf(c) + 1}</span>}
                        </label>
                    ))}
                </div>
            </Field>
            <div className="hint">tick them from the bottom up: {form.stack.length ? form.stack.join(' → ') : 'none yet'}</div>
            <Field label="Board level">
                <select value={form.top} title="the case whose top the board's top is level with" onChange={e => setForm({...form, top: e.target.value})}>
                    <option value="">at the bottom (z 0)</option>
                    {form.stack.map(c => <option key={c} value={c}>top with {c}'s top</option>)}
                </select>
            </Field>
            <Field label="Parts">
                <div className="controls">
                    <Button title="Another 3D model on the board, e.g. a module board on standoffs"
                            onClick={() => setForm({...form, parts: [...form.parts, {name: '', model: '', at_module: modules[0] ?? '', z: '0'}]})}>+ Part</Button>
                </div>
            </Field>
            {form.parts.map((part, i) => (
                <div key={i} className="part">
                    <div className="row">
                        <input placeholder="name" value={part.name} title="what it is called in the view" onChange={e => setPart(i, {name: e.target.value})}/>
                        <select value={part.at_module ?? ''} title="where it goes: at this module of the pcb, turned with it" onChange={e => setPart(i, {at_module: e.target.value})}>
                            <option value="">at the board's origin</option>
                            {modules.map(m => <option key={m} value={m}>at {m}</option>)}
                        </select>
                        z <input className="short" value={part.z ?? ''} title="the height of the model's z = 0, in mm" onChange={e => setPart(i, {z: e.target.value})}/>
                        <Button $variant="ghost" title="Leave this part out" onClick={() => setForm({...form, parts: form.parts.filter((_, j) => j !== i)})}>×</Button>
                    </div>
                    <input className="model" placeholder="github:owner/repo/model.glb, https://…, or ${VAR}/…" value={part.model}
                           title="its model: a path as footprints name them (glb, step, wrl), a URL, or github:owner/repo/file"
                           onChange={e => setPart(i, {model: e.target.value})}/>
                </div>
            ))}
            {canMirror && (
                <Field label="Other half">
                    <div className="controls">
                        <input type="checkbox" checked={form.mirror} title={`The same with ${otherPcb} and the mirrored cases`}
                               onChange={e => setForm({...form, mirror: e.target.checked})}/>
                        <input value={other} disabled={!form.mirror} title="the other half's assembly" placeholder="its name"
                               onChange={e => setForm({...form, mirrorName: e.target.value})}/>
                    </div>
                </Field>
            )}
            {note && <div className="note">{note}</div>}
            <div className="buttons">
                <Button onClick={onCancel}>Cancel</Button>
                <Button $variant="go" onClick={create}>Add</Button>
            </div>
        </Dialog>
    );
};

export default NewAssembly;
