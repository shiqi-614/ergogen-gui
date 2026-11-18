import {ReactNode} from "react";
import styled from "styled-components";
import {Button} from "./Button";
import {colors, fontSize} from "./theme";

// A labelled value on a card: the label, the box (or select) and its unit, in columns that line up down the card.
const Row = styled.label`
  display: grid;
  grid-template-columns: 4.6rem 1fr 1.6rem;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;

  .label {
    color: ${colors.label};
  }

  .unit {
    color: ${colors.muted};
    font-size: ${fontSize.small};
  }

  /* a select takes the unit's column too */
  select {
    grid-column: 2 / 4;
  }
`;

type FieldProps = { label: string, unit?: string, title?: string, children: ReactNode };

export const Field = ({label, unit, title, children}: FieldProps): JSX.Element => (
    <Row className="field" title={title}>
        <span className="label">{label}</span>
        {children}
        {unit !== undefined && <span className="unit">{unit}</span>}
    </Row>
);

// a short explanation at the top of a tab, or a tip under its fields
export const About = styled.div`
  margin-bottom: 0.55rem;
  color: ${colors.muted};
  font-size: ${fontSize.small};
`;

export const Tip = styled(About)`
  margin: 0.3rem 0 0;
`;

// what just happened, or why something can't be done
export const Status = styled.div`
  margin-top: 0.5rem;
  color: ${colors.warn};
  font-size: ${fontSize.small};
`;

// a heading inside a card's body
export const Section = styled.div`
  margin: 0.9rem 0 0.4rem;
  padding-top: 0.6rem;
  border-top: 1px solid ${colors.rule};
  color: ${colors.label};
  font-size: ${fontSize.small};
  font-weight: bold;
`;

// a checkbox and what it does
export const Check = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  color: ${colors.label};
  font-size: ${fontSize.small};
  cursor: pointer;

  input {
    margin: 0;
  }
`;

// the buttons at the bottom of a card or a tab: those before <Gap/> on the left, after it on the right
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.65rem;
  padding-top: 0.55rem;
  border-top: 1px solid ${colors.rule};
`;

export const Gap = styled.span`
  flex-grow: 1;
`;

// a list of things to pick, each lit while pointed at
export const List = styled.div`
  max-height: 11rem;
  overflow-y: auto;
  margin: 0 -0.3rem;
`;

export const ListRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.2rem 0.3rem;
  border-radius: 0.2rem;
  cursor: pointer;

  &:hover {
    background: rgba(255, 159, 28, 0.15);
  }

  small {
    overflow: hidden;
    color: ${colors.muted};
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

// small buttons in a row with a label first, e.g. the hidden keys to bring back
export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin: 0.5rem 0 0.2rem;
  color: ${colors.label};
  font-size: ${fontSize.small};
`;

export {Button};
