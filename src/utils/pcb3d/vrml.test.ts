import {expect, it} from "vitest";
import {vrmlParts} from "./vrml";
import {mergeByColour} from "./models";

// the shape of KiCad's StepUp files: a DEF'd material used again, comments, commas
const KICAD = `#VRML V2.0 utf8
#kicad StepUp wrl exported
Shape {
    appearance Appearance {material DEF PIN-01 Material {
        diffuseColor 0.8 0.8 0.78
        transparency 0.0
        }
    }
    geometry IndexedFaceSet {
        creaseAngle 0.50
        coordIndex [0,1,2,3,-1]
        coord Coordinate { point [0 0 0,1 0 0,1 1 0,0 1 0]}
    }
}
Shape {
    appearance Appearance {material USE PIN-01 }
    geometry IndexedFaceSet { coordIndex [0,1,2] coord Coordinate { point [0 0 1, 1 0 1, 0 1 1] } }
}`;

it('reads shapes into triangles in mm, KiCad counting VRML in 0.1 inch', () => {
    const parts = vrmlParts(KICAD);
    expect(parts).toHaveLength(2);
    // the quad as two triangles, a corner each
    expect(parts[0].index).toHaveLength(6);
    expect(Array.from(parts[0].position.slice(6, 9))).toEqual([2.54, 2.54, 0].map(v => Math.fround(v)));
    expect(parts[1].color).toEqual(parts[0].color);
    expect(parts[0].color).toEqual([0.8, 0.8, 0.78]);
    // flat normals, out of the counter-clockwise side
    expect(Array.from(parts[0].normal!.slice(0, 3))).toEqual([0, 0, 1]);
});

it('applies Transform nodes, and turns "ccw FALSE" faces round', () => {
    const parts = vrmlParts(`#VRML V2.0 utf8
Transform { translation 1 0 0 rotation 0 0 1 1.5707963 scale 2 2 2 children [
    Shape { geometry IndexedFaceSet { ccw FALSE coordIndex [0 1 2 -1] coord Coordinate { point [0 0 0 1 0 0 0 1 0] } } }
] }`);
    expect(parts).toHaveLength(1);
    const p = Array.from(parts[0].position).map(v => Math.round(v * 1000) / 1000 + 0);
    // scaled by 2, turned a quarter, moved by (1, 0, 0), in mm; the corners in the order the face is drawn
    expect(p.slice(0, 3)).toEqual([2.54, 0, 0]);
    expect(p.slice(3, 6)).toEqual([-2.54, 0, 0]);
    expect(p.slice(6, 9)).toEqual([2.54, 5.08, 0]);
    expect(Array.from(parts[0].normal!.slice(0, 3)).map(v => Math.round(v) + 0)).toEqual([0, 0, -1]);
});

it('merges the parts of one colour, keeping only the corners they use', () => {
    const merged = mergeByColour(vrmlParts(KICAD).concat({
        position: new Float32Array([0, 0, 0, 9, 9, 9, 1, 0, 0, 0, 1, 0]), normal: null,
        index: new Uint32Array([0, 2, 3]), color: [1, 0, 0],
    }));
    expect(merged.map(p => [p.index.length, p.position.length / 3])).toEqual([[9, 9], [3, 3]]);
    // the unused corner (9, 9, 9) is gone
    expect(Array.from(merged[1].position)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(merged[1].normal).toBeNull();
});
