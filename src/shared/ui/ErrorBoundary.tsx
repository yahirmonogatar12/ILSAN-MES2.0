import { Component, type ReactNode } from "react";
interface Props {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  resetKey?: string;
}
/** Isolates unexpected render errors; the application chooses recovery behavior. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null });
  }
  render() {
    return this.state.error
      ? this.props.fallback(this.state.error, () =>
          this.setState({ error: null }),
        )
      : this.props.children;
  }
}
