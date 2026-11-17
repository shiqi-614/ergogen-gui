import {expect, it} from "vitest";
import {keyHull, nearMisses, outlineHandles, pcbPartHandles} from "./outlineGeometry";

const points = {
    a: {x: 0, y: 0, r: 0},
    b: {x: 19, y: 2.5, r: 0},
};
const evaluate = (expr: string) => Number(expr);
const square = (y: number) => ({
    outlines: {
        cut: [{
            what: 'polygon',
            points: [
                {ref: 'a', shift: [0, 10]},
                {ref: 'b', shift: [0, y]},
                {ref: 'b', shift: [0, -10]},
                {ref: 'a', shift: [0, -10]},
            ],
        }],
    },
});

it('places polygon points from their keys and keeps their refs', () => {
    const {handles, polygons} = outlineHandles(square(7.5), 'cut', points, evaluate);
    expect(handles.map(h => [h.ref, h.at.x, h.at.y])).toEqual([['a', 0, 10], ['b', 19, 10], ['b', 19, -7.5], ['a', 0, -10]]);
    expect(polygons).toHaveLength(1);
});

it('flags an edge that misses straight by a typo, not by float noise', () => {
    const misses = (y: number) => nearMisses(outlineHandles(square(y), 'cut', points, evaluate).polygons[0]).length;
    expect(misses(7.5)).toBe(0);        // level on top; the bottom edge slopes 7.5°, on purpose
    expect(misses(7.51)).toBe(1);       // a 0.01 typo tilts the top edge by 0.03°
    expect(misses(7.5 + 1e-9)).toBe(0); // float noise is not a typo
});

it('wraps the keys in the corners on their hull', () => {
    const keys = {
        a: {x: 0, y: 0, r: 0, meta: {width: 18, height: 18}},
        b: {x: 19, y: 0, r: 0, meta: {width: 18, height: 18}},
        c: {x: 0, y: 19, r: 0, meta: {width: 18, height: 18}},
        m: {x: 99, y: 99, r: 0, meta: {width: 18, height: 18, mirrored: true}},
    };
    const hull = keyHull(keys);
    expect(hull.map(c => `${c.ref} ${c.shift.join(',')}`).sort()).toEqual(['a -9,-9', 'b 9,-9', 'b 9,9', 'c -9,9', 'c 9,9'].sort());
});

it('places a pcb part on each half it is on', () => {
    const keys = {
        a: {x: 0, y: 0, r: 0},
        mirror_a: {x: 100, y: 0, r: 0, meta: {mirrored: true}},
    };
    const config = {pcbs: {right: {
        modules: {
            usb: {what: {github: {file: 'usb/usb.kicad_pcb'}}, where: {ref: ['a'], shift: [5, 16], rotate: 90}},
            only_right: {where: {ref: 'a', shift: [1, 0]}, asym: 'source'},
            only_left: {where: {ref: 'a', shift: [1, 0]}, asym: 'clone'},
        },
        footprints: {keys: {where: true}},
    }}};
    const {handles} = pcbPartHandles(config, 'right', keys, Number);
    expect(handles.map(h => [h.name, h.half, h.at.x, h.at.y, h.at.r, h.file])).toEqual([
        ['usb', 'source', 5, 16, 90, 'usb.kicad_pcb'],
        ['usb', 'mirror', 95, 16, -90, 'usb.kicad_pcb'],
        ['only_right', 'source', 1, 0, 0, 'only_right'],
        ['only_left', 'mirror', 99, 0, 0, 'only_left'],
    ]);
});
