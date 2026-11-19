import {RefObject, useEffect, useRef} from "react";

// Moving and zooming a view the way every preview does it (KiCanvas, the 3D views): the right mouse button held
// down drags it, the wheel zooms about the pointer. The left button is left to whatever the view edits with.

export type Pan = { dx: number, dy: number };

type Handlers = {
    // the pointer moved by (dx, dy) screen pixels with the right button down
    pan: (move: Pan) => void,
    // zoom by factor (below 1: in) about the screen point (x, y) in the element
    zoom: (factor: number, x: number, y: number) => void,
};

// how much one wheel notch zooms
const STEP = 1.15;

export const usePanZoom = (target: RefObject<HTMLElement | SVGElement>, handlers: Handlers) => {
    const current = useRef(handlers);
    current.current = handlers;
    // the element it is bound to, and how to let it go: the element may come (or change) after the first render
    const bound = useRef<{ element: Element, release: () => void } | null>(null);
    useEffect(() => {
        const element = target.current;
        if (bound.current?.element === element) return;
        bound.current?.release();
        bound.current = null;
        if (!element) return;
        // the wheel listener has to be a non-passive one to keep the page from scrolling
        const onWheel = (e: Event) => {
            const wheel = e as WheelEvent;
            wheel.preventDefault();
            const rect = element.getBoundingClientRect();
            current.current.zoom(wheel.deltaY > 0 ? STEP : 1 / STEP, wheel.clientX - rect.left, wheel.clientY - rect.top);
        };
        const onDown = (e: Event) => {
            const press = e as PointerEvent;
            if (press.button !== 2) return;
            // a right-button drag moves the view, and nothing under the pointer reacts to it
            press.preventDefault();
            press.stopPropagation();
            let last = {x: press.clientX, y: press.clientY};
            const onMove = (m: PointerEvent) => {
                current.current.pan({dx: m.clientX - last.x, dy: m.clientY - last.y});
                last = {x: m.clientX, y: m.clientY};
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        };
        const onMenu = (e: Event) => e.preventDefault();
        element.addEventListener('wheel', onWheel, {passive: false});
        element.addEventListener('pointerdown', onDown, true);
        element.addEventListener('contextmenu', onMenu);
        bound.current = {element, release: () => {
            element.removeEventListener('wheel', onWheel);
            element.removeEventListener('pointerdown', onDown, true);
            element.removeEventListener('contextmenu', onMenu);
        }};
    });
    useEffect(() => () => bound.current?.release(), []);
};
