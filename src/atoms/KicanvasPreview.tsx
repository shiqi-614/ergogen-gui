import {useEffect, useRef, useState} from "react";
import ErrorBoundary from "./ErrorBoundary";
import styled from "styled-components";
import Loading from "./Loading";
import Button from "./Button";
import PcbEditor from "./PcbEditor";

type Props = {
    pcb: string,
    name?: string,
    // the pcb in the config the board is of, so its parts can be edited on it
    pcbName?: string
};

type Camera = { x: number, y: number, zoom: number };

// KiCanvas (https://kicanvas.org, MIT, see public/dependencies/kicanvas.LICENSE.md) defines <kicanvas-embed>;
// it is loaded the first time a board is shown
let kicanvasReady: Promise<unknown> | null = null;
let kicanvasFailures = 0;
const loadKicanvas = () => {
    if (!kicanvasReady) {
        kicanvasReady = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'module';
            // a page remembers a module that failed to load under its URL, so a retry asks for another one
            script.src = `${import.meta.env.BASE_URL}dependencies/kicanvas.js` + (kicanvasFailures ? `?retry=${kicanvasFailures}` : '');
            // the next attempt loads it again
            script.onerror = () => {
                kicanvasReady = null;
                kicanvasFailures++;
                script.remove();
                reject(new Error('kicanvas.js did not load'));
            };
            document.head.appendChild(script);
            window.customElements.whenDefined('kicanvas-embed').then(resolve);
        });
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
  position: relative;
  width: 100%;
  height: calc(100vh - 6rem);
  min-height: 20rem;
  overflow: hidden;
`;

// where the <kicanvas-embed> goes; the overlay sits next to it, out of KiCanvas' way
const Board = styled.div`
  width: 100%;
  height: 100%;
`;

// covers the board until KiCanvas has loaded and drawn it
const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  background: rgba(45, 45, 45, 0.92);
`;

const Failed = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  margin: auto;
  color: #ff6d6d;
`;

const KicanvasPreview = ({pcb, name = 'preview.kicad_pcb', pcbName}: Props): JSX.Element => {
    const container = useRef<HTMLDivElement>(null);
    // keeps the view while the board is regenerated after an edit
    const camera = useRef<Camera | null>(null);
    // KiCanvas loads its script once, then parses and draws every board it gets
    const [status, setStatus] = useState<'loading' | 'shown' | 'failed'>('loading');
    // bumped by Retry, to load the script again
    const [attempt, setAttempt] = useState(0);
    // the board viewer, once it has drawn this board
    const [viewer, setViewer] = useState<any>(null);

    useEffect(() => {
        const target = container.current;
        if (!target || !pcb) return;
        let embed: HTMLElement | null = null;
        let cancelled = false;
        setStatus('loading');
        setViewer(null);

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
                if (!cancelled) setStatus('shown');
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
                if (!cancelled) setViewer(viewer);
            });
            target.replaceChildren(element);
            embed = element;
        }, () => {
            if (!cancelled) setStatus('failed');
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
    }, [pcb, name, attempt]);

    return (
        <Container>
            <Board ref={container}/>
            {/* stays mounted while the board regenerates after an edit, so editing goes on on the new one */}
            {pcbName && <ErrorBoundary area="the board's editor" resetKey={pcb}><PcbEditor viewer={status === 'shown' ? viewer : null} pcb={pcbName}/></ErrorBoundary>}
            {pcb && status !== 'shown' && (
                <Overlay>
                    {status === 'failed'
                        ? <Failed>
                            The PCB viewer (KiCanvas) didn't load.
                            <Button size="small" onClick={() => setAttempt(n => n + 1)}>Retry</Button>
                        </Failed>
                        : <Loading text="Loading the PCB preview…"/>}
                </Overlay>
            )}
        </Container>
    );
};

export default KicanvasPreview;
