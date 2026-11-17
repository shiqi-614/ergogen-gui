// The 3D view's board as a binary glTF file (.glb), for Blender and other 3D tools: a node per footprint, named by
// its reference, holding its models. glTF counts in metres with y up, the view in mm with z up. The exporter of
// this three.js writes no instancing, so each instance becomes a node of its own; the nodes of one model share
// its mesh, which the file holds once.
import {Group, InstancedMesh, Matrix4, Mesh, Object3D, Scene} from "three";
import {GLTFExporter} from "three/examples/jsm/exporters/GLTFExporter";

// what the view puts on an InstancedMesh: the reference of the footprint each instance belongs to
export type InstanceNames = { footprints: string[] };

// name: the top node's, e.g. ergo_cai_right
export const exportGlb = (root: Object3D, name: string): Promise<ArrayBuffer> => {
    const frame = new Group();
    frame.name = name;
    frame.scale.setScalar(0.001);
    frame.rotation.x = -Math.PI / 2;
    const board = new Group();
    board.position.copy(root.position);
    frame.add(board);

    const footprints: Record<string, Group> = {};
    const footprint = (reference: string) => {
        if (!footprints[reference]) {
            footprints[reference] = new Group();
            footprints[reference].name = reference;
            board.add(footprints[reference]);
        }
        return footprints[reference];
    };
    const matrix = new Matrix4();
    root.children.forEach(child => {
        if ((child as InstancedMesh).isInstancedMesh) {
            const instanced = child as InstancedMesh;
            const names = (instanced.userData as InstanceNames).footprints || [];
            for (let i = 0; i < instanced.count; i++) {
                instanced.getMatrixAt(i, matrix);
                const mesh = new Mesh(instanced.geometry, instanced.material);
                mesh.name = instanced.name;
                mesh.matrixAutoUpdate = false;
                mesh.matrix.copy(matrix);
                footprint(names[i] || 'footprint').add(mesh);
            }
        } else if ((child as Mesh).isMesh) {
            const mesh = new Mesh((child as Mesh).geometry, (child as Mesh).material);
            mesh.name = child.name;
            board.add(mesh);
        }
    });

    const scene = new Scene();
    scene.add(frame);
    return new Promise((resolve, reject) => new GLTFExporter().parse(
        scene,
        result => resolve(result as ArrayBuffer),
        error => reject(error instanceof Error ? error : new Error(String(error))),
        {binary: true},
    ));
};
