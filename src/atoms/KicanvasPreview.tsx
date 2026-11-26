import {useEffect, useRef, useState} from "react";
import ErrorBoundary from "./ErrorBoundary";
import styled from "styled-components";
import Loading, {Spinner} from "./Loading";
import Button from "./Button";
import PcbEditor from "./PcbEditor";
import {useConfigContext} from "../context/ConfigContext";

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

// where the <kicanvas-embed> goes; the overlay sits next to it, out of KiCanvas' way. A regenerated board loads
// in a second, hidden <kicanvas-embed> over the shown one, and takes its place once drawn
const Board = styled.div`
  position: relative;
  width: 100%;
  height: 100%;

  kicanvas-embed {
    position: absolute;
    inset: 0;
  }
`;

// covers the board until KiCanvas has loaded and drawn it
const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  background: rgba(45, 45, 45, 0.92);
`;

// in a corner while the board on show is being made again: it stays on show and can be edited meanwhile
const Updating = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.6rem;
  border-radius: 0.25rem;
  background: rgba(45, 45, 45, 0.85);
  color: #c8c8c8;
  font-size: 0.8rem;
  pointer-events: none;
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
    // the <kicanvas-embed> on show; it stays until the next board has been drawn
    const shown = useRef<HTMLElement | null>(null);
    // KiCanvas loads its script once, then parses and draws every board it gets
    const [status, setStatus] = useState<'loading' | 'shown' | 'failed'>('loading');
    // bumped by Retry, to load the script again
    const [attempt, setAttempt] = useState(0);
    // the board viewer, once it has drawn this board
    const [viewer, setViewer] = useState<any>(null);
    // a regenerated board being drawn behind the one on show
    const [drawing, setDrawing] = useState(false);
    // ergogen making the next results, after an edit
    const running = !!useConfigContext()?.running;

    useEffect(() => {
        const target = container.current;
        if (!target || !pcb) return;
        let embed: HTMLElement | null = null;
        let cancelled = false;
        // the first board covers the pane until drawn; a regenerated one loads behind the one on show
        if (!shown.current) {
            setStatus('loading');
            setViewer(null);
        } else {
            setDrawing(true);
        }

        loadKicanvas().then(() => {
            if (cancelled) return;
            // a new element per board: kicanvas-embed reads its source only once
            const element = document.createElement('kicanvas-embed');
            element.setAttribute('controls', 'full');
            // without its "Click or tap to interact" cover, which kept the wheel from the board until it was clicked,
            // again after any click elsewhere (the parts' boxes, their card), and on every board made after an edit
            element.setAttribute('controlslist', 'nooverlay');
            element.style.height = '100%';
            element.style.setProperty('aspect-ratio', 'auto');
            element.style.visibility = 'hidden';
            const source = document.createElement('kicanvas-source');
            source.setAttribute('name', name);
            source.textContent = pcb;
            element.appendChild(source);
            element.addEventListener('kicanvas:load', () => {
                if (cancelled) return;
                // the view of the board on show, kept on the new one
                const old = shown.current && boardViewer(shown.current);
                if (old) {
                    const {center, zoom} = old.viewport.camera;
                    camera.current = {x: center.x, y: center.y, zoom};
                }
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
                element.style.visibility = '';
                shown.current?.remove();
                shown.current = element;
                setStatus('shown');
                setDrawing(false);
                setViewer(viewer);
            });
            target.appendChild(element);
            embed = element;
        }, () => {
            if (!cancelled) setStatus('failed');
        });

        // a board that was not drawn yet goes; the one on show stays until the next one is drawn
        return () => {
            cancelled = true;
            if (embed && embed !== shown.current) embed.remove();
        };
    }, [pcb, name, attempt]);

    // the board on show goes with the pane
    useEffect(() => () => {
        shown.current?.remove();
        shown.current = null;
    }, []);

    return (
        <Container>
            <Board ref={container}/>
            {/* stays mounted while the board regenerates after an edit, so editing goes on on the new one */}
            {pcbName && <ErrorBoundary area="the board's editor" resetKey={pcb}><PcbEditor viewer={status === 'shown' ? viewer : null} pcb={pcbName}/></ErrorBoundary>}
            {status === 'shown' && (running || drawing) && (
                <Updating role="status" aria-live="polite"><Spinner $size="0.8rem"/>Updating the board…</Updating>
            )}
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
