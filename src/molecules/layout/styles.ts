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

export const Panel = styled.div`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 15rem;
  max-height: calc(100% - 4.5rem);
  overflow-y: auto;
  padding: 0.75rem;
  border-radius: 0.25rem;
  background: rgba(45, 45, 45, 0.95);
  font-size: 0.9rem;

  h4 {
    margin: 0 0 0.5rem 0;
  }

  h4:not(:first-child) {
    margin-top: 0.8rem;
  }

  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }

  input {
    width: 6rem;
    padding: 0.2rem 0.4rem;
    border: 1px solid #595959;
    border-radius: 0.2rem;
    background: #1e1e1e;
    color: #ffffff;
    font: inherit;
  }

  input:disabled {
    color: #8a8a8a;
  }

  select {
    width: 6rem;
    padding: 0.2rem 0.4rem;
    border: 1px solid #595959;
    border-radius: 0.2rem;
    background: #1e1e1e;
    color: #ffffff;
    font: inherit;
  }

  input[type=range] {
    width: 100%;
    padding: 0;
    border: none;
    accent-color: #ff9f1c;
  }

  .part {
    padding: 0.5rem 0;
    border-top: 1px solid #444444;
  }

  .part:first-of-type {
    border-top: none;
  }

  .note {
    color: #8a8a8a;
    font-size: 0.8rem;
  }

  .title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .title button {
    border: none;
    border-radius: 0.2rem;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }

  .title button.danger {
    padding: 0.15rem 0.5rem;
    background: #a33a3a;
    font-size: 0.8rem;
  }

  .title button.remove {
    padding: 0 0.4rem;
    background: transparent;
    color: #bdbdbd;
    font-size: 1.1rem;
  }

  .title button.remove:hover {
    color: #ff6d6d;
  }

  /* folds the panel down to its title, out of the way of what is under it */
  .title button.fold {
    padding: 0 0.4rem 0 0;
    background: transparent;
    color: #bdbdbd;
    font-size: 0.9rem;
  }

  .title .name {
    display: flex;
    align-items: baseline;
    flex-grow: 1;
  }
`;

export const StatusBar = styled.div`
  position: absolute;
  left: 0.75rem;
  bottom: 0.75rem;
  right: 0.75rem;
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
