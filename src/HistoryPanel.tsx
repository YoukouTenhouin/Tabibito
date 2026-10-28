import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "./i18n";

/** One history tree, presented as a persistent sidebar or a modal phone drawer. */
export function HistoryPanel({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [compact, setCompact] = useState(() => matchMedia("(max-width: 899px)").matches);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const query = matchMedia("(max-width: 899px)");
    const change = () => { setCompact(query.matches); close.current(); };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) element.showModal();
    else element.close();
    return () => element.close();
  }, [open, compact]);
  if (!compact) return <aside className="history-sidebar">{children}</aside>;
  return <dialog ref={dialog} className="history-drawer" aria-label={t("history.title")}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    {children}
  </dialog>;
}
