import { downloadBackup, errorMessage } from "./backup";
import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; error: string }
> {
  state = { failed: false, error: "" };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>Something went wrong.</h1>
        <p>Your flights are still saved in this browser.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload Tabibito
        </button>
        <button
          className="button secondary"
          onClick={() => {
            void downloadBackup().catch((error) =>
              this.setState({ error: errorMessage(error) }),
            );
          }}
        >
          Download your backup
        </button>
        {this.state.error && <p role="alert">{this.state.error}</p>}
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
