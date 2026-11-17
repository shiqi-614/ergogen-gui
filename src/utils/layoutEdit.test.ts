import {expect, it} from "vitest";
import {addOutline, caseLines, caseReferences, deleteCase, insertIntoStack, mirrorCaseLines, stacksWith, addPcbOutline, appendEntry, appendListItem, appendOutline, applyEdits, deleteEntry, deleteListItem, deleteOutline, deleteOutlinePart, findAnchorShift, findChildShift, findChildValue, findItemSites, findPartSites, findShift, findSite, findValue, findWhereList, formatLength, insertPolygonPoint, moveListItem, nudge, outlineReferences, parseLength, partLines, pcbOutlines, plateLines, removePolygonPoint, EditSite} from "./layoutEdit";

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

const polygon = `outlines:
  board:
    - what: polygon
      points:
        - ref: a
          shift: [0, 1]
        - ref: b # second
          shift: [2, 3]
      fillet: 1
`;

it('inserts and removes polygon points as whole list items', () => {
    const path = ['outlines', 'board', 0, 'points'];
    expect(insertPolygonPoint(polygon, path, 1, {ref: 'c', shift: ['4', '5']}))
        .toContain('          shift: [0, 1]\n        - ref: c\n          shift: [4, 5]\n        - ref: b # second\n');
    expect(insertPolygonPoint(polygon, path, 2, {ref: 'c', shift: ['4', '5']}))
        .toContain('          shift: [2, 3]\n        - ref: c\n          shift: [4, 5]\n      fillet: 1\n');
    expect(removePolygonPoint(polygon, path, 0)).toContain('      points:\n        - ref: b # second\n          shift: [2, 3]\n      fillet: 1\n');
    expect(removePolygonPoint(polygon, path, 1)).toContain('          shift: [0, 1]\n      fillet: 1\n');
});

it('writes a plate template for one half of a split board', () => {
    expect(appendOutline('points: {}\n', 'plate', plateLines(14, false))).toContain("      where: '/^(?!mirror_)/'\n      size: [1kx, 1ky]");
});

it('writes a plate template', () => {
    expect(appendOutline('points: {}\n', 'plate', plateLines(14))).toBe('points: {}\noutlines:\n  plate:\n'
        + '    - what: rectangle\n      where: true\n      size: [1kx, 1ky]\n      bound: true\n'
        + '    - what: rectangle\n      where: true\n      size: 14\n      operation: subtract\n');
});

const used = `outlines:
  cut:
    - what: polygon
      points:
        - ref: a
  holes:
    a:
      what: circle
      where: &pos1
        ref: a
    b:
      what: circle
      where: *pos1
  board:
    - what: outline
      name: cut
      operation: subtract
    - what: rectangle
      size: 2
pcbs:
  main:
    outlines:
      edge:
        outline: cut
      other:
        outline: board
cases:
  top:
    - what: outline
      name: board
    - what: outline
      name: cut
      operation: subtract
`;

it('finds where an outline is used', () => {
    expect(outlineReferences(used, 'cut').map(r => r.label)).toEqual(['outlines.board.0', 'pcbs.main.outlines.edge', 'cases.top.1']);
});

it('deletes an outline, with or without what uses it', () => {
    const alone = deleteOutline(used, 'cut', false);
    expect(alone).not.toContain('  cut:\n');
    expect(alone).toContain('      name: cut\n');
    const all = deleteOutline(used, 'cut', true);
    expect(all).toBe(`outlines:
  holes:
    a:
      what: circle
      where: &pos1
        ref: a
    b:
      what: circle
      where: *pos1
  board:
    - what: rectangle
      size: 2
pcbs:
  main:
    outlines:
      other:
        outline: board
cases:
  top:
    - what: outline
      name: board
`);
});

it('deletes a part, but not one whose anchor is still used', () => {
    expect(deleteOutlinePart(used, 'board', 1)).toContain('      operation: subtract\npcbs:');
    expect(deleteOutlinePart(used, 'holes', 'b')).toContain('        ref: a\n  board:');
    expect(() => deleteOutlinePart(used, 'holes', 'a')).toThrow(/&pos1/);
    expect(() => deleteOutline(used, 'holes', true)).not.toThrow();
});

const pcbConfig = `pcbs:
  right:
    footprints:
      hole:
        what: x
        where: &pos
          ref: a
          shift: [1, 2]
    modules:
      usb:
        what:
          github:
            repo: "r"
            file: "usb.kicad_pcb"
        where:
          ref: [a]
          shift: [0, 16]

cases: {}
`;

it('adds a part after the last one, as a shift from a key', () => {
    const out = appendEntry(pcbConfig, ['pcbs', 'right', 'modules'], 'joystick', partLines('r', 'joy.kicad_pcb', 'b', ['3', '-4']));
    expect(out).toContain(`          shift: [0, 16]
      joystick:
        what:
          github:
            repo: "r"
            file: "joy.kicad_pcb"
        where:
          ref: b
          shift: [3, -4]

cases: {}`);
    expect(() => appendEntry(pcbConfig, ['pcbs', 'right', 'modules'], 'usb', [])).toThrow(/already/);
    expect(() => appendEntry(pcbConfig, ['pcbs', 'left', 'modules'], 'x', [])).toThrow(/no pcbs.left.modules/);
});

it('deletes an entry', () => {
    expect(deleteEntry(pcbConfig, ['pcbs', 'right', 'modules'], 'usb')).toContain('    modules:\n\ncases: {}');
    expect(() => deleteEntry(pcbConfig, ['pcbs', 'right', 'footprints'], 'hole')).not.toThrow();
});

const footprints = `pcbs:
  right:
    footprints:
      diodes:
        what: x
        where: true
        adjust:
          shift: [0, -8.4]
          rotate: 180
        side: back
      stab:
        what: y
        where: [thumbs_col2_row5, thumbs_col3_row5] # two keys
      led:
        what: z
        where: matrix_col0_row0
        adjust.rotate: 90
`;
const fp = (name: string) => ['pcbs', 'right', 'footprints', name];

it('finds or adds the adjust of a footprint, nested or dotted', () => {
    const shift = findChildShift(footprints, fp('diodes'), 'adjust');
    if (typeof shift === 'string') throw new Error(shift);
    expect(shift.raw).toEqual(['0', '-8.4']);
    const ledShift = findChildShift(footprints, fp('led'), 'adjust');
    if (typeof ledShift === 'string') throw new Error(ledShift);
    expect(applyEdits(footprints, ledShift.edits('1', '2'))).toContain('      led:\n        adjust.shift: [1, 2]\n        what: z');
    expect((findChildValue(footprints, fp('led'), 'adjust', 'rotate') as EditSite).raw).toBe('90');
    expect((findChildValue(footprints, fp('diodes'), 'adjust', 'rotate') as EditSite).raw).toBe('180');
    expect(applyEdits(footprints, [{site: findChildValue(footprints, fp('stab'), 'adjust', 'rotate') as EditSite, value: '5'}]))
        .toContain('      stab:\n        adjust.rotate: 5\n        what: y');
    expect((findValue(footprints, fp('diodes'), 'side') as EditSite).raw).toBe('back');
});

it('reads and rewrites the keys a footprint is on', () => {
    const stab = findWhereList(footprints, fp('stab'));
    const led = findWhereList(footprints, fp('led'));
    if (typeof stab === 'string' || typeof led === 'string') throw new Error('no list');
    expect(stab.names).toEqual(['thumbs_col2_row5', 'thumbs_col3_row5']);
    expect(applyEdits(footprints, [{site: stab.site, value: '[thumbs_col2_row5]'}])).toContain('        where: [thumbs_col2_row5] # two keys\n');
    expect(led.names).toEqual(['matrix_col0_row0']);
    expect(findWhereList(footprints, fp('diodes'))).toMatch(/not a list/);
});

const boards = `pcbs:
  right:
    outlines:
      main:
        outline: board
    footprints:
      a: {}
  bare:
    footprints:
      a: {}
  empty:
    outlines:
    footprints: {}
`;

it('reads, adds and removes the outlines of a pcb', () => {
    expect(pcbOutlines(boards, 'right')).toEqual([{key: 'main', outline: 'board'}]);
    expect(pcbOutlines(boards, 'bare')).toEqual([]);
    expect(addPcbOutline(boards, 'right', 'cut')).toContain('      main:\n        outline: board\n      cut:\n        outline: cut\n    footprints:');
    expect(addPcbOutline(addPcbOutline(boards, 'right', 'cut'), 'right', 'cut')).toContain('      cut_2:\n        outline: cut\n');
    expect(addPcbOutline(boards, 'bare', 'board')).toContain('  bare:\n    outlines:\n      board:\n        outline: board\n    footprints:');
    expect(addPcbOutline(boards, 'empty', 'board')).toContain('  empty:\n    outlines:\n      board:\n        outline: board\n    footprints: {}');
    expect(deleteEntry(boards, ['pcbs', 'right', 'outlines'], 'main')).toContain('    outlines:\n    footprints:');
});

const caseConfig = `cases:
  top:
    - what: outline
      name: expand
      extrude: 3
    # the keys' holes
    - what: pcb
      name: /footprints.keys/
      extrude: 3
      operation: subtract
      layers: [Dwgs.User]
    - what: outline
      name: cut
      operation: subtract
  middle:
    - what: outline
      name: combo
`;
const top = ['cases', 'top'];

it('finds the settings of case parts, lists included', () => {
    const parts = findItemSites(caseConfig, top, ['name', 'extrude', 'layers', 'operation'] as const);
    if (typeof parts === 'string') throw new Error(parts);
    expect(parts.map(p => [p.key, p.what, (p.sites.name as EditSite).raw])).toEqual([[0, 'outline', 'expand'], [1, 'pcb', '/footprints.keys/'], [2, 'outline', 'cut']]);
    expect((parts[1].sites.layers as EditSite).raw).toBe('[Dwgs.User]');
    expect(applyEdits(caseConfig, [{site: parts[2].sites.extrude as EditSite, value: '5'}])).toContain('    - what: outline\n      extrude: 5\n      name: cut');
});

it('moves a case part up or down, its comment with it', () => {
    const up = moveListItem(caseConfig, top, 1, -1);
    expect(up).toContain(`  top:
    # the keys' holes
    - what: pcb
      name: /footprints.keys/
      extrude: 3
      operation: subtract
      layers: [Dwgs.User]
    - what: outline
      name: expand
      extrude: 3
    - what: outline
      name: cut`);
    const down = moveListItem(caseConfig, top, 1, 1);
    expect(down).toContain(`      extrude: 3
    - what: outline
      name: cut
      operation: subtract
    # the keys' holes
    - what: pcb
      name: /footprints.keys/
      extrude: 3
      operation: subtract
      layers: [Dwgs.User]
  middle:`);
    expect(moveListItem(caseConfig, top, 0, -1)).toBe(caseConfig);
    expect(moveListItem(moveListItem(caseConfig, top, 1, 1), top, 2, -1)).toBe(caseConfig);
});

it('deletes a case part with its comment, and adds one at the end', () => {
    expect(deleteListItem(caseConfig, top, 1)).toContain('      extrude: 3\n    - what: outline\n      name: cut');
    expect(deleteListItem(caseConfig, top, 1)).not.toContain('keys');
    expect(appendListItem(caseConfig, top, ['what: outline', 'name: board', 'extrude: 2', 'operation: subtract']))
        .toContain('      operation: subtract\n    - what: outline\n      name: board\n      extrude: 2\n      operation: subtract\n  middle:');
});

const cases = `cases:
  right_top:
    - what: outline
      name: expand
      extrude: 3
    # the keys' holes
    - what: pcb
      name: /footprints.keys/
      operation: subtract
  right_lid:
    - what: case
      name: right_top
    - what: outline
      name: cut
      operation: subtract
  left_top:
    mirror:
      from: right_top

assemblies:
  right:
    stack: [right_bottom, {name: right_top, gap: 1}, right_lid]
  left:
    stack: [left_bottom, left_top]
`;

it("copies a case's parts, comments and all", () => {
    expect(caseLines(cases, 'right_top')).toEqual(['- what: outline', '  name: expand', '  extrude: 3', "# the keys' holes",
        '- what: pcb', '  name: /footprints.keys/', '  operation: subtract']);
    const added = appendEntry(cases, ['cases'], 'right_copy', caseLines(cases, 'right_top'));
    expect(added).toContain("  right_copy:\n    - what: outline\n      name: expand\n      extrude: 3\n    # the keys' holes\n    - what: pcb");
    expect(appendEntry(cases, ['cases'], 'left_copy', mirrorCaseLines('right_copy'))).toContain('  left_copy:\n    mirror:\n      from: right_copy\n');
});

it('finds and changes the stacks a case is in', () => {
    expect(stacksWith(cases, 'right_top')).toEqual([{assembly: 'right', index: 1}]);
    expect(insertIntoStack(cases, 'right', 'right_mid', 2)).toContain('stack: [right_bottom, {name: right_top, gap: 1}, right_mid, right_lid]');
    expect(insertIntoStack(cases, 'left', 'left_mid', 9)).toContain('stack: [left_bottom, left_top, left_mid]');
});

it('says what uses a case, and deletes it with them', () => {
    expect(caseReferences(cases, 'right_top')).toEqual({mirrors: ['left_top'], stacks: ['right'], parts: ['right_lid.0']});
    const out = deleteCase(cases, 'right_top');
    expect(out).toBe(`cases:
  right_lid:
    - what: outline
      name: cut
      operation: subtract

assemblies:
  right:
    stack: [right_bottom, right_lid]
  left:
    stack: [left_bottom]
`);
    expect(deleteCase(cases, 'right_top', false)).toContain('  left_top:\n    mirror:\n      from: right_top');
});
