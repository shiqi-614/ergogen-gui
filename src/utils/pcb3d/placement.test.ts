import {expect, it} from "vitest";
import {Vector3} from "three";
import {Model3d, PlacedFootprint} from "./board";
import {modelMatrix} from "./placement";

const fp = (at: [number, number], angle: number, back = false): PlacedFootprint => ({reference: 'X1', at, angle, back, models: []});
const model = (offset: [number, number, number] = [0, 0, 0], rotate: [number, number, number] = [0, 0, 0]): Model3d =>
    ({path: 'm.step', offset, scale: [1, 1, 1], rotate, opacity: 1});
const where = (f: PlacedFootprint, m: Model3d, p: [number, number, number]) =>
    new Vector3(...p).applyMatrix4(modelMatrix(f, m, 1.6)).toArray().map(v => Math.round(v * 1e6) / 1e6 + 0);

it('puts a front model on the board top, with y up', () => {
    expect(where(fp([10, 20], 0), model([1, 2, 3]), [0, 0, 0])).toEqual([11, -18, 4.6]);
});

it('turns a model with its footprint, counter-clockwise from above', () => {
    expect(where(fp([10, 20], 90), model(), [1, 0, 0])).toEqual([10, -19, 1.6]);
});

it('turns a back model over: under the board, mirrored in y', () => {
    expect(where(fp([10, 20], 0, true), model(), [1, 2, 3])).toEqual([11, -22, -3]);
});

it('rotates a model by the negated angles KiCad applies, z then y then x', () => {
    // a keycap modelled with its top along +y stands up with (rotate (xyz 90 180 0)), as ErgoCaiLib's DSA keycaps do
    expect(where(fp([0, 0], 0), model([0, 0, 0], [90, 180, 0]), [0, 1, 0])).toEqual([0, 0, 2.6]);
    expect(where(fp([0, 0], 0), model([0, 0, 0], [0, 0, 90]), [1, 0, 0])).toEqual([0, -1, 1.6]);
});
