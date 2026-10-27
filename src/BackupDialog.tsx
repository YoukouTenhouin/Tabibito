import { flightStore } from "./storage";
import { useState } from "react";
import { downloadBackup, errorMessage } from "./backup";
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
  const [backup, setBackup] = useState<Backup | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(file?: File) {
    setBackup(null);
    setPreview(null);
    setConfirmed(false);
    setError("");
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 10 MB.");
      const parsed = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success)
        throw new Error(
          "This is not a valid Tabibito version 1 backup. No data has been changed.",
        );
      const result = await flightStore.preview(parsed.data);
      setBackup(parsed.data);
      setPreview(result);
    } catch (error) {
      setError(
        error instanceof SyntaxError
          ? "This file is not valid JSON. No data has been changed."
          : errorMessage(error),
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
      setError(errorMessage(error));
      setPreview(null);
      setBackup(null);
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Keep your journeys safe"
      subtitle="Download your history, or restore a saved backup."
      onClose={onClose}
      busy={busy}
    >
      <section className="backup-section">
        <div className="section-icon">
          <Icon name="download" />
        </div>
        <div>
          <h3>Export your history</h3>
          <p>All flights and airport details in one portable JSON file.</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                await downloadBackup();
              } catch (error) {
                setError(errorMessage(error));
              }
            }}
          >
            <Icon name="download" size={16} />
            Download backup
          </button>
        </div>
      </section>
      <section className="backup-section">
        <div className="section-icon">
          <Icon name="upload" />
        </div>
        <div>
          <h3>Restore a backup</h3>
          <p>
            Preview a Tabibito backup before replacing your current history.
          </p>
          <label
            className={`button secondary file-button ${busy ? "disabled" : ""}`}
          >
            Choose backup
            <input
              aria-label="Choose backup"
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
      {busy && <p role="status">Working…</p>}
      {preview && (
        <div className="restore-preview">
          <h3>{preview.incomingCount} flights in this backup</h3>
          <p>
            Restoring will replace all {preview.currentCount} flights currently
            saved. Download your current history first if you want to keep it.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Replace my current history with this backup
          </label>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="button danger"
          disabled={!confirmed || !preview || busy}
          onClick={restore}
        >
          Replace history
        </button>
      </div>
    </Modal>
  );
}
