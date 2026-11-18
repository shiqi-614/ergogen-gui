import {ReactNode} from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import styled from "styled-components";
import {colors, shadow} from "./theme";

// A form over the page: a title, labelled fields, and the buttons at the bottom. Radix keeps the focus inside while
// it is open and gives it back after; Escape, the × or a click beside it closes it.

const Overlay = styled(RadixDialog.Overlay)`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
`;

const Box = styled(RadixDialog.Content)`
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 1001;
  transform: translate(-50%, -50%);
  width: min(28rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow: auto;
  padding: 1rem 1.2rem;
  border-radius: 0.4rem;
  background: #2b2b2b;
  box-shadow: ${shadow};
  color: ${colors.text};
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
    border: none;
    border-radius: 0.2rem;
    background: transparent;
    color: #aaaaaa;
    font: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }

  .field {
    display: grid;
    grid-template-columns: 6.5rem 1fr auto;
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

  .field .checks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.2rem 0.6rem;
    max-height: 9rem;
    overflow-y: auto;
  }

  .field .checks label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
  }

  .field .checks .order {
    min-width: 1.1rem;
    border-radius: 0.6rem;
    background: #28a745;
    color: #ffffff;
    font-size: 0.75rem;
    text-align: center;
  }

  .field:has(.checks) {
    align-items: start;
  }

  .part {
    margin: 0 0 0.6rem 7.1rem;
    padding: 0.4rem;
    border-radius: 0.25rem;
    background: #232323;
  }

  .part .row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-bottom: 0.3rem;
  }

  .part .row input:first-child {
    width: 4.5rem;
  }

  .part .row input.short {
    width: 2.8rem;
  }

  .part .row select {
    flex-grow: 1;
    min-width: 0;
  }

  .part input.model {
    width: 100%;
    box-sizing: border-box;
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

  .message {
    margin-bottom: 0.5rem;
  }

  ul.uses {
    max-height: 12rem;
    overflow-y: auto;
    margin: 0 0 0.6rem;
    padding-left: 1.2rem;
    color: #bdbdbd;
  }

  .hint-plain {
    color: #888888;
    font-size: 0.8rem;
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

const Dialog = ({title, onClose, children}: Props): JSX.Element => (
    <RadixDialog.Root open onOpenChange={open => !open && onClose()}>
        <RadixDialog.Portal>
            <Overlay/>
            <Box aria-describedby={undefined}
                 // the box asked for with autoFocus, else the first one, rather than the × in the head
                 onOpenAutoFocus={e => {
                     const content = e.currentTarget as HTMLElement;
                     const first = content.querySelector<HTMLElement>('input, select, textarea, .buttons button:last-child');
                     if (first) { e.preventDefault(); first.focus(); }
                 }}>
                <div className="head">
                    <RadixDialog.Title asChild><span>{title}</span></RadixDialog.Title>
                    <RadixDialog.Close asChild><button title="Close">×</button></RadixDialog.Close>
                </div>
                {children}
            </Box>
        </RadixDialog.Portal>
    </RadixDialog.Root>
);

export default Dialog;
