import {useState} from "react";
import styled from "styled-components";
import KicanvasPreview from "../atoms/KicanvasPreview";
import Pcb3dPreview from "../atoms/Pcb3dPreview";

type Props = {
    pcb: string,
    // the pcb's name in the config, e.g. ergo_cai_right; KiCanvas's view edits its parts on the board
    board: string
};

type View = '2d' | '3d';

const Wrapper = styled.div`
  position: relative;
`;

// like the Preview / Layout switch, in the pane's top left corner
const Switch = styled.div`
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 1;
  display: flex;
  border-radius: 0.25rem;
  overflow: hidden;
  background: #595959;
`;

const SwitchButton = styled.button<{ $active: boolean }>`
  padding: 0.3rem 0.8rem;
  border: none;
  background: ${p => p.$active ? '#28a745' : 'transparent'};
  color: #ffffff;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
`;

// the view last picked, for the next board shown
let lastView: View = '2d';

// A board in KiCanvas (2D, the layers as KiCad draws them) or in 3D with the footprints' models.
const PcbPreview = ({pcb, board}: Props): JSX.Element => {
    const [view, setView] = useState<View>(lastView);
    const choose = (v: View) => {
        lastView = v;
        setView(v);
    };
    return (
        <Wrapper>
            <Switch role="group" aria-label="Board view">
                <SwitchButton $active={view === '2d'} aria-pressed={view === '2d'} onClick={() => choose('2d')}>2D</SwitchButton>
                <SwitchButton $active={view === '3d'} aria-pressed={view === '3d'} onClick={() => choose('3d')}>3D</SwitchButton>
            </Switch>
            {view === '2d'
                ? <KicanvasPreview pcb={pcb} name={`${board}_preview.kicad_pcb`} pcbName={board}/>
                : <Pcb3dPreview pcb={pcb} fileName={`${board}.glb`}/>}
        </Wrapper>
    );
};

export default PcbPreview;
