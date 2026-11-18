import {nearestKey, shiftFrom} from "../../utils/keyFrame";
import {Points, Vec} from "./geometry";

// Drawing a new outline point by point in the layout editor: where a click puts the next point, written as a
// shift from its nearest key the way hand-written outlines are.

export type DrawnPoint = { ref: string, shift: [number, number], at: Vec };
export type Drawing = { name: string, points: DrawnPoint[] };
// the point a click would add, the lines it is snapped along, and whether it closes the outline
export type Cursor = { point: DrawnPoint, guides: [Vec, Vec][], closes: boolean };

// where a point at wanted goes: written as a shift from the nearest key, in that key's frame
// (to 0.1 mm, or exactly when it has been lined up with another point)
export const placeNear = (points: Points | null, wanted: Vec, exact: boolean): DrawnPoint | null => {
    if (!points) return null;
    const ref = nearestKey(points, wanted);
    if (!ref) return null;
    return {ref, ...shiftFrom(points[ref], wanted, exact ? undefined : 0.1)};
};

// The point a click at wanted would add: the first point (closing the outline) when close to it, else snapped level
// with the last or first point when close to them; pxPerMm is the view's scale, the closeness is in pixels
export const pointAt = (points: Points | null, d: Drawing, at: Vec, pxPerMm: number): Cursor | null => {
    if (!points) return null;
    const wanted = {...at};
    const first = d.points[0];
    if (first && d.points.length >= 3 && Math.hypot(wanted.x - first.at.x, wanted.y - first.at.y) < 8 / pxPerMm) {
        return {point: first, guides: [], closes: true};
    }
    const guides: [Vec, Vec][] = [];
    const snapped = {x: false, y: false};
    for (const n of [d.points[d.points.length - 1], first].filter(Boolean) as DrawnPoint[]) {
        if (!snapped.x && Math.abs(wanted.x - n.at.x) < 6 / pxPerMm) {
            wanted.x = n.at.x;
            snapped.x = true;
            guides.push([n.at, wanted]);
        }
        if (!snapped.y && Math.abs(wanted.y - n.at.y) < 6 / pxPerMm) {
            wanted.y = n.at.y;
            snapped.y = true;
            guides.push([n.at, wanted]);
        }
    }
    // snapped points keep the precision that lines them up
    const point = placeNear(points, wanted, snapped.x || snapped.y);
    if (!point) return null;
    return {point, guides: guides.map(([n]) => [n, point.at]), closes: false};
};
