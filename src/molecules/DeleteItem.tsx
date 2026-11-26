import {useState} from "react";
import {useConfigContext} from "../context/ConfigContext";
import {Button, Dialog, Field} from "../ui";
import {caseReferences, deleteCase, deleteEntry, deleteOutline, deletePcb, outlineReferences, pcbReferences} from "../utils/layoutEdit";

// Deleting an outline, a pcb, a case or an assembly, from its row in the project list: what goes with it, and a
// dialog to say yes to first. The editor's undo brings it all back.

export type Deletable = 'outline' | 'PCB' | 'case' | 'assembly';

// what else the config loses with it, and the text without it all
export const deletion = (text: string, kind: Deletable, name: string): { uses: string[], apply: () => string } => {
    if (kind === 'outline') {
        return {uses: outlineReferences(text, name).map(r => r.label), apply: () => deleteOutline(text, name, true)};
    }
    if (kind === 'case') {
        const refs = caseReferences(text, name);
        return {
            uses: [
                ...refs.mirrors.map(m => `the mirrored case ${m}`),
                ...refs.stacks.map(a => `its layer in the stack of assembly ${a}`),
                ...refs.parts.map(p => `part ${p.split('.')[1]} of case ${p.split('.')[0]}`),
            ],
            apply: () => deleteCase(text, name, true),
        };
    }
    if (kind === 'PCB') {
        const {mirrors, assemblies} = pcbReferences(text, name);
        return {uses: [...mirrors.map(m => `the mirrored pcb ${m}`), ...assemblies.map(a => `assembly ${a}`)], apply: () => deletePcb(text, name)};
    }
    return {uses: [], apply: () => deleteEntry(text, ['assemblies'], name)};
};

type Props = {
    kind: Deletable,
    name: string,
    onDone: (deleted: boolean) => void,
};

export const ConfirmDelete = ({kind, name, onDone}: Props): JSX.Element | null => {
    const configContext = useConfigContext();
    const [note, setNote] = useState<string | null>(null);
    if (!configContext) return null;
    const {uses, apply} = deletion(configContext.configInput ?? '', kind, name);
    const remove = () => {
        try {
            configContext.setConfigInput(apply());
            onDone(true);
        } catch (err: unknown) {
            setNote(`Can't delete it: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    return (
        <Dialog title={`Delete ${kind} ${name}?`} onClose={() => onDone(false)}>
            {uses.length > 0
                ? <>
                    <div className="message">These go with it:</div>
                    <ul className="uses">{uses.map(u => <li key={u}>{u}</li>)}</ul>
                </>
                : <div className="message">{kind === 'assembly' ? 'Its board and cases stay.' : 'Nothing else uses it.'}</div>}
            <div className="hint-plain">Undo in the config editor brings it back.</div>
            {note && <div className="note">{note}</div>}
            <div className="buttons">
                <Button onClick={() => onDone(false)}>Cancel</Button>
                <Button $variant="destructive" autoFocus onClick={remove}>Delete</Button>
            </div>
        </Dialog>
    );
};
