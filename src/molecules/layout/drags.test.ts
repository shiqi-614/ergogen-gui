import {expect, it} from "vitest";
import {stepDrag, RotateDrag, KeyDrag} from "./drags";
import {pointAt} from "./drawing";
import {EditSite} from "../../utils/layoutEdit";

const site = (text: string, raw: string): EditSite => {
    const start = text.indexOf(raw);
    return {start, end: start + raw.length, raw, render: v => v};
};
const input = (x: number, y: number, shiftKey = false) => ({now: {x, y}, shiftKey, snap: 1, units: {u: 19}});

it('turns a column by the angle around its pivot, in half degrees, the other way on the mirrored half', () => {
    const text = 'splay: 0';
    const d: RotateDrag = {kind: 'rotate', sourceText: text, sign: 1, pivot: {x: 0, y: 0}, startAngle: 0, base: 0,
        site: site(text, '0'), withRest: new Set(['a']), pivots: {}};
    const step = stepDrag(d, input(10, 1.2))!;
    expect(step.text).toBe('splay: 7');
    expect(step.transform?.angle).toBe(7);
    expect(stepDrag({...d, sign: -1}, input(10, 1.2))!.text).toBe('splay: -7');
});

it("moves a key by its own shift, in its frame, keeping a unit as written", () => {
    const text = 'shift: [1u, 0]';
    const d: KeyDrag = {kind: 'key', name: 'k', sourceText: text, start: {x: 0, y: 0}, sign: 1, frame: 90,
        raw: ['1u', '0'], site: site(text, '[1u, 0]'), names: new Set(['k', 'mirror_k'])};
    // turned a quarter: up the board is the key's x
    const step = stepDrag(d, input(0, 1.9))!;
    expect(step.text).toBe('shift: [1.1u, 0]');
    expect(step.transform?.dy).toBeCloseTo(1.9);
});

it('snaps a drawn point level with the last one, and closes on the first', () => {
    const points = {a: {x: 0, y: 0, r: 0, meta: {} as any}} as any;
    const drawing = {name: 'o', points: [
        {ref: 'a', shift: [0, 0] as [number, number], at: {x: 0, y: 0}},
        {ref: 'a', shift: [10, 0] as [number, number], at: {x: 10, y: 0}},
        {ref: 'a', shift: [10, 10] as [number, number], at: {x: 10, y: 10}},
    ]};
    const level = pointAt(points, drawing, {x: 20, y: 10.3}, 10)!;
    expect(level.point.at.y).toBe(10);
    expect(level.guides.length).toBe(1);
    expect(pointAt(points, drawing, {x: 0.2, y: 0.3}, 10)!.closes).toBe(true);
});
