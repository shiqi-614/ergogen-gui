// Where a footprint's 3D model goes, the way KiCad's 3D viewer puts it there (render_3d_opengl.cpp,
// get3dModelsFromFootprint). The frame is the 3D view's: mm, x as on the board, y up (the board's y negated),
// the board's bottom at z = 0 and its top at z = thickness. Models are taken to be in mm.
import {Matrix4} from "three";
import {Model3d, PlacedFootprint} from "./board";

const DEG = Math.PI / 180;

export const modelMatrix = (fp: PlacedFootprint, model: Model3d, thickness: number): Matrix4 => {
    const m = new Matrix4().makeTranslation(fp.at[0], -fp.at[1], fp.back ? 0 : thickness);
    const then = (next: Matrix4) => m.multiply(next);
    then(new Matrix4().makeRotationZ(fp.angle * DEG));
    // a footprint on the back is turned over: half a turn about y, then about z
    if (fp.back) {
        then(new Matrix4().makeRotationY(Math.PI));
        then(new Matrix4().makeRotationZ(Math.PI));
    }
    then(new Matrix4().makeTranslation(model.offset[0], model.offset[1], model.offset[2]));
    then(new Matrix4().makeRotationZ(-model.rotate[2] * DEG));
    then(new Matrix4().makeRotationY(-model.rotate[1] * DEG));
    then(new Matrix4().makeRotationX(-model.rotate[0] * DEG));
    then(new Matrix4().makeScale(model.scale[0], model.scale[1], model.scale[2]));
    return m;
};
