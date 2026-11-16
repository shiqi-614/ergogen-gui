import {expect, it} from "vitest";
import {addOutline, applyEdits, findAnchorShift, findPartSites, findShift, findSite, formatLength, nudge, parseLength, EditSite} from "./layoutEdit";

const config = `points:
  zones:
    matrix:
      columns:
        col0:
          key:
            stagger: -2.5 # keep me
          rows.row4.skip: true
        col1:
        col2:
          key.stagger: 3
        col3:
          rows.row4.asym: clone
        col4:
          key:
            width: 1.5kx
      rows:
        row0:
`;

const write = (col: string, attr: 'stagger' | 'spread' | 'splay', value: string) => {
    const site = findSite(config, 'matrix', col, attr);
    if (typeof site === 'string') throw new Error(site);
    return applyEdits(config, [{site, value}]);
};

it('replaces a nested value and keeps its comment', () => {
    expect((findSite(config, 'matrix', 'col0', 'stagger') as EditSite).raw).toBe('-2.5');
    expect(write('col0', 'stagger', '1.5')).toContain('            stagger: 1.5 # keep me\n');
});

it('replaces a dotted value', () => {
    expect(write('col2', 'stagger', '4')).toContain('          key.stagger: 4\n');
});

it('adds a value to an empty column', () => {
    expect(write('col1', 'spread', '20')).toContain('        col1:\n          key.spread: 20\n        col2:');
});

it('adds a value to a column without a key map', () => {
    expect(write('col3', 'splay', '-5')).toContain('        col3:\n          key.splay: -5\n          rows.row4.asym: clone');
});

it('adds a value into an existing key map', () => {
    expect(write('col4', 'stagger', '2')).toContain('          key:\n            stagger: 2\n            width: 1.5kx');
});

it('changes nothing else', () => {
    const out = write('col0', 'stagger', '-2.5');
    expect(out).toBe(config);
});

it('explains what it cannot edit', () => {
    expect(findSite(config, 'thumbs', 'col0', 'stagger')).toMatch(/not a plain map/);
    expect(findSite(config, 'matrix', 'col9', 'stagger')).toMatch(/not written out/);
    expect(findSite('points: [', 'matrix', 'col0', 'stagger')).toMatch(/YAML errors/);
});

const zones = `points:
  zones:
    matrix:
      columns:
        col0:
    thumbs:
      anchor:
        ref: matrix_col1_row4
        shift: [-2.37kx, -2.2kx] # move me
        rotate: 25
      columns:
        col0:
    extra:
      anchor:
        ref: matrix_col0_row0
      columns:
        col0:
`;

it('writes into an existing anchor shift and keeps its comment', () => {
    const anchor = findAnchorShift(zones, 'thumbs');
    if (typeof anchor === 'string') throw new Error(anchor);
    expect(anchor.raw).toEqual(['-2.37kx', '-2.2kx']);
    expect(applyEdits(zones, anchor.edits('-2kx', '-3kx'))).toContain('        shift: [-2kx, -3kx] # move me\n');
});

it('adds a shift to an anchor, or an anchor to a zone', () => {
    const extra = findAnchorShift(zones, 'extra');
    const matrix = findAnchorShift(zones, 'matrix');
    if (typeof extra === 'string' || typeof matrix === 'string') throw new Error('no anchor');
    expect(applyEdits(zones, extra.edits('1', '2'))).toContain('      anchor:\n        shift: [1, 2]\n        ref: matrix_col0_row0');
    expect(applyEdits(zones, matrix.edits('1', '2'))).toContain('    matrix:\n      anchor.shift: [1, 2]\n      columns:');
});

it('reads and writes lengths in their units', () => {
    const units = {kx: 19, u: 19};
    const length = parseLength('-2.37kx', units);
    expect(length).toEqual({mm: -2.37 * 19, unit: 'kx', scale: 19});
    expect(formatLength(-38, length)).toBe('-2kx');
    expect(parseLength('u', units)).toEqual({mm: 19, unit: 'u', scale: 19});
    expect(parseLength('2.5', units)).toEqual({mm: 2.5});
    expect(parseLength('u + 2', units)).toBeNull();
    expect(formatLength(1.234)).toBe('1.23');
});

const outlines = `outlines:
  board:
    - what: polygon
      points:
        - ref: matrix_col1_row0
          shift: [-9.5 + 25, 1ky + 14] # first
        - ref: matrix_col1_row0
  holes:
    a:
      what: circle
      where: &pos1
        ref: [matrix_col0_row0]
        shift: [-1.55kx, 1ky]
  studs:
    - what: hexagon
      where:
        <<: *pos1
      radius: 2
`;

it('finds a polygon point shift, or adds one', () => {
    const first = findShift(outlines, ['outlines', 'board', 0, 'points', 0]);
    const second = findShift(outlines, ['outlines', 'board', 0, 'points', 1]);
    if (typeof first === 'string' || typeof second === 'string') throw new Error('no shift');
    expect(first.raw).toEqual(['-9.5 + 25', '1ky + 14']);
    expect(applyEdits(outlines, first.edits('-9.5 + 26', '1ky + 15'))).toContain('shift: [-9.5 + 26, 1ky + 15] # first');
    expect(applyEdits(outlines, second.edits('1', '2'))).toContain('        - shift: [1, 2]\n          ref: matrix_col1_row0\n');
});

it('follows a merge to the anchor it shares', () => {
    const merged = findShift(outlines, ['outlines', 'studs', 0, 'where']);
    if (typeof merged === 'string') throw new Error(merged);
    expect(merged.raw).toEqual(['-1.55kx', '1ky']);
    expect(applyEdits(outlines, merged.edits('-1.6kx', '1ky'))).toContain('      where: &pos1\n        ref: [matrix_col0_row0]\n        shift: [-1.6kx, 1ky]');
});

it('nudges a coordinate and keeps how it is written', () => {
    const units = {kx: 19, ky: 19};
    expect(nudge('12', 1.5, units)).toBe('13.5');
    expect(nudge('0.8kx', 1.9, units)).toBe('0.9kx');
    expect(nudge('0.8kx', 1, units)).toBe('0.85kx');
    expect(nudge('0.8kx', 1, units, true)).toBe('0.8kx + 1');
    expect(nudge('1ky + 12', 1.5, units)).toBe('1ky + 13.5');
    expect(nudge('0 - 25', -2, units)).toBe('0 - 27');
    expect(nudge('1ky + 2', -3, units)).toBe('1ky - 1');
    expect(nudge(undefined, -2.5, units)).toBe('-2.5');
    expect(nudge('2 * kx', 1, units)).toBe('2 * kx + 1');
});

it('adds a new polygon outline after the last one', () => {
    const config = `points:\n  zones: {}\noutlines:\n  board:\n    - what: polygon\n      points:\n        - ref: a\n\npcbs:\n  x: 1\n`;
    const out = addOutline(config, 'cut', [{ref: 'a', shift: ['1', '2']}, {ref: 'b', shift: ['-3', '4.5']}]);
    expect(out).toBe(`points:\n  zones: {}\noutlines:\n  board:\n    - what: polygon\n      points:\n        - ref: a\n`
        + `  cut:\n    - what: polygon\n      points:\n        - ref: a\n          shift: [1, 2]\n        - ref: b\n          shift: [-3, 4.5]\n`
        + `\npcbs:\n  x: 1\n`);
    expect(() => addOutline(config, 'board', [])).toThrow(/already/);
    expect(() => addOutline(config, 'no good', [])).toThrow(/can't be/);
});

it('starts an outlines section when there is none', () => {
    expect(addOutline('points: {}', 'cut', [{ref: 'a', shift: ['0', '0']}]))
        .toBe('points: {}\noutlines:\n  cut:\n    - what: polygon\n      points:\n        - ref: a\n          shift: [0, 0]\n');
});

it('adds the outline before trailing lines of spaces', () => {
    const config = `outlines:\n  board:\n    - what: circle\n  \n\npcbs: {}\n`;
    expect(addOutline(config, 'cut', [{ref: 'a', shift: ['0', '0']}]))
        .toBe(`outlines:\n  board:\n    - what: circle\n  cut:\n    - what: polygon\n      points:\n        - ref: a\n          shift: [0, 0]\n  \n\npcbs: {}\n`);
});

it('keeps six decimals for a snapped point', () => {
    const units = {kx: 19};
    expect(nudge('3', 0.123456789, units, true)).toBe('3.123457');
    expect(nudge('1ky + 2', 0.1 + 0.2, {ky: 19}, true)).toBe('1ky + 2.3');
    expect(nudge('0.8kx', 1 / 3, units, true)).toBe('0.8kx + 0.333333');
});

const parts = `outlines:
  board:
    - what: polygon # outer
      operation: stack
      points:
        - ref: a
      fillet: 0.9
  holes:
    left:
      what: circle
      radius: 2
`;

it('finds the settings of each outline part, or where to add them', () => {
    const board = findPartSites(parts, 'board');
    const holes = findPartSites(parts, 'holes');
    if (typeof board === 'string' || typeof holes === 'string') throw new Error('no parts');
    expect(board.map(p => [p.key, p.what])).toEqual([[0, 'polygon']]);
    const {fillet, expand, operation} = board[0].sites as Record<string, EditSite>;
    expect([fillet.raw, operation.raw, expand.raw]).toEqual(['0.9', 'stack', undefined]);
    expect(applyEdits(parts, [{site: expand, value: '2'}, {site: fillet, value: '1.5'}]))
        .toContain('    - what: polygon # outer\n      expand: 2\n      operation: stack\n      points:\n        - ref: a\n      fillet: 1.5\n');
    expect(holes.map(p => [p.key, p.what])).toEqual([['left', 'circle']]);
    expect(applyEdits(parts, [{site: holes[0].sites.operation as EditSite, value: 'subtract'}]))
        .toContain('      what: circle\n      operation: subtract\n      radius: 2');
});
