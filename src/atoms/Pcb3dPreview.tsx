import {Fragment, useEffect, useRef, useState} from "react";
import CaseParts, {MadePart} from "../molecules/CaseParts";
import styled from "styled-components";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader";
import {BoardData, Model3d, PlacedFootprint, readBoard} from "../utils/pcb3d/board";
import {boardSection, buildBoard, loadManifold} from "../utils/pcb3d/boardMesh";
import {Body, caseSlabs, Collision, findCollisions, Slab, stlSolid, TOLERANCE} from "../utils/pcb3d/collisions";
import {MeshPart} from "../utils/pcb3d/meshCache";
import {loadModel, loadSources} from "../utils/pcb3d/models";
import {modelMatrix} from "../utils/pcb3d/placement";
import {exportGlb, InstanceNames} from "../utils/pcb3d/exportGlb";
import {mm, StackEdit} from "../utils/assemblyEdit";
import DownloadIcon from "./DownloadIcon";

// a case part stacked with the board, as config.assemblies says (z: its bottom's height)
// made: the case's parts as ergogen made them, for the panel's part editor
export type StackedPart = { name: string, z: number, height: number, stl: Blob, made?: MadePart[] };
// the board in the stack, and how the config places it: level with a part's top, on a part, or at a height, shifted
export type StackedPcb = { z: number, thickness: number, shift: number, top: string | null, on: string | null };
export type Stack = { name: string, pcb: StackedPcb, parts: StackedPart[] };

type Props = {
    pcb: string,
    // what the 3D model downloads as, e.g. ergo_cai_right.glb
    fileName: string,
    // the case parts around the board, if an assembly in the config holds it
    stack?: Stack | null,
    // writes moved parts back into the config
    onSave?: (edit: StackEdit) => void
};

// where the panel has the board and each case part: their bottoms' heights
type Positions = { pcb: number, parts: Record<string, number> };

const positionsOf = (stack?: Stack | null): Positions => ({
    pcb: stack?.pcb.z ?? 0,
    parts: Object.fromEntries((stack?.parts || []).map(p => [p.name, p.z])),
});

const moved = (stack: Stack, at: Positions) =>
    Math.abs(at.pcb - stack.pcb.z) > 1e-6 || stack.parts.some(p => Math.abs(at.parts[p.name] - p.z) > 1e-6);

// The config's terms for where things are: each part's gap to the one below it, and the board's shift from where
// its placement (level with a part's top, on a part, or at a height) puts it, taken at the parts' new heights.
const editOf = (stack: Stack, at: Positions): StackEdit => {
    const parts = stack.parts.map((p, i) => {
        const below = stack.parts[i - 1];
        return {name: p.name, gap: at.parts[p.name] - (below ? at.parts[below.name] + below.height : 0)};
    });
    const part = (name: string) => stack.parts.find(p => p.name === name);
    const {top, on, thickness} = stack.pcb;
    const ref = part(top || on || '');
    const base = ref ? at.parts[ref.name] + ref.height - (top ? thickness : 0) : stack.pcb.z - stack.pcb.shift;
    return {parts, pcbShift: at.pcb - base};
};

// same sizing as the other previews
const Container = styled.div`
  position: relative;
  width: 100%;
  height: calc(100vh - 6rem);
  min-height: 20rem;
  overflow: hidden;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

const Message = styled.div`
  position: absolute;
  top: 3rem;
  width: 100%;
  text-align: center;
`;

const Status = styled.div`
  position: absolute;
  left: 0.75rem;
  bottom: 0.75rem;
  max-width: calc(100% - 1.5rem);
  padding: 0.35rem 0.6rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.6);
  color: #dddddd;
  font-size: 0.8rem;

  summary {
    cursor: pointer;
  }

  ul {
    max-height: 30vh;
    margin: 0.3rem 0 0;
    padding-left: 1.2rem;
    overflow: auto;
  }
`;

// like the download buttons in the Downloads list, in the pane's top right corner
const Download = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: 0.25rem;
  background-color: #28a745;
  color: #ffffff;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color .15s ease-in-out;

  &:hover:not(:disabled) {
    background-color: #218838;
  }

  &:disabled {
    background-color: #595959;
    color: #bbbbbb;
    cursor: default;
  }
`;

// the case parts and the collision check, under the 2D / 3D switch
const Panel = styled.div`
  position: absolute;
  top: 2.6rem;
  left: 0.5rem;
  max-width: min(24rem, calc(100% - 1rem));
  max-height: calc(100% - 6rem);
  overflow: auto;
  padding: 0.45rem 0.6rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.6);
  color: #dddddd;
  font-size: 0.8rem;

  label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
  }

  ul {
    margin: 0.3rem 0 0;
    padding-left: 1.1rem;
  }
`;

const PanelTitle = styled.div`
  margin-bottom: 0.25rem;
  color: #ffffff;
`;

// a part's row: its switch, the height of its bottom, and where its top is then
const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 4.2rem 3.6rem;
  align-items: center;
  gap: 0.35rem;

  input[type=number] {
    width: 100%;
    padding: 0 0.2rem;
    border: 1px solid #666666;
    border-radius: 0.2rem;
    background: #2b2b2b;
    color: #ffffff;
    font: inherit;
  }

  .top {
    color: #999999;
  }
`;

// opens a case part's list of parts, after its name
const PartsButton = styled.button`
  margin-left: 0.2rem;
  padding: 0 0.35rem;
  border: none;
  border-radius: 0.2rem;
  background: #444444;
  color: #cccccc;
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover {
    background: #5a5a5a;
  }
`;

const Buttons = styled.div`
  display: flex;
  gap: 0.35rem;
`;

const Check = styled.button`
  margin-top: 0.4rem;
  padding: 0.2rem 0.6rem;
  border: none;
  border-radius: 0.25rem;
  background: #595959;
  color: #ffffff;
  font: inherit;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #6a6a6a;
  }

  &:disabled {
    color: #aaaaaa;
    cursor: default;
  }
`;

// Colours are sRGB, as in the models' files and in KiCad, and the view draws in sRGB: without that, the lighting
// works on them as if they were linear and shows them much darker than KiCad does.
const colour = (r: number, g: number, b: number) => new THREE.Color(r, g, b).convertSRGBToLinear();
// models without a colour of their own are grey, as in KiCad
const DEFAULT_COLOUR = colour(0.7, 0.7, 0.7);
const COPPER = new THREE.MeshStandardMaterial({color: colour(0.79, 0.64, 0.23), metalness: 0.7, roughness: 0.35});
// the case parts, see-through so the board shows, one tint each from the bottom up
const CASE_TINTS = [[0.62, 0.71, 0.85], [0.85, 0.77, 0.55], [0.62, 0.82, 0.6], [0.85, 0.63, 0.75], [0.6, 0.82, 0.82]];
// footprints whose models run into the case
const HIT = new THREE.Color(1, 0.12, 0.08);
const UNHIT = new THREE.Color(1, 1, 1);

type Placement = { fp: PlacedFootprint, model: Model3d };
type Missing = { path: string, why: string };

// what the effect built, for the download, the case part switches and the collision check
type Built = {
    root: THREE.Group,
    // the board, its copper and its models, at the board's height in the stack
    onBoard: THREE.Group,
    board: BoardData,
    models: THREE.InstancedMesh[],
    parts: Record<string, { mesh: THREE.Mesh, stl: ArrayBuffer, height: number }>,
    render: () => void,
};

// footprints that run into one case part with the same models by the same amount (the switches, say), their
// model parts' overlaps summed
type Found = { references: string[], layer: string, area: number, models: string[] };
type CheckState =
    { state: 'idle' } | { state: 'running', done: number, total: number }
    | { state: 'done', found: Found[] } | { state: 'failed', why: string };

// the instances in `hit` ("<index in models>:<instance>") in red, the others in their own colours
const mark = (v: Built, hit: Set<string>) => {
    v.models.forEach((mesh, k) => {
        if (!hit.size && !mesh.instanceColor) return;
        for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, hit.has(`${k}:${i}`) ? HIT : UNHIT);
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        // the shader only takes instance colours once it is built again with them
        (mesh.material as THREE.Material).needsUpdate = true;
    });
    v.render();
};

const summarize = (collisions: Collision[]): Found[] => {
    const byPair: Record<string, { reference: string, layer: string, area: number, models: string[] }> = {};
    collisions.forEach(c => {
        const key = `${c.reference}|${c.layer}`;
        const f = byPair[key] = byPair[key] || {reference: c.reference, layer: c.layer, area: 0, models: []};
        f.area += c.area;
        if (c.model && !f.models.includes(c.model)) f.models.push(c.model);
    });
    const groups: Record<string, Found> = {};
    Object.values(byPair).forEach(f => {
        const key = `${f.layer}|${f.models.sort().join(',')}|${f.area.toFixed(2)}`;
        const g = groups[key] = groups[key] || {references: [], layer: f.layer, area: f.area, models: f.models};
        g.references.push(f.reference);
    });
    return Object.values(groups).sort((a, b) => b.area * b.references.length - a.area * a.references.length);
};

const count = (found: Found[]) => found.reduce((n, f) => n + f.references.length, 0);

// SW1, SW2, SW3 and 29 more
const listed = (references: string[]) => {
    const sorted = references.slice().sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
    return sorted.length <= 4 ? sorted.join(', ') : `${sorted.slice(0, 3).join(', ')} and ${sorted.length - 3} more`;
};

// at most this many models download and convert at once
const PARALLEL = 4;

// A board in 3D: its body, holes and pads, and every footprint's 3D models (from the addresses in ErgoCaiLib's
// 3dmodels/sources.yaml). Left drag orbits, right drag pans, the wheel zooms.
const Pcb3dPreview = ({pcb, fileName, stack, onSave}: Props): JSX.Element => {
    const container = useRef<HTMLDivElement>(null);
    const view = useRef<Built | null>(null);
    // case parts switched off, by name; a ref too, for parts that load after a switch
    const [hidden, setHidden] = useState<Record<string, boolean>>({});
    const hiddenNow = useRef(hidden);
    hiddenNow.current = hidden;
    const [check, setCheck] = useState<CheckState>({state: 'idle'});
    // where the panel has moved things to; a ref too, for parts that load after a move
    const [positions, setPositions] = useState<Positions>(positionsOf(stack));
    const positionsNow = useRef(positions);
    positionsNow.current = positions;
    // bumped to put the height fields back to the positions
    const [fields, setFields] = useState(0);
    const [built, setBuilt] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ done: number, total: number }>({done: 0, total: 0});
    const [missing, setMissing] = useState<Missing[]>([]);
    // the case whose parts the panel lists, and the part pointed at in it, drawn in the view
    const [editing, setEditing] = useState<string | null>(null);
    const [lit, setLit] = useState<{ layer: string, part: string } | null>(null);

    useEffect(() => {
        const host = container.current;
        if (!host) return;
        let disposed = false;
        setError(null);
        setMissing([]);
        setProgress({done: 0, total: 0});
        setBuilt(false);
        setCheck({state: 'idle'});
        positionsNow.current = positionsOf(stack);
        setPositions(positionsNow.current);
        setFields(n => n + 1);

        const renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputEncoding = THREE.sRGBEncoding;
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        // the clear colour goes out as it is, unconverted
        scene.background = new THREE.Color(0x2b2b2b);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, 1.1));
        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        scene.add(light);
        const root = new THREE.Group();
        scene.add(root);
        const onBoard = new THREE.Group();
        onBoard.position.z = positionsNow.current.pcb;
        root.add(onBoard);

        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10000);
        camera.up.set(0, 0, 1);
        const controls = new OrbitControls(camera, renderer.domElement);

        const render = () => {
            light.position.copy(camera.position);
            renderer.render(scene, camera);
        };
        const resize = () => {
            const {clientWidth: width, clientHeight: height} = host;
            if (!width || !height) return;
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            render();
        };
        controls.addEventListener('change', render);
        const observer = new ResizeObserver(resize);
        observer.observe(host);

        const disposables: { dispose: () => void }[] = [];
        const cleanup = () => {
            disposed = true;
            view.current = null;
            observer.disconnect();
            controls.dispose();
            disposables.forEach(d => d.dispose());
            renderer.dispose();
            // browsers allow only a few live WebGL contexts, and every preview switch mounts a new one
            renderer.forceContextLoss();
            host.removeChild(renderer.domElement);
        };

        let board: ReturnType<typeof readBoard>;
        try {
            board = readBoard(pcb);
        } catch (e) {
            setError(`Cannot read this board: ${e instanceof Error ? e.message : e}`);
            return cleanup;
        }

        // the board in the middle, seen from the front and above
        const xs: number[] = [], ys: number[] = [];
        board.outline.forEach(loop => loop.forEach(([x, y]) => {
            xs.push(x);
            ys.push(-y);
        }));
        if (!xs.length) board.footprints.forEach(fp => {
            xs.push(fp.at[0]);
            ys.push(-fp.at[1]);
        });
        if (!xs.length) {
            xs.push(0);
            ys.push(0);
        }
        const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const boardZ = stack?.pcb.z ?? 0;
        const [minZ, maxZ] = [Math.min(boardZ, ...(stack?.parts || []).map(p => p.z)),
            Math.max(boardZ + board.thickness, ...(stack?.parts || []).map(p => p.z + p.height))];
        root.position.set(-(minX + maxX) / 2, -(minY + maxY) / 2, -(minZ + maxZ) / 2);
        const radius = Math.max(10, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2);
        const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1;
        camera.position.set(0, -distance * 0.6, distance * 0.8);
        camera.near = distance / 100;
        camera.far = distance * 10;
        controls.target.set(0, 0, 0);
        controls.update();
        resize();

        buildBoard(board).then(geometry => {
            if (disposed) return;
            const body = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.6, metalness: 0});
            disposables.push(geometry.body, body);
            const named = (mesh: THREE.Mesh, name: string) => {
                mesh.name = name;
                onBoard.add(mesh);
            };
            named(new THREE.Mesh(geometry.body, body), 'board');
            if (geometry.front) named(new THREE.Mesh(geometry.front, COPPER), 'copper, front');
            if (geometry.back) named(new THREE.Mesh(geometry.back, COPPER), 'copper, back');
            [geometry.front, geometry.back].forEach(side => side && disposables.push(side));
            setBuilt(true);
            render();
        }).catch((e: unknown) => {
            if (!disposed) setError(`Cannot build the board: ${e instanceof Error ? e.message : e}`);
        });

        // every footprint that uses a model, by model; a model is converted once and drawn once per footprint
        const placements: Record<string, Placement[]> = {};
        board.footprints.forEach(fp => fp.models.forEach(model => {
            const key = `${model.opacity < 1 ? model.opacity : 1}|${model.path}`;
            (placements[key] = placements[key] || []).push({fp, model});
        }));
        // the most used first: the switches and keycaps show up early
        const queue = Object.keys(placements).sort((a, b) => placements[b].length - placements[a].length);
        setProgress({done: 0, total: queue.length});

        const models: THREE.InstancedMesh[] = [];
        const parts: Built['parts'] = {};
        view.current = {root, onBoard, board, models, parts, render};

        // the case parts, each at its height in the stack
        (stack?.parts || []).forEach((part, i) => part.stl.arrayBuffer().then(stl => {
            if (disposed) return;
            const geometry = new STLLoader().parse(stl);
            const tint = CASE_TINTS[i % CASE_TINTS.length];
            const material = new THREE.MeshStandardMaterial({
                color: colour(tint[0], tint[1], tint[2]), roughness: 0.8, metalness: 0,
                transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = part.name;
            mesh.position.z = positionsNow.current.parts[part.name] ?? part.z;
            mesh.visible = !hiddenNow.current[part.name];
            root.add(mesh);
            parts[part.name] = {mesh, stl, height: part.height};
            disposables.push(geometry, material);
            render();
        }).catch((e: unknown) => {
            if (!disposed) setMissing(m => m.concat({path: part.name, why: `cannot read its STL: ${e instanceof Error ? e.message : e}`}));
        }));

        const show = (parts: MeshPart[], where: Placement[]) => {
            const matrices = where.map(p => modelMatrix(p.fp, p.model, board.thickness));
            const opacity = where[0].model.opacity;
            // parts of a model can share their vertices
            const shared = new Map<Float32Array, THREE.BufferAttribute>();
            const attribute = (array: Float32Array) => {
                if (!shared.has(array)) shared.set(array, new THREE.BufferAttribute(array, 3));
                return shared.get(array) as THREE.BufferAttribute;
            };
            for (const part of parts) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', attribute(part.position));
                geometry.setIndex(new THREE.BufferAttribute(part.index, 1));
                if (part.normal) geometry.setAttribute('normal', attribute(part.normal));
                else geometry.computeVertexNormals();
                const material = new THREE.MeshStandardMaterial({
                    color: part.color ? colour(part.color[0], part.color[1], part.color[2]) : DEFAULT_COLOUR,
                    roughness: 0.6,
                    metalness: 0.1,
                    // a model's scale can mirror it, which turns its faces inside out
                    side: THREE.DoubleSide,
                    transparent: opacity < 1,
                    opacity,
                });
                const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
                matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                mesh.name = where[0].model.path.split('/').pop() || 'model';
                (mesh.userData as InstanceNames).footprints = where.map(p => p.fp.reference);
                mesh.instanceMatrix.needsUpdate = true;
                // three.js would cull the instances by the model's own bounds, at the origin
                mesh.frustumCulled = false;
                onBoard.add(mesh);
                models.push(mesh);
                disposables.push(geometry, material, mesh);
            }
            render();
        };

        loadSources().then(sources => {
            let done = 0;
            const next = (): Promise<void> => {
                const key = queue.shift();
                if (!key || disposed) return Promise.resolve();
                const where = placements[key];
                return loadModel(where[0].model.path, sources)
                    .then(parts => {
                        if (!disposed) show(parts, where);
                    })
                    .catch((e: unknown) => {
                        if (!disposed) setMissing(m => m.concat({path: where[0].model.path, why: e instanceof Error ? e.message : String(e)}));
                    })
                    .then(() => {
                        if (!disposed) setProgress({done: ++done, total: Object.keys(placements).length});
                        return next();
                    });
            };
            return Promise.all(Array.from({length: PARALLEL}, next));
        }).catch((e: unknown) => {
            if (disposed) return;
            setMissing([{path: 'every model', why: `cannot read the model addresses: ${e instanceof Error ? e.message : e}`}]);
            setProgress({done: queue.length, total: queue.length});
        });

        return cleanup;
    }, [pcb, stack]);

    // the board or a case part moved in the panel; what was checked no longer holds
    useEffect(() => {
        const v = view.current;
        if (!v) return;
        v.onBoard.position.z = positions.pcb;
        Object.keys(v.parts).forEach(name => {
            if (positions.parts[name] !== undefined) v.parts[name].mesh.position.z = positions.parts[name];
        });
        mark(v, new Set());
        setCheck(c => c.state === 'done' ? {state: 'idle'} : c);
        v.render();
    }, [positions]);

    const moveTo = (name: string | null, raw: string) => {
        const z = parseFloat(raw);
        if (isNaN(z)) return;
        setPositions(p => name === null ? {...p, pcb: z} : {...p, parts: {...p.parts, [name]: z}});
    };
    const reset = () => {
        setPositions(positionsOf(stack));
        setFields(n => n + 1);
    };

    // a case part switched on or off; what was checked no longer holds
    useEffect(() => {
        const v = view.current;
        if (!v) return;
        Object.keys(v.parts).forEach(name => {
            v.parts[name].mesh.visible = !hidden[name];
        });
        mark(v, new Set());
        setCheck(c => c.state === 'done' ? {state: 'idle'} : c);
        v.render();
    }, [hidden]);

    const loading = progress.done < progress.total;

    const checkCollisions = async () => {
        const v = view.current;
        if (!v) return;
        setCheck({state: 'running', done: 0, total: 0});
        const made: any[] = [];
        try {
            const wasm = await loadManifold();
            const slabs: Slab[] = [];
            Object.keys(v.parts).filter(name => !hidden[name]).forEach(name => {
                const {stl, mesh, height} = v.parts[name];
                const solid = stlSolid(wasm, stl, mesh.position.z);
                caseSlabs(name, solid, mesh.position.z, mesh.position.z + height).forEach(slab => {
                    made.push(slab.material);
                    slabs.push(slab);
                });
                solid.delete();
            });
            const section = await boardSection(v.board);
            made.push(section);
            const z = v.onBoard.position.z;
            // the board, then every model part of every footprint, with where in the view each one is
            const bodies: Body[] = [{reference: 'board', model: '', section, bottom: z, top: z + v.board.thickness}];
            const where: ({ mesh: THREE.InstancedMesh, index: number } | null)[] = [null];
            const lift = new THREE.Matrix4().makeTranslation(0, 0, v.onBoard.position.z);
            v.models.forEach(mesh => {
                const names = (mesh.userData as InstanceNames).footprints;
                const positions = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
                const index = (mesh.geometry.getIndex() as THREE.BufferAttribute).array as Uint32Array;
                for (let i = 0; i < mesh.count; i++) {
                    const m = new THREE.Matrix4();
                    mesh.getMatrixAt(i, m);
                    bodies.push({reference: names[i], model: mesh.name, positions, index, matrix: lift.clone().multiply(m)});
                    where.push({mesh, index: i});
                }
            });
            const collisions = await findCollisions(wasm, bodies, slabs, (done, total) => setCheck({state: 'running', done, total}));
            const hit = new Set<string>();
            collisions.forEach(c => {
                const w = where[c.body];
                if (w) hit.add(`${v.models.indexOf(w.mesh)}:${w.index}`);
            });
            mark(v, hit);
            setCheck({state: 'done', found: summarize(collisions)});
        } catch (e) {
            setCheck({state: 'failed', why: e instanceof Error ? e.message : String(e)});
        } finally {
            made.forEach(m => m.delete());
        }
    };
    const download = () => {
        if (!view.current) return;
        setExporting(true);
        exportGlb(view.current.root, fileName.replace(/\.glb$/, '')).then(glb => {
            const url = URL.createObjectURL(new Blob([glb], {type: 'model/gltf-binary'}));
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }).catch((e: unknown) => {
            setError(`Cannot export the 3D model: ${e instanceof Error ? e.message : e}`);
        }).finally(() => setExporting(false));
    };
    // The part pointed at in the panel: the outline it extruded, as lines on its bottom and top, in the colour of
    // what it does to the case. It sits in the case part's place in the stack, shifted as the part is.
    useEffect(() => {
        const v = view.current;
        const makerjs = (window as any).makerjs;
        const layer = stack?.parts.find(p => p.name === lit?.layer);
        const made = layer?.made?.find(m => m.part === lit?.part);
        if (!v || !built || !layer || !made?.outline || !makerjs) return;
        const [dx, dy, dz] = [made.shift?.[0] ?? 0, made.shift?.[1] ?? 0, made.shift?.[2] ?? 0];
        const bottom = (positionsNow.current.parts[layer.name] ?? layer.z) + dz;
        const top = bottom + (made.extrude ?? layer.height);
        const colour = made.operation === 'subtract' ? 0xff4d4d : made.operation === 'intersect' ? 0xffd43b : 0x4dabf7;
        // drawn over the case parts, so a cut inside one still shows
        const material = new THREE.LineBasicMaterial({color: colour, depthTest: false, transparent: true});
        const group = new THREE.Group();
        group.renderOrder = 10;
        for (const chain of makerjs.model.findChains(made.outline) as any[]) {
            const points = makerjs.chain.toKeyPoints(chain, 0.5) as number[][];
            if (points.length < 2) continue;
            for (const z of [bottom, top]) {
                const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x + dx, y + dy, z)));
                const line = chain.endless ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
                line.renderOrder = 10;
                group.add(line);
            }
        }
        v.root.add(group);
        v.render();
        return () => {
            v.root.remove(group);
            group.children.forEach(c => (c as THREE.Line).geometry.dispose());
            material.dispose();
            v.render();
        };
    }, [lit, built, stack, positions]);

    return (
        <Container ref={container}>
            <Download onClick={download} disabled={!built || loading || exporting}
                      title={loading ? 'The models are still loading' : `Download the board with its models as glTF (${fileName}), for Blender and other 3D tools`}>
                <DownloadIcon/>{exporting ? 'Exporting…' : '.glb'}
            </Download>
            {stack && (
                <Panel>
                    <PanelTitle>Case ({stack.name}), from the bottom up; heights in mm</PanelTitle>
                    {stack.parts.map(p => {
                        const z = positions.parts[p.name] ?? p.z;
                        return (
                            <Fragment key={p.name}>
                            <Row>
                                <label>
                                    <input type="checkbox" checked={!hidden[p.name]}
                                           onChange={() => setHidden(h => ({...h, [p.name]: !h[p.name]}))}/>
                                    {p.name}
                                    <PartsButton aria-expanded={editing === p.name} title={`The parts ${p.name} is made of`}
                                                 onClick={e => { e.preventDefault(); setEditing(editing === p.name ? null : p.name); setLit(null); }}>
                                        {editing === p.name ? '▾ parts' : '▸ parts'}
                                    </PartsButton>
                                </label>
                                <input key={`${p.name}|${fields}`} type="number" step="0.1" defaultValue={mm(z)}
                                       title={`The height of ${p.name}'s bottom`} onChange={e => moveTo(p.name, e.target.value)}/>
                                <span className="top">– {mm(z + p.height)}</span>
                            </Row>
                            {editing === p.name && (
                                <CaseParts caseName={p.name} made={p.made ?? []} lit={lit?.layer === p.name ? lit.part : null}
                                           onLight={part => setLit(part ? {layer: p.name, part} : null)}/>
                            )}
                            </Fragment>
                        );
                    })}
                    <Row>
                        <span>PCB</span>
                        <input key={`pcb|${fields}`} type="number" step="0.1" defaultValue={mm(positions.pcb)}
                               title="The height of the board's bottom" onChange={e => moveTo(null, e.target.value)}/>
                        <span className="top">– {mm(positions.pcb + stack.pcb.thickness)}</span>
                    </Row>
                    {moved(stack, positions) && (
                        <Buttons>
                            <Check onClick={() => onSave?.(editOf(stack, positions))} disabled={!onSave}
                                   title="Write these heights into the config's assemblies, as gaps and the board's shift">
                                Save to config
                            </Check>
                            <Check onClick={reset}>Reset</Check>
                        </Buttons>
                    )}
                    <Check onClick={checkCollisions} disabled={!built || loading || check.state === 'running'}
                           title={`Which footprints' models, and the board, reach more than ${TOLERANCE} mm into the case parts shown`}>
                        {check.state === 'running' ? `Checking… ${check.done} of ${check.total}` : 'Check collisions'}
                    </Check>
                    {check.state === 'done' && (check.found.length === 0
                        ? <div>Nothing runs into the case parts shown.</div>
                        : <details open>
                            <summary>
                                {count(check.found)} {count(check.found) === 1 ? 'footprint runs' : 'footprints run'} into
                                the case, in red; overlap seen from above
                            </summary>
                            <ul>{check.found.map(f => (
                                <li key={`${f.layer}|${f.references.join(',')}`} title={f.references.join(', ') + (f.models.length ? `\n${f.models.join(', ')}` : '')}>
                                    {listed(f.references)} – {f.layer}: {f.area < 1 ? f.area.toFixed(2) : f.area.toFixed(1)} mm²
                                    {f.references.length > 1 ? ' each' : ''}
                                </li>
                            ))}</ul>
                        </details>)}
                    {check.state === 'failed' && <div>Cannot check: {check.why}</div>}
                </Panel>
            )}
            {error && <Message>{error}</Message>}
            {(loading || missing.length > 0) && (
                <Status role="status">
                    {loading && <div>Loading 3D models: {progress.done} of {progress.total}</div>}
                    {missing.length > 0 && (
                        <details>
                            <summary>{missing.length} {missing.length === 1 ? 'model' : 'models'} not shown</summary>
                            <ul>{missing.map(m => <li key={m.path}><code>{m.path}</code>: {m.why}</li>)}</ul>
                        </details>
                    )}
                </Status>
            )}
        </Container>
    );
};

export default Pcb3dPreview;
