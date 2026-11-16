import {useEffect, useRef, useState} from "react";
import styled from "styled-components";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader";

type Props = {
    stl: Blob | null
};

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
const StlPreview = ({stl}: Props): JSX.Element => {
    const container = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

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
            geometry.center();
            geometry.computeBoundingSphere();
            scene.add(new THREE.Mesh(geometry, material));

            // frame the whole layer, seen from the front and above
            const radius = geometry.boundingSphere?.radius || 1;
            const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1;
            camera.position.set(0, -distance * 0.6, distance * 0.8);
            camera.near = distance / 100;
            camera.far = distance * 10;
            controls.target.set(0, 0, 0);
            controls.update();
            resize();
        }).catch((e: unknown) => {
            if (!disposed) setError(`Cannot show this STL: ${e}`);
        });

        return () => {
            disposed = true;
            observer.disconnect();
            controls.dispose();
            geometry?.dispose();
            material.dispose();
            renderer.dispose();
            // browsers allow only a few live WebGL contexts, and every preview switch mounts a new one
            renderer.forceContextLoss();
            host.removeChild(renderer.domElement);
        };
    }, [stl]);

    return (
        <Container ref={container}>
            {!stl && <Message>No STL for this case.</Message>}
            {error && <Message>{error}</Message>}
        </Container>
    );
};

export default StlPreview;
