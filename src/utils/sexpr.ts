// KiCad's s-expression files (.kicad_pcb, .kicad_mod), read into nested arrays: a list is an array whose first
// item is its name, and atoms and quoted strings are both plain strings.

export type SExpr = string | SExpr[];

export const parseSexpr = (text: string): SExpr[] => {
    const top: SExpr[] = [];
    const stack: SExpr[][] = [top];
    let i = 0;
    const n = text.length;
    while (i < n) {
        const c = text[i];
        if (c === '(') {
            const list: SExpr[] = [];
            stack[stack.length - 1].push(list);
            stack.push(list);
            i++;
        } else if (c === ')') {
            if (stack.length === 1) throw new Error(`unbalanced ")" at character ${i}`);
            stack.pop();
            i++;
        } else if (c === '"') {
            let value = '';
            i++;
            while (i < n && text[i] !== '"') {
                if (text[i] === '\\' && i + 1 < n) {
                    const e = text[i + 1];
                    value += e === 'n' ? '\n' : e === 't' ? '\t' : e;
                    i += 2;
                } else {
                    value += text[i++];
                }
            }
            stack[stack.length - 1].push(value);
            i++;
        } else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
            i++;
        } else {
            const start = i;
            while (i < n && !' \t\n\r()"'.includes(text[i])) i++;
            stack[stack.length - 1].push(text.slice(start, i));
        }
    }
    if (stack.length !== 1) throw new Error('unbalanced "(": the file ends inside a list');
    return top;
};

export const isList = (node: SExpr | undefined): node is SExpr[] => Array.isArray(node);

export const head = (node: SExpr | undefined): string | undefined =>
    isList(node) && typeof node[0] === 'string' ? node[0] : undefined;

// the first child list called `name`
export const child = (node: SExpr[] | undefined, name: string): SExpr[] | undefined =>
    node?.find((c): c is SExpr[] => head(c) === name);

export const children = (node: SExpr[] | undefined, name: string): SExpr[][] =>
    (node || []).filter((c): c is SExpr[] => head(c) === name);

export const num = (node: SExpr | undefined, fallback = 0): number => {
    const value = typeof node === 'string' ? parseFloat(node) : NaN;
    return isNaN(value) ? fallback : value;
};

// (name x y) or (name x y z) as numbers
export const xy = (node: SExpr[] | undefined): [number, number] => [num(node?.[1]), num(node?.[2])];
export const xyz = (node: SExpr[] | undefined, fallback = 0): [number, number, number] =>
    [num(node?.[1], fallback), num(node?.[2], fallback), num(node?.[3], fallback)];
