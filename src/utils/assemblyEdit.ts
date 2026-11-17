// Writes a stack, as the 3D board view's panel moves it, into config.assemblies.<name>: the stack as a list, each
// part with its gap to the one below it, and the board's shift from where its placement puts it. Everything else
// in the config text stays as typed.
import {parseDocument} from "yaml";
import {Pair, Scalar, YAMLMap} from "yaml/types";

export type StackEdit = {
    // from the bottom up; gap: the space between the part's bottom and the top of the one below (z = 0 for the first)
    parts: { name: string, gap: number }[],
    // the board's new shift, or null to leave the board as it is
    pcbShift: number | null,
};

type Change = { start: number, end: number, text: string };

const findPair = (map: YAMLMap, key: string): Pair | undefined =>
    (map.items as Pair[]).find(pair => pair.key instanceof Scalar && String(pair.key.value) === key);

// mm, to 0.01
export const mm = (v: number) => String(Math.round(v * 100) / 100 + 0);
const zero = (v: number) => Math.abs(v) < 0.005;

const rangeOf = (text: string, node: any): [number, number] => {
    const range = node?.range;
    if (!range) throw new Error('the config is written in a way this cannot edit');
    // a block value's range runs on over the line break after it
    const [start, end] = range;
    return [start, start + text.slice(start, end).trimEnd().length];
};

const lineStart = (text: string, offset: number) => text.lastIndexOf('\n', offset - 1) + 1;

const shiftChanges = (text: string, pcb: Pair, shift: number): Change[] => {
    const value: any = pcb.value;
    const written = mm(shift);
    if (value instanceof YAMLMap && value.type === 'MAP') {
        const pair = findPair(value, 'shift');
        if (pair) {
            // a shift of 0 goes, with its line
            if (zero(shift)) {
                const keyStart = (pair.key as Scalar).range?.[0] ?? 0;
                const from = lineStart(text, keyStart);
                const [, end] = rangeOf(text, pair.value);
                const to = text[end] === '\n' ? end + 1 : end;
                return [{start: from, end: to, text: ''}];
            }
            const [start, end] = rangeOf(text, pair.value);
            return [{start, end, text: written}];
        }
        if (zero(shift)) return [];
        // a new line after the map's last one, at its indentation
        const first = (value.items[0] as Pair).key as Scalar;
        const indent = ' '.repeat((first.range?.[0] ?? 0) - lineStart(text, first.range?.[0] ?? 0));
        const [, end] = rangeOf(text, (value.items[value.items.length - 1] as Pair).value);
        return [{start: end, end, text: `\n${indent}shift: ${written}`}];
    }
    // just a name, or a flow map: written again as a flow map
    const [start, end] = rangeOf(text, value);
    const fields = value instanceof YAMLMap
        ? (value.items as Pair[]).filter(p => String((p.key as Scalar).value) !== 'shift')
            .map(p => `${(p.key as Scalar).value}: ${text.slice(...rangeOf(text, p.value))}`)
        : [`name: ${text.slice(start, end)}`];
    if (!zero(shift)) fields.push(`shift: ${written}`);
    return [{start, end, text: fields.length === 1 && value instanceof Scalar ? text.slice(start, end) : `{${fields.join(', ')}}`}];
};

export const writeStack = (text: string, assembly: string, edit: StackEdit): string => {
    const doc = parseDocument(text, {keepCstNodes: true});
    if (doc.errors.length) throw new Error('the config has YAML errors');
    const node = doc.getIn(['assemblies', assembly], true);
    if (!(node instanceof YAMLMap)) throw new Error(`assemblies.${assembly} is not a map in the config`);
    const changes: Change[] = [];

    const stack = findPair(node, 'stack');
    if (!stack) throw new Error(`assemblies.${assembly} has no stack`);
    const [start, end] = rangeOf(text, stack.value);
    const entries = edit.parts.map(p => zero(p.gap) ? p.name : `{name: ${p.name}, gap: ${mm(p.gap)}}`);
    changes.push({start, end, text: `[${entries.join(', ')}]`});

    if (edit.pcbShift !== null) {
        const pcb = findPair(node, 'pcb');
        if (!pcb) throw new Error(`assemblies.${assembly} has no pcb`);
        changes.push(...shiftChanges(text, pcb, edit.pcbShift));
    }
    return changes.sort((a, b) => b.start - a.start)
        .reduce((out, c) => out.slice(0, c.start) + c.text + out.slice(c.end), text);
};
