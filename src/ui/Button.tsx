import styled, {css} from "styled-components";
import {colors, fontSize, radius} from "./theme";

// plain, go (add, confirm), accent (a toggle that is on), danger (delete: outlined until pointed at), destructive (the
// yes of a dialog that deletes), ghost (a fold arrow, a ×)
export type ButtonVariant = 'plain' | 'go' | 'accent' | 'danger' | 'destructive' | 'ghost';

const variants: Record<ButtonVariant, ReturnType<typeof css>> = {
    plain: css`
      background: ${colors.button};
      &:hover:not(:disabled) { background: ${colors.buttonHover}; }
    `,
    go: css`
      background: ${colors.go};
      &:hover:not(:disabled) { background: ${colors.goHover}; }
    `,
    accent: css`
      background: ${colors.accent};
      color: ${colors.accentInk};
    `,
    danger: css`
      background: transparent;
      color: ${colors.dangerInk};
      box-shadow: inset 0 0 0 1px ${colors.dangerRule};
      &:hover:not(:disabled) { background: ${colors.danger}; color: ${colors.strong}; }
    `,
    destructive: css`
      background: ${colors.danger};
      &:hover:not(:disabled) { background: ${colors.dangerHover}; }
    `,
    ghost: css`
      padding: 0 0.2rem;
      background: transparent;
      color: ${colors.label};
      &:hover:not(:disabled) { color: ${colors.strong}; }
    `,
};

export const Button = styled.button<{ $variant?: ButtonVariant }>`
  padding: 0.2rem 0.6rem;
  border: none;
  border-radius: ${radius.small};
  color: ${colors.strong};
  font: inherit;
  font-size: ${fontSize.small};
  cursor: pointer;

  &:disabled {
    color: #777777;
    cursor: default;
  }

  ${p => variants[p.$variant ?? 'plain']}
`;
