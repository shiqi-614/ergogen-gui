import styled, {keyframes} from "styled-components";

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// a ring that turns while something loads
export const Spinner = styled.span<{ $size?: string }>`
  display: inline-block;
  flex-shrink: 0;
  width: ${p => p.$size ?? '2rem'};
  height: ${p => p.$size ?? '2rem'};
  border: calc(${p => p.$size ?? '2rem'} / 9) solid rgba(255, 255, 255, 0.15);
  border-top-color: #28a745;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  width: 100%;
  height: 100%;
  min-height: 8rem;
  color: #c8c8c8;
  font-size: 0.9rem;
`;

// a spinner and what is being waited for, in the middle of the space it gets
const Loading = ({text, className}: { text: string, className?: string }): JSX.Element => (
    <Box className={className} role="status" aria-live="polite">
        <Spinner/>
        {text}
    </Box>
);

export default Loading;
