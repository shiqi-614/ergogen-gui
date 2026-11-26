import {useMemo, useState} from "react";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {Button, Dialog, Field} from "../ui";
import {appendEntry, caseLines, insertIntoStack, mirrorCaseLines} from "../utils/layoutEdit";

// A new case (cases.<name>), from the "+" on the project list's Cases: a copy of another case's parts, or an
// outline extruded; on a split board with a mirrored case for the other half too; and put into an assembly's
// stack above one of its layers (the mirrored one into the other half's assembly, above the same layer's mirror).

type Props = {
    // the new case is shown, by its preview key (cases.<name>.stl)
    onCreated: (previewKey: string) => void,
    onCancel: () => void,
};

// the other half's name for a case, a pcb or an assembly: right_x is left_x, x_right is x_left (and the other way
// round), others get _mirrored
export const mirrorName = (name: string) => {
    const swap = (side: string) => side === 'right' ? 'left' : 'right';
    if (/^(right|left)_/.test(name)) return name.replace(/^(right|left)_/, (_, side) => `${swap(side)}_`);
    if (/_(right|left)$/.test(name)) return name.replace(/_(right|left)$/, (_, side) => `_${swap(side)}`);
    return `${name}_mirrored`;
};

const NewCase = ({onCreated, onCancel}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const text = configContext?.configInput ?? '';
    const config = useMemo(() => {
        try {
            return yaml.load(text) as any;
        } catch (e: unknown) {
            return null;
        }
    }, [text]);
    const cases = Object.entries(config?.cases ?? {}) as [string, any][];
    // cases with parts of their own, to copy; the mirrored ones are made of those
    const ownCases = cases.filter(([, c]) => !c?.mirror).map(([n]) => n);
    const outlines = Object.keys(config?.outlines ?? {});
    const assemblies = Object.entries(config?.assemblies ?? {}) as [string, any][];
    const split = cases.some(([, c]) => c?.mirror?.from);

    const [form, setForm] = useState(() => {
        // at the top of the first assembly's stack
        const stack: any[] = assemblies[0]?.[1]?.stack ?? [];
        const top = stack.length ? String(typeof stack[stack.length - 1] === 'string' ? stack[stack.length - 1] : stack[stack.length - 1]?.name) : '';
        return {
            name: '', start: 'copy' as 'copy' | 'outline', copy: ownCases[0] ?? '', outline: outlines[0] ?? '', thick: '3',
            mirror: split, mirrorName: null as string | null, assembly: assemblies[0]?.[0] ?? '', above: top,
        };
    });
    const [note, setNote] = useState<string | null>(null);

    if (!configContext) return null;

    const stackOf = (assembly: string): string[] => ((config?.assemblies?.[assembly]?.stack ?? []) as any[])
        .map(e => typeof e === 'string' ? e : String(e?.name));
    const other = form.mirrorName ?? (form.name.trim() ? mirrorName(form.name.trim()) : '');

    const create = () => {
        const name = form.name.trim();
        if (!/^[A-Za-z_][\w-]*$/.test(name)) return setNote('Name it with letters, digits, _ or -, starting with a letter');
        if (config?.cases?.[name]) return setNote(`There already is a case called ${name}`);
        if (form.mirror && (config?.cases?.[other] || other === name)) return setNote(`There already is a case called ${other}`);
        try {
            const lines = form.start === 'copy'
                ? caseLines(text, form.copy)
                : ['- what: outline', `  name: ${form.outline}`, `  extrude: ${form.thick.trim() || '3'}`];
            let next = appendEntry(text, ['cases'], name, lines);
            if (form.mirror) next = appendEntry(next, ['cases'], other, mirrorCaseLines(name));
            if (form.assembly) {
                // above the layer picked, or at the bottom
                const stack = stackOf(form.assembly);
                const at = form.above ? stack.indexOf(form.above) + 1 : 0;
                next = insertIntoStack(next, form.assembly, name, at);
                if (form.mirror && form.above) {
                    // the mirrored case goes into the stack that has the picked layer's mirror, above it
                    const mirrorOfAbove = cases.find(([, c]) => c?.mirror?.from === form.above)?.[0];
                    const into = assemblies.find(([a]) => a !== form.assembly && mirrorOfAbove && stackOf(a).includes(mirrorOfAbove))?.[0];
                    if (into && mirrorOfAbove) next = insertIntoStack(next, into, other, stackOf(into).indexOf(mirrorOfAbove) + 1);
                }
            }
            configContext.setConfigInput(next);
            onCreated(`cases.${name}.stl`);
        } catch (err: unknown) {
            setNote(`Can't add the case: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <Dialog title="New case" onClose={onCancel}>
            <Field label="Name">
                <input autoFocus placeholder="case name" value={form.name}
                       onChange={e => setForm({...form, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && create()}/>
            </Field>
            <Field label="Starts as">
                <div className="controls">
                    <select value={form.start} title="how it starts" onChange={e => setForm({...form, start: e.target.value as 'copy' | 'outline'})}>
                        <option value="copy">a copy of a case</option>
                        <option value="outline">an outline, extruded</option>
                    </select>
                </div>
            </Field>
            {form.start === 'copy'
                ? <Field label="Case">
                    <select value={form.copy} onChange={e => setForm({...form, copy: e.target.value})} title="the case whose parts it starts with">
                        {ownCases.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </Field>
                : <div className="field">
                    <span>Outline</span>
                    <div className="controls">
                        <select value={form.outline} onChange={e => setForm({...form, outline: e.target.value})} title="the outline it is made from">
                            {outlines.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <input className="short" value={form.thick} title="how thick, in mm" onChange={e => setForm({...form, thick: e.target.value})}/> mm
                    </div>
                </div>}
            <Field label="Mirrored">
                <div className="controls">
                    <input type="checkbox" checked={form.mirror} title="A mirrored case for the other half of a split board"
                           onChange={e => setForm({...form, mirror: e.target.checked})}/>
                    <input value={other} disabled={!form.mirror} title="the mirrored case's name" placeholder="its mirrored name"
                           onChange={e => setForm({...form, mirrorName: e.target.value})}/>
                </div>
            </Field>
            {assemblies.length > 0 && (
                <Field label="Assembly">
                    <div className="controls">
                        <select value={form.assembly} onChange={e => {
                            const stack = stackOf(e.target.value);
                            setForm({...form, assembly: e.target.value, above: stack[stack.length - 1] ?? ''});
                        }}>
                            <option value="">none</option>
                            {assemblies.map(([a]) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        {form.assembly && (
                            <select value={form.above} onChange={e => setForm({...form, above: e.target.value})} title="where in the stack, from the bottom up">
                                <option value="">at the bottom</option>
                                {stackOf(form.assembly).map(l => <option key={l} value={l}>above {l}</option>)}
                            </select>
                        )}
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

export default NewCase;
