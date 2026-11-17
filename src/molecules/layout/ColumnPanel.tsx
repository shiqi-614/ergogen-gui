import {useEffect, useMemo, useState} from "react";
import {ATTRS, Attr, Edit, applyEdits, findAnchorShift, findSite, formatLength, parseLength} from "../../utils/layoutEdit";
import {Column, Site, Units, editableLength, format} from "./geometry";
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
};

const ColumnPanel = ({column, text, units, effective, next, onCommit, folded, onFold}: PanelProps) => {
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

    return (
        <Panel onPointerDown={e => e.stopPropagation()}>
            <div className="title">
                <div className="name">
                    <button className="fold" title={folded ? 'Show the panel' : 'Fold the panel away'} onClick={() => onFold(!folded)}>{folded ? '▸' : '▾'}</button>
                    <h4>{column.zone} / {column.col}</h4>
                </div>
            </div>
            {!folded && <>
            {ATTRS.map(attr => {
                const site = sites[attr];
                const disabled = typeof site === 'string' && site;
                return (
                    <label key={attr}>
                        <span>{attr} ({UNITS[attr]})</span>
                        {input(attr, typeof site === 'string' ? '' : site.raw ?? '', effective ? format(effective[attr]) : '', disabled, () => commitAttr(attr))}
                    </label>
                );
            })}
            <h4>zone {column.zone} anchor shift</h4>
            {(['x', 'y'] as const).map((axis, i) => (
                <label key={axis}>
                    <span>{axis}</span>
                    {input(`anchor${axis.toUpperCase()}`, typeof anchor === 'string' ? '' : anchor.raw[i] ?? '', '0',
                        typeof anchor === 'string' && anchor, commitAnchor)}
                </label>
            ))}
            </>}
        </Panel>
    );
};

export default ColumnPanel;
