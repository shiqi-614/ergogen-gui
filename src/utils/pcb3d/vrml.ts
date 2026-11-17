// VRML 2.0 models, the subset KiCad's libraries and easyeda2kicad write: Shapes with a Material (DEF / USE) and an
// IndexedFaceSet, possibly inside Transform or Group nodes. KiCad counts VRML in 0.1 inch; the parts come out in mm,
// flat-shaded like KiCad draws them. (three.js's VRMLLoader isn't used: its parser fails once Vite bundles it.)
import {MeshPart} from "./meshCache";

const UNIT = 2.54;

// VRML colours are sRGB; the parts carry linear ones
const linear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

type Node = { type: string, fields: Record<string, Value> };
type Value = number[] | Node | Node[] | string | boolean | null;

const tokenize = (text: string): string[] => {
    const tokens: string[] = [];
    const re = /#[^\n\r]*|"(?:[^"\\]|\\.)*"|[{}[\]]|[^\s,{}[\]#"]+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) if (m[0][0] !== '#') tokens.push(m[0]);
    return tokens;
};

const isNumber = (t: string | undefined) => t !== undefined && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t);

export const parseVrml = (text: string): Node[] => {
    const tokens = tokenize(text);
    let i = 0;
    const defs: Record<string, Node> = {};

    const node = (): Node | null => {
        let name: string | null = null;
        if (tokens[i] === 'USE') {
            i += 2;
            return defs[tokens[i - 1]] || null;
        }
        if (tokens[i] === 'DEF') {
            name = tokens[i + 1];
            i += 2;
        }
        const type = tokens[i++];
        if (tokens[i] !== '{') throw new Error(`VRML: "{" expected after ${type}`);
        i++;
        const fields: Record<string, Value> = {};
        while (i < tokens.length && tokens[i] !== '}') {
            const field = tokens[i++];
            // ROUTE, PROTO and the like: not in KiCad's files, skipped to the end of the node
            if (field === 'ROUTE') { i += 3; continue; }
            fields[field] = value();
        }
        i++;
        const n = {type, fields};
        if (name) defs[name] = n;
        return n;
    };

    const value = (): Value => {
        const t = tokens[i];
        if (t === '[') {
            i++;
            const numbers: number[] = [], nodes: Node[] = [];
            while (i < tokens.length && tokens[i] !== ']') {
                if (isNumber(tokens[i])) numbers.push(parseFloat(tokens[i++]));
                else if (tokens[i][0] === '"') i++;
                else {
                    const n = node();
                    if (n) nodes.push(n);
                }
            }
            i++;
            return nodes.length ? nodes : numbers;
        }
        if (t === 'TRUE' || t === 'FALSE') {
            i++;
            return t === 'TRUE';
        }
        if (t === 'NULL') {
            i++;
            return null;
        }
        if (t && t[0] === '"') {
            i++;
            return t.slice(1, -1);
        }
        if (isNumber(t)) {
            const numbers: number[] = [];
            while (isNumber(tokens[i])) numbers.push(parseFloat(tokens[i++]));
            return numbers;
        }
        return node();
    };

    const top: Node[] = [];
    while (i < tokens.length) {
        const n = node();
        if (n) top.push(n);
    }
    return top;
};

type Matrix = number[]; // 4x4, column-major like three.js
const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const multiply = (a: Matrix, b: Matrix): Matrix => {
    const out = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return out;
};
const translation = ([x, y, z]: number[]): Matrix => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scaling = ([x, y, z]: number[]): Matrix => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
const rotation = ([x, y, z, angle]: number[]): Matrix => {
    const length = Math.hypot(x, y, z) || 1;
    [x, y, z] = [x / length, y / length, z / length];
    const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    return [
        t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
        t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
        t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
        0, 0, 0, 1,
    ];
};
const vec = (v: Value, fallback: number[]) => Array.isArray(v) && v.length && typeof v[0] === 'number' ? v as number[] : fallback;

// VRML's Transform: T * C * R * SR * S * -SR * -C, without scaleOrientation (KiCad doesn't write it)
const transformOf = (n: Node): Matrix => {
    const centre = vec(n.fields.center, [0, 0, 0]);
    return [translation(vec(n.fields.translation, [0, 0, 0])), translation(centre), rotation(vec(n.fields.rotation, [0, 0, 1, 0])),
        scaling(vec(n.fields.scale, [1, 1, 1])), translation(centre.map(v => -v))].reduce(multiply);
};

const shapePart = (shape: Node, matrix: Matrix): MeshPart | null => {
    const geometry = shape.fields.geometry as Node | null;
    if (!geometry || geometry.type !== 'IndexedFaceSet') return null;
    const coord = geometry.fields.coord as Node | null;
    const points = vec(coord?.fields.point ?? null, []);
    const indices = vec(geometry.fields.coordIndex, []);
    const at = (k: number) => {
        const [x, y, z] = [points[3 * k], points[3 * k + 1], points[3 * k + 2]];
        return [0, 1, 2].map(r => (matrix[r] * x + matrix[4 + r] * y + matrix[8 + r] * z + matrix[12 + r]) * UNIT);
    };
    const triangles: number[] = [];
    let face: number[] = [];
    // corners are counter-clockwise seen from outside, unless "ccw FALSE"
    const clockwise = geometry.fields.ccw === false;
    const flush = () => {
        // a polygon as a fan from its first corner
        for (let k = 1; k + 1 < face.length; k++) {
            if (clockwise) triangles.push(face[0], face[k + 1], face[k]);
            else triangles.push(face[0], face[k], face[k + 1]);
        }
        face = [];
    };
    for (const k of indices) {
        if (k < 0) flush();
        else if (3 * k + 2 < points.length) face.push(k);
    }
    flush();
    if (!triangles.length) return null;
    // flat shading: every triangle gets its own three corners and its normal
    const position = new Float32Array(triangles.length * 3);
    const normal = new Float32Array(triangles.length * 3);
    for (let t = 0; t < triangles.length; t += 3) {
        const [a, b, c] = [at(triangles[t]), at(triangles[t + 1]), at(triangles[t + 2])];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const length = Math.hypot(n[0], n[1], n[2]) || 1;
        [a, b, c].forEach((p, k) => {
            position.set(p, 3 * (t + k));
            normal.set(n.map(x => x / length), 3 * (t + k));
        });
    }
    const material = ((shape.fields.appearance as Node | null)?.fields.material as Node | null);
    const colour = vec(material?.fields.diffuseColor ?? null, []);
    return {
        position,
        normal,
        index: Uint32Array.from({length: triangles.length}, (_, k) => k),
        color: colour.length >= 3 ? [linear(colour[0]), linear(colour[1]), linear(colour[2])] : null,
    };
};

export const vrmlParts = (text: string): MeshPart[] => {
    const parts: MeshPart[] = [];
    const walk = (nodes: Node[], matrix: Matrix) => nodes.forEach(n => {
        if (n.type === 'Shape') {
            const part = shapePart(n, matrix);
            if (part) parts.push(part);
        } else if (n.fields.children) {
            const children = Array.isArray(n.fields.children) ? n.fields.children as Node[] : [n.fields.children as Node];
            walk(children.filter(c => c && typeof c === 'object' && 'type' in c), n.type === 'Transform' ? multiply(matrix, transformOf(n)) : matrix);
        }
    });
    walk(parseVrml(text), IDENTITY);
    return parts;
};
