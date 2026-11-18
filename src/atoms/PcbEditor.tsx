import {usePcbParts} from "./pcb/usePcbParts";
import PartsOverlay from "./pcb/PartsOverlay";
import PartsCard from "./pcb/PartsCard";

// Edits a pcb's parts on its KiCanvas preview. Modules are boxed around their footprints: drag one to
// move it (its where.shift), its card deletes it, a new one is placed with a click. Footprints are picked by
// clicking one of them, which picks its whole config entry: one placed by an anchor moves like a module,
// one that follows keys moves and turns on every key at once (its adjust), and the keys it is on can be
// clicked in and out. Moves are written in the frame of the key they are relative to, the way the values
// were written. A pcb mirrored from another has that pcb's parts, so it edits those. After every edit
// the preview regenerates. The state and the edits are in usePcbParts, what is drawn on the board in
// PartsOverlay, the card in PartsCard.

type Props = {
    // the board viewer inside <kicanvas-embed>, once it has drawn the board; null while it regenerates
    viewer: any,
    // which pcb the board is
    pcb: string,
};

const PcbEditor = ({viewer, pcb}: Props): JSX.Element | null => {
    const parts = usePcbParts(viewer, pcb);
    if (!parts) return null;
    return (
        <>
            <PartsOverlay parts={parts}/>
            <PartsCard parts={parts}/>
        </>
    );
};

export default PcbEditor;
