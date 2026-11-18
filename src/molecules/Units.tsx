import {useEffect, useMemo, useState} from "react";
import styled from "styled-components";
import {useConfigContext} from "../context/ConfigContext";
import {Button, Dialog, Field, colors, fontSize, radius} from "../ui";
import {appendEntry, applyEdits, deleteUnit, isPlainNumber, nudge, unitEntries, unitMentions} from "../utils/layoutEdit";

// The config's units and variables, at the top of the Downloads list: what each is written as, what an expression comes to
// and how often the config uses it. A changed value is written as typed and everything made again, so the preview
// shows what it does; ↑ and ↓ nudge a value by 0.1 (with Shift 1, with Alt 0.01) and keep how it is written.

const List = styled.div`
  margin: 0 0 0.5em 0.35rem;
  font-size: 0.85rem;

  .unit {
    display: grid;
    grid-template-columns: minmax(5rem, 8rem) 1fr 3.6rem 3.4rem 1rem;
    align-items: center;
    gap: 0.4rem;
    padding: 0.1rem 0.25rem;
    border-radius: 0.2rem;
  }

  .unit:hover {
    background: rgba(255, 159, 28, 0.12);
  }

  .name {
    overflow: hidden;
    font-family: monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name.documented {
    text-decoration: underline dotted ${colors.muted};
    cursor: help;
  }

  input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.1rem 0.35rem;
    border: 1px solid ${colors.fieldBorder};
    border-radius: ${radius.small};
    background: ${colors.field};
    color: ${colors.strong};
    font: inherit;
    font-family: monospace;
  }

  .value, .uses {
    color: ${colors.muted};
    font-size: ${fontSize.small};
    text-align: right;
    white-space: nowrap;
  }

  .uses.unused {
    color: ${colors.warn};
  }

  .group {
    margin: 0.4rem 0 0.15rem 0.25rem;
    color: ${colors.muted};
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .note {
    margin: 0.3rem 0 0 0.25rem;
    color: ${colors.dangerInk};
  }
`;

const format = (value: unknown) => typeof value === 'number' ? String(Number(value.toFixed(3))) : '?';

export const useUnits = () => {
    const text = useConfigContext()?.configInput ?? '';
    return useMemo(() => unitEntries(text), [text]);
};

export const UnitList = (): JSX.Element | null => {
    const configContext = useConfigContext();
    const text = configContext?.configInput ?? '';
    const entries = useUnits();
    const values = (configContext?.results?.units ?? {}) as Record<string, number>;
    const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
    useEffect(() => setDrafts({}), [text]);
    const [note, setNote] = useState<string | null>(null);
    if (!configContext) return null;

    const write = (index: number, value: string) => {
        const site = entries[index].site;
        if (typeof site === 'string') return setNote(`Can't change ${entries[index].name}: ${site}`);
        if (value === site.raw) return;
        setNote(null);
        configContext.setConfigInput(applyEdits(text, [{site, value}]));
    };
    const commit = (index: number) => {
        const typed = drafts[entries[index].name]?.trim();
        setDrafts({...drafts, [entries[index].name]: undefined});
        if (typed) write(index, typed);
    };
    const remove = (index: number) => {
        const {name, section} = entries[index];
        const uses = unitMentions(text, name);
        const shown = uses.slice(0, 8).map(u => `  ${u}`).join('\n') + (uses.length > 8 ? `\n  … ${uses.length - 8} more` : '');
        if (!window.confirm(`Delete ${section}.${name}?` + (uses.length ? `\nThese lines use it and will need another value:\n${shown}` : ''))) return;
        try {
            configContext.setConfigInput(deleteUnit(text, section, name));
        } catch (err: unknown) {
            setNote(`Can't delete ${name}: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    return (
        <List>
            {entries.length === 0 && <div className="group">no units of its own</div>}
            {entries.map((entry, index) => {
                const uses = unitMentions(text, entry.name);
                const first = index === 0 || entries[index - 1].section !== entry.section;
                return (
                    <div key={`${entry.section}.${entry.name}`}>
                        {first && entries.some(e => e.section === 'variables') && <div className="group">{entry.section}</div>}
                        <div className="unit">
                            <span className={`name${entry.comment ? ' documented' : ''}`} title={entry.comment || entry.name}>{entry.name}</span>
                            <input value={drafts[entry.name] ?? entry.raw} aria-label={entry.name} disabled={typeof entry.site === 'string'}
                                   title={typeof entry.site === 'string' ? entry.site : '↑ ↓ nudge by 0.1 (Shift 1, Alt 0.01)'}
                                   onChange={e => setDrafts({...drafts, [entry.name]: e.target.value})}
                                   onBlur={() => commit(index)}
                                   onKeyDown={e => {
                                       if (e.key === 'Enter') commit(index);
                                       else if (e.key === 'Escape') setDrafts({...drafts, [entry.name]: undefined});
                                       else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                           e.preventDefault();
                                           const step = (e.shiftKey ? 1 : e.altKey ? 0.01 : 0.1) * (e.key === 'ArrowUp' ? 1 : -1);
                                           write(index, nudge(drafts[entry.name] ?? entry.raw, step, values));
                                           setDrafts({...drafts, [entry.name]: undefined});
                                       }
                                   }}/>
                            {/* what an expression comes to; a plain number is that already */}
                            <span className="value" title="what it comes to">{isPlainNumber(entry.raw) ? '' : `= ${format(values[entry.name])}`}</span>
                            <span className={`uses${uses.length ? '' : ' unused'}`} title={uses.length ? uses.join('\n') : 'nothing uses it'}>{uses.length} use{uses.length === 1 ? '' : 's'}</span>
                            <Button $variant="ghost" title={`Delete ${entry.name}`} onClick={() => remove(index)}>×</Button>
                        </div>
                    </div>
                );
            })}
            {note && <div className="note">{note}</div>}
        </List>
    );
};

type NewProps = { onClose: () => void };

// a new unit, at the end of the units (where it can use all the others)
export const NewUnit = ({onClose}: NewProps): JSX.Element | null => {
    const configContext = useConfigContext();
    const entries = useUnits();
    const [name, setName] = useState('');
    const [value, setValue] = useState('');
    const [note, setNote] = useState<string | null>(null);
    if (!configContext) return null;
    const create = () => {
        const n = name.trim(), v = value.trim();
        if (!/^[A-Za-z_$][\w$]*$/.test(n)) return setNote('Name it with letters, digits or _, starting with a letter');
        if (entries.some(e => e.name === n)) return setNote(`There already is a unit called ${n}`);
        if (!v) return setNote('Give it a value: a number, or an expression of other units, like 2kx or funnelWide + 2');
        try {
            configContext.setConfigInput(appendEntry(configContext.configInput ?? '', ['units'], n, [], v));
            onClose();
        } catch (err: unknown) {
            setNote(`Can't add it: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    return (
        <Dialog title="New unit" onClose={onClose}>
            <Field label="Name">
                <input autoFocus placeholder="unit name" value={name} onChange={e => setName(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && create()}/>
            </Field>
            <Field label="Value">
                <input placeholder="e.g. 1.75, 2kx, funnelWide + 2" value={value} onChange={e => setValue(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && create()}/>
            </Field>
            <div className="hint">in mm; it can use any unit above it, and the ones after it can use it</div>
            {note && <div className="note">{note}</div>}
            <div className="buttons">
                <Button onClick={onClose}>Cancel</Button>
                <Button $variant="go" onClick={create}>Add</Button>
            </div>
        </Dialog>
    );
};
