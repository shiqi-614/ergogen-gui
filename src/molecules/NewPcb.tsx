import {useMemo, useState} from "react";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import {Button, Dialog, Field} from "../ui";
import {mirrorName} from "./NewCase";
import {appendEntry, entryLines, mirrorCaseLines} from "../utils/layoutEdit";

// A new pcb (pcbs.<name>), from the "+" on the project list's PCBs: a copy of another pcb (its outlines,
// footprints and modules), or an empty board whose edge is an outline; on a split board with a mirrored pcb for
// the other half too.

type Props = {
    // the new pcb is shown, by its preview key
    onCreated: (previewKey: string) => void,
    onCancel: () => void,
};

const NewPcb = ({onCreated, onCancel}: Props): JSX.Element | null => {
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
    // pcbs with footprints of their own, to copy; the mirrored ones are made of those
    const ownPcbs = pcbs.filter(([, p]) => !p?.mirror).map(([n]) => n);
    const outlines = Object.keys(config?.outlines ?? {});
    const split = pcbs.some(([, p]) => p?.mirror?.from);

    const [form, setForm] = useState({
        name: '', start: (ownPcbs.length ? 'copy' : 'empty') as 'copy' | 'empty', copy: ownPcbs[0] ?? '',
        outline: outlines.includes('board') ? 'board' : outlines[0] ?? '', mirror: split, mirrorName: null as string | null,
    });
    const [note, setNote] = useState<string | null>(null);
    if (!configContext) return null;
    const other = form.mirrorName ?? (form.name.trim() ? mirrorName(form.name.trim()) : '');

    const create = () => {
        const name = form.name.trim();
        if (!/^[A-Za-z_][\w-]*$/.test(name)) return setNote('Name it with letters, digits, _ or -, starting with a letter');
        if (config?.pcbs?.[name]) return setNote(`There already is a pcb called ${name}`);
        if (form.mirror && (config?.pcbs?.[other] || other === name || !other)) return setNote(`Give the mirrored pcb a name of its own`);
        if (form.start === 'empty' && !form.outline) return setNote('An empty board needs an outline for its edge');
        try {
            const lines = form.start === 'copy' ? entryLines(text, 'pcbs', form.copy) : ['outlines:', '  edge:', `    outline: ${form.outline}`];
            let next = appendEntry(text, ['pcbs'], name, lines);
            if (form.mirror) next = appendEntry(next, ['pcbs'], other, mirrorCaseLines(name));
            configContext.setConfigInput(next);
            onCreated(`pcbs.${name}.preview.kicad_pcb`);
        } catch (err: unknown) {
            setNote(`Can't add the pcb: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <Dialog title="New PCB" onClose={onCancel}>
            <Field label="Name">
                <input autoFocus placeholder="pcb name" value={form.name}
                       onChange={e => setForm({...form, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && create()}/>
            </Field>
            <Field label="Starts as">
                <select value={form.start} title="how it starts" onChange={e => setForm({...form, start: e.target.value as 'copy' | 'empty'})}>
                    {ownPcbs.length > 0 && <option value="copy">a copy of a pcb</option>}
                    <option value="empty">an empty board</option>
                </select>
            </Field>
            {form.start === 'copy'
                ? <Field label="PCB">
                    <select value={form.copy} title="the pcb whose outlines, footprints and modules it starts with"
                            onChange={e => setForm({...form, copy: e.target.value})}>
                        {ownPcbs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </Field>
                : <Field label="Edge">
                    <select value={form.outline} title="the outline its board edge is" onChange={e => setForm({...form, outline: e.target.value})}>
                        {outlines.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </Field>}
            <Field label="Mirrored">
                <div className="controls">
                    <input type="checkbox" checked={form.mirror} title="A mirrored pcb for the other half of a split board"
                           onChange={e => setForm({...form, mirror: e.target.checked})}/>
                    <input value={other} disabled={!form.mirror} title="the mirrored pcb's name" placeholder="its mirrored name"
                           onChange={e => setForm({...form, mirrorName: e.target.value})}/>
                </div>
            </Field>
            {note && <div className="note">{note}</div>}
            <div className="buttons">
                <Button onClick={onCancel}>Cancel</Button>
                <Button $variant="go" onClick={create}>Add</Button>
            </div>
        </Dialog>
    );
};

export default NewPcb;
