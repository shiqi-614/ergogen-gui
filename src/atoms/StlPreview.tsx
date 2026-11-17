import {useEffect, useRef, useState} from "react";
import CaseParts, {MadePart, OPERATION_COLOURS} from "../molecules/CaseParts";
import styled from "styled-components";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader";

type Props = {
    stl: Blob | null,
    // the case (cases.<name>) it is, with its parts as ergogen made them: edited in a panel over the view
    caseName?: string,
    made?: MadePart[],
};

// where each case was looked at from, so editing it (which makes a new STL) doesn't move the view
const views: Record<string, { position: THREE.Vector3, target: THREE.Vector3 }> = {};

// same sizing as the KiCanvas preview: the pane's height follows its content, the canvas its container
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

// Shows a case layer's STL (the file the Downloads list offers) with three.js.
// Left drag orbits, right drag pans, the wheel zooms.
const StlPreview = ({stl, caseName, made}: Props): JSX.Element => {
    const container = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    // the scene, its redraw and how far the STL was moved to centre it, for drawing a part's shape in it
    const scene3d = useRef<{ scene: THREE.Scene, render: () => void, offset: THREE.Vector3 } | null>(null);
    const [loaded, setLoaded] = useState(0);
    // the part the panel points at, by its index in the case's parts
    const [lit, setLit] = useState<string | null>(null);

    useEffect(() => {
        const host = container.current;
        if (!host || !stl) return;
        let disposed = false;
        setError(null);

        const renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setPixelRatio(window.devicePixelRatio);
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2b2b2b);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.8));
        const light = new THREE.DirectionalLight(0xffffff, 0.7);
        scene.add(light);

        // ergogen extrudes the case layers along +z
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

        let geometry: THREE.BufferGeometry | null = null;
        const material = new THREE.MeshStandardMaterial({color: 0xd0d0d0, metalness: 0.1, roughness: 0.7});

        stl.arrayBuffer().then((buffer) => {
            if (disposed) return;
            geometry = new STLLoader().parse(buffer);
            if (!geometry.getAttribute('position')?.count) throw new Error('the STL has no triangles');
            if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
            geometry.computeBoundingBox();
            const offset = geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
            geometry.center();
            geometry.computeBoundingSphere();
            scene.add(new THREE.Mesh(geometry, material));

            // frame the whole layer, seen from the front and above; or as it was looked at last
            const radius = geometry.boundingSphere?.radius || 1;
            const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1;
            camera.near = distance / 100;
            camera.far = distance * 10;
            const seen = caseName ? views[caseName] : undefined;
            if (seen) {
                camera.position.copy(seen.position);
                controls.target.copy(seen.target);
            } else {
                camera.position.set(0, -distance * 0.6, distance * 0.8);
                controls.target.set(0, 0, 0);
            }
            controls.update();
            resize();
            scene3d.current = {scene, render, offset};
            setLoaded(n => n + 1);
        }).catch((e: unknown) => {
            if (!disposed) setError(`Cannot show this STL: ${e}`);
        });

        return () => {
            disposed = true;
            if (caseName && scene3d.current) views[caseName] = {position: camera.position.clone(), target: controls.target.clone()};
            scene3d.current = null;
            observer.disconnect();
            controls.dispose();
            geometry?.dispose();
            material.dispose();
            renderer.dispose();
            // browsers allow only a few live WebGL contexts, and every preview switch mounts a new one
            renderer.forceContextLoss();
            host.removeChild(renderer.domElement);
        };
    }, [stl]); // eslint-disable-line react-hooks/exhaustive-deps

    // The part the panel points at: the outline it extruded, as lines on its bottom and top, in the colour of what
    // it does, moved as the STL was to centre it and shifted as the part is
    useEffect(() => {
        const view = scene3d.current;
        const makerjs = (window as any).makerjs;
        const part = made?.find(m => m.part === lit);
        if (!view || !part?.outline || !makerjs) return;
        const {offset} = view;
        const [dx, dy, dz] = [part.shift?.[0] ?? 0, part.shift?.[1] ?? 0, part.shift?.[2] ?? 0];
        const material = new THREE.LineBasicMaterial({color: OPERATION_COLOURS[part.operation] ?? 0xffffff, depthTest: false, transparent: true});
        const group = new THREE.Group();
        for (const chain of makerjs.model.findChains(part.outline) as any[]) {
            const points = makerjs.chain.toKeyPoints(chain, 0.5) as number[][];
            if (points.length < 2) continue;
            for (const z of [dz, dz + (part.extrude ?? 0)]) {
                const geometry = new THREE.BufferGeometry().setFromPoints(
                    points.map(([x, y]) => new THREE.Vector3(x + dx - offset.x, y + dy - offset.y, z - offset.z)));
                const line = chain.endless ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
                // drawn over the case, so a cut inside it still shows
                line.renderOrder = 10;
                group.add(line);
            }
        }
        view.scene.add(group);
        view.render();
        return () => {
            view.scene.remove(group);
            group.children.forEach(c => (c as THREE.Line).geometry.dispose());
            material.dispose();
            view.render();
        };
    }, [lit, loaded, made]);

    return (
        <Container ref={container}>
            {!stl && <Message>No STL for this case.</Message>}
            {error && <Message>{error}</Message>}
            {caseName && <CaseParts caseName={caseName} made={made ?? []} onLight={setLit}/>}
        </Container>
    );
};

export default StlPreview;
