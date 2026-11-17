import {useEffect, useRef, useState} from "react";
import styled from "styled-components";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {Model3d, PlacedFootprint, readBoard} from "../utils/pcb3d/board";
import {buildBoard} from "../utils/pcb3d/boardMesh";
import {MeshPart} from "../utils/pcb3d/meshCache";
import {loadModel, loadSources} from "../utils/pcb3d/models";
import {modelMatrix} from "../utils/pcb3d/placement";
import {exportGlb, InstanceNames} from "../utils/pcb3d/exportGlb";
import DownloadIcon from "./DownloadIcon";

type Props = {
    pcb: string,
    // what the 3D model downloads as, e.g. ergo_cai_right.glb
    fileName: string
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

// Colours are sRGB, as in the models' files and in KiCad, and the view draws in sRGB: without that, the lighting
// works on them as if they were linear and shows them much darker than KiCad does.
const colour = (r: number, g: number, b: number) => new THREE.Color(r, g, b).convertSRGBToLinear();
// models without a colour of their own are grey, as in KiCad
const DEFAULT_COLOUR = colour(0.7, 0.7, 0.7);
const COPPER = new THREE.MeshStandardMaterial({color: colour(0.79, 0.64, 0.23), metalness: 0.7, roughness: 0.35});

type Placement = { fp: PlacedFootprint, model: Model3d };
type Missing = { path: string, why: string };

// at most this many models download and convert at once
const PARALLEL = 4;

// A board in 3D: its body, holes and pads, and every footprint's 3D models (from the addresses in ErgoCaiLib's
// 3dmodels/sources.yaml). Left drag orbits, right drag pans, the wheel zooms.
const Pcb3dPreview = ({pcb, fileName}: Props): JSX.Element => {
    const container = useRef<HTMLDivElement>(null);
    // the board and its models as shown, for the download
    const shown = useRef<THREE.Group | null>(null);
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
        shown.current = root;

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
            shown.current = null;
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
        root.position.set(-(minX + maxX) / 2, -(minY + maxY) / 2, -board.thickness / 2);
        const radius = Math.max(10, Math.hypot(maxX - minX, maxY - minY) / 2);
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
                root.add(mesh);
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
                root.add(mesh);
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
    }, [pcb]);

    const loading = progress.done < progress.total;
    const download = () => {
        if (!shown.current) return;
        setExporting(true);
        exportGlb(shown.current, fileName.replace(/\.glb$/, '')).then(glb => {
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
            <Download onClick={download} disabled={!built || loading || exporting}
                      title={loading ? 'The models are still loading' : `Download the board with its models as glTF (${fileName}), for Blender and other 3D tools`}>
                <DownloadIcon/>{exporting ? 'Exporting…' : '.glb'}
            </Download>
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
