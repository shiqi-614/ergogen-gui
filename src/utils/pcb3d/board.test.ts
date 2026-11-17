import {expect, it} from "vitest";
import {arcPoints, chainLoops, placer, readBoard} from "./board";
import {parseSexpr} from "../sexpr";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

const boardWith = (items: string) => `(kicad_pcb (version 20241229) (general (thickness 1.2)) ${items})`;

it('reads lists, atoms and quoted strings with escapes', () => {
    const [node] = parseSexpr('(model "a \\"b\\" c" (offset (xyz 1 -2 0.5)) hide)');
    expect(node).toEqual(['model', 'a "b" c', ['offset', ['xyz', '1', '-2', '0.5']], 'hide']);
    expect(() => parseSexpr('(a (b)')).toThrow();
});

it('turns footprint coordinates the way KiCad does: counter-clockwise on screen, y down', () => {
    // a pad 1 mm to the right of a footprint turned by 90 degrees ends up 1 mm above it
    close(placer([10, 20], 90)([1, 0]), [10, 19]);
    close(placer([10, 20], 0)([1, 2]), [11, 22]);
});

it('draws an arc through its mid point, either way round', () => {
    const quarter = arcPoints([1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1]);
    quarter.forEach(([x, y]) => expect(Math.hypot(x, y)).toBeCloseTo(1, 6));
    expect(quarter.every(([x, y]) => x >= -1e-9 && y >= -1e-9)).toBe(true);
    const long = arcPoints([1, 0], [-1, 0], [0, 1]);
    expect(long.some(([, y]) => y < -0.9)).toBe(true);
});

it('chains lines given in any direction into one closed loop', () => {
    const loops = chainLoops([[[0, 0], [10, 0]], [[10, 10], [10, 0]], [[10, 10], [0, 10]], [[0, 0], [0, 10]]]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
    // an open line is no board edge
    expect(chainLoops([[[0, 0], [10, 0]], [[10, 0], [10, 10]]])).toHaveLength(0);
});

it('reads the board edge, holes, copper and models of a board', () => {
    const board = readBoard(boardWith(`
        (gr_line (start 0 0) (end 40 0) (layer "Edge.Cuts"))
        (gr_line (start 40 0) (end 40 30) (layer "Edge.Cuts"))
        (gr_arc (start 40 30) (mid 20 40) (end 0 30) (layer "Edge.Cuts"))
        (gr_line (start 0 30) (end 0 0) (layer "Edge.Cuts"))
        (gr_line (start 5 5) (end 6 6) (layer "F.SilkS"))
        (footprint "lib:SW" (layer "F.Cu") (at 10 10 90)
            (property "Reference" "SW1" (at 0 0 0) (layer "F.SilkS"))
            (pad "" np_thru_hole circle (at 0 0 90) (size 4 4) (drill 4) (layers "*.Cu" "*.Mask"))
            (pad "1" thru_hole oval (at 2 0 90) (size 2 3) (drill oval 1 2) (layers "*.Cu" "*.Mask"))
            (pad "2" smd roundrect (at -2 0 90) (size 1 1) (layers "F.Cu" "F.Mask") (roundrect_rratio 0.25))
            (model "\${ERGOCAI_LIB}/3dmodels/a.step" (offset (xyz 1 2 3)) (scale (xyz 1 1 1)) (rotate (xyz 90 0 0)))
            (model "\${ERGOCAI_LIB}/3dmodels/b.step" (hide yes))
            (model "\${ERGOCAI_LIB}/3dmodels/c.step" (opacity 0.5)))
        (footprint "lib:D" (layer "B.Cu") (at 20 20 0)
            (fp_text reference "D1" (at 0 0) (layer "B.SilkS"))
            (pad "1" smd rect (at 0 0 0) (size 1 1) (layers "B.Cu" "B.Mask")))
        (via (at 30 5) (size 0.6) (drill 0.3) (layers "F.Cu" "B.Cu"))`));
    expect(board.thickness).toBe(1.2);
    expect(board.outline).toHaveLength(1);
    expect(Math.max(...board.outline[0].map(p => p[1]))).toBeCloseTo(40, 3);

    const [sw, d] = board.footprints;
    expect([sw.reference, sw.back, sw.angle]).toEqual(['SW1', false, 90]);
    expect([d.reference, d.back]).toEqual(['D1', true]);
    expect(sw.models.map(m => m.path)).toEqual(['${ERGOCAI_LIB}/3dmodels/a.step', '${ERGOCAI_LIB}/3dmodels/c.step']);
    expect(sw.models[0]).toMatchObject({offset: [1, 2, 3], scale: [1, 1, 1], rotate: [90, 0, 0], opacity: 1});
    expect(sw.models[1].opacity).toBe(0.5);

    // the mounting hole, the slot (2 long, turned with its pad) and the via
    expect(board.holes).toHaveLength(3);
    close(board.holes[0].at, [10, 10]);
    expect(board.holes[1]).toMatchObject({w: 2, h: 1, angle: 180});
    close(board.holes[1].at, [10, 8]);
    // no copper for the mounting hole: the oval pad and the via on both sides, the SMD pads on one each
    expect(board.copper.map(c => [c.front, c.back])).toEqual([[true, true], [true, false], [false, true], [true, true]]);
});

it('reads the old KiCad 5 offset in inches', () => {
    const board = readBoard(boardWith('(module "x" (layer "F.Cu") (at 0 0) (model "a.wrl" (at (xyz 0.1 0 0)) (scale (xyz 1 1 1)) (rotate (xyz 0 0 0))))'));
    close(board.footprints[0].models[0].offset, [2.54, 0, 0]);
});
