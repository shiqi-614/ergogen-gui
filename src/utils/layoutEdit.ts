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

// What one key sets for itself
export type KeyAttr = 'width' | 'height' | 'rotate' | 'shift' | 'skip';

// Finds what key <zone>_<col>_<row> sets for itself: points.zones.<zone>.columns.<col>.rows.<row>.<attr>, in
// any of the ways it can be written (rows: {row1: {width: 2}}, rows.row1: {width: 2}, rows.row1.width: 2,
// rows: {row1.width: 2}). If the key doesn't set it, the site adds it next to what the key does set, else as
// rows.<row>.<attr> in the column. A shift's site is its whole [x, y] list.
export const findKeySite = (text: string, zone: string, col: string, row: string, attr: KeyAttr): EditSite | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const columns = doc.getIn(['points', 'zones', zone, 'columns'], true);
    if (!isBlockMap(columns)) return `points.zones.${zone}.columns is not a plain map`;
    const colPair = findPair(columns, col);
    if (!colPair) return `column ${col} is not written out in the config`;
    const line = `rows.${row}.${attr}`;
    if (colPair.value === null) {
        const keyStart = (colPair.key as Scalar).range?.[0] ?? 0;
        const at = endOfLine(text, keyStart);
        const indent = ' '.repeat(columnOf(text, keyStart) + 2);
        return {start: at, end: at, render: v => `\n${indent}${line}: ${v}`};
    }
    const colMap = colPair.value;
    if (!isBlockMap(colMap)) return `column ${col} is not a plain map`;
    const rowsPair = findPair(colMap, 'rows');
    const rowsMap = isBlockMap(rowsPair?.value) ? rowsPair!.value as YAMLMap : undefined;
    if (rowsPair && rowsPair.value !== null && !rowsMap) return `the rows of column ${col} are not a plain map`;
    // the maps this key's settings can be in, and the prefix they have there
    const own = [findPair(colMap, `rows.${row}`)?.value, rowsMap && findPair(rowsMap, row)?.value]
        .filter((m): m is YAMLMap => isBlockMap(m));
    const places: [YAMLMap, string][] = [[colMap, `rows.${row}.`], ...own.map(m => [m, ''] as [YAMLMap, string])];
    if (rowsMap) places.push([rowsMap, `${row}.`]);
    for (const [map, prefix] of places) {
        const pair = findPair(map, prefix + attr);
        if (!pair) continue;
        if (pair.value instanceof Scalar) return replaceScalar(text, pair.value);
        const range = (pair.value as YAMLSeq | null)?.cstNode?.valueRange;
        if (!range) return `its ${attr} is not a plain value`;
        return {start: range.start, end: range.end, raw: text.slice(range.start, range.end), render: v => v};
    }
    if (own.length) return insertInto(text, own[0], attr);
    if (rowsMap) return insertInto(text, rowsMap, `${row}.${attr}`);
    return insertInto(text, colMap, line);
};

// The two values of a shift written [x, y]
export const splitShift = (raw: string | undefined): [string, string] | null => {
    const m = raw?.trim().match(/^\[([^,\]]*),([^,\]]*)\]$/);
    return m ? [m[1].trim(), m[2].trim()] : null;
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
export const findPartSites = (text: string, outline: string): PartSites[] | string =>
    findItemSites(text, ['outlines', outline], PART_ATTRS) as PartSites[] | string;

// a value as written, a scalar or a flow list or map like [Dwgs.User]: its site
const replaceValue = (text: string, node: unknown): EditSite | string => {
    if (node instanceof Scalar) return replaceScalar(text, node);
    const range = (node instanceof YAMLSeq || node instanceof YAMLMap) && node.type?.startsWith('FLOW') ? node.cstNode?.valueRange : null;
    if (!range) return 'it is not written on one line';
    return {start: range.start, end: range.end, raw: text.slice(range.start, range.end), render: v => v};
};

// The items of a list (or map) at path and where each of the given keys is written in them; a
// missing key goes on a new line after the item's "what"
export const findItemSites = <K extends string>(text: string, path: (string | number)[], attrs: K[]):
    { key: string | number, what: string, sites: Record<K, EditSite | string> }[] | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const node = doc.getIn(path, true);
    let parts: [string | number, unknown][];
    if (node instanceof YAMLSeq) parts = node.items.map((item, i) => [i, item]);
    else if (isBlockMap(node)) parts = (node.items as Pair[]).map(pair => [String((pair.key as Scalar)?.value), pair.value]);
    else return `${path.join('.')} is not a list or a map of parts`;

    return parts.map(([key, part]) => {
        const what = isBlockMap(part) ? findPair(part, 'what') : undefined;
        const sites = Object.fromEntries(attrs.map(attr => {
            if (!isBlockMap(part)) return [attr, 'the part is not a plain map'];
            const pair = findPair(part, attr);
            if (pair) return [attr, replaceValue(text, pair.value)];
            const whatKey = what?.key instanceof Scalar ? what.key.range : null;
            if (what && whatKey) {
                const at = endOfLine(text, whatKey[0]);
                const indent = ' '.repeat(columnOf(text, whatKey[0]));
                return [attr, {start: at, end: at, render: (v: string) => `\n${indent}${attr}: ${v}`} as EditSite];
            }
            return [attr, insertInto(text, part, attr)];
        })) as Record<K, EditSite | string>;
        const whatValue = what?.value instanceof Scalar ? String(what.value.value) : 'outline';
        return {key, what: whatValue, sites};
    });
};

// The lines of each item of the list at path: from the comment lines right above it (they are about it)
// to where the next one's start
const listBlocks = (text: string, path: (string | number)[]): { list: YAMLSeq, blocks: Range[] } => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const list = doc.getIn(path, true);
    if (!(list instanceof YAMLSeq) || list.type !== 'SEQ') throw new Error(`${path.join('.')} is not a list`);
    const starts = list.items.map(item => {
        let start = lineStartOf(text, (item as YAMLMap).range?.[0] ?? 0);
        for (;;) {
            const above = lineStartOf(text, start - 1);
            if (start === 0 || !/^[ \t]*#/.test(text.slice(above, start))) break;
            start = above;
        }
        return start;
    });
    const blocks = starts.map((start, i) => ({start, end: i + 1 < starts.length ? starts[i + 1] : afterNode(text, list.items[i] as YAMLMap)}));
    return {list, blocks};
};

// Moves item index of the list at path by delta places (-1: up, 1: down), its comment with it
export const moveListItem = (text: string, path: (string | number)[], index: number, delta: number): string => {
    const {blocks} = listBlocks(text, path);
    const other = index + delta;
    if (!blocks[index] || !blocks[other]) return text;
    const [a, b] = index < other ? [blocks[index], blocks[other]] : [blocks[other], blocks[index]];
    // the last item's block may lack a line break at the end of the text
    const piece = (r: Range) => { const t = text.slice(r.start, r.end); return t.endsWith('\n') ? t : t + '\n'; };
    const joined = piece(b) + text.slice(a.end, b.start) + piece(a);
    const end = text.slice(b.start, b.end).endsWith('\n') ? joined : joined.slice(0, -1);
    return text.slice(0, a.start) + end + text.slice(b.end);
};

// Deletes item index of the list at path, with the comment lines above it
export const deleteListItem = (text: string, path: (string | number)[], index: number): string => {
    const {blocks} = listBlocks(text, path);
    if (!blocks[index]) throw new Error(`${path.join('.')} has no item ${index}`);
    const shared = anchorsUsedElsewhere(text, blocks[index]);
    if (shared.length) throw new Error(`it defines ${shared.map(a => `&${a}`).join(', ')}, which other parts of the config still use`);
    return removeRanges(text, [blocks[index]]);
};

// Adds an item (lines relative to its "- ") at the end of the list at path, lined up with the others
export const appendListItem = (text: string, path: (string | number)[], lines: string[]): string => {
    const {list, blocks} = listBlocks(text, path);
    const firstKey = ((list.items[0] as YAMLMap)?.items?.[0] as Pair | undefined)?.key;
    const column = firstKey instanceof Scalar && firstKey.range ? columnOf(text, firstKey.range[0]) : undefined;
    if (column === undefined || column < 2) throw new Error(`${path.join('.')} has no item to line the new one up with`);
    const dash = ' '.repeat(column - 2);
    const body = lines.map((line, i) => (i === 0 ? `${dash}- ` : `${dash}  `) + line).join('\n') + '\n';
    const at = blocks[blocks.length - 1].end;
    return text.slice(0, at) + (at > 0 && text[at - 1] !== '\n' ? '\n' : '') + body + text.slice(at);
};

export type NewPoint = { ref: string, shift: [string, string] };

// Adds a polygon outline at the end of the outlines section (or a new outlines section at the
// end of the config), in the same ref + shift form as hand-written ones, so it follows its keys
// Adds <name> with the given lines (relative to the name's indentation) as the last entry of the
// map at path, before the blank lines that separate it from what follows. A missing top-level map
// is started at the end of the config.
export const appendEntry = (text: string, path: string[], name: string, lines: string[]): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    if (!/^[A-Za-z_][\w-]*$/.test(name)) throw new Error(`"${name}" can't be a name here: use letters, digits, _ or -`);
    const map = doc.getIn(path, true);
    if (map !== undefined && map !== null && !isBlockMap(map)) throw new Error(`${path.join('.')} is not a plain map`);
    if (isBlockMap(map) && findPair(map, name)) throw new Error(`there already is a ${path.join('.')}.${name}`);
    if (!isBlockMap(map) && path.length > 1) throw new Error(`the config has no ${path.join('.')} section to add to`);

    const first = isBlockMap(map) ? (map.items[0] as Pair | undefined)?.key : undefined;
    const indent = first instanceof Scalar && first.range ? columnOf(text, first.range[0]) : 2;
    const pad = (n: number) => ' '.repeat(indent + n);
    const body = [`${pad(0)}${name}:`, ...lines.map(line => `${pad(2)}${line}`)].join('\n') + '\n';

    if (isBlockMap(map) && map.range) {
        // after the last entry, but before the blank lines that separate it from what follows
        let at = map.range[1];
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
    return `${text}${ending}${path[0]}:\n${body}`;
};

// Adds outlines.<name> with the given parts
export const appendOutline = (text: string, name: string, lines: string[]): string => {
    if (!/^[A-Za-z_][\w-]*$/.test(name)) throw new Error(`"${name}" can't be an outline name`);
    try {
        return appendEntry(text, ['outlines'], name, lines);
    } catch (e: unknown) {
        throw new Error(String(e instanceof Error ? e.message : e).replace(/^there already is a outlines\./, 'there already is an outline called '));
    }
};

// A part placed on a pcb: what it is (a file in a GitHub repo) and where, as a shift from a key
export const partLines = (repo: string, file: string, ref: string, shift: [string, string]) => [
    'what:',
    '  github:',
    `    repo: "${repo}"`,
    `    file: "${file}"`,
    'where:',
    `  ref: ${ref}`,
    `  shift: [${shift[0]}, ${shift[1]}]`,
];

// A polygon outline in the same ref + shift form as hand-written ones, so it follows its keys
export const addOutline = (text: string, name: string, points: NewPoint[]): string => appendOutline(text, name, [
    '- what: polygon',
    '  points:',
    ...points.flatMap(p => [`    - ref: ${p.ref}`, `      shift: [${p.shift[0]}, ${p.shift[1]}]`]),
]);

// A plate over the keys with a switch cutout in each: 14 mm for MX, 13.8 mm for Choc. On a split
// board it covers one half, the keys whose name doesn't start with "mirror_"; on a unibody, all keys.
export const plateLines = (cutout: number, bothHalves = true) => {
    const where = bothHalves ? 'true' : "'/^(?!mirror_)/'";
    return [
    '- what: rectangle',
    `  where: ${where}`,
    '  size: [1kx, 1ky]',
    '  bound: true',
    '- what: rectangle',
    `  where: ${where}`,
    `  size: ${cutout}`,
    '  operation: subtract',
    ];
};

// the start of the line an offset is on
const lineStartOf = (text: string, offset: number) => text.lastIndexOf('\n', offset - 1) + 1;

// just past the newline that ends a node's last line of content
const afterNode = (text: string, node: { range?: [number, number] | null }) => {
    const [start, end] = node.range ?? [0, 0];
    let last = end;
    while (last > start && /\s/.test(text[last - 1])) last--;
    return Math.min(text.length, endOfLine(text, last) + 1);
};

const pointList = (text: string, path: (string | number)[]): YAMLSeq => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const list = doc.getIn(path, true);
    if (!(list instanceof YAMLSeq) || list.type !== 'SEQ' || !list.items.every(isBlockMap)) {
        throw new Error(`${path.join('.')} is not a list of points`);
    }
    return list;
};

// Inserts a polygon point (ref + shift) at index of the points list at path, as its own list item
export const insertPolygonPoint = (text: string, path: (string | number)[], index: number, point: NewPoint): string => {
    const list = pointList(text, path);
    const items = list.items as YAMLMap[];
    const firstKey = (items[0]?.items[0] as Pair | undefined)?.key;
    const keyColumn = firstKey instanceof Scalar && firstKey.range ? columnOf(text, firstKey.range[0]) : undefined;
    if (keyColumn === undefined || keyColumn < 2) throw new Error(`${path.join('.')} has no point to line the new one up with`);
    const dash = ' '.repeat(keyColumn - 2);
    const lines = `${dash}- ref: ${point.ref}\n${dash}  shift: [${point.shift[0]}, ${point.shift[1]}]\n`;
    const at = index < items.length ? lineStartOf(text, items[index].range?.[0] ?? 0) : afterNode(text, items[items.length - 1]);
    return text.slice(0, at) + lines + text.slice(at);
};

// Removes the point at index of the points list at path, with all of its lines
export const removePolygonPoint = (text: string, path: (string | number)[], index: number): string => {
    const items = pointList(text, path).items as YAMLMap[];
    if (!items[index]) throw new Error(`${path.join('.')} has no point ${index}`);
    const start = lineStartOf(text, items[index].range?.[0] ?? 0);
    const end = index + 1 < items.length ? lineStartOf(text, items[index + 1].range?.[0] ?? 0) : afterNode(text, items[index]);
    return text.slice(0, start) + text.slice(end);
};

type Range = { start: number, end: number };

// the lines of a list item, or of a key and its value, up to where the next one starts
const itemLines = (text: string, node: YAMLMap | YAMLSeq | Pair, next: unknown): Range => {
    const keyStart = node instanceof Pair ? (node.key as Scalar).range?.[0] : node.range?.[0];
    const start = lineStartOf(text, keyStart ?? 0);
    const nextStart = next instanceof Pair ? (next.key as Scalar)?.range?.[0] : (next as YAMLMap | undefined)?.range?.[0];
    if (nextStart !== undefined) return {start, end: lineStartOf(text, nextStart)};
    const last = node instanceof Pair ? (node.value ?? node.key) : node;
    return {start, end: afterNode(text, last as YAMLMap)};
};

// The places that use outline <name> outside of it: a case or outline part with name: <name>,
// or a pcb outline with outline: <name>. Each is a whole list item or key, ready to remove.
export type Reference = { label: string, range: Range };

const findReferences = (text: string, doc: ReturnType<typeof parseDocument>, name: string): Reference[] => {
    const found: Reference[] = [];
    const visit = (node: unknown, path: string[], remove: () => Range) => {
        if (isBlockMap(node) || node instanceof YAMLMap) {
            if (path[0] === 'outlines' && path[1] === name) return;
            const uses = (node.items as Pair[]).some(pair =>
                pair.key instanceof Scalar && ['name', 'outline'].includes(String(pair.key.value))
                && pair.value instanceof Scalar && String(pair.value.value) === name);
            if (uses && path.length > 1) found.push({label: path.join('.'), range: remove()});
            const pairs = node.items as Pair[];
            pairs.forEach((pair, i) => {
                const key = pair.key instanceof Scalar ? String(pair.key.value) : '?';
                visit(pair.value, [...path, key], () => itemLines(text, pair, pairs[i + 1]));
            });
        } else if (node instanceof YAMLSeq) {
            node.items.forEach((item, i) => visit(item, [...path, String(i)], () => itemLines(text, item as YAMLMap, node.items[i + 1])));
        }
    };
    visit(doc.contents, [], () => ({start: 0, end: 0}));
    return found.filter(ref => ref.range.end > ref.range.start);
};

const outlinePair = (doc: ReturnType<typeof parseDocument>, name: string) => {
    const outlines = doc.get('outlines', true);
    if (!isBlockMap(outlines)) return null;
    const pairs = outlines.items as Pair[];
    const index = pairs.findIndex(pair => pair.key instanceof Scalar && String(pair.key.value) === name);
    return index < 0 ? null : {pair: pairs[index], next: pairs[index + 1]};
};

// YAML anchors (&name) inside the range that something outside of it still uses (*name)
const anchorsUsedElsewhere = (text: string, range: Range) => {
    const inside = text.slice(range.start, range.end);
    const outside = text.slice(0, range.start) + text.slice(range.end);
    return Array.from(inside.matchAll(/&([\w-]+)/g), m => m[1]).filter(anchor => new RegExp(`\\*${anchor}\\b`).test(outside));
};

export const outlineReferences = (text: string, name: string): Reference[] => {
    const doc = parseDocument(text, {keepCstNodes: true});
    return doc.errors.length ? [] : findReferences(text, doc, name);
};

const removeRanges = (text: string, ranges: Range[]) =>
    [...ranges].sort((a, b) => b.start - a.start).reduce((out, r) => out.slice(0, r.start) + out.slice(r.end), text);

// Deletes outlines.<name>, and with withReferences the parts and pcb outlines that use it too
export const deleteOutline = (text: string, name: string, withReferences: boolean): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const found = outlinePair(doc, name);
    if (!found) throw new Error(`there is no outline called ${name}`);
    const own = itemLines(text, found.pair, found.next);
    const shared = anchorsUsedElsewhere(text, own);
    if (shared.length) throw new Error(`${name} defines ${shared.map(a => `&${a}`).join(', ')}, which other parts of the config still use`);
    const references = withReferences ? findReferences(text, doc, name).map(r => r.range) : [];
    return removeRanges(text, [own, ...references]);
};

// Deletes one part (a list item, or a named part) of outlines.<name>
export const deleteOutlinePart = (text: string, name: string, key: string | number): string =>
    deleteEntry(text, ['outlines', name], key);

// Deletes the list item or map key <key> of the node at path, unless it defines YAML anchors
// that something else still uses
export const deleteEntry = (text: string, path: (string | number)[], key: string | number): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const node = doc.getIn(path, true);
    let range: Range | undefined;
    if (node instanceof YAMLSeq && typeof key === 'number' && node.items[key]) {
        range = itemLines(text, node.items[key] as YAMLMap, node.items[key + 1]);
    } else if (isBlockMap(node)) {
        const pairs = node.items as Pair[];
        const index = pairs.findIndex(pair => pair.key instanceof Scalar && String(pair.key.value) === String(key));
        if (index >= 0) range = itemLines(text, pairs[index], pairs[index + 1]);
    }
    if (!range) throw new Error(`${path.join('.')} has no ${typeof key === 'number' ? 'part' : 'entry'} ${key}`);
    const shared = anchorsUsedElsewhere(text, range);
    if (shared.length) throw new Error(`it defines ${shared.map(a => `&${a}`).join(', ')}, which other parts of the config still use`);
    return removeRanges(text, [range]);
};

// A key of the map at path: its value's site, or where to add it
export const findValue = (text: string, path: (string | number)[], key: string): EditSite | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const node = doc.getIn(path, true);
    if (!isBlockMap(node)) return `${path.join('.')} is not a plain map`;
    const pair = findPair(node, key);
    return pair ? replaceScalar(text, pair.value) : insertInto(text, node, key);
};

// <child>.<key> of the map at path, written nested (adjust: {rotate: 1}) or dotted (adjust.rotate: 1).
// A missing one is added: into <child> when there is one, otherwise as a dotted key.
const childOf = (text: string, path: (string | number)[], child: string) => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const node = doc.getIn(path, true);
    if (!isBlockMap(node)) return `${path.join('.')} is not a plain map`;
    const childPair = findPair(node, child);
    if (childPair && !isBlockMap(childPair.value)) return `${child} is not a plain map`;
    return {node, childMap: childPair?.value as YAMLMap | undefined};
};

export const findChildValue = (text: string, path: (string | number)[], child: string, key: string): EditSite | string => {
    const found = childOf(text, path, child);
    if (typeof found === 'string') return found;
    const dotted = findPair(found.node, `${child}.${key}`);
    if (dotted) return replaceScalar(text, dotted.value);
    if (found.childMap) {
        const pair = findPair(found.childMap, key);
        return pair ? replaceScalar(text, pair.value) : insertInto(text, found.childMap, key);
    }
    return insertInto(text, found.node, `${child}.${key}`);
};

export const findChildShift = (text: string, path: (string | number)[], child: string): AnchorShift | string => {
    const found = childOf(text, path, child);
    if (typeof found === 'string') return found;
    const dotted = findPair(found.node, `${child}.shift`);
    if (dotted) return shiftList(text, dotted.value);
    if (found.childMap) {
        const pair = findPair(found.childMap, 'shift');
        return pair ? shiftList(text, pair.value) : insertShift(insertInto(text, found.childMap, 'shift'));
    }
    return insertShift(insertInto(text, found.node, `${child}.shift`));
};

// The keys a footprint is on, when its where is a list of key names (or one name): where to
// write a new list, in the same flow style
export const findWhereList = (text: string, path: (string | number)[]): { names: string[], site: EditSite } | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const node = doc.getIn(path, true);
    if (!isBlockMap(node)) return `${path.join('.')} is not a plain map`;
    const pair = findPair(node, 'where');
    const value = pair?.value;
    if (value instanceof Scalar && typeof value.value === 'string' && !value.value.startsWith('/')) {
        const site = replaceScalar(text, value);
        return typeof site === 'string' ? site : {names: [value.value], site};
    }
    const range = value instanceof YAMLSeq ? value.cstNode?.valueRange : null;
    if (value instanceof YAMLSeq && value.type === 'FLOW_SEQ' && range && value.items.every(i => i instanceof Scalar && typeof i.value === 'string')) {
        // just the [ ... ], not a comment after it
        const {start, end} = range;
        return {names: value.items.map(i => String((i as Scalar).value)), site: {start, end, raw: text.slice(start, end), render: v => v}};
    }
    return 'its where is not a list of key names written like [a, b]';
};

// a footprint placed on keys: what it is and the keys it is on
export const keyFootprintLines = (repo: string, file: string, keys: string[]) => [
    'what:',
    '  github:',
    `    repo: "${repo}"`,
    `    file: "${file}"`,
    `where: [${keys.join(', ')}]`,
];

// The outlines a pcb's board edge is made of: pcbs.<pcb>.outlines, each entry naming one outline
export const pcbOutlines = (text: string, pcb: string): { key: string, outline: string }[] | string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return 'the config has YAML errors';
    const pcbMap = doc.getIn(['pcbs', pcb], true);
    if (!isBlockMap(pcbMap)) return `pcbs.${pcb} is not a plain map`;
    const outlines = findPair(pcbMap, 'outlines')?.value;
    if (outlines === undefined || outlines === null) return [];
    if (!isBlockMap(outlines)) return `pcbs.${pcb}.outlines is not a plain map`;
    return (outlines.items as Pair[]).map(pair => {
        const entry = pair.value;
        const outline = isBlockMap(entry) ? findPair(entry, 'outline')?.value : undefined;
        return {key: String((pair.key as Scalar).value), outline: outline instanceof Scalar ? String(outline.value) : ''};
    });
};

// Makes outlines.<outline> part of a pcb's board edge: a new entry in pcbs.<pcb>.outlines, which is
// started (in front of the pcb's other keys) when the pcb has none
export const addPcbOutline = (text: string, pcb: string, outline: string): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const pcbMap = doc.getIn(['pcbs', pcb], true);
    if (!isBlockMap(pcbMap)) throw new Error(`pcbs.${pcb} is not a plain map`);
    const pair = findPair(pcbMap, 'outlines');
    const taken = isBlockMap(pair?.value) ? (pair?.value as YAMLMap).items.map(p => String(((p as Pair).key as Scalar).value)) : [];
    let key = outline;
    for (let n = 2; taken.includes(key); n++) key = `${outline}_${n}`;
    if (isBlockMap(pair?.value)) return appendEntry(text, ['pcbs', pcb, 'outlines'], key, [`outline: ${outline}`]);
    if (pair && pair.value !== null) throw new Error(`pcbs.${pcb}.outlines is not a plain map`);

    const firstKey = (pcbMap.items[0] as Pair | undefined)?.key;
    const start = firstKey instanceof Scalar ? firstKey.range?.[0] : undefined;
    if (start === undefined) throw new Error(`pcbs.${pcb} is empty`);
    const indent = columnOf(text, start);
    const pad = (n: number) => ' '.repeat(indent + n);
    const entry = `${pad(2)}${key}:\n${pad(4)}outline: ${outline}`;
    if (pair) {
        // "outlines:" with nothing under it
        const at = endOfLine(text, (pair.key as Scalar).range?.[0] ?? start);
        return text.slice(0, at) + '\n' + entry + text.slice(at);
    }
    return text.slice(0, start) + `outlines:\n${entry}\n${pad(0)}` + text.slice(start);
};

// --- whole cases ---

const casePair = (doc: ReturnType<typeof parseDocument>, name: string) => {
    const cases = doc.get('cases', true);
    if (!isBlockMap(cases)) return null;
    const pairs = cases.items as Pair[];
    const index = pairs.findIndex(pair => pair.key instanceof Scalar && String(pair.key.value) === name);
    return index < 0 ? null : {pair: pairs[index], next: pairs[index + 1]};
};

// The lines of <section>.<name>'s value, relative to its name's indentation: comments and all, to copy
export const entryLines = (text: string, section: string, name: string): string[] => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const map = doc.get(section, true);
    const pairs = isBlockMap(map) ? map.items as Pair[] : [];
    const index = pairs.findIndex(pair => pair.key instanceof Scalar && String(pair.key.value) === name);
    if (index < 0) throw new Error(`there is no ${section}.${name}`);
    const {start, end} = itemLines(text, pairs[index], pairs[index + 1]);
    const keyColumn = columnOf(text, (pairs[index].key as Scalar).range?.[0] ?? start);
    const lines = text.slice(start, end).split('\n').slice(1);
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.map(line => line.slice(Math.min(keyColumn + 2, line.length - line.trimStart().length)));
};

// The lines of cases.<name>'s value: its parts, to copy
export const caseLines = (text: string, name: string): string[] => {
    try {
        return entryLines(text, 'cases', name);
    } catch (e: unknown) {
        throw new Error(String(e instanceof Error ? e.message : e).replace(/^there is no cases\./, 'there is no case called '));
    }
};

// the items of a flow list like [a, {name: b, gap: 2}] as written, and the list's place in the text
const flowItems = (text: string, node: unknown): { items: string[], names: string[], range: Range } | null => {
    if (!(node instanceof YAMLSeq) || node.type !== 'FLOW_SEQ' || !node.cstNode?.valueRange) return null;
    const items = node.items.map(item => {
        const r = (item as any)?.cstNode?.valueRange ?? (item as any)?.cstNode?.range;
        return r ? text.slice(r.start, r.end).trim() : '';
    });
    const names = node.items.map(item => item instanceof Scalar ? String(item.value)
        : item instanceof YAMLMap ? String((findPair(item, 'name')?.value as Scalar | undefined)?.value ?? '') : '');
    const {start, end} = node.cstNode.valueRange;
    return {items, names, range: {start, end}};
};

// The assemblies whose stack has cases.<name>, and where
export const stacksWith = (text: string, name: string): { assembly: string, index: number }[] => {
    const doc = parseDocument(text, {keepCstNodes: true});
    const assemblies = doc.get('assemblies', true);
    if (doc.errors.length || !isBlockMap(assemblies)) return [];
    return (assemblies.items as Pair[]).flatMap(pair => {
        const stack = isBlockMap(pair.value) ? findPair(pair.value, 'stack')?.value : undefined;
        const list = flowItems(text, stack);
        const index = list?.names.indexOf(name) ?? -1;
        return index < 0 ? [] : [{assembly: String((pair.key as Scalar).value), index}];
    });
};

// Puts cases.<name> into assemblies.<assembly>.stack at index (0: at the bottom)
export const insertIntoStack = (text: string, assembly: string, name: string, index: number): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const list = flowItems(text, doc.getIn(['assemblies', assembly, 'stack'], true));
    if (!list) throw new Error(`assemblies.${assembly}.stack is not a list written like [a, b]`);
    const items = [...list.items];
    items.splice(Math.max(0, Math.min(index, items.length)), 0, name);
    return text.slice(0, list.range.start) + `[${items.join(', ')}]` + text.slice(list.range.end);
};

// What uses cases.<name>: the cases mirrored from it, the stacks it is in, and other cases' parts made of it
export const caseReferences = (text: string, name: string): { mirrors: string[], stacks: string[], parts: string[] } => {
    const doc = parseDocument(text, {keepCstNodes: true});
    const cases = doc.get('cases', true);
    const mirrors: string[] = [], parts: string[] = [];
    if (!doc.errors.length && isBlockMap(cases)) {
        for (const pair of cases.items as Pair[]) {
            const key = String((pair.key as Scalar).value);
            const value = pair.value;
            if (isBlockMap(value)) {
                const mirror = findPair(value, 'mirror')?.value;
                const from = isBlockMap(mirror) || mirror instanceof YAMLMap ? findPair(mirror as YAMLMap, 'from')?.value : undefined;
                if (from instanceof Scalar && String(from.value) === name) mirrors.push(key);
            } else if (value instanceof YAMLSeq) {
                value.items.forEach((item, i) => {
                    if (!(item instanceof YAMLMap)) return;
                    const what = findPair(item, 'what')?.value, used = findPair(item, 'name')?.value;
                    if (what instanceof Scalar && what.value === 'case' && used instanceof Scalar && String(used.value) === name) parts.push(`${key}.${i}`);
                });
            }
        }
    }
    return {mirrors, stacks: stacksWith(text, name).map(s => s.assembly), parts};
};

// Deletes cases.<name> and what uses it: the other cases' parts made of it, its place in every stack, and
// with mirrors the cases mirrored from it (and what uses those)
export const deleteCase = (text: string, name: string, mirrors = true): string => {
    let out = text;
    const refs = caseReferences(out, name);
    if (mirrors) for (const mirror of refs.mirrors) out = deleteCase(out, mirror, true);
    // the parts made of it, the last first so the indexes stay right
    for (const ref of [...caseReferences(out, name).parts].reverse()) {
        const [owner, index] = ref.split('.');
        out = deleteListItem(out, ['cases', owner], Number(index));
    }
    for (const {assembly} of stacksWith(out, name)) {
        const doc = parseDocument(out, {keepCstNodes: true});
        const list = flowItems(out, doc.getIn(['assemblies', assembly, 'stack'], true));
        if (!list) continue;
        const items = list.items.filter((_, i) => list.names[i] !== name);
        out = out.slice(0, list.range.start) + `[${items.join(', ')}]` + out.slice(list.range.end);
    }
    const doc = parseDocument(out, {keepCstNodes: true});
    const found = casePair(doc, name);
    if (!found) throw new Error(`there is no case called ${name}`);
    const own = itemLines(out, found.pair, found.next);
    const shared = anchorsUsedElsewhere(out, own);
    if (shared.length) throw new Error(`${name} defines ${shared.map(a => `&${a}`).join(', ')}, which other parts of the config still use`);
    return removeRanges(out, [own]);
};

// --- whole pcbs and assemblies ---

// the entries of <section> mirrored from <name> (mirror: from: <name>)
const mirrorsOf = (doc: ReturnType<typeof parseDocument>, section: string, name: string): string[] => {
    const map = doc.get(section, true);
    if (!isBlockMap(map)) return [];
    return (map.items as Pair[]).filter(pair => {
        const mirror = isBlockMap(pair.value) ? findPair(pair.value, 'mirror')?.value : undefined;
        const from = mirror instanceof YAMLMap ? findPair(mirror, 'from')?.value : undefined;
        return from instanceof Scalar && String(from.value) === name;
    }).map(pair => String((pair.key as Scalar).value));
};

// the board of an assembly: pcb: <name>, or pcb: {name: <name>, …}
const boardOf = (assembly: unknown): string | null => {
    const pcb = isBlockMap(assembly) ? findPair(assembly, 'pcb')?.value : undefined;
    if (pcb instanceof Scalar) return String(pcb.value);
    const name = pcb instanceof YAMLMap ? findPair(pcb, 'name')?.value : undefined;
    return name instanceof Scalar ? String(name.value) : null;
};

// What goes with pcbs.<name>: the pcbs mirrored from it, and the assemblies holding it or one of those
export const pcbReferences = (text: string, name: string): { mirrors: string[], assemblies: string[] } => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) return {mirrors: [], assemblies: []};
    const mirrors = mirrorsOf(doc, 'pcbs', name);
    const boards = [name, ...mirrors];
    const map = doc.get('assemblies', true);
    const assemblies = isBlockMap(map) ? (map.items as Pair[])
        .filter(pair => boards.includes(boardOf(pair.value) ?? ''))
        .map(pair => String((pair.key as Scalar).value)) : [];
    return {mirrors, assemblies};
};

// Deletes pcbs.<name>, the pcbs mirrored from it and the assemblies holding any of them
export const deletePcb = (text: string, name: string): string => {
    const {mirrors, assemblies} = pcbReferences(text, name);
    let out = text;
    for (const assembly of assemblies) out = deleteEntry(out, ['assemblies'], assembly);
    for (const mirror of mirrors) out = deleteEntry(out, ['pcbs'], mirror);
    return deleteEntry(out, ['pcbs'], name);
};

// One of an assembly's other 3D models: its model path (or address), at a module of the pcb, its z = 0 at z
export type AssemblyPart = { name: string, model: string, module?: string, z?: string };

// A new assembly's lines: its stack from the bottom up, its board (its top level with one of the stack's), and
// its other parts
export const assemblyLines = (stack: string[], pcb: string, top?: string, parts: AssemblyPart[] = []) => [
    `stack: [${stack.join(', ')}]`,
    ...(top ? ['pcb:', `  name: ${pcb}`, `  top: ${top}`] : [`pcb: ${pcb}`]),
    ...(parts.length ? ['parts:', ...parts.flatMap(part => partItemLines(part).map((line, i) => (i ? '    ' : '  - ') + line))] : []),
];

// an assembly part's lines, relative to its "- "
const partItemLines = (part: AssemblyPart) => [
    ...(part.name ? [`name: ${part.name}`] : []),
    `model: ${JSON.stringify(part.model)}`,
    ...(part.module ? [`module: ${part.module}`] : []),
    ...(part.z ? [`z: ${part.z}`] : []),
];

// Adds a part at the end of assemblies.<assembly>.parts, starting the list when the assembly has none
export const addAssemblyPart = (text: string, assembly: string, part: AssemblyPart): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const parts = doc.getIn(['assemblies', assembly, 'parts'], true);
    if (parts instanceof YAMLSeq && parts.type === 'SEQ' && parts.items.length) return appendListItem(text, ['assemblies', assembly, 'parts'], partItemLines(part));
    const lines = partItemLines(part).map((line, i) => (i ? '  ' : '- ') + line);
    if (parts === undefined) return appendEntry(text, ['assemblies', assembly], 'parts', lines);
    if (parts !== null && !(parts instanceof YAMLSeq && !parts.items.length)) throw new Error(`assemblies.${assembly}.parts is not a list`);
    // "parts:" (or "parts: []") with nothing in it: the list goes in its place
    const map = doc.getIn(['assemblies', assembly], true) as YAMLMap;
    const pair = findPair(map, 'parts') as Pair;
    const keyStart = (pair.key as Scalar).range?.[0] ?? 0;
    const pad = ' '.repeat(columnOf(text, keyStart) + 2);
    const end = endOfLine(text, keyStart);
    return text.slice(0, keyStart) + 'parts:\n' + lines.map(line => pad + line).join('\n') + text.slice(end);
};

// A case mirrored from another (for the other half of a split board)
export const mirrorCaseLines = (from: string) => ['mirror:', `  from: ${from}`];

// the comment lines right above a line go with what follows them
const withComments = (text: string, start: number) => {
    while (start > 0) {
        const previous = lineStartOf(text, start - 1);
        if (!/^[ \t]*#/.test(text.slice(previous, start))) break;
        start = previous;
    }
    return start;
};

// Adds <name> with the given lines (relative to the name's indentation) to the map at path, right before or
// after its entry <beside>, in the map's order
export const insertEntry = (text: string, path: string[], name: string, lines: string[], beside: string, after: boolean): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    if (!/^[A-Za-z_][\w-]*$/.test(name)) throw new Error(`"${name}" can't be a name here: use letters, digits, _ or -`);
    const map = doc.getIn(path, true);
    if (!isBlockMap(map)) throw new Error(`${path.join('.')} is not a plain map`);
    if (findPair(map, name)) throw new Error(`there already is a ${path.join('.')}.${name}`);
    const pairs = map.items as Pair[];
    const index = pairs.findIndex(pair => pair.key instanceof Scalar && String(pair.key.value) === beside);
    if (index < 0) throw new Error(`${path.join('.')} has no ${beside}`);
    if (after && index === pairs.length - 1) return appendEntry(text, path, name, lines);
    const keyStart = (pairs[after ? index + 1 : index].key as Scalar).range?.[0];
    if (keyStart === undefined) throw new Error(`can't find ${path.join('.')}.${beside} in the text`);
    const pad = ' '.repeat(columnOf(text, keyStart));
    const at = withComments(text, lineStartOf(text, keyStart));
    return text.slice(0, at) + [`${pad}${name}:`, ...lines.map(line => `${pad}  ${line}`)].join('\n') + '\n' + text.slice(at);
};

// A name for one more of names: <prefix><n> with n one past the highest there is
export const nextName = (names: string[], prefix: string) => {
    const numbers = names.map(n => n.startsWith(prefix) ? Number(n.slice(prefix.length)) : NaN).filter(n => Number.isInteger(n));
    let n = numbers.length ? Math.max(...numbers) + 1 : names.length;
    while (names.includes(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
};

// Deletes points.zones.<zone>.columns.<col>
export const deleteColumn = (text: string, zone: string, col: string): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    const columns = doc.getIn(['points', 'zones', zone, 'columns'], true);
    if (isBlockMap(columns) && columns.items.length < 2) throw new Error(`${col} is the only column of ${zone}`);
    return deleteEntry(text, ['points', 'zones', zone, 'columns'], col);
};

// Deletes points.zones.<zone>.rows.<row>, and what the zone's columns set for that row (rows.<row>.skip: …,
// or <row> in their rows map)
export const deleteRow = (text: string, zone: string, row: string): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const rows = doc.getIn(['points', 'zones', zone, 'rows'], true);
    if (!isBlockMap(rows)) throw new Error(`points.zones.${zone}.rows is not a plain map`);
    const rowPairs = rows.items as Pair[];
    const index = rowPairs.findIndex(pair => pair.key instanceof Scalar && String(pair.key.value) === row);
    if (index < 0) throw new Error(`${zone} has no row ${row}`);
    if (rowPairs.length < 2) throw new Error(`${row} is the only row of ${zone}`);
    const ranges: Range[] = [itemLines(text, rowPairs[index], rowPairs[index + 1])];
    const columns = doc.getIn(['points', 'zones', zone, 'columns'], true);
    for (const colPair of isBlockMap(columns) ? columns.items as Pair[] : []) {
        if (!isBlockMap(colPair.value)) continue;
        const pairs = colPair.value.items as Pair[];
        pairs.forEach((pair, i) => {
            const key = pair.key instanceof Scalar ? String(pair.key.value) : '';
            if (key === `rows.${row}` || key.startsWith(`rows.${row}.`)) {
                ranges.push(itemLines(text, pair, pairs[i + 1]));
            } else if (key === 'rows' && isBlockMap(pair.value)) {
                const own = pair.value.items as Pair[];
                const of = own.map(p => p.key instanceof Scalar && (String(p.key.value) === row || String(p.key.value).startsWith(`${row}.`)));
                if (!of.some(Boolean)) return;
                // the column's whole rows map, when that row was all it had
                if (of.every(Boolean)) ranges.push(itemLines(text, pair, pairs[i + 1]));
                else own.forEach((p, j) => of[j] && ranges.push(itemLines(text, p, own[j + 1])));
            }
        });
    }
    const shared = ranges.flatMap(range => anchorsUsedElsewhere(text, range));
    if (shared.length) throw new Error(`it defines ${shared.map(a => `&${a}`).join(', ')}, which other parts of the config still use`);
    return removeRanges(text, ranges);
};

// The lines of the config that name any of the given keys (an anchor's ref, an outline's point, a footprint's
// where), as "line: text", to say what a deleted column or row leaves without its key
export const keyMentions = (text: string, keys: string[]): string[] => {
    if (!keys.length) return [];
    const pattern = new RegExp(`(^|[^\\w])(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w])`);
    return text.split('\n').flatMap((line, i) => pattern.test(line.replace(/#.*/, '')) ? [`${i + 1}: ${line.trim()}`] : []);
};

export const applyEdits = (text: string, edits: Edit[]) =>
    [...edits]
        .sort((a, b) => b.site.start - a.site.start)
        .reduce((out, {site, value}) => out.slice(0, site.start) + site.render(value) + out.slice(site.end), text);

export const isPlainNumber = (raw: string) => /^-?\d+(\.\d+)?$/.test(raw.trim());
