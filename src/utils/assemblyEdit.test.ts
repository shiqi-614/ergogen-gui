import {expect, it} from "vitest";
import {writeStack} from "./assemblyEdit";

const CONFIG = `points: {}
# how the case stacks up
assemblies:
  ergocai_right:
    stack: [right_buttom, right_gap, right_switchplate]
    pcb:
      name: ergo_cai_right
      top: right_gap
  other:
    stack:
      - a
      - b
    pcb: board
`;

const parts = (...gaps: number[]) => ['right_buttom', 'right_gap', 'right_switchplate'].map((name, i) => ({name, gap: gaps[i]}));

it('writes the stack with the gaps that are not 0, and adds the board shift, leaving the rest as typed', () => {
    const out = writeStack(CONFIG, 'ergocai_right', {parts: parts(0, 0, 1.5), pcbShift: -0.25});
    expect(out).toBe(CONFIG
        .replace('[right_buttom, right_gap, right_switchplate]', '[right_buttom, right_gap, {name: right_switchplate, gap: 1.5}]')
        .replace('      top: right_gap\n', '      top: right_gap\n      shift: -0.25\n'));
});

it('changes a shift there is, and takes out one that comes back to 0', () => {
    const shifted = writeStack(CONFIG, 'ergocai_right', {parts: parts(0, 0, 0), pcbShift: 0.5});
    expect(writeStack(shifted, 'ergocai_right', {parts: parts(0, 0, 0), pcbShift: 1})).toContain('      shift: 1\n');
    expect(writeStack(shifted, 'ergocai_right', {parts: parts(0, 0, 0), pcbShift: 0})).toBe(CONFIG);
});

it('rewrites a block list as a list, and a board given by name as a map', () => {
    const out = writeStack(CONFIG, 'other', {parts: [{name: 'a', gap: 0}, {name: 'b', gap: 0.2}], pcbShift: 2});
    expect(out).toContain('    stack:\n      [a, {name: b, gap: 0.2}]\n    pcb: {name: board, shift: 2}\n');
    expect(out.startsWith(CONFIG.slice(0, CONFIG.indexOf('  other:')))).toBe(true);
});

it('says when there is nothing to write into', () => {
    expect(() => writeStack(CONFIG, 'missing', {parts: [], pcbShift: null})).toThrow(/assemblies.missing/);
});
