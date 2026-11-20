import {useMemo, useState} from "react";
import ErrorBoundary from "../atoms/ErrorBoundary";
import styled from "styled-components";
import KicanvasPreview from "../atoms/KicanvasPreview";
import Pcb3dPreview, {Stack} from "../atoms/Pcb3dPreview";
import {useConfigContext} from "../context/ConfigContext";
import AssemblyParts from "./AssemblyParts";
import {StackEdit, writeStack} from "../utils/assemblyEdit";
import {applyEdits, findValue, insertIntoStack, moveInStack, removeFromStack} from "../utils/layoutEdit";
import yaml from "js-yaml";

type Props = {
    pcb: string,
    // the pcb's name in the config, e.g. ergo_cai_right; KiCanvas's view edits its parts on the board
    board: string,
    // the view to open with, instead of the one last picked
    initialView?: '2d' | '3d',
    // the assembly (config.assemblies) it is shown as, with its case around it; without one, just the board
    assembly?: string
};

type View = '2d' | '3d';

const Wrapper = styled.div`
  position: relative;
`;

// at the top of the pane, in the middle
const Switch = styled.div`
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
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
const PcbPreview = ({pcb, board, initialView, assembly}: Props): JSX.Element => {
    const [chosen, setView] = useState<View>(initialView || lastView);
    // an assembly is shown in 3D only
    const view: View = assembly ? '3d' : chosen;
    const configContext = useConfigContext();
    const results = configContext?.results as any;
    // the case parts around this board, when it is shown as one of config.assemblies
    const stack = useMemo((): Stack | null => {
        const found = assembly ? results?.assemblies?.[assembly] : null;
        if (!found || found.pcb?.name !== board) return null;
        const name = assembly as string;
        const parts = (found.layers || [])
            .map((l: any) => ({name: l.name, z: l.z, height: l.height, stl: results?.cases?.[l.name]?.stl}))
            .filter((p: any) => p.stl instanceof Blob);
        const models = (found.parts || []).map((p: any) => ({name: p.name, model: p.model, x: p.x, y: p.y, r: p.r || 0, z: p.z || 0}));
        const {z, thickness, shift, top, on} = found.pcb;
        return {name, pcb: {z, thickness, shift: shift || 0, top: top || null, on: on || null}, parts, models};
    }, [results, board, assembly]);
    // the panel's moves, into the config's assemblies; the next run brings them back
    const save = (edit: StackEdit) => {
        if (!configContext?.configInput || !stack) return;
        try {
            configContext.setConfigInput(writeStack(configContext.configInput, stack.name, edit));
        } catch (e) {
            window.alert(`Cannot write the stack into the config: ${e instanceof Error ? e.message : e}`);
        }
    };
    // the cases this assembly's stack can take: the config's, less those in it
    const caseNames = useMemo(() => {
        try {
            return Object.keys((yaml.load(configContext?.configInput ?? '') as any)?.cases ?? {});
        } catch (e: unknown) {
            return [];
        }
    }, [configContext?.configInput]);
    const restack = (change: (text: string) => string) => {
        if (!configContext?.configInput) return;
        try {
            configContext.setConfigInput(change(configContext.configInput));
        } catch (e) {
            window.alert(`Cannot change the stack: ${e instanceof Error ? e.message : e}`);
        }
    };
    const stackCases = stack ? {
        available: caseNames.filter(name => !stack.parts.some(p => p.name === name)),
        add: (name: string) => restack(text => insertIntoStack(text, stack.name, name, stack.parts.length)),
        remove: (name: string) => restack(text => removeFromStack(text, stack.name, name)),
        move: (name: string, delta: number) => restack(text => moveInStack(text, stack.name, name, delta)),
        // the board's pcb.top (or pcb.on) set to another case; the board then sits by that case, its shift kept
        placeBy: (name: string) => restack(text => {
            const site = findValue(text, ['assemblies', stack.name, 'pcb'], stack.pcb.top ? 'top' : 'on');
            if (typeof site === 'string') throw new Error(site);
            return applyEdits(text, [{site, value: name}]);
        }),
    } : undefined;
    const choose = (v: View) => {
        lastView = v;
        setView(v);
    };
    return (
        <Wrapper>
            {/* an assembly is a 3D thing: only a board has its 2D view too */}
            {!assembly && (
                <Switch role="group" aria-label="Board view">
                    <SwitchButton $active={view === '2d'} aria-pressed={view === '2d'} onClick={() => choose('2d')}>2D</SwitchButton>
                    <SwitchButton $active={view === '3d'} aria-pressed={view === '3d'} onClick={() => choose('3d')}>3D</SwitchButton>
                </Switch>
            )}
            <ErrorBoundary area={view === '2d' ? 'the board' : 'the board in 3D'} resetKey={`${view} ${pcb.length}`}>
                {view === '2d'
                    ? <KicanvasPreview pcb={pcb} name={`${board}_preview.kicad_pcb`} pcbName={board}/>
                    : <Pcb3dPreview pcb={pcb} fileName={`${board}.glb`} stack={stack} onSave={save} stackCases={stackCases}
                                    partsTab={assembly && <ErrorBoundary area="the assembly's parts" resetKey={configContext?.configInput}>
                                        <AssemblyParts assembly={assembly} embedded/></ErrorBoundary>}/>}
            </ErrorBoundary>
        </Wrapper>
    );
};

export default PcbPreview;
