import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, details: ErrorInfo) {
    console.error("Kasa interface error", error, details.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <div>
            <span>Kasa</span>
            <h1>We could not load this screen</h1>
            <p>
              Refresh the app to try again. Your submitted records are not
              changed.
            </p>
            <button onClick={() => window.location.reload()}>
              Refresh Kasa
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
