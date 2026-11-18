import React, {ReactNode} from "react";
import styled from "styled-components";

// One part of the page that failed to draw, in place of that part only: the rest of the page, and the config
// editor, keep working. It tries again when resetKey changes (the config, the file shown) or on the button.

const Box = styled.div`
  margin: 0.5rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid #7a3a3a;
  border-radius: 0.25rem;
  background: rgba(60, 20, 20, 0.85);
  color: #ffb3ab;
  font-size: 0.85rem;

  strong {
    display: block;
    margin-bottom: 0.25rem;
    color: #ffffff;
  }

  code {
    display: block;
    max-height: 6rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  button {
    margin-top: 0.5rem;
    padding: 0.2rem 0.7rem;
    border: none;
    border-radius: 0.2rem;
    background: #595959;
    color: #ffffff;
    font: inherit;
    cursor: pointer;
  }
`;

type Props = {
    // what the part is, as the message names it: "the preview", "the case's parts"
    area: string,
    resetKey?: unknown,
    children: ReactNode,
};

type State = { error: Error | null };

// for the end-to-end tests: makes the named part fail to draw, to check that only it goes (dev builds only)
const Breaker = ({area}: { area: string }): null => {
    if (import.meta.env.DEV && (window as any).__breakArea === area) throw new Error(`${area} broken on purpose`);
    return null;
};

class ErrorBoundary extends React.Component<Props, State> {
    state: State = {error: null};

    static getDerivedStateFromError(error: Error): State {
        return {error};
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`${this.props.area} failed to draw:`, error, info.componentStack);
    }

    componentDidUpdate(previous: Props) {
        if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({error: null});
    }

    render() {
        const {error} = this.state;
        if (!error) return <><Breaker area={this.props.area}/>{this.props.children}</>;
        return (
            <Box data-error-boundary={this.props.area}>
                <strong>Can't show {this.props.area}</strong>
                <code>{error.message || String(error)}</code>
                <button onClick={() => this.setState({error: null})}>Try again</button>
            </Box>
        );
    }
}

export default ErrorBoundary;
