import {useMemo, useState} from "react";
import yaml from "js-yaml";
import {useConfigContext} from "../context/ConfigContext";
import Dialog from "../atoms/Dialog";

// A new outline (outlines.<name>), from the "+" on the Downloads list's Outlines: a name and how it starts. The
// layout editor makes it, with its keys at hand, and opens it there (or starts drawing its points).

export type Template = 'draw' | 'hull' | 'plate-mx' | 'plate-choc';
export const TEMPLATES: [Template, string][] = [
    ['draw', 'draw its points'],
    ['hull', 'around all keys'],
    ['plate-mx', 'plate, MX cutouts'],
    ['plate-choc', 'plate, Choc cutouts'],
];

// what the layout editor is asked to make: on a mirrored layout, a template covers one half or both
export type OutlineRequest = { name: string, template: Template, both: boolean };

type Props = {
    onCreate: (request: OutlineRequest) => void,
    onCancel: () => void,
};

const NewOutline = ({onCreate, onCancel}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const text = configContext?.configInput ?? '';
    const config = useMemo(() => {
        try {
            return yaml.load(text) as any;
        } catch (e: unknown) {
            return null;
        }
    }, [text]);
    const mirrors = Object.values((configContext?.results?.points ?? {}) as Record<string, any>).some(p => p?.meta?.mirrored);
    // a split board makes each half's pcb or case with "mirror: from:"; a unibody has both halves on one
    const looksSplit = ['pcbs', 'cases'].some(section =>
        Object.values(config?.[section] ?? {}).some((v: any) => v && typeof v === 'object' && v.mirror?.from));

    const [name, setName] = useState('');
    const [template, setTemplate] = useState<Template>('draw');
    const [both, setBoth] = useState<boolean | null>(null);
    const [note, setNote] = useState<string | null>(null);

    const create = () => {
        const trimmed = name.trim();
        if (!/^[A-Za-z_][\w-]*$/.test(trimmed)) return setNote('Name it with letters, digits, _ or -, starting with a letter');
        if (config?.outlines?.[trimmed]) return setNote(`There already is an outline called ${trimmed}`);
        onCreate({name: trimmed, template, both: mirrors ? both ?? !looksSplit : true});
    };

    return (
        <Dialog title="New outline" onClose={onCancel}>
            <label className="field">
                <span>Name</span>
                <input autoFocus placeholder="outline name" value={name}
                       onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}/>
            </label>
            <label className="field">
                <span>Starts as</span>
                <select value={template} onChange={e => setTemplate(e.target.value as Template)} title="how it starts">
                    {TEMPLATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </label>
            {template === 'draw' && <div className="hint">in the layout editor: click its points, Enter to finish</div>}
            {mirrors && template !== 'draw' && (
                <label className="field">
                    <span>Covers</span>
                    <select value={(both ?? !looksSplit) ? 'both' : 'half'} onChange={e => setBoth(e.target.value === 'both')}
                            title="A split board's outline covers one half, a unibody's covers both">
                        <option value="half">one half (split)</option>
                        <option value="both">both halves (unibody)</option>
                    </select>
                </label>
            )}
            {note && <div className="note">{note}</div>}
            <div className="buttons">
                <button onClick={onCancel}>Cancel</button>
                <button className="add" onClick={create}>{template === 'draw' ? 'Draw' : 'Add'}</button>
            </div>
        </Dialog>
    );
};

export default NewOutline;
