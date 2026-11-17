// The 3D view's scene as a binary glTF file (.glb), for Blender and other 3D tools: the board, a node per footprint
// named by its reference holding its models, and the case parts shown, each where the view stacks it. glTF counts in
// metres with y up, the view in mm with z up. The exporter of this three.js writes no instancing, so each instance
// becomes a node of its own; the nodes of one model share its mesh, which the file holds once.
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

    const groups: Record<string, Group> = {};
    const group = (reference: string) => {
        if (!groups[reference]) {
            groups[reference] = new Group();
            groups[reference].name = reference;
            frame.add(groups[reference]);
        }
        return groups[reference];
    };
    const place = (mesh: Mesh, matrix: Matrix4, parent: Object3D) => {
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(matrix);
        parent.add(mesh);
    };

    // every mesh shown, in root's own frame: ergogen's x and y, so the case STLs line up, and z as stacked
    root.updateMatrixWorld(true);
    const frameInverse = new Matrix4().copy(root.matrixWorld).invert();
    const instance = new Matrix4();
    root.traverseVisible(object => {
        const at = new Matrix4().multiplyMatrices(frameInverse, object.matrixWorld);
        if ((object as InstancedMesh).isInstancedMesh) {
            const instanced = object as InstancedMesh;
            const names = (instanced.userData as InstanceNames).footprints || [];
            for (let i = 0; i < instanced.count; i++) {
                instanced.getMatrixAt(i, instance);
                const mesh = new Mesh(instanced.geometry, instanced.material);
                mesh.name = instanced.name;
                place(mesh, new Matrix4().multiplyMatrices(at, instance), group(names[i] || 'footprint'));
            }
        } else if ((object as Mesh).isMesh) {
            const mesh = new Mesh((object as Mesh).geometry, (object as Mesh).material);
            mesh.name = object.name;
            place(mesh, at, frame);
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
