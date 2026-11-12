import {useEffect, useRef} from "react";
import styled from "styled-components";

type Props = {
    pcb: string,
    name?: string
};

type Camera = { x: number, y: number, zoom: number };

// KiCanvas (https://kicanvas.org, MIT, see public/dependencies/kicanvas.LICENSE.md) defines <kicanvas-embed>;
// it is loaded the first time a board is shown
let kicanvasReady: Promise<unknown> | null = null;
const loadKicanvas = () => {
    if (!kicanvasReady) {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = `${process.env.PUBLIC_URL}/dependencies/kicanvas.js`;
        document.head.appendChild(script);
        kicanvasReady = window.customElements.whenDefined('kicanvas-embed');
    }
    return kicanvasReady;
};

// the board viewer inside <kicanvas-embed> (KiCanvas internals)
const boardViewer = (embed: HTMLElement): any =>
    embed.shadowRoot?.querySelector('kc-board-app')?.shadowRoot?.querySelector('kc-board-viewer')
        // @ts-ignore
        ?.viewer;

// the preview pane's height follows its content, while the KiCanvas canvas follows its container:
// give it a fixed height (the viewport below the header) so the two cannot grow each other
const Container = styled.div`
  width: 100%;
  height: calc(100vh - 7rem);
  min-height: 20rem;
  overflow: hidden;
`;

const KicanvasPreview = ({pcb, name = 'preview.kicad_pcb'}: Props): JSX.Element => {
    const container = useRef<HTMLDivElement>(null);
    // keeps the view while the board is regenerated after an edit
    const camera = useRef<Camera | null>(null);

    useEffect(() => {
        const target = container.current;
        if (!target || !pcb) return;
        let embed: HTMLElement | null = null;
        let cancelled = false;

        loadKicanvas().then(() => {
            if (cancelled) return;
            // a new element per board: kicanvas-embed reads its source only once
            const element = document.createElement('kicanvas-embed');
            element.setAttribute('controls', 'full');
            element.style.height = '100%';
            element.style.setProperty('aspect-ratio', 'auto');
            const source = document.createElement('kicanvas-source');
            source.setAttribute('name', name);
            source.textContent = pcb;
            element.appendChild(source);
            element.addEventListener('kicanvas:load', () => {
                const viewer = boardViewer(element);
                const outline = viewer?.layers.by_name('Edge.Cuts')?.bbox;
                if (!outline || !(outline.w > 0)) return;
                // KiCanvas frames the A4 drawing sheet and keeps the camera on it; ergogen boards sit around
                // the sheet's corner, so hide the sheet and use the board outline instead
                viewer.page_opacity = 0;
                viewer.viewport.bounds = outline.grow(Math.max(outline.w, outline.h));
                if (camera.current) {
                    viewer.viewport.camera.center.set(camera.current.x, camera.current.y);
                    viewer.viewport.camera.zoom = camera.current.zoom;
                } else {
                    viewer.zoom_to_board();
                }
                viewer.draw();
            });
            target.replaceChildren(element);
            embed = element;
        });

        return () => {
            cancelled = true;
            const viewer = embed && boardViewer(embed);
            if (viewer) {
                const {center, zoom} = viewer.viewport.camera;
                camera.current = {x: center.x, y: center.y, zoom};
            }
            embed?.remove();
        };
    }, [pcb, name]);

    return <Container ref={container}/>;
};

export default KicanvasPreview;
