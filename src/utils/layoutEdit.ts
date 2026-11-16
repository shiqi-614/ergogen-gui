import {parseDocument} from "yaml";
import {Alias, Pair, Scalar, YAMLMap, YAMLSeq} from "yaml/types";

// Column attributes the layout editor can change
export type Attr = 'stagger' | 'spread' | 'splay';
export const ATTRS: Attr[] = ['stagger', 'spread', 'splay'];

// Where a column attribute lives in the config text. Writing a value replaces
// text[start, end) with render(value); everything else in the text stays as typed.
export type EditSite = {
    start: number,
    end: number,
    // the value as written at column level, undefined when the column doesn't set it
    raw?: string,
    render: (value: string) => string,
};

export type Edit = { site: EditSite, value: string };

const isBlockMap = (node: unknown): node is YAMLMap =>
    node instanceof YAMLMap && node.type === 'MAP';

const findPair = (map: YAMLMap, key: string): Pair | undefined =>
    (map.items as Pair[]).find(pair => pair.key instanceof Scalar && String(pair.key.value) === key);

const columnOf = (text: string, offset: number) => offset - text.lastIndexOf('\n', offset - 1) - 1;

const endOfLine = (text: string, offset: number) => {
    const end = text.indexOf('\n', offset);
    return end === -1 ? text.length : end;
};

const replaceScalar = (text: string, node: unknown): EditSite | string => {
    const range = node instanceof Scalar ? node.cstNode?.valueRange : null;
    if (!range) return 'it is not a plain value';
    return {start: range.start, end: range.end, raw: text.slice(range.start, range.end), render: v => v};
};

// a new "line: value" in front of the first entry of a block map, at its indentation
const insertInto = (text: string, map: YAMLMap, line: string): EditSite | string => {
    const first = map.items[0] as Pair | undefined;
    const start = first?.key instanceof Scalar ? first.key.range?.[0] : undefined;
    if (start === undefined) return 'its map is empty';
    const indent = ' '.repeat(columnOf(text, start));
    return {start, end: start, render: v => `${line}: ${v}\n${indent}`};
};

// Finds points.zones.<zone>.columns.<col>.key.<attr> in the config text, written either
// nested (key: {stagger: 1}) or dotted (key.stagger: 1). If the column doesn't set it,
// the site inserts it. Returns a reason when the config is shaped in a way this can't edit.
export const findSite = (text: string, zone: string, col: string, attr: Attr): EditSite | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const columns = doc.getIn(['points', 'zones', zone, 'columns'], true);
    if (!isBlockMap(columns)) return `points.zones.${zone}.columns is not a plain map`;
    const colPair = findPair(columns, col);
    if (!colPair) return `column ${col} is not written out in the config`;

    const colNode = colPair.value;
    if (colNode === null) {
        // "col1:" with nothing under it
        const keyStart = (colPair.key as Scalar).range?.[0] ?? 0;
        const at = endOfLine(text, keyStart);
        const indent = ' '.repeat(columnOf(text, keyStart) + 2);
        return {start: at, end: at, render: v => `\n${indent}key.${attr}: ${v}`};
    }
    if (!isBlockMap(colNode)) return `column ${col} is not a plain map`;

    const keyPair = findPair(colNode, 'key');
    const keyMap = isBlockMap(keyPair?.value) ? keyPair?.value as YAMLMap : undefined;
    const nested = keyMap && findPair(keyMap, attr);
    if (nested) return replaceScalar(text, nested.value);
    const dotted = findPair(colNode, `key.${attr}`);
    if (dotted) return replaceScalar(text, dotted.value);
    if (keyMap) return insertInto(text, keyMap, attr);
    if (keyPair) return `the key of column ${col} is not a plain map`;
    return insertInto(text, colNode, `key.${attr}`);
};

// Finds points.zones.<zone>.anchor.shift, nested or dotted, as a two-number list.
// The edits write both numbers, adding the shift (or the whole anchor) when it is missing.
export type AnchorShift = {
    raw: [string | undefined, string | undefined],
    edits: (x: string, y: string) => Edit[],
};

const insertShift = (site: EditSite | string): AnchorShift | string => typeof site === 'string' ? site : {
    raw: [undefined, undefined],
    edits: (x, y) => [{site, value: `[${x}, ${y}]`}],
};

const shiftList = (text: string, node: unknown): AnchorShift | string => {
    if (!(node instanceof YAMLSeq) || node.items.length !== 2) return 'its shift is not an [x, y] list';
    const [x, y] = node.items.map(item => replaceScalar(text, item));
    if (typeof x === 'string' || typeof y === 'string') return 'its shift is not an [x, y] list of values';
    return {raw: [x.raw, y.raw], edits: (vx, vy) => [{site: x, value: vx}, {site: y, value: vy}]};
};

export const findAnchorShift = (text: string, zone: string): AnchorShift | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const zones = doc.getIn(['points', 'zones'], true);
    if (!isBlockMap(zones)) return 'points.zones is not a plain map';
    const zoneNode = findPair(zones, zone)?.value;
    if (!isBlockMap(zoneNode)) return `zone ${zone} is not a plain map`;

    const dotted = findPair(zoneNode, 'anchor.shift');
    if (dotted) return shiftList(text, dotted.value);
    const anchorPair = findPair(zoneNode, 'anchor');
    if (!anchorPair) return insertShift(insertInto(text, zoneNode, 'anchor.shift'));
    if (!isBlockMap(anchorPair.value)) return `the anchor of zone ${zone} is not a plain map`;
    const shiftPair = findPair(anchorPair.value, 'shift');
    if (!shiftPair) return insertShift(insertInto(text, anchorPair.value, 'shift'));
    return shiftList(text, shiftPair.value);
};

// The shift of the anchor at path, like an outline polygon's point or a part's where.
// A "<<: *name" merge without its own shift leads to the anchor it merges in: changing that
// moves everything else that merges it too, which is what sharing it in the config means.
export const findShift = (text: string, path: (string | number)[]): AnchorShift | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    let node = doc.getIn(path, true);
    for (let hops = 0; hops < 5; hops++) {
        if (!isBlockMap(node)) return `${path.join('.')} is not a plain map`;
        const shiftPair = findPair(node, 'shift');
        if (shiftPair) return shiftList(text, shiftPair.value);
        const merged = findPair(node, '<<')?.value;
        if (!(merged instanceof Alias)) return insertShift(insertInto(text, node, 'shift'));
        node = merged.source;
    }
    return `${path.join('.')} merges too deep`;
};

// A length as written in the config: a number of millimetres, or a number of a unit ("2.5kx", "u")
export type Length = { mm: number, unit?: string, scale?: number };

export const parseLength = (raw: string, units: Record<string, number>): Length | null => {
    const text = raw.trim();
    if (isPlainNumber(text)) return {mm: Number(text)};
    const match = /^(-?\d*\.?\d+)?\s*([A-Za-z_$][\w$]*)$/.exec(text);
    const scale = match && units[match[2]];
    if (!match || typeof scale !== 'number') return null;
    const count = match[1] === undefined ? 1 : Number(match[1]);
    return {mm: count * scale, unit: match[2], scale};
};

const trim = (value: number, digits = 2) => String(Number(value.toFixed(digits)));

const plus = (head: string, value: number, digits = 2) => `${head} ${value < 0 ? '-' : '+'} ${trim(Math.abs(value), digits)}`;

// Moves a written coordinate by delta millimetres and keeps how it was written: "12" -> "13.5",
// "0.8kx" -> "0.9kx", "1ky + 12" -> "1ky + 13.5". With exact (a snapped point, which has to land
// exactly in line), numbers keep up to 6 decimals, and a unit value the move doesn't leave at a
// round number of units becomes "0.8kx + 1.2" rather than being rounded.
export const nudge = (raw: string | undefined, delta: number, units: Record<string, number>, exact = false): string => {
    const digits = exact ? 6 : 2;
    if (raw === undefined) return trim(delta, digits);
    const length = parseLength(raw, units);
    if (length?.unit && length.scale) {
        const count = (length.mm + delta) / length.scale;
        const rounded = Number(count.toFixed(2));
        if (!exact || Math.abs(rounded - count) < 1e-9) return `${trim(rounded)}${length.unit}`;
        return plus(raw.trim(), delta, digits);
    }
    if (length) return trim(length.mm + delta, digits);
    const sum = /^(.*\S)\s*([+-])\s*(\d*\.?\d+)$/.exec(raw.trim());
    if (sum) return plus(sum[1], (sum[2] === '-' ? -1 : 1) * Number(sum[3]) + delta, digits);
    return plus(raw.trim(), delta, digits);
};

// writes millimetres the way the original value was written
export const formatLength = (mm: number, like?: Length | null) =>
    like?.unit && like.scale ? `${trim(mm / like.scale)}${like.unit}` : trim(mm);

// The settings of an outline part the layout editor can change
export type PartAttr = 'operation' | 'expand' | 'joints' | 'fillet';
export const PART_ATTRS: PartAttr[] = ['operation', 'expand', 'joints', 'fillet'];

export type PartSites = { key: string | number, what: string, sites: Record<PartAttr, EditSite | string> };

// Finds the parts of outlines.<name> (a list, or a map of named parts) and where each of their
// settings is written. A missing setting goes on a new line after the part's "what".
export const findPartSites = (text: string, outline: string): PartSites[] | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const node = doc.getIn(['outlines', outline], true);
    let parts: [string | number, unknown][];
    if (node instanceof YAMLSeq) parts = node.items.map((item, i) => [i, item]);
    else if (isBlockMap(node)) parts = (node.items as Pair[]).map(pair => [String((pair.key as Scalar)?.value), pair.value]);
    else return `outlines.${outline} is not a list or a map of parts`;

    return parts.map(([key, part]) => {
        const what = isBlockMap(part) ? findPair(part, 'what') : undefined;
        const sites = Object.fromEntries(PART_ATTRS.map(attr => {
            if (!isBlockMap(part)) return [attr, 'the part is not a plain map'];
            const pair = findPair(part, attr);
            if (pair) return [attr, replaceScalar(text, pair.value)];
            const whatKey = what?.key instanceof Scalar ? what.key.range : null;
            if (what && whatKey) {
                const at = endOfLine(text, whatKey[0]);
                const indent = ' '.repeat(columnOf(text, whatKey[0]));
                return [attr, {start: at, end: at, render: (v: string) => `\n${indent}${attr}: ${v}`} as EditSite];
            }
            return [attr, insertInto(text, part, attr)];
        })) as Record<PartAttr, EditSite | string>;
        const whatValue = what?.value instanceof Scalar ? String(what.value.value) : 'outline';
        return {key, what: whatValue, sites};
    });
};

export type NewPoint = { ref: string, shift: [string, string] };

// Adds a polygon outline at the end of the outlines section (or a new outlines section at the
// end of the config), in the same ref + shift form as hand-written ones, so it follows its keys
export const addOutline = (text: string, name: string, points: NewPoint[]): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    if (!/^[A-Za-z_][\w-]*$/.test(name)) throw new Error(`"${name}" can't be an outline name`);
    const outlines = doc.get('outlines', true);
    if (outlines !== undefined && outlines !== null && !isBlockMap(outlines)) throw new Error('outlines is not a plain map');
    if (isBlockMap(outlines) && findPair(outlines, name)) throw new Error(`there already is an outline called ${name}`);

    const first = isBlockMap(outlines) ? (outlines.items[0] as Pair | undefined)?.key : undefined;
    const indent = first instanceof Scalar && first.range ? columnOf(text, first.range[0]) : 2;
    const pad = (n: number) => ' '.repeat(indent + n);
    const body = [
        `${pad(0)}${name}:`,
        `${pad(2)}- what: polygon`,
        `${pad(4)}points:`,
        ...points.flatMap(p => [`${pad(6)}- ref: ${p.ref}`, `${pad(8)}shift: [${p.shift[0]}, ${p.shift[1]}]`]),
    ].join('\n') + '\n';

    if (isBlockMap(outlines) && outlines.range) {
        // after the last outline, but before the blank lines that separate it from what follows
        let at = outlines.range[1];
        // the map can end partway into a line of spaces: start from the beginning of that line
        const lineOfEnd = text.lastIndexOf('\n', at - 1) + 1;
        if (/^[ \t]*$/.test(text.slice(lineOfEnd, at))) at = lineOfEnd;
        // step back over blank (or only-spaces) lines, so they keep separating it from what follows
        while (at > 0 && text[at - 1] === '\n') {
            const lineStart = text.lastIndexOf('\n', at - 2) + 1;
            if (lineStart === 0 || !/^[ \t]*\n$/.test(text.slice(lineStart, at))) break;
            at = lineStart;
        }
        if (at > 0 && text[at - 1] !== '\n') return text.slice(0, at) + '\n' + body + text.slice(at);
        return text.slice(0, at) + body + text.slice(at);
    }
    const ending = text.endsWith('\n') ? '' : '\n';
    return `${text}${ending}outlines:\n${body}`;
};

export const applyEdits = (text: string, edits: Edit[]) =>
    [...edits]
        .sort((a, b) => b.site.start - a.site.start)
        .reduce((out, {site, value}) => out.slice(0, site.start) + site.render(value) + out.slice(site.end), text);

export const isPlainNumber = (raw: string) => /^-?\d+(\.\d+)?$/.test(raw.trim());
