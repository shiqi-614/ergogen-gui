import styled from "styled-components";
import {colors, fontSize, radius} from "./theme";

// A "+ Something" button that first asks which one: a menu that looks like the go Button, its first entry the label
const Menu = styled.select`
  padding: 0.2rem 0.4rem;
  border: none;
  border-radius: ${radius.small};
  background: ${colors.go};
  color: ${colors.strong};
  font: inherit;
  font-size: ${fontSize.small};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${colors.goHover};
  }

  &:disabled {
    color: #777777;
    cursor: default;
  }

  option {
    background: ${colors.field};
    color: ${colors.text};
  }
`;

type Props = { label: string, title?: string, options: string[], onPick: (option: string) => void, disabled?: boolean };

export const AddMenu = ({label, title, options, onPick, disabled}: Props): JSX.Element => (
    <Menu className="add-menu" value="" title={title} disabled={disabled || options.length === 0} onChange={e => e.target.value && onPick(e.target.value)}>
        <option value="">{label}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
    </Menu>
);
