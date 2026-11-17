import {expect, it} from "vitest";
import {gltfParts} from "./models";

// a binary glTF file of one triangle, 1 mm a side, on a node moved by (10, 20, 3) mm
const glb = () => {
    const bin = new Float32Array([0, 0, 0, 0.001, 0, 0, 0, 0.001, 0]);
    const json = new TextEncoder().encode(JSON.stringify({
        asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0]}],
        nodes: [{mesh: 0, translation: [0.01, 0.02, 0.003]}],
        meshes: [{primitives: [{attributes: {POSITION: 0}, material: 0}]}],
        materials: [{pbrMetallicRoughness: {baseColorFactor: [0.5, 0.25, 0.125, 1]}}],
        accessors: [{bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0.001, 0.001, 0]}],
        bufferViews: [{buffer: 0, byteOffset: 0, byteLength: bin.byteLength}],
        buffers: [{byteLength: bin.byteLength}],
    }));
    const jsonLength = Math.ceil(json.length / 4) * 4;
    const out = new ArrayBuffer(12 + 8 + jsonLength + 8 + bin.byteLength);
    const view = new DataView(out);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, out.byteLength, true);
    view.setUint32(12, jsonLength, true);
    view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(out, 20, jsonLength).fill(0x20).set(json);
    view.setUint32(20 + jsonLength, bin.byteLength, true);
    view.setUint32(24 + jsonLength, 0x004e4942, true);
    new Uint8Array(out, 28 + jsonLength).set(new Uint8Array(bin.buffer));
    return out;
};

it('reads a glTF file in mm with z up, its nodes moving its meshes, and its colours as they are', async () => {
    const parts = await gltfParts(glb());
    expect(parts).toHaveLength(1);
    // glTF's y up is the view's z, its z the view's -y
    expect(Array.from(parts[0].position).map(v => +v.toFixed(4))).toEqual([10, -3, 20, 11, -3, 20, 10, -3, 21]);
    expect(Array.from(parts[0].index)).toEqual([0, 1, 2]);
    expect(parts[0].color).toEqual([0.5, 0.25, 0.125]);
});
