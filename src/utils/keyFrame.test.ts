import {expect, it} from "vitest";
import {fromFrame, nearestKey, shiftFrom, toFrame} from "./keyFrame";

const close = (v: { x: number, y: number }) => [Number(v.x.toFixed(6)), Number(v.y.toFixed(6))];

it('takes an offset into a turned frame and back', () => {
    // a key turned a quarter turn counter-clockwise has its x pointing up the board
    expect(close(toFrame({x: 0, y: 1}, {r: 90, mirrored: false}))).toEqual([1, 0]);
    expect(close(toFrame({x: 1, y: 0}, {r: 90, mirrored: false}))).toEqual([0, -1]);
    const frame = {r: 25, mirrored: false};
    expect(close(fromFrame(toFrame({x: 3, y: -4}, frame), frame))).toEqual([3, -4]);
});

it('mirrors x on a mirrored key', () => {
    expect(close(toFrame({x: 2, y: 3}, {r: 0, mirrored: true}))).toEqual([-2, 3]);
    const frame = {r: -25, mirrored: true};
    expect(close(fromFrame(toFrame({x: 3, y: -4}, frame), frame))).toEqual([3, -4]);
});

it('finds the nearest key, of those it may use', () => {
    const points: Record<string, { x: number, y: number, r: number, meta?: { mirrored?: boolean } }> =
        {a: {x: 0, y: 0, r: 0}, b: {x: 10, y: 0, r: 0}, mirror_c: {x: 4, y: 0, r: 0, meta: {mirrored: true}}};
    expect(nearestKey(points, {x: 3, y: 0})).toBe('mirror_c');
    expect(nearestKey(points, {x: 3, y: 0}, (_, p) => !p.meta?.mirrored)).toBe('a');
    expect(nearestKey({}, {x: 0, y: 0})).toBeNull();
});

it('writes a point as a shift from a key, and says where the rounded shift lands', () => {
    const key = {x: 10, y: 0, r: 90};
    const exact = shiftFrom(key, {x: 10, y: 5});
    expect(close({x: exact.shift[0], y: exact.shift[1]})).toEqual([5, 0]);
    const rounded = shiftFrom(key, {x: 10.04, y: 5.26}, 0.1);
    expect(rounded.shift.map(v => Number(v.toFixed(6)))).toEqual([5.3, 0]);
    expect(close(rounded.at)).toEqual([10, 5.3]);
    // a mirrored key shifts x the other way
    const mirrored = shiftFrom({x: 0, y: 0, r: 0, meta: {mirrored: true}}, {x: 2, y: 1});
    expect(close({x: mirrored.shift[0], y: mirrored.shift[1]})).toEqual([-2, 1]);
});
