import styled from "styled-components";
import {PcbParts} from "./usePcbParts";

// On the board: the modules' boxes, the footprints' outlines, the turn knob and the keys to pick, over KiCanvas.

const Layer = styled.svg<{ active: boolean }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;

  .target {
    pointer-events: ${p => p.active ? 'all' : 'none'};
  }

  polygon.module {
    fill: rgba(77, 171, 247, 0.06);
    stroke: #4dabf7;
    stroke-width: 1;
    stroke-dasharray: 4 3;
    cursor: move;
  }

  /* pointed at in the card's list */
  polygon.module.lit, polygon.footprint.lit {
    fill: rgba(255, 159, 28, 0.25);
    stroke: #ff9f1c;
    stroke-width: 2;
  }

  polygon.module.chosen {
    fill: rgba(77, 171, 247, 0.2);
    stroke: #ffffff;
    stroke-width: 2;
    stroke-dasharray: none;
  }

  polygon.module:hover {
    fill: rgba(77, 171, 247, 0.18);
  }

  polygon.footprint {
    fill: transparent;
    stroke: rgba(255, 159, 28, 0.35);
    stroke-width: 0.8;
    cursor: pointer;
  }

  polygon.footprint:hover {
    fill: rgba(255, 159, 28, 0.12);
  }

  polygon.footprint.chosen {
    fill: rgba(255, 159, 28, 0.15);
    stroke: #ff9f1c;
    stroke-width: 1.5;
    cursor: move;
  }

  polygon.ghost {
    fill: rgba(77, 171, 247, 0.25);
    stroke: #ffffff;
    stroke-width: 1.5;
    pointer-events: none;
  }

  circle.knob {
    fill: #ff9f1c;
    stroke: #ffffff;
    stroke-width: 1;
    cursor: grab;
  }

  circle.key {
    fill: rgba(30, 30, 30, 0.6);
    stroke: #ff9f1c;
    stroke-width: 1.5;
    cursor: pointer;
  }

  circle.key.member {
    fill: #ff9f1c;
  }

  rect.catcher {
    fill: transparent;
    pointer-events: all;
    cursor: crosshair;
  }

  g.remove {
    cursor: pointer;
  }

  g.remove circle {
    fill: #a33a3a;
  }

  g.remove:hover circle {
    fill: #d64545;
  }

  g.remove text {
    fill: #ffffff;
    stroke: none;
    font-size: 11px;
  }

  text {
    fill: #9ccfff;
    font-size: 12px;
    font-family: sans-serif;
    paint-order: stroke;
    stroke: #1e1e1e;
    stroke-width: 3px;
    pointer-events: none;
  }
`;

const PartsOverlay = ({parts}: { parts: PcbParts }): JSX.Element => {
    const {active, tab, moving, setMoving, setNote, adding, chosen, setChosen, choosingKeys, chosenModule, setChosenInstance, setFields, hoverOutline, lit, layer, half, points, modules, instances, toScreen, toWorld, onScreen, screenDelta, start, move, drop, place, keyList, toggleKey, ghostFor, outlinePath, knobFor} = parts;
    return (
        <>
            <Layer ref={layer} active={active && !adding?.placing} onPointerMove={move} onPointerUp={drop} onPointerCancel={() => setMoving(null)}>
                {active && tab === 'modules' && modules.map(({module, box}) => {
                    const shape = onScreen(box);
                    const rect = shape.bounds;
                    const shift = moving?.kind === 'module' && moving.module === module ? screenDelta(moving.delta) : null;
                    const label = shift ? {x: rect.x + shift.x, y: rect.y + shift.y} : rect;
                    return (
                        <g key={module}>
                            <polygon className={`module target${module === chosenModule ? ' chosen' : ''}${module === lit ? ' lit' : ''}`} points={shape.points}
                                     onPointerDown={e => start(e, {kind: 'module', module, start: toWorld(e), delta: {x: 0, y: 0}})}>
                                <title>{`modules.${module}: drag to move it, click to pick it`}</title>
                            </polygon>
                            {shift && <polygon className="ghost" points={shape.points} transform={`translate(${shift.x} ${shift.y})`}/>}
                            <text x={label.x + 3} y={label.y - 4}>{module}</text>
                        </g>
                    );
                })}
                {active && tab === 'footprints' && !choosingKeys && instances.map(instance => {
                    const shape = onScreen(instance.box);
                    const ghost = ghostFor(instance);
                    const isChosen = instance.name === chosen;
                    return (
                        <g key={instance.key}>
                            <polygon className={`footprint target${isChosen ? ' chosen' : ''}${instance.name === lit ? ' lit' : ''}`} points={shape.points}
                                  onPointerDown={e => {
                                      setChosenInstance(instance.key);
                                      if (!isChosen) {
                                          e.stopPropagation();
                                          setChosen(instance.name);
                                          setFields({});
                                          setNote(null);
                                          return;
                                      }
                                      start(e, {kind: 'footprint', name: instance.name, instance, start: toWorld(e), delta: {x: 0, y: 0}});
                                  }}>
                                <title>{`footprints.${instance.name}${isChosen ? ': drag to move' : ': click to pick'}`}</title>
                            </polygon>
                            {ghost && (() => {
                                const d = screenDelta({x: ghost.dx, y: ghost.dy});
                                return <polygon className="ghost" points={shape.points}
                                                transform={`translate(${d.x} ${d.y}) rotate(${ghost.angle} ${shape.center.x} ${shape.center.y})`}/>;
                            })()}
                        </g>
                    );
                })}
                {active && tab === 'footprints' && knobFor && (() => {
                    const rect = onScreen(knobFor.box).bounds;
                    // the turn is measured around the footprint's middle, in board coordinates
                    const center = knobFor.box.center;
                    const knob = {x: rect.x + rect.w / 2, y: rect.y - 14};
                    return (
                        <circle className="knob target" cx={knob.x} cy={knob.y} r={6}
                                onPointerDown={e => {
                                    const now = toWorld(e);
                                    start(e, {kind: 'turn', name: knobFor.name, instance: knobFor, center,
                                        startAngle: Math.atan2(now.y - center.y, now.x - center.x) * 180 / Math.PI, angle: 0});
                                }}>
                            <title>{`Drag to turn ${knobFor.name}`}</title>
                        </circle>
                    );
                })()}
                {active && tab === 'footprints' && choosingKeys && keyList && typeof keyList !== 'string' && Object.entries(points)
                    .filter(([, p]) => !!p.meta?.mirrored === (half === 'mirror'))
                    .map(([keyName, p]) => {
                        const at = toScreen({x: p.x, y: -p.y});
                        const member = keyList.names.includes(keyName.replace(/^mirror_/, ''));
                        return (
                            <circle key={keyName} className={`key target${member ? ' member' : ''}`} cx={at.x} cy={at.y} r={7}
                                    onPointerDown={e => { e.stopPropagation(); toggleKey(keyName); }}>
                                <title>{`${keyName.replace(/^mirror_/, '')}: click to ${member ? 'take it off' : 'put it on'}`}</title>
                            </circle>
                        );
                    })}
                {moving?.kind === 'turn' && (
                    <text x={onScreen(moving.instance.box).bounds.x} y={onScreen(moving.instance.box).bounds.y - 24}>{`${moving.angle}°`}</text>
                )}
                {active && tab === 'outline' && hoverOutline && half === 'source' && (() => {
                    const path = outlinePath(hoverOutline);
                    return path && <path d={path.d} transform={path.transform} fill="rgba(255, 159, 28, 0.12)" stroke="#ff9f1c"
                                         strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" fillRule="evenodd"/>;
                })()}
                {adding?.placing && <rect className="catcher" x={0} y={0} width="100%" height="100%" onPointerDown={place}/>}
            </Layer>
        </>
    );
};

export default PartsOverlay;
