import React, {useEffect, useMemo, useState} from "react";
import yaml from "js-yaml";
import {
    ATTRS, Attr, Edit, KeyAttr, applyEdits, deleteColumn, deleteRow, findAnchorShift, findKeySite, findSite, formatLength,
    insertEntry, keyMentions, nextName, parseLength, splitShift,
} from "../../utils/layoutEdit";
import {Column, Meta, Site, Units, editableLength, format} from "./geometry";
import styled from "styled-components";
import {Panel} from "./styles";

const UNITS: Record<Attr, string> = {stagger: 'mm', spread: 'mm', splay: '°'};

type PanelProps = {
    column: Column,
    text: string,
    units: Units,
    effective?: Record<Attr, number>,
    next?: { col: string, effective: Record<Attr, number> },
    onCommit: (text: string) => void,
    // folded down to its title
    folded: boolean,
    onFold: (folded: boolean) => void,
    // the names of the zone's keys in a column, a row, or both (the mirrored ones too)
    keysOf: (col?: string, row?: string) => string[],
    // the column picked after one is added or deleted
    onSelect: (column: Column | null) => void,
    // the picked key, as ergogen made it: what its settings come to
    keyMeta?: Meta,
    // the tab shown, for the layout to light what it edits
    onTab?: (tab: Tab) => void,
};

// What the panel shows: the picked key's own settings, its column's, its row's or its zone's. The tab picked
// stays from key to key.
export type Tab = 'key' | 'column' | 'row' | 'zone';
const TABS: [Tab, string][] = [['key', 'Key'], ['column', 'Column'], ['row', 'Row'], ['zone', 'Zone']];
let lastTab: Tab = 'column';

const Card = styled(Panel)`
  width: 16rem;
  padding: 0;
  overflow-x: hidden;
  border: 1px solid #444444;
  box-shadow: 0 0.3rem 1.2rem rgba(0, 0, 0, 0.4);

  .head {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem 0.5rem;
  }

  .head .names {
    flex-grow: 1;
    min-width: 0;
  }

  .head strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .head small {
    color: #8a8a8a;
  }

  .head button {
    padding: 0;
    border: none;
    background: transparent;
    color: #bdbdbd;
    font: inherit;
    cursor: pointer;
  }

  .tabs {
    display: flex;
    margin: 0 0.75rem;
    border-radius: 0.3rem;
    background: #1e1e1e;
  }

  .tabs button {
    flex: 1;
    padding: 0.3rem 0;
    border: none;
    border-radius: 0.3rem;
    background: transparent;
    color: #a0a0a0;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .tabs button.on {
    background: #ff9f1c;
    color: #1e1e1e;
    font-weight: bold;
  }

  .tabs button:disabled {
    color: #555555;
    cursor: default;
  }

  .body {
    padding: 0.7rem 0.75rem 0.75rem;
  }

  label.field {
    display: grid;
    grid-template-columns: 4.6rem 1fr 1.6rem;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
  }

  label.field input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .label {
    color: #bdbdbd;
  }

  .unit {
    color: #8a8a8a;
    font-size: 0.8rem;
  }

  .about {
    margin-bottom: 0.6rem;
    color: #8a8a8a;
    font-size: 0.8rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
    margin: 0.5rem 0 0.2rem;
    color: #bdbdbd;
    font-size: 0.8rem;
  }

  .actions {
    display: flex;
    gap: 0.35rem;
    margin-top: 0.7rem;
    padding-top: 0.6rem;
    border-top: 1px solid #3c3c3c;
  }

  .actions .gap {
    flex-grow: 1;
  }

  .actions button, .chips button {
    padding: 0.2rem 0.55rem;
    border: none;
    border-radius: 0.2rem;
    background: #4a4a4a;
    color: #ffffff;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .actions button:hover, .chips button:hover {
    background: #5c5c5c;
  }

  .actions button.danger {
    background: transparent;
    color: #ff8a80;
    box-shadow: inset 0 0 0 1px #7a3a3a;
  }

  .actions button.danger:hover {
    background: #a33a3a;
    color: #ffffff;
  }

  .note {
    margin-top: 0.5rem;
  }
`;

const ColumnPanel = ({column, text, units, effective, next, onCommit, folded, onFold, keysOf, onSelect, keyMeta, onTab}: PanelProps) => {
    const sites = useMemo(
        () => Object.fromEntries(ATTRS.map(attr => [attr, findSite(text, column.zone, column.col, attr)])) as Record<Attr, Site>,
        [text, column.zone, column.col]
    );
    const nextSites = useMemo(
        () => next && Object.fromEntries(ATTRS.map(attr => [attr, findSite(text, column.zone, next.col, attr)])) as Record<Attr, Site>,
        [text, column.zone, next]
    );
    const anchor = useMemo(() => findAnchorShift(text, column.zone), [text, column.zone]);
    const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
    useEffect(() => setDrafts({}), [text, column.zone, column.col]);

    const commitAttr = (attr: Attr) => {
        const draft = drafts[attr]?.trim();
        const site = sites[attr];
        if (draft === undefined || typeof site === 'string') return;
        if (draft === '' || draft === (site.raw ?? '')) {
            setDrafts({...drafts, [attr]: undefined});
            return;
        }
        const edits: Edit[] = [{site, value: draft}];
        // like a drag, a new stagger or spread leaves the columns after this one where they are
        const typed = attr !== 'splay' && parseLength(draft, units);
        const nextSite = nextSites && editableLength(nextSites[attr], units);
        if (typed && effective && next && nextSite && typeof nextSite !== 'string') {
            const change = typed.mm - effective[attr];
            edits.push({site: nextSite.site, value: formatLength(next.effective[attr] - change, nextSite.like)});
        }
        onCommit(applyEdits(text, edits));
    };

    const commitAnchor = () => {
        if (typeof anchor === 'string') return;
        const x = drafts.anchorX?.trim() ?? anchor.raw[0] ?? '0';
        const y = drafts.anchorY?.trim() ?? anchor.raw[1] ?? '0';
        if (x === (anchor.raw[0] ?? '0') && y === (anchor.raw[1] ?? '0')) return;
        onCommit(applyEdits(text, anchor.edits(x || '0', y || '0')));
    };

    // the zone's columns and rows, in the config's order: columns left to right, rows bottom up
    const zone = useMemo(() => {
        try {
            const z = (yaml.load(text) as any)?.points?.zones?.[column.zone];
            return {columns: Object.keys(z?.columns ?? {}), rows: Object.keys(z?.rows ?? {})};
        } catch (e: unknown) {
            return {columns: [], rows: []};
        }
    }, [text, column.zone]);
    const [note, setNote] = useState<string | null>(null);
    useEffect(() => setNote(null), [column.zone, column.col, column.row]);
    const zonePath = ['points', 'zones', column.zone];
    const tryWrite = (what: string, make: () => string, then: () => void) => {
        try {
            onCommit(make());
            then();
        } catch (err: unknown) {
            setNote(`Can't ${what}: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    // a new column to the right of this one on the screen, or the left (the other way round on the mirrored
    // half), starting where ergogen puts one: a key's width on
    const addColumn = (right: boolean) => {
        const name = nextName(zone.columns, 'col');
        tryWrite('add a column', () => insertEntry(text, [...zonePath, 'columns'], name, [], column.col, right !== !!column.mirrored),
            () => onSelect({...column, col: name}));
    };
    // a new row above this one, or below: in the zone's every column
    const addRow = (above: boolean) => {
        if (!column.row) return;
        const name = nextName(zone.rows, 'row');
        tryWrite('add a row', () => insertEntry(text, [...zonePath, 'rows'], name, [], column.row!, above),
            () => onSelect({...column, row: name}));
    };
    // what still names the keys that go (an anchor, an outline point, a footprint's where) is listed first
    const confirmDelete = (what: string, keys: string[]) => {
        const mentions = keyMentions(text, keys);
        const shown = mentions.slice(0, 8).map(m => `  ${m}`).join('\n') + (mentions.length > 8 ? `\n  … ${mentions.length - 8} more` : '');
        return window.confirm(`Delete ${what}?` + (mentions.length
            ? `\nThese lines name its keys, and need another key once it is gone:\n${shown}` : ''));
    };
    const removeColumn = () => {
        if (!confirmDelete(`column ${column.col} of ${column.zone}`, keysOf(column.col))) return;
        tryWrite(`delete ${column.col}`, () => deleteColumn(text, column.zone, column.col), () => onSelect(null));
    };
    const removeRow = () => {
        if (!column.row || !confirmDelete(`row ${column.row} of ${column.zone}, in all its columns`, keysOf(undefined, column.row))) return;
        tryWrite(`delete ${column.row}`, () => deleteRow(text, column.zone, column.row!), () => onSelect({...column, row: undefined}));
    };

    const [tab, setTabState] = useState<Tab>(lastTab);
    const setTab = (next: Tab) => { lastTab = next; setTabState(next); };
    const keySites = useMemo(() => column.row
        ? Object.fromEntries((['width', 'height', 'rotate', 'shift', 'skip'] as KeyAttr[])
            .map(attr => [attr, findKeySite(text, column.zone, column.col, column.row!, attr)])) as Record<KeyAttr, Site>
        : null, [text, column.zone, column.col, column.row]);
    const setKey = (row: string, attr: KeyAttr, value: string, site?: Site) => {
        const at = site ?? findKeySite(text, column.zone, column.col, row, attr);
        if (typeof at === 'string') return setNote(`Can't set ${attr}: ${at}`);
        if (value === (at.raw ?? '')) return;
        onCommit(applyEdits(text, [{site: at, value}]));
    };
    const commitKey = (attr: KeyAttr) => {
        const draft = drafts[`key.${attr}`]?.trim();
        if (draft === undefined || !keySites || !column.row) return;
        setDrafts({...drafts, [`key.${attr}`]: undefined});
        if (draft !== '') setKey(column.row, attr, draft, keySites[attr]);
    };
    const shiftRaw = keySites && typeof keySites.shift !== 'string' ? splitShift(keySites.shift.raw) : null;
    const commitShift = () => {
        if (!keySites || !column.row || typeof keySites.shift === 'string') return;
        const x = drafts['key.shiftX']?.trim(), y = drafts['key.shiftY']?.trim();
        if (x === undefined && y === undefined) return;
        setDrafts({...drafts, 'key.shiftX': undefined, 'key.shiftY': undefined});
        if (keySites.shift.raw !== undefined && !shiftRaw) return setNote("Can't set the shift: it is not written [x, y]");
        setKey(column.row, 'shift', `[${x || shiftRaw?.[0] || '0'}, ${y || shiftRaw?.[1] || '0'}]`, keySites.shift);
    };
    // the column's keys that are skipped (on both halves): shown to be brought back
    const hidden = zone.rows.filter(row => keysOf(column.col, row).length === 0);

    const input = (key: string, value: string, placeholder: string, disabled: string | false, commit: () => void) => (
        <input
            value={drafts[key] ?? value}
            placeholder={placeholder}
            disabled={!!disabled}
            title={disabled ? `Can't edit here: ${disabled}` : undefined}
            onChange={e => setDrafts({...drafts, [key]: e.target.value})}
            onKeyDown={e => e.key === 'Enter' && commit()}
            onBlur={commit}
        />
    );

    // a label, a box, and the unit after it
    const field = (label: string, key: string, value: string, placeholder: string, disabled: string | false,
                   commit: () => void, unit = '', title?: string) => (
        <label key={key} className="field" title={title}>
            <span className="label">{label}</span>
            {input(key, value, placeholder, disabled, commit)}
            <span className="unit">{unit}</span>
        </label>
    );
    const rawOf = (site: Site) => typeof site === 'string' ? '' : site.raw ?? '';
    const reason = (site: Site) => typeof site === 'string' && site;
    const isZoneRow = !!column.row && zone.rows.includes(column.row);
    const shown: Tab = (tab === 'key' && !keySites) || (tab === 'row' && !isZoneRow) ? 'column' : tab;
    useEffect(() => onTab?.(shown), [shown]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Card onPointerDown={e => e.stopPropagation()}>
            <div className="head">
                <div className="names">
                    <strong title={keyMeta?.name}>{keyMeta?.name ?? `${column.zone} / ${column.col}`}</strong>
                    <small>zone {column.zone} · {column.col}{column.row ? ` · ${column.row}` : ''}{column.mirrored ? ' · mirrored' : ''}</small>
                </div>
                <button title={folded ? 'Show the panel' : 'Fold the panel away'} onClick={() => onFold(!folded)}>{folded ? '▸' : '▾'}</button>
            </div>
            {!folded && <>
                <div className="tabs" role="tablist">
                    {TABS.map(([value, label]) => (
                        <button key={value} role="tab" aria-selected={shown === value} className={shown === value ? 'on' : ''}
                                disabled={(value === 'key' && !keySites) || (value === 'row' && !isZoneRow)}
                                onClick={() => setTab(value)}>{label}</button>
                    ))}
                </div>
                <div className="body">
                    {shown === 'key' && keySites && <>
                        <div className="about">This key only{column.mirrored ? ', on both halves' : ''}. Empty boxes show what it gets from its column and zone.</div>
                        {field('Width', 'key.width', rawOf(keySites.width), keyMeta ? format(keyMeta.width) : '', reason(keySites.width), () => commitKey('width'), 'mm')}
                        {field('Height', 'key.height', rawOf(keySites.height), keyMeta ? format(keyMeta.height) : '', reason(keySites.height), () => commitKey('height'), 'mm')}
                        {field('Rotate', 'key.rotate', rawOf(keySites.rotate), keyMeta ? format(keyMeta.rotate) : '', reason(keySites.rotate), () => commitKey('rotate'), '°')}
                        {(['X', 'Y'] as const).map((axis, i) => field(`Shift ${axis}`, `key.shift${axis}`, shiftRaw?.[i] ?? '',
                            keyMeta ? format(keyMeta.shift?.[i] ?? 0) : '0', reason(keySites.shift), commitShift, 'mm', "in the key's own frame"))}
                        <div className="actions">
                            <span className="gap"/>
                            <button className="danger" title="Skip this key: ergogen leaves it out" onClick={() => setKey(column.row!, 'skip', 'true', keySites.skip)}>Hide key</button>
                        </div>
                    </>}
                    {shown === 'column' && <>
                        {ATTRS.map(attr => field(attr[0].toUpperCase() + attr.slice(1), attr, rawOf(sites[attr]),
                            effective ? format(effective[attr]) : '', reason(sites[attr]), () => commitAttr(attr), UNITS[attr]))}
                        {hidden.length > 0 && (
                            <div className="chips">
                                Hidden keys
                                {hidden.map(row => (
                                    <button key={row} title={`Bring back the key in ${row}: skip: false`} onClick={() => setKey(row, 'skip', 'false')}>{row} ↺</button>
                                ))}
                            </div>
                        )}
                        <div className="actions">
                            <button title="A new column to the left of this one" onClick={() => addColumn(false)}>+ Left</button>
                            <button title="A new column to the right of this one" onClick={() => addColumn(true)}>+ Right</button>
                            <span className="gap"/>
                            <button className="danger" title={`Delete column ${column.col}`} onClick={removeColumn}>Delete</button>
                        </div>
                    </>}
                    {shown === 'row' && <>
                        <div className="about">Row {column.row} runs through every column of zone {column.zone}.</div>
                        <div className="actions">
                            <button title="A new row above this one, in every column" onClick={() => addRow(true)}>+ Above</button>
                            <button title="A new row below this one, in every column" onClick={() => addRow(false)}>+ Below</button>
                            <span className="gap"/>
                            <button className="danger" title={`Delete row ${column.row}`} onClick={removeRow}>Delete</button>
                        </div>
                    </>}
                    {shown === 'zone' && <>
                        <div className="about">Where zone {column.zone} starts: its anchor's shift.</div>
                        {(['X', 'Y'] as const).map((axis, i) => field(`Anchor ${axis}`, `anchor${axis}`,
                            typeof anchor === 'string' ? '' : anchor.raw[i] ?? '', '0', typeof anchor === 'string' && anchor, commitAnchor, 'mm'))}
                    </>}
                    {note && <div className="note">{note}</div>}
                </div>
            </>}
        </Card>
    );
};

export default ColumnPanel;
