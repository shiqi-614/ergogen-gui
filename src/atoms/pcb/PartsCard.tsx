import styled from "styled-components";
import {About, Actions, Button, CardHead, CardShell, CardTabs, Check, Field, Gap, List, ListRow, Status, Tip, colors} from "../../ui";
import {PcbParts} from "./usePcbParts";

// The card the parts are edited in: Modules / Footprints / Board edge, the picked part, or the list to pick from.

// the "Edit parts" button, below the 2D / 3D switch, while the card is closed
const OpenButton = styled(Button)`
  position: absolute;
  top: 2.75rem;
  left: 0.5rem;
  padding: 0.25rem 0.7rem;
  font-size: 0.85rem;
`;

// the card the parts are edited in, below the 2D / 3D switch
const Card = styled(CardShell)`
  top: 2.75rem;
  left: 0.5rem;
`;

// the picked module or footprint: its name, and its file and where it is
const PickedName = styled.div`
  margin-bottom: 0.5rem;

  strong {
    color: ${colors.strong};
  }

  small {
    display: block;
    color: ${colors.muted};
  }
`;

const Picked = ({name, detail}: { name: string, detail: string }): JSX.Element => (
    <PickedName><strong>{name}</strong><small>{detail}</small></PickedName>
);

const PartsCard = ({parts}: { parts: PcbParts }): JSX.Element => {
    const {pcb, active, setActive, tab, setTab, moving, note, setNote, adding, setAdding, chosen, setChosen, choosingKeys, setChoosingKeys, chosenModule, setChosenModule, setChosenInstance, setFields, setHoverOutline, listFolded, setListFolded, setLit, source, half, modules, instances, config, followsKeys, target, placementFields, remove, startAdding, keyList, chosenConfig, describeWhere, setSide, outlineTarget, boardOutlines, outlineNames, toggleOutline, footprintFiles, moduleFiles} = parts;
    return (
        <>
            {!active && (
                <OpenButton onClick={() => { setActive(true); setNote(null); }}>Edit parts</OpenButton>
            )}
            {active && (
                <Card onPointerDown={e => e.stopPropagation()} onMouseLeave={() => { setLit(null); setHoverOutline(null); }}>
                    <CardHead title={`Parts of ${pcb}`} subtitle={source !== pcb ? `mirrored from ${source}: its parts are edited` : undefined}
                              folded={listFolded} onFold={setListFolded} foldAt="left"
                              actions={<Button $variant="go" onClick={() => { setActive(false); setNote(null); setAdding(null); setChoosingKeys(false); }}>Done</Button>}/>
                    {!listFolded && <>
                        <CardTabs value={tab} onChange={t => { setTab(t); setAdding(null); setChoosingKeys(false); setNote(null); }}
                                  tabs={[{value: 'modules', label: 'Modules'}, {value: 'footprints', label: 'Footprints'}, {value: 'outline', label: 'Board edge'}]}/>
                        <div className="body">
                            {/* a new part: named and given its file, then placed with a click (or put on keys) */}
                            {adding && !adding.placing && <>
                                <Field label="Name">
                                    <input autoFocus placeholder={`${adding.tab === 'modules' ? 'module' : 'footprint'} name`} value={adding.name}
                                           onChange={e => setAdding({...adding, name: e.target.value})}
                                           onKeyDown={e => e.key === 'Enter' ? startAdding() : e.key === 'Escape' && setAdding(null)}/>
                                </Field>
                                <Field label="File">
                                    <select value={adding.file} onChange={e => setAdding({...adding, file: e.target.value})} title={adding.file.replace('|', '/')}>
                                        {(adding.tab === 'modules' ? moduleFiles : footprintFiles).map(f =>
                                            <option key={f} value={f}>{f.split('|')[1].split('/').slice(-2).join('/')}</option>)}
                                    </select>
                                </Field>
                                {adding.tab === 'footprints' && (
                                    <Field label="Where">
                                        <select value={adding.onKeys ? 'keys' : 'point'} onChange={e => setAdding({...adding, onKeys: e.target.value === 'keys'})}>
                                            <option value="keys">on keys</option>
                                            <option value="point">at a point</option>
                                        </select>
                                    </Field>
                                )}
                                <Actions>
                                    <Gap/>
                                    <Button onClick={() => setAdding(null)}>Cancel</Button>
                                    <Button $variant="go" onClick={startAdding}>{adding.tab === 'footprints' && adding.onKeys ? 'Add' : 'Place'}</Button>
                                </Actions>
                            </>}
                            {adding?.placing && <>
                                <About>Click on the board where {adding.name} goes.</About>
                                <Actions><Gap/><Button onClick={() => setAdding(null)}>Cancel</Button></Actions>
                            </>}

                            {!adding && tab === 'modules' && (chosenModule ? <>
                                <Picked name={chosenModule} detail={String(config()?.pcbs?.[source]?.modules?.[chosenModule]?.what?.github?.file ?? '').split('/').pop()}/>
                                {placementFields()}
                                <Tip>Drag its box to move it; ←↑→↓ 0.1 mm (Shift 1 mm), [ ] turn 5°.</Tip>
                                <Actions>
                                    <Button onClick={() => { setChosenModule(null); setFields({}); }}>Deselect</Button>
                                    <Gap/>
                                    <Button $variant="danger" title={`Delete module ${chosenModule}`} onClick={() => { remove('modules', chosenModule); setChosenModule(null); }}>Delete</Button>
                                </Actions>
                            </> : <>
                                <About>Point at one to find it; drag its box on the board to move it, click it to pick it.</About>
                                <List>
                                    {modules.map(({module}) => (
                                        <ListRow key={module} onMouseEnter={() => setLit(module)}
                                                 onClick={() => { setChosenModule(module); setFields({}); setNote(null); }}>
                                            <span>{module}</span>
                                            <small>{String(config()?.pcbs?.[source]?.modules?.[module]?.what?.github?.file ?? '').split('/').slice(-2, -1)[0] ?? ''}</small>
                                        </ListRow>
                                    ))}
                                </List>
                                <Actions>
                                    <Button $variant="go" onClick={() => setAdding({tab, name: '', file: moduleFiles[0] ?? '', onKeys: true, placing: false})}>+ Add module</Button>
                                </Actions>
                            </>)}

                            {!adding && tab === 'footprints' && (chosen ? <>
                                <Picked name={chosen} detail={`${String(chosenConfig?.what?.github?.file ?? '').split('/').pop()}, ${describeWhere(chosenConfig?.where)}`}/>
                                <Field label="Side">
                                    <select value={String(chosenConfig?.side ?? 'front').toLowerCase()} onChange={e => setSide(e.target.value)}>
                                        <option value="front">front</option>
                                        <option value="back">back</option>
                                    </select>
                                </Field>
                                {target && placementFields()}
                                <Tip>
                                    {choosingKeys ? `Click keys on the board to put ${chosen} on them or take it off.`
                                        : `${followsKeys(chosen) ? 'Drag one to move them all on their keys' : 'Drag it to move it'}, the knob turns it; ←↑→↓ 0.1 mm (Shift 1 mm), [ ] 5°.`}
                                </Tip>
                                <Actions>
                                    {keyList && typeof keyList !== 'string' && (
                                        <Button $variant={choosingKeys ? 'accent' : 'plain'} onClick={() => setChoosingKeys(!choosingKeys)}>{choosingKeys ? 'Keys chosen' : 'Choose keys'}</Button>
                                    )}
                                    <Button onClick={() => { setChosen(null); setChoosingKeys(false); }}>Deselect</Button>
                                    <Gap/>
                                    <Button $variant="danger" title={`Delete footprint ${chosen}`} onClick={() => { remove('footprints', chosen); setChosen(null); }}>Delete</Button>
                                </Actions>
                            </> : <>
                                <About>Point at one to find it; click it, here or on the board, to pick it and the others like it.</About>
                                <List>
                                    {Object.keys(config()?.pcbs?.[source]?.footprints ?? {}).map(name => (
                                        <ListRow key={name} onMouseEnter={() => setLit(name)}
                                                 onClick={() => { setChosen(name); setChosenInstance(instances.find(i => i.name === name)?.key ?? null); setFields({}); setNote(null); }}>
                                            <span>{name}</span>
                                            <small>{describeWhere(config()?.pcbs?.[source]?.footprints?.[name]?.where)}</small>
                                        </ListRow>
                                    ))}
                                </List>
                                <Actions>
                                    <Button $variant="go" onClick={() => setAdding({tab, name: '', file: footprintFiles[0] ?? '', onKeys: true, placing: false})}>+ Add footprint</Button>
                                </Actions>
                            </>)}

                            {!adding && tab === 'outline' && <>
                                <About>
                                    {`The board edge of ${outlineTarget} is the checked outlines stacked; a closed shape inside the board becomes a cut-out.`}
                                    {outlineTarget !== pcb && ` ${pcb} takes them from ${outlineTarget}, mirrored.`}
                                    {half === 'source' ? ' Point at one to see it on the board.' : ''}
                                </About>
                                <List>
                                    {typeof boardOutlines === 'string' ? <span>{boardOutlines}</span> : outlineNames.map(name => (
                                        <Check key={name} onMouseEnter={() => setHoverOutline(name)}>
                                            <input type="checkbox" checked={boardOutlines.some(e => e.outline === name)} onChange={() => toggleOutline(name)}/>
                                            {name}
                                        </Check>
                                    ))}
                                </List>
                            </>}

                            {moving && moving.kind !== 'turn' && (
                                <Status>{`${moving.kind === 'module' ? moving.module : moving.name}: ${moving.delta.x.toFixed(1)}, ${(-moving.delta.y).toFixed(1)} mm`}</Status>
                            )}
                            {!moving && note && <Status>{note}</Status>}
                        </div>
                    </>}
                </Card>
            )}

        </>
    );
};

export default PartsCard;
