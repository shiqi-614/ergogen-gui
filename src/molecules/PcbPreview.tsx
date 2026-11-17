import {useMemo, useState} from "react";
import styled from "styled-components";
import KicanvasPreview from "../atoms/KicanvasPreview";
import Pcb3dPreview, {Stack} from "../atoms/Pcb3dPreview";
import {useConfigContext} from "../context/ConfigContext";
import {StackEdit, writeStack} from "../utils/assemblyEdit";

type Props = {
    pcb: string,
    // the pcb's name in the config, e.g. ergo_cai_right; KiCanvas's view edits its parts on the board
    board: string,
    // the view to open with, instead of the one last picked
    initialView?: '2d' | '3d'
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
const PcbPreview = ({pcb, board, initialView}: Props): JSX.Element => {
    const [view, setView] = useState<View>(initialView || lastView);
    const configContext = useConfigContext();
    const results = configContext?.results as any;
    // the case parts around this board: the first of config.assemblies that holds it
    const stack = useMemo((): Stack | null => {
        const entry = Object.entries(results?.assemblies || {}).find(([, a]: [string, any]) => a?.pcb?.name === board);
        if (!entry) return null;
        const [name, assembly] = entry as [string, any];
        const parts = (assembly.layers || [])
            .map((l: any) => ({name: l.name, z: l.z, height: l.height, stl: results?.cases?.[l.name]?.stl, made: results?.cases?.[l.name]?.parts || []}))
            .filter((p: any) => p.stl instanceof Blob);
        const {z, thickness, shift, top, on} = assembly.pcb;
        return {name, pcb: {z, thickness, shift: shift || 0, top: top || null, on: on || null}, parts};
    }, [results, board]);
    // the panel's moves, into the config's assemblies; the next run brings them back
    const save = (edit: StackEdit) => {
        if (!configContext?.configInput || !stack) return;
        try {
            configContext.setConfigInput(writeStack(configContext.configInput, stack.name, edit));
        } catch (e) {
            window.alert(`Cannot write the stack into the config: ${e instanceof Error ? e.message : e}`);
        }
    };
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
                : <Pcb3dPreview pcb={pcb} fileName={`${board}.glb`} stack={stack} onSave={save}/>}
        </Wrapper>
    );
};

export default PcbPreview;
