import {ReactNode, useEffect} from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";

// A form over the page: a title, labelled fields, and the buttons at the bottom. Escape, the × or a click
// beside it closes it.

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
`;

const Box = styled.div`
  width: min(26rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow: auto;
  padding: 1rem 1.2rem;
  border-radius: 0.4rem;
  background: #2b2b2b;
  box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.5);
  color: #dddddd;
  font-size: 0.9rem;

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.9rem;
    color: #ffffff;
    font-size: 1.05rem;
    font-weight: bold;
  }

  .head button {
    padding: 0 0.3rem;
    background: transparent;
    color: #aaaaaa;
    font-size: 1.2rem;
  }

  .field {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.6rem;
  }

  .field > span:first-child {
    color: #aaaaaa;
  }

  .field .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  .field .controls > select, .field .controls > input:not([type="checkbox"]) {
    flex-grow: 1;
    min-width: 0;
  }

  .hint {
    margin: -0.3rem 0 0.6rem 7.1rem;
    color: #888888;
    font-size: 0.8rem;
  }

  input, select {
    padding: 0.25rem 0.4rem;
    border: 1px solid #595959;
    border-radius: 0.2rem;
    background: #1e1e1e;
    color: #ffffff;
    font: inherit;
  }

  input.short {
    width: 4rem;
    flex-grow: 0 !important;
  }

  button {
    padding: 0.3rem 0.9rem;
    border: none;
    border-radius: 0.2rem;
    background: #595959;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }

  button.add {
    background: #28a745;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .note {
    margin-top: 0.6rem;
    color: #ff8a80;
  }
`;

type Props = {
    title: string,
    onClose: () => void,
    children: ReactNode,
};

const Dialog = ({title, onClose, children}: Props): JSX.Element => {
    useEffect(() => {
        const listener = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, [onClose]);
    return ReactDOM.createPortal(
        <Overlay onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <Box role="dialog" aria-label={title}>
                <div className="head">
                    {title}
                    <button title="Close" onClick={onClose}>×</button>
                </div>
                {children}
            </Box>
        </Overlay>,
        document.body,
    );
};

export default Dialog;
