import {expect, it} from "vitest";
import {footprintInstances, footprintShape, moduleBoxes, toBoard} from "./pcbGeometry";

const sorted = (corners: { x: number, y: number }[]) =>
    corners.map(c => [Number(c.x.toFixed(6)), Number(c.y.toFixed(6))]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

it('turns local coordinates the way KiCad does: counter-clockwise on a board whose y is down', () => {
    expect(sorted([toBoard({x: 0, y: 0}, 90, {x: 1, y: 0})])).toEqual([[0, -1]]);
    // D36 of the ErgoCai board: its first pad lies inside the box KiCanvas gives the footprint
    const pad = toBoard({x: -30.509754, y: 34.693137}, -155, {x: -3.9, y: 0});
    expect(pad.x).toBeGreaterThan(-35.53);
    expect(pad.x).toBeLessThan(-35.53 + 10.04);
    expect(pad.y).toBeGreaterThan(31.53);
    expect(pad.y).toBeLessThan(31.53 + 6.32);
});

const footprint = (x: number, y: number, rotation: number, more: object) => ({at: {position: {x, y}, rotation}, drawings: [], pads: [], ...more});

it('boxes a footprint around its courtyard, turned with it', () => {
    const f = footprint(10, 5, 90, {drawings: [
        {layer: 'F.CrtYd', start: {x: -2, y: -1}, end: {x: 2, y: 1}},
        {layer: {name: 'F.SilkS'}, start: {x: -9, y: -9}, end: {x: 9, y: 9}},
    ]});
    const shape = footprintShape(f)!;
    expect(sorted(shape.corners)).toEqual([[9, 3], [9, 7], [11, 3], [11, 7]]);
    expect(sorted([shape.center])).toEqual([[10, 5]]);
});

it('boxes a footprint without a courtyard around its pads and drawings', () => {
    const f = footprint(0, 0, 0, {
        pads: [{at: {position: {x: 3, y: 0}, rotation: 0}, size: {x: 2, y: 2}}],
        drawings: [{layer: 'F.SilkS', center: {x: -1, y: 0}, end: {x: 0, y: 0}}],
    });
    expect(sorted(footprintShape(f)!.corners)).toEqual([[-2, -1], [-2, 1], [4, -1], [4, 1]]);
});

it('boxes a module in its own frame, around its footprints', () => {
    // two footprints side by side along the module's x, which points up the board (90°)
    const board = [
        {reference: 'U1', ...footprint(0, -5, 90, {drawings: [{layer: 'F.CrtYd', start: {x: -1, y: -1}, end: {x: 1, y: 1}}]})},
        {reference: 'U2', ...footprint(0, -9, 90, {drawings: [{layer: 'F.CrtYd', start: {x: -1, y: -1}, end: {x: 1, y: 1}}]})},
    ];
    const [box] = moduleBoxes(board, {mcu: {point: {x: 0, y: 7, r: 90}, footprints: {U1: {point: {x: 0, y: 5}}, U2: {point: {x: 0, y: 9}}}}});
    expect(box.module).toBe('mcu');
    expect(sorted(box.box.corners)).toEqual([[-1, -10], [-1, -4], [1, -10], [1, -4]]);
});

it('finds the footprints that are on the board, under the references the preview gives them', () => {
    const shape = (ref: string, x: number) => ({reference: ref, ...footprint(x, 0, 0, {drawings: [{layer: 'F.CrtYd', start: {x: -1, y: -1}, end: {x: 1, y: 1}}]})});
    const board = [shape('SW1', 0), shape('D1', 0), shape('hole', 30)];
    const keys1 = {where: true}, keys2 = {where: ['k1']}, diodes = {where: true}, hole = {where: {ref: 'k1'}};
    const meta = {name: 'k1', index: 1};
    const instances = footprintInstances(board, {
        keys1: {point: {x: 0, y: 0, r: 0, meta}, config: keys1},
        keys2: {point: {x: 0, y: 0, r: 0, meta}, config: keys2},
        diodes: {point: {x: 0, y: 0, r: 0, meta}, config: diodes},
        hole: {point: {x: 30, y: 0, r: 0, meta}, config: hole},
    }, {keys1, keys2, diodes, hole});
    // of the two key footprints on k1 only the last is on the board
    expect(instances.map(i => [i.name, i.keyName])).toEqual([['keys2', 'k1'], ['diodes', 'k1'], ['hole', 'k1']]);
});
