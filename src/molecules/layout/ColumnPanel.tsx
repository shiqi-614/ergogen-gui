import React, {useEffect, useMemo, useState} from "react";
import yaml from "js-yaml";
import {
    ATTRS, Attr, Edit, KeyAttr, addMirror, addZone, applyEdits, deleteColumn, deleteMirror, deleteRow, deleteZone,
    findAnchorShift, findChildValue, findKeySite, findSite, findValue, formatLength, insertEntry, keyMentions, nextName,
    parseLength, splitShift,
} from "../../utils/layoutEdit";
import {Column, Meta, Site, Units, editableLength, format} from "./geometry";
import styled from "styled-components";
import {About, Actions, Button, CardHead, CardShell, CardTabs, Check, Chips, Field, Gap, Section, Status} from "../../ui";
import {Dialog} from "../../ui";

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
    // every key of the board, by zone (the source half's names), for a zone's anchor and the mirror's
    boardKeys?: { zone: string, name: string }[],
};

// What the panel shows: the picked key's own settings, its column's, its row's or its zone's. The tab picked
// stays from key to key.
export type Tab = 'key' | 'column' | 'row' | 'zone';
const TABS: [Tab, string][] = [['key', 'Key'], ['column', 'Column'], ['row', 'Row'], ['zone', 'Zone']];
let lastTab: Tab = 'column';

// at the layout editor's top right
const Card = styled(CardShell)`
  top: 0.75rem;
  right: 0.75rem;
  width: 16rem;
`;

const ColumnPanel = ({column, text, units, effective, next, onCommit, folded, onFold, keysOf, onSelect, keyMeta, onTab, boardKeys = []}: PanelProps) => {
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
            const points = (yaml.load(text) as any)?.points;
            const z = points?.zones?.[column.zone];
            return {columns: Object.keys(z?.columns ?? {}), rows: Object.keys(z?.rows ?? {}), zones: Object.keys(points?.zones ?? {}),
                mirrored: points?.mirror !== undefined && points?.mirror !== null};
        } catch (e: unknown) {
            return {columns: [], rows: [], zones: [], mirrored: false};
        }
    }, [text, column.zone]);
    // where the zone starts and how it turns, and the whole board's mirror
    const zonePathOf = ['points', 'zones', column.zone];
    const zoneSites = useMemo(() => ({
        ref: findChildValue(text, zonePathOf, 'anchor', 'ref'),
        anchorRotate: findChildValue(text, zonePathOf, 'anchor', 'rotate'),
        rotate: findValue(text, zonePathOf, 'rotate'),
        mirrorRef: zone.mirrored ? findValue(text, ['points', 'mirror'], 'ref') : null,
        mirrorDistance: zone.mirrored ? findValue(text, ['points', 'mirror'], 'distance') : null,
    }), [text, column.zone, zone.mirrored]); // eslint-disable-line react-hooks/exhaustive-deps
    const [newZone, setNewZone] = useState<{ name: string, ref: string, x: string, y: string } | null>(null);
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

    const setSite = (site: Site | null, value: string, what: string) => {
        if (!site) return;
        if (typeof site === 'string') return setNote(`Can't set ${what}: ${site}`);
        if (value === (site.raw ?? '')) return;
        onCommit(applyEdits(text, [{site, value}]));
    };
    const commitDraft = (key: string, site: Site | null, what: string) => {
        const typed = drafts[key]?.trim();
        if (typed === undefined) return;
        setDrafts({...drafts, [key]: undefined});
        if (typed !== '') setSite(site, typed, what);
    };
    // the keys a zone can start from: those of the zones before it in the config (ergogen makes them in order)
    const anchorKeys = boardKeys.filter(k => zone.zones.indexOf(k.zone) < zone.zones.indexOf(column.zone)).map(k => k.name);
    const createZone = () => {
        if (!newZone) return;
        const name = newZone.name.trim();
        if (!/^[A-Za-z_][\w-]*$/.test(name)) return setNote('Name the zone with letters, digits, _ or -');
        if (zone.zones.includes(name)) return setNote(`There already is a zone called ${name}`);
        // after the last zone, so it can start from any key
        tryWrite('add a zone', () => addZone(text, name, zone.zones[zone.zones.length - 1], newZone.ref, [newZone.x.trim() || '0', newZone.y.trim() || '0']),
            () => { setNewZone(null); onSelect({zone: name, col: 'col0', row: 'row0'}); });
    };
    const removeZone = () => {
        if (!confirmDelete(`zone ${column.zone} with all its keys`, keysOf())) return;
        tryWrite(`delete ${column.zone}`, () => deleteZone(text, column.zone), () => onSelect(null));
    };
    const toggleMirror = (on: boolean) => {
        if (on) return tryWrite('mirror the board', () => addMirror(text, keyMeta?.name.replace(/^mirror_/, '') ?? boardKeys[0]?.name ?? '', '0'), () => {});
        const mirroredKeys = boardKeys.map(k => `mirror_${k.name}`);
        if (!confirmDelete('the mirror: the other half goes', mirroredKeys)) return;
        tryWrite('stop mirroring', () => deleteMirror(text), () => onSelect({...column, mirrored: false}));
    };

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
        <Field key={key} label={label} unit={unit} title={title}>
            {input(key, value, placeholder, disabled, commit)}
        </Field>
    );
    const rawOf = (site: Site) => typeof site === 'string' ? '' : site.raw ?? '';
    const reason = (site: Site) => typeof site === 'string' && site;
    const isZoneRow = !!column.row && zone.rows.includes(column.row);
    const shown: Tab = (tab === 'key' && !keySites) || (tab === 'row' && !isZoneRow) ? 'column' : tab;
    useEffect(() => onTab?.(shown), [shown]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Card onPointerDown={e => e.stopPropagation()}>
            <CardHead title={keyMeta?.name ?? `${column.zone} / ${column.col}`} folded={folded} onFold={onFold}
                      subtitle={`zone ${column.zone} · ${column.col}${column.row ? ` · ${column.row}` : ''}${column.mirrored ? ' · mirrored' : ''}`}/>
            {!folded && <>
                <CardTabs value={shown} onChange={setTab} tabs={TABS.map(([value, label]) => ({
                    value, label, disabled: (value === 'key' && !keySites) || (value === 'row' && !isZoneRow)}))}/>
                <div className="body">
                    {shown === 'key' && keySites && <>
                        <About>This key only{column.mirrored ? ', on both halves' : ''}. Empty boxes show what it gets from its column and zone.</About>
                        {field('Width', 'key.width', rawOf(keySites.width), keyMeta ? format(keyMeta.width) : '', reason(keySites.width), () => commitKey('width'), 'mm')}
                        {field('Height', 'key.height', rawOf(keySites.height), keyMeta ? format(keyMeta.height) : '', reason(keySites.height), () => commitKey('height'), 'mm')}
                        {field('Rotate', 'key.rotate', rawOf(keySites.rotate), keyMeta ? format(keyMeta.rotate) : '', reason(keySites.rotate), () => commitKey('rotate'), '°')}
                        {(['X', 'Y'] as const).map((axis, i) => field(`Shift ${axis}`, `key.shift${axis}`, shiftRaw?.[i] ?? '',
                            keyMeta ? format(keyMeta.shift?.[i] ?? 0) : '0', reason(keySites.shift), commitShift, 'mm', "in the key's own frame"))}
                        <Actions>
                            <Gap/>
                            <Button $variant="danger" title="Skip this key: ergogen leaves it out" onClick={() => setKey(column.row!, 'skip', 'true', keySites.skip)}>Hide key</Button>
                        </Actions>
                    </>}
                    {shown === 'column' && <>
                        {ATTRS.map(attr => field(attr[0].toUpperCase() + attr.slice(1), attr, rawOf(sites[attr]),
                            effective ? format(effective[attr]) : '', reason(sites[attr]), () => commitAttr(attr), UNITS[attr]))}
                        {hidden.length > 0 && (
                            <Chips>
                                Hidden keys
                                {hidden.map(row => (
                                    <Button key={row} title={`Bring back the key in ${row}: skip: false`} onClick={() => setKey(row, 'skip', 'false')}>{row} ↺</Button>
                                ))}
                            </Chips>
                        )}
                        <Actions>
                            <Button title="A new column to the left of this one" onClick={() => addColumn(false)}>+ Left</Button>
                            <Button title="A new column to the right of this one" onClick={() => addColumn(true)}>+ Right</Button>
                            <Gap/>
                            <Button $variant="danger" title={`Delete column ${column.col}`} onClick={removeColumn}>Delete</Button>
                        </Actions>
                    </>}
                    {shown === 'row' && <>
                        <About>Row {column.row} runs through every column of zone {column.zone}.</About>
                        <Actions>
                            <Button title="A new row above this one, in every column" onClick={() => addRow(true)}>+ Above</Button>
                            <Button title="A new row below this one, in every column" onClick={() => addRow(false)}>+ Below</Button>
                            <Gap/>
                            <Button $variant="danger" title={`Delete row ${column.row}`} onClick={removeRow}>Delete</Button>
                        </Actions>
                    </>}
                    {shown === 'zone' && <>
                        <About>Where zone {column.zone} starts (a key of an earlier zone, and a shift from it) and how it turns.</About>
                        <Field label="From key" title="the key it starts from; its shift and rotate are in that key's frame">
                            <select value={rawOf(zoneSites.ref)} disabled={typeof zoneSites.ref === 'string'}
                                    onChange={e => e.target.value && setSite(zoneSites.ref, e.target.value, 'the anchor key')}>
                                {!rawOf(zoneSites.ref) && <option value="">the origin</option>}
                                {rawOf(zoneSites.ref) && !anchorKeys.includes(rawOf(zoneSites.ref)) && <option value={rawOf(zoneSites.ref)}>{rawOf(zoneSites.ref)}</option>}
                                {anchorKeys.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </Field>
                        {(['X', 'Y'] as const).map((axis, i) => field(`Shift ${axis}`, `anchor${axis}`,
                            typeof anchor === 'string' ? '' : anchor.raw[i] ?? '', '0', typeof anchor === 'string' && anchor, commitAnchor, 'mm'))}
                        {field('Turn', 'zone.anchorRotate', rawOf(zoneSites.anchorRotate), '0', reason(zoneSites.anchorRotate),
                            () => commitDraft('zone.anchorRotate', zoneSites.anchorRotate, 'the anchor rotate'), '°', "the anchor's rotate: the zone turns about where it starts")}
                        {field('Rotate', 'zone.rotate', rawOf(zoneSites.rotate), '0', reason(zoneSites.rotate),
                            () => commitDraft('zone.rotate', zoneSites.rotate, 'the zone rotate'), '°', 'the zone\'s rotate: its keys turn about the origin')}
                        <Actions>
                            <Button title="A new zone of one key, starting from this key" onClick={() => setNewZone({
                                name: nextName(zone.zones, 'zone'), ref: keyMeta?.name.replace(/^mirror_/, '') ?? anchorKeys[0] ?? '', x: '0', y: '-1.5u'})}>+ Zone</Button>
                            <Gap/>
                            <Button $variant="danger" title={`Delete zone ${column.zone}`} onClick={removeZone}>Delete</Button>
                        </Actions>
                        <Section>Mirror, for the other half</Section>
                        <Check className="check">
                            <input type="checkbox" checked={zone.mirrored} onChange={e => toggleMirror(e.target.checked)}/>
                            {zone.mirrored ? 'the board is mirrored' : 'mirror the board (a split or a unibody with two halves)'}
                        </Check>
                        {zone.mirrored && <>
                            <Field label="Axis key" title="the key the mirror's axis is lined up with">
                                <select value={rawOf(zoneSites.mirrorRef)} disabled={typeof zoneSites.mirrorRef === 'string'}
                                        onChange={e => e.target.value && setSite(zoneSites.mirrorRef, e.target.value, 'the mirror key')}>
                                    {rawOf(zoneSites.mirrorRef) && !boardKeys.some(k => k.name === rawOf(zoneSites.mirrorRef)) &&
                                        <option value={rawOf(zoneSites.mirrorRef)}>{rawOf(zoneSites.mirrorRef)}</option>}
                                    {boardKeys.map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
                                </select>
                            </Field>
                            {field('Distance', 'mirror.distance', rawOf(zoneSites.mirrorDistance), '0', reason(zoneSites.mirrorDistance),
                                () => commitDraft('mirror.distance', zoneSites.mirrorDistance, 'the mirror distance'), 'mm',
                                'between the axis key and its mirror image; negative brings the halves together')}
                        </>}
                    </>}
                    {note && <Status>{note}</Status>}
                </div>
            </>}
            {newZone && (
                <Dialog title="New zone" onClose={() => setNewZone(null)}>
                    <Field label="Name">
                        <input autoFocus value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})}
                               onKeyDown={e => e.key === 'Enter' && createZone()}/>
                    </Field>
                    <Field label="Starts at">
                        <select value={newZone.ref} onChange={e => setNewZone({...newZone, ref: e.target.value})}>
                            {boardKeys.map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Shift" unit="mm">
                        <div className="controls">
                            x <input className="short" value={newZone.x} onChange={e => setNewZone({...newZone, x: e.target.value})}/>
                            y <input className="short" value={newZone.y} onChange={e => setNewZone({...newZone, y: e.target.value})}/>
                        </div>
                    </Field>
                    <div className="hint">one key (col0, row0) to start with: add columns and rows on the panel, Alt-drag it into place</div>
                    {note && <div className="note">{note}</div>}
                    <div className="buttons">
                        <Button onClick={() => setNewZone(null)}>Cancel</Button>
                        <Button $variant="go" onClick={createZone}>Add</Button>
                    </div>
                </Dialog>
            )}
        </Card>
    );
};

export default ColumnPanel;
