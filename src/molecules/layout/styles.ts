// The layout editor's look
import styled from "styled-components";

export const Container = styled.div`
  position: relative;
  height: calc(100vh - 6rem);
  min-height: 20rem;
  background: #1e1e1e;
  border-radius: 0.25rem;
  overflow: hidden;
  user-select: none;
`;

export const Canvas = styled.svg`
  width: 100%;
  height: 100%;
  touch-action: none;
`;

export const Key = styled.rect<{ selected: boolean }>`
  fill: ${p => p.selected ? 'rgba(40, 167, 69, 0.35)' : 'rgba(255, 255, 255, 0.04)'};
  stroke: ${p => p.selected ? '#28a745' : '#bdbdbd'};
  stroke-width: 0.4;
  cursor: grab;

  &:hover {
    stroke: #ffffff;
  }
`;

export const RotateHandle = styled.circle`
  fill: #28a745;
  stroke: #ffffff;
  stroke-width: 0.4;
  cursor: grab;
`;

// what an edit did (or an error), at the bottom left: $right keeps it clear of the panel on the right
export const StatusBar = styled.div<{ $right?: string }>`
  position: absolute;
  left: 0.75rem;
  bottom: 0.75rem;
  right: ${p => p.$right ?? '0.75rem'};
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: #bdbdbd;

  button {
    padding: 0.2rem 0.6rem;
    border: none;
    border-radius: 0.2rem;
    background: #595959;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }
`;

export const OutlineBar = styled.div`
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  display: flex;
  flex-direction: column;
  /* each control keeps its own width, rather than stretching to the widest row */
  align-items: flex-start;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: #bdbdbd;

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    max-width: 22rem;
  }

  input {
    width: 9rem;
    padding: 0.2rem 0.4rem;
    border: 1px solid #595959;
    border-radius: 0.2rem;
    background: #1e1e1e;
    color: #ffffff;
    font: inherit;
  }

  button {
    padding: 0.2rem 0.6rem;
    border: none;
    border-radius: 0.2rem;
    background: #28a745;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }

  button.secondary {
    background: #595959;
  }

  /* how to edit: under the bar while the pointer (or the keyboard) is on its "?"; clicks go through it */
  .help-text {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: max-content;
    max-width: 36rem;
    margin-top: 0.3rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #595959;
    border-radius: 0.25rem;
    background: #2d2d2d;
    color: #e0e0e0;
    line-height: 1.5;
    pointer-events: none;
  }

  .help-text b {
    display: block;
    margin-top: 0.3rem;
    color: #ffffff;
  }

  button.help:hover + .help-text, button.help:focus-visible + .help-text {
    display: block;
  }

  select {
    padding: 0.2rem 0.4rem;
    border: 1px solid #595959;
    border-radius: 0.2rem;
    background: #2d2d2d;
    color: #ffffff;
    font: inherit;
  }
`;

export const VertexHandle = styled.rect<{ chosen: boolean }>`
  fill: ${p => p.chosen ? '#ffffff' : '#ff9f1c'};
  stroke: ${p => p.chosen ? '#ff9f1c' : '#ffffff'};
  stroke-width: ${p => p.chosen ? 0.8 : 0.3};
  cursor: move;
`;

// an invisible, wide line over an outline edge: clicking it adds a point there
export const EdgeTarget = styled.line`
  stroke: transparent;
  stroke-width: 2.5;
  cursor: copy;

  &:hover {
    stroke: rgba(255, 159, 28, 0.35);
  }
`;

export const CenterHandle = styled.circle`
  fill: #ff9f1c;
  stroke: #ffffff;
  stroke-width: 0.3;
  cursor: move;
`;

export const ErrorText = styled.span`
  color: #ff6d6d;
`;
