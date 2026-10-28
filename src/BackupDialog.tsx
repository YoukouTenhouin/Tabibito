import { useI18n } from "./i18n";
import { AppError } from "./errors";
import { flightStore } from "./storage";
import { useState } from "react";
import { downloadBackup } from "./backup";
import { errorCode, type ErrorCode } from "./errors";
import { backupSchema, type Backup } from "./shared";
import { Modal } from "./Modal";
import { Icon } from "./icons";
type Preview = {
  incomingCount: number;
  currentCount: number;
  expectedRevision: string;
};
export function BackupDialog({
  onClose,
  onRestored,
}: {
  onClose: () => void;
  onRestored: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | "">("");
  async function load(file?: File) {
    setBackup(null);
    setPreview(null);
    setConfirmed(false);
    setError("");
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new AppError("errors.backupSize");
      const parsed = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new AppError("errors.backupInvalid");
      const result = await flightStore.preview(parsed.data);
      setBackup(parsed.data);
      setPreview(result);
    } catch (error) {
      setError(
        error instanceof SyntaxError ? "errors.backupJson" : errorCode(error),
      );
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!preview || !backup || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      await flightStore.restore(backup, preview.expectedRevision);
      await onRestored();
      onClose();
    } catch (error) {
      setError(errorCode(error));
      setPreview(null);
      setBackup(null);
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t("backup.title")}
      subtitle={t("backup.subtitle")}
      onClose={onClose}
      busy={busy}
    >
      <p className="backup-storage-note">{t("app.notice")}</p>
      <section className="backup-section">
        <div className="section-icon">
          <Icon name="download" />
        </div>
        <div>
          <h3>{t("backup.exportTitle")}</h3>
          <p>{t("backup.exportHint")}</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                await downloadBackup();
              } catch (error) {
                setError(errorCode(error));
              }
            }}
          >
            <Icon name="download" size={16} />
            {t("backup.download")}
          </button>
        </div>
      </section>
      <section className="backup-section">
        <div className="section-icon">
          <Icon name="upload" />
        </div>
        <div>
          <h3>{t("backup.restoreTitle")}</h3>
          <p>{t("backup.restoreHint")}</p>
          <label
            className={`button secondary file-button ${busy ? "disabled" : ""}`}
          >
            {t("backup.choose")}
            <input
              aria-label={t("backup.choose")}
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => {
                void load(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
      {busy && <p role="status">{t("backup.working")}</p>}
      {preview && (
        <div className="restore-preview">
          <h3>{t("backup.count", { count: preview.incomingCount })}</h3>
          <p>{t("backup.replaceHint", { count: preview.currentCount })}</p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {t("backup.confirm")}
          </label>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button
          className="button danger"
          disabled={!confirmed || !preview || busy}
          onClick={restore}
        >
          {t("backup.replace")}
        </button>
      </div>
    </Modal>
  );
}
