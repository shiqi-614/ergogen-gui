import {expect, it} from "vitest";
import {findLayerCollisions, shadowOf, Slab, TOLERANCE} from "./collisions";

const area = (points: [number, number][]) => points.reduce((sum, [x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length];
    return sum + (x0 * y1 - x1 * y0) / 2;
}, 0);

it('sees a flat triangle inside the heights from above, counter-clockwise', () => {
    // given clockwise
    const s = shadowOf([[0, 0, 1], [0, 1, 1], [1, 0, 1]], 0, 2)!;
    expect(area(s)).toBeCloseTo(0.5, 9);
});

it('keeps only what lies between the two heights', () => {
    // a slope from z = 0 at x = 0 to z = 4 at x = 4, cut at z = 1 and z = 2: the strip x 1..2
    const s = shadowOf([[0, 0, 0], [4, 0, 4], [4, 4, 4]], 1, 2)!;
    expect(Math.min(...s.map(p => p[0]))).toBeCloseTo(1, 9);
    expect(Math.max(...s.map(p => p[0]))).toBeCloseTo(2, 9);
    expect(shadowOf([[0, 0, 3], [1, 0, 3], [0, 1, 3]], 1, 2)).toBeNull();
});

it('makes a wall a strip half the tolerance to either side, so a wall on the edge of the material stays clear', () => {
    const s = shadowOf([[0, 0, 0], [10, 0, 0], [10, 0, 5]], 1, 2)!;
    expect(area(s)).toBeGreaterThan(0);
    expect(Math.max(...s.map(p => Math.abs(p[1])))).toBeCloseTo(TOLERANCE / 2, 9);
});

it('finds case parts that run into each other, but not one that only lies on another, once a pair', async () => {
    const wasm = (await import('manifold-3d')).default;
    const m = await wasm();
    m.setup();
    // as caseSlabs makes them: heights and material shrunk by the tolerance
    const slab = (name: string, z0: number, z1: number, x0: number, w: number): Slab => {
        const material = m.CrossSection.square([w, 10]).translate([x0, 0]).offset(-TOLERANCE, 'Miter');
        return {name, z0: z0 + TOLERANCE, z1: z1 - TOLERANCE, material, box: material.bounds()};
    };
    const slabs = [
        slab('plate', 0, 3, 0, 10),
        // a leg under the plate that reaches 1 mm up into it, 2 mm in from its edge
        slab('leg', -6, 1, 8, 4), slab('leg', -12, -6, 8, 4),
        // another, right under the plate: it touches it, no more
        slab('foot', -6, 0, 0, 4),
    ];
    const found = findLayerCollisions(slabs);
    expect(found.map(c => [c.reference, c.layer])).toEqual([['plate', 'leg']]);
    expect(found[0].area).toBeCloseTo((2 - 2 * TOLERANCE) * (10 - 2 * TOLERANCE), 3);
    slabs.forEach(s => s.material.delete());
});
