import { Component, type ReactNode } from "react";
interface Props {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  resetKey?: string;
}
interface State {
  error: Error | null;
  resetKey?: string;
}
/** Isolates unexpected render errors; the application chooses recovery behavior. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };
  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey !== state.resetKey
      ? { error: null, resetKey: props.resetKey }
      : null;
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error
      ? this.props.fallback(this.state.error, () =>
          this.setState({ error: null }),
        )
      : this.props.children;
  }
}
