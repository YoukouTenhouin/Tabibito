import { ThemeProvider } from "./theme";
import { downloadBackup } from "./backup";
import { errorCode, type ErrorCode } from "./errors";
import { StrictMode, Component, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { i18n, useI18n } from "./i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import App from "./App";
import "./styles.css";

function FatalError() {
  const { t } = useI18n();
  const [error, setError] = useState<ErrorCode | "">("");
  return (
    <main className="fatal-error">
      <LanguageSwitcher />
      <h1>{t("fatal.title")}</h1>
      <p>{t("fatal.saved")}</p>
      <button className="button primary" onClick={() => location.reload()}>
        {t("fatal.reload")}
      </button>
      <button
        className="button secondary"
        onClick={() => {
          void downloadBackup().catch((error) => setError(errorCode(error)));
        }}
      >
        {t("fatal.backup")}
      </button>
      {error && <p role="alert">{t(error)}</p>}
    </main>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <FatalError /> : this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider><ErrorBoundary>
        <App />
      </ErrorBoundary></ThemeProvider>
    </I18nextProvider>
  </StrictMode>,
);
