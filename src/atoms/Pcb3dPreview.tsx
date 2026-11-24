import {ReactNode, useEffect, useRef, useState} from "react";
import styled from "styled-components";
import {Actions, Field, AddMenu, Button, CardHead, CardShell, CardTabs, Gap, Status as StatusText, Tip, colors, fontSize} from "../ui";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader";
import {BoardData, Model3d, PlacedFootprint, readBoard} from "../utils/pcb3d/board";
import {boardSection, buildBoard, loadManifold} from "../utils/pcb3d/boardMesh";
import {Body, caseSlabs, Collision, findCollisions, findLayerCollisions, Slab, stlSolid, TOLERANCE} from "../utils/pcb3d/collisions";
import {MeshPart} from "../utils/pcb3d/meshCache";
import {loadModel, loadSources} from "../utils/pcb3d/models";
import {modelMatrix} from "../utils/pcb3d/placement";
import {exportGlb, InstanceNames} from "../utils/pcb3d/exportGlb";
import {mm, StackEdit} from "../utils/assemblyEdit";
import DownloadIcon from "./DownloadIcon";

// a case part stacked with the board, as config.assemblies says (z: its bottom's height)
export type StackedPart = { name: string, z: number, height: number, stl: Blob };
// one of the assembly's other parts, a 3D model (a module board exported from KiCad, say): where its origin is
export type StackedModel = { name: string, model: string, x: number, y: number, r: number, z: number };
// the board in the stack, and how the config places it: level with a part's top, on a part, or at a height, shifted
export type StackedPcb = { z: number, thickness: number, shift: number, top: string | null, on: string | null };
export type Stack = { name: string, pcb: StackedPcb, parts: StackedPart[], models: StackedModel[] };

type Props = {
    pcb: string,
    // what the 3D model downloads as, e.g. ergo_cai_right.glb
    fileName: string,
    // the case parts around the board, if an assembly in the config holds it
    stack?: Stack | null,
    // writes moved parts back into the config
    onSave?: (edit: StackEdit) => void,
    // the assembly's other parts, edited in a tab beside its case's heights
    partsTab?: ReactNode,
    // the cases a stack can take, and putting one on its top, moving one up or down, taking one out of it, and
    // which case the board is placed by (its pcb.top or pcb.on)
    stackCases?: {
        available: string[], add: (name: string) => void, remove: (name: string) => void,
        move: (name: string, delta: number) => void, placeBy: (name: string) => void,
    },
};

// where the panel has the board and each case part (their bottoms' heights), and the other parts (their origins')
type Positions = { pcb: number, parts: Record<string, number>, models: number[] };

const positionsOf = (stack?: Stack | null): Positions => ({
    pcb: stack?.pcb.z ?? 0,
    parts: Object.fromEntries((stack?.parts || []).map(p => [p.name, p.z])),
    models: (stack?.models || []).map(m => m.z),
});

const differs = (a: number, b: number) => Math.abs(a - b) > 1e-6;

const moved = (stack: Stack, at: Positions) => differs(at.pcb, stack.pcb.z)
    || stack.parts.some(p => differs(at.parts[p.name], p.z)) || stack.models.some((m, i) => differs(at.models[i], m.z));

// the other parts' switches, apart from the case parts'
const modelKey = (i: number) => `model ${i}`;

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
    const models = stack.models.map((m, i) => ({index: i, z: at.models[i]})).filter((m, i) => differs(m.z, stack.models[i].z));
    return {parts, pcbShift: at.pcb - base, models};
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
  color: ${colors.text};
  font-size: ${fontSize.small};

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
const Download = styled(Button)`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;

  &:disabled {
    background: ${colors.button};
  }
`;

// the case parts and the collision check, in the top left corner
const Card = styled(CardShell)`
  top: 0.5rem;
  left: 0.5rem;
  width: min(22rem, calc(100% - 1rem));
  max-height: calc(100% - 4rem);

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

  summary {
    cursor: pointer;
  }
`;

// a part's row: its switch, the height of its bottom, where its top is then, and (a case) its ↑ ↓ ×
const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.2rem 3.6rem 3.6rem;

  label, > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.2rem;

  .top {
    color: ${colors.muted};
    font-size: ${fontSize.small};
  }

  .tools {
    display: flex;
    justify-content: flex-end;
  }
`;

// a group's name: the board, and the other parts after it
const GroupHead = styled.div`
  margin: 0.5rem 0 0.25rem;
  padding-top: 0.4rem;
  border-top: 1px solid ${colors.rule};
  color: ${colors.muted};
  font-size: ${fontSize.small};
`;

// The view lights linear colours and draws in sRGB. The colours here are sRGB, as KiCad gives them, and go in
// converted; the models' come linear already (meshCache.ts). Lit as if they were linear, sRGB colours show much
// darker than in KiCad.
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
    // the footprints' models, and the other parts'
    models: THREE.InstancedMesh[],
    parts: Record<string, { mesh: THREE.Mesh, stl: ArrayBuffer, height: number }>,
    // the other parts, by their place in the stack's list, once loaded
    stacked: THREE.Group[],
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
// 3dmodels/sources.yaml); in an assembly, also its case parts and other parts. Left drag orbits, right drag pans,
// the wheel zooms.
const Pcb3dPreview = ({pcb, fileName, stack, onSave, partsTab, stackCases}: Props): JSX.Element => {
    const container = useRef<HTMLDivElement>(null);
    const view = useRef<Built | null>(null);
    // case parts switched off, by name; a ref too, for parts that load after a switch
    const [hidden, setHidden] = useState<Record<string, boolean>>({});
    // the heights card, folded down to its title, and the tab it shows
    const [panelFolded, setPanelFolded] = useState(false);
    const [cardTab, setCardTab] = useState<'case' | 'parts'>('case');
    const hiddenNow = useRef(hidden);
    hiddenNow.current = hidden;
    const [check, setCheck] = useState<CheckState>({state: 'idle'});
    // where the panel has moved things to; a ref too, for parts that load after a move
    const [positions, setPositions] = useState<Positions>(positionsOf(stack));
    const positionsNow = useRef(positions);
    positionsNow.current = positions;
    // bumped to put the height fields back to the positions
    const [fields, setFields] = useState(0);
    // the other parts' tops, above their origins, once loaded
    const [tops, setTops] = useState<Record<number, number>>({});
    const [built, setBuilt] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ done: number, total: number }>({done: 0, total: 0});
    const [missing, setMissing] = useState<Missing[]>([]);

    useEffect(() => {
        const host = container.current;
        if (!host) return;
        let disposed = false;
        setError(null);
        setMissing([]);
        setProgress({done: 0, total: 0});
        setBuilt(false);
        setCheck({state: 'idle'});
        setTops({});
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
            Math.max(boardZ + board.thickness, ...(stack?.parts || []).map(p => p.z + p.height), ...(stack?.models || []).map(m => m.z))];
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

        const models: THREE.InstancedMesh[] = [];
        const parts: Built['parts'] = {};
        const stacked: THREE.Group[] = [];
        view.current = {root, onBoard, board, models, parts, stacked, render};

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

        // a model's parts, drawn at each of the matrices (in parent's frame), each instance named by its reference
        const instanced = (parts: MeshPart[], matrices: THREE.Matrix4[], references: string[], opacity: number,
                           name: string, parent: THREE.Object3D) => {
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
                    color: part.color ? new THREE.Color(part.color[0], part.color[1], part.color[2]) : DEFAULT_COLOUR,
                    roughness: 0.6,
                    metalness: 0.1,
                    // a model's scale can mirror it, which turns its faces inside out
                    side: THREE.DoubleSide,
                    transparent: opacity < 1,
                    opacity,
                });
                const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
                matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                mesh.name = name;
                (mesh.userData as InstanceNames).footprints = references;
                mesh.instanceMatrix.needsUpdate = true;
                // three.js would cull the instances by the model's own bounds, at the origin
                mesh.frustumCulled = false;
                parent.add(mesh);
                models.push(mesh);
                disposables.push(geometry, material, mesh);
            }
            render();
        };

        // one of the assembly's other parts, at its place and the panel's height
        const showStacked = (parts: MeshPart[], m: StackedModel, i: number) => {
            const group = new THREE.Group();
            group.name = m.name;
            group.position.set(m.x, m.y, positionsNow.current.models[i] ?? m.z);
            group.rotation.z = THREE.MathUtils.degToRad(m.r);
            group.visible = !hiddenNow.current[modelKey(i)];
            root.add(group);
            stacked[i] = group;
            instanced(parts, [new THREE.Matrix4()], [m.name], 1, m.model.split('/').pop() || m.name, group);
            let top = -Infinity;
            parts.forEach(p => {
                for (let k = 2; k < p.position.length; k += 3) top = Math.max(top, p.position[k]);
            });
            setTops(t => ({...t, [i]: top}));
        };

        // every model to load: the assembly's other parts, then the footprints' models, the most used first (the
        // switches and keycaps show up early)
        const jobs: { path: string, show: (parts: MeshPart[]) => void }[] = [
            ...(stack?.models || []).map((m, i) => ({path: m.model, show: (parts: MeshPart[]) => showStacked(parts, m, i)})),
            ...Object.values(placements).sort((a, b) => b.length - a.length).map(where => ({
                path: where[0].model.path,
                show: (parts: MeshPart[]) => instanced(parts, where.map(p => modelMatrix(p.fp, p.model, board.thickness)),
                    where.map(p => p.fp.reference), where[0].model.opacity, where[0].model.path.split('/').pop() || 'model', onBoard),
            })),
        ];
        const total = jobs.length;
        setProgress({done: 0, total});

        loadSources().then(sources => {
            let done = 0;
            const next = (): Promise<void> => {
                const job = jobs.shift();
                if (!job || disposed) return Promise.resolve();
                return loadModel(job.path, sources)
                    .then(parts => {
                        if (!disposed) job.show(parts);
                    })
                    .catch((e: unknown) => {
                        if (!disposed) setMissing(m => m.concat({path: job.path, why: e instanceof Error ? e.message : String(e)}));
                    })
                    .then(() => {
                        if (!disposed) setProgress({done: ++done, total});
                        return next();
                    });
            };
            return Promise.all(Array.from({length: PARALLEL}, next));
        }).catch((e: unknown) => {
            if (disposed) return;
            setMissing([{path: 'every model', why: `cannot read the model addresses: ${e instanceof Error ? e.message : e}`}]);
            setProgress({done: total, total});
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
        v.stacked.forEach((group, i) => {
            if (positions.models[i] !== undefined) group.position.z = positions.models[i];
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
    const moveModel = (i: number, raw: string) => {
        const z = parseFloat(raw);
        if (isNaN(z)) return;
        setPositions(p => ({...p, models: p.models.map((at, k) => k === i ? z : at)}));
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
        v.stacked.forEach((group, i) => {
            group.visible = !hidden[modelKey(i)];
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
            // the board, then every model part of every footprint and other part shown, with where in the view each is
            const bodies: Body[] = [{reference: 'board', model: '', section, bottom: z, top: z + v.board.thickness}];
            const where: ({ mesh: THREE.InstancedMesh, index: number } | null)[] = [null];
            v.root.updateMatrixWorld(true);
            const fromWorld = v.root.matrixWorld.clone().invert();
            v.models.forEach(mesh => {
                let shown = true;
                mesh.traverseAncestors(a => {
                    shown = shown && a.visible;
                });
                if (!shown) return;
                // the mesh's frame in the view's: on the board, or where its part is
                const frame = fromWorld.clone().multiply(mesh.matrixWorld);
                const names = (mesh.userData as InstanceNames).footprints;
                const positions = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
                const index = (mesh.geometry.getIndex() as THREE.BufferAttribute).array as Uint32Array;
                for (let i = 0; i < mesh.count; i++) {
                    const m = new THREE.Matrix4();
                    mesh.getMatrixAt(i, m);
                    bodies.push({reference: names[i], model: mesh.name, positions, index, matrix: frame.clone().multiply(m)});
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
            setCheck({state: 'done', found: summarize([...collisions, ...findLayerCollisions(slabs)])});
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
    return (
        <Container ref={container}>
            <Download $variant="go" onClick={download} disabled={!built || loading || exporting}
                      title={loading ? 'The models are still loading' : `Download the board with its models as glTF (${fileName}), for Blender and other 3D tools`}>
                <DownloadIcon/>{exporting ? 'Exporting…' : '.glb'}
            </Download>
            {stack && (
                <Card>
                    <CardHead title={`Case (${stack.name})`} subtitle="from the bottom up: each part's bottom – its top, in mm"
                              folded={panelFolded} onFold={setPanelFolded} foldAt="left"/>
                    {!panelFolded && partsTab && <CardTabs value={cardTab} onChange={v => setCardTab(v as 'case' | 'parts')}
                                                           tabs={[{value: 'case', label: 'Case'}, {value: 'parts', label: 'Parts'}]}/>}
                    {!panelFolded && partsTab && cardTab === 'parts' && <div className="body">{partsTab}</div>}
                    {!panelFolded && (!partsTab || cardTab === 'case') && <div className="body">
                    {stack.parts.map(p => {
                        const z = positions.parts[p.name] ?? p.z;
                        return (
                            <Row key={p.name}>
                                <label>
                                    <input type="checkbox" checked={!hidden[p.name]}
                                           onChange={() => setHidden(h => ({...h, [p.name]: !h[p.name]}))}/>
                                    {p.name}
                                </label>
                                <input key={`${p.name}|${fields}`} type="number" step="0.1" defaultValue={mm(z)}
                                       title={`The height of ${p.name}'s bottom`} onChange={e => moveTo(p.name, e.target.value)}/>
                                <span className="top">– {mm(z + p.height)}</span>
                                {stackCases && (() => {
                                    const holds = stack.pcb.top === p.name || stack.pcb.on === p.name;
                                    const at = stack.parts.indexOf(p);
                                    return <span className="tools">
                                        <Button $variant="ghost" disabled={at === stack.parts.length - 1} onClick={() => stackCases.move(p.name, 1)}
                                                title={`Move ${p.name} up the stack`}>↑</Button>
                                        <Button $variant="ghost" disabled={at === 0} onClick={() => stackCases.move(p.name, -1)}
                                                title={`Move ${p.name} down the stack`}>↓</Button>
                                        <Button $variant="ghost" disabled={holds} onClick={() => stackCases.remove(p.name)}
                                                title={holds ? `The board is placed by ${p.name} (pcb.${stack.pcb.top === p.name ? 'top' : 'on'}): change that first`
                                                    : `Take ${p.name} out of this assembly's stack (the case stays in cases)`}>×</Button>
                                    </span>;
                                })()}
                            </Row>
                        );
                    })}
                    {stackCases && (
                        <Actions>
                            <AddMenu label="+ Case" title="Put another case on top of the stack" options={stackCases.available} onPick={stackCases.add}/>
                        </Actions>
                    )}
                    <GroupHead>Board</GroupHead>
                    <Row>
                        <span>{fileName.replace(/\.glb$/, '')}</span>
                        <input key={`pcb|${fields}`} type="number" step="0.1" defaultValue={mm(positions.pcb)}
                               title="The height of the board's bottom" onChange={e => moveTo(null, e.target.value)}/>
                        <span className="top">– {mm(positions.pcb + stack.pcb.thickness)}</span>
                    </Row>
                    {stackCases && (stack.pcb.top || stack.pcb.on) && (
                        <Field label={stack.pcb.top ? 'Top level with' : 'Lies on'}>
                            <select value={(stack.pcb.top || stack.pcb.on) as string} onChange={e => stackCases.placeBy(e.target.value)}
                                    title={stack.pcb.top ? "the case part whose top the board's top is level with (pcb.top)" : 'the case part the board lies on (pcb.on)'}>
                                {stack.parts.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                            </select>
                        </Field>
                    )}
                    {stack.models.length > 0 && <GroupHead>Other parts</GroupHead>}
                    {stack.models.map((m, i) => {
                        const z = positions.models[i] ?? m.z;
                        return (
                            <Row key={`model|${i}`}>
                                <label>
                                    <input type="checkbox" checked={!hidden[modelKey(i)]}
                                           onChange={() => setHidden(h => ({...h, [modelKey(i)]: !h[modelKey(i)]}))}/>
                                    {m.name}
                                </label>
                                <input key={`model|${i}|${fields}`} type="number" step="0.1" defaultValue={mm(z)}
                                       title={`The height of ${m.name}'s origin; a board exported from KiCad has it at its bottom`}
                                       onChange={e => moveModel(i, e.target.value)}/>
                                <span className="top">{tops[i] !== undefined && `– ${mm(z + tops[i])}`}</span>
                            </Row>
                        );
                    })}
                    <Actions>
                        <Button onClick={checkCollisions} disabled={!built || loading || check.state === 'running'}
                                title={`Which footprints' models, other parts, the board and case parts reach more than ${TOLERANCE} mm into the case parts shown`}>
                            {check.state === 'running' ? `Checking… ${check.done} of ${check.total}` : 'Check collisions'}
                        </Button>
                        <Gap/>
                        {moved(stack, positions) && <>
                            <Button onClick={reset}>Reset</Button>
                            <Button $variant="go" onClick={() => onSave?.(editOf(stack, positions))} disabled={!onSave}
                                    title="Write these heights into the config's assemblies, as gaps, the board's shift and the other parts' z">
                                Save to config
                            </Button>
                        </>}
                    </Actions>
                    {check.state === 'done' && (check.found.length === 0
                        ? <Tip>Nothing runs into the case parts shown.</Tip>
                        : <details open>
                            <summary>
                                {count(check.found)} {count(check.found) === 1 ? 'part runs' : 'parts run'} into the
                                case, footprints in red; overlap seen from above
                            </summary>
                            <ul>{check.found.map(f => (
                                <li key={`${f.layer}|${f.references.join(',')}`} title={f.references.join(', ') + (f.models.length ? `\n${f.models.join(', ')}` : '')}>
                                    {listed(f.references)} – {f.layer}: {f.area < 1 ? f.area.toFixed(2) : f.area.toFixed(1)} mm²
                                    {f.references.length > 1 ? ' each' : ''}
                                </li>
                            ))}</ul>
                        </details>)}
                    {check.state === 'failed' && <StatusText>Cannot check: {check.why}</StatusText>}
                    </div>}
                </Card>
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
