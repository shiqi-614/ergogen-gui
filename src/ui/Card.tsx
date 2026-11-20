import {ReactNode} from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import styled from "styled-components";
import {Button} from "./Button";
import {colors, fontSize, radius, shadow} from "./theme";

// A card over a view (the layout editor's panel, a board's parts): a head with its title and a fold arrow, tabs, and a
// body of fields, notes and a row of actions. Where it sits is up to whoever uses it: styled(CardShell)`top: …`.

export const CardShell = styled.div`
  position: absolute;
  width: 17rem;
  max-height: calc(100% - 4rem);
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid ${colors.border};
  border-radius: ${radius.card};
  background: ${colors.panel};
  box-shadow: ${shadow};
  color: ${colors.text};
  font-size: ${fontSize.body};

  .body {
    padding: 0.65rem 0.7rem 0.7rem;
  }

  /* the add menus (AddMenu) look like buttons, not fields */
  input:not([type=checkbox]):not([type=range]), select:not(.add-menu) {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.2rem 0.4rem;
    border: 1px solid ${colors.fieldBorder};
    border-radius: ${radius.small};
    background: ${colors.field};
    color: ${colors.strong};
    font: inherit;
  }

  input:disabled {
    color: ${colors.muted};
  }

  input[type=range] {
    width: 100%;
    margin: -0.15rem 0 0.45rem;
    accent-color: ${colors.accent};
  }
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.7rem 0.45rem;

  .names {
    flex-grow: 1;
    min-width: 0;
  }

  strong {
    display: block;
    overflow: hidden;
    color: ${colors.strong};
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: ${colors.muted};
  }
`;

type HeadProps = {
    title: ReactNode,
    subtitle?: ReactNode,
    folded: boolean,
    onFold: (folded: boolean) => void,
    // on the right of the head, e.g. Done
    actions?: ReactNode,
    // the fold arrow on the left (a card that opens downwards) or the right
    foldAt?: 'left' | 'right',
};

export const CardHead = ({title, subtitle, folded, onFold, actions, foldAt = 'right'}: HeadProps): JSX.Element => {
    const fold = (
        <Button $variant="ghost" title={folded ? 'Show the card' : 'Fold the card away'} onClick={() => onFold(!folded)}>
            {folded ? '▸' : '▾'}
        </Button>
    );
    return (
        <Head>
            {foldAt === 'left' && fold}
            <div className="names">
                <strong title={typeof title === 'string' ? title : undefined}>{title}</strong>
                {subtitle && <small>{subtitle}</small>}
            </div>
            {actions}
            {foldAt === 'right' && fold}
        </Head>
    );
};

const TabList = styled(RadixTabs.List)`
  display: flex;
  margin: 0 0.7rem;
  border-radius: ${radius.card};
  background: ${colors.field};
`;

const Tab = styled(RadixTabs.Trigger)`
  flex: 1;
  padding: 0.3rem 0;
  border: none;
  border-radius: ${radius.card};
  background: transparent;
  color: #a0a0a0;
  font: inherit;
  font-size: ${fontSize.small};
  cursor: pointer;

  &[data-state=active] {
    background: ${colors.accent};
    color: ${colors.accentInk};
    font-weight: bold;
  }

  &:disabled {
    color: #555555;
    cursor: default;
  }
`;

type TabsProps<T extends string> = {
    value: T,
    onChange: (value: T) => void,
    tabs: { value: T, label: string, disabled?: boolean }[],
};

// the card's tabs (Radix: arrow keys move between them); what each shows is up to the card
export const CardTabs = <T extends string>({value, onChange, tabs}: TabsProps<T>): JSX.Element => (
    <RadixTabs.Root value={value} onValueChange={v => onChange(v as T)} activationMode="manual">
        <TabList>
            {/* Radix switches on mousedown; a click (from a script, or assistive technology) switches too */}
            {tabs.map(t => <Tab key={t.value} value={t.value} disabled={t.disabled} onClick={() => !t.disabled && onChange(t.value)}>{t.label}</Tab>)}
        </TabList>
    </RadixTabs.Root>
);
