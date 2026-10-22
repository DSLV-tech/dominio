// ─── ConfirmDialog ────────────────────────────────────────────────────────────
// Conferma per azioni distruttive (es. abbandonare la partita).
// Il pulsante sicuro ("Annulla") ha il focus di partenza: un Invio di troppo
// non cancella niente. Esc o un click sullo sfondo chiudono senza agire.

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';

export interface ConfirmDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  title, children, confirmLabel, cancelLabel = 'Annulla', onConfirm, onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // non deve arrivare agli altri ascoltatori di Esc (selezione mappa, riepilogo…)
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      previous?.focus();
    };
  }, [onCancel]);

  const onBackdrop = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="confirm" role="presentation" onMouseDown={onBackdrop}>
      <div className="confirm__card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <h2 id="confirm-title" className="confirm__title">{title}</h2>
        <div id="confirm-text" className="confirm__text">{children}</div>
        <div className="confirm__actions">
          <button ref={cancelRef} type="button" className="btn btn--ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
