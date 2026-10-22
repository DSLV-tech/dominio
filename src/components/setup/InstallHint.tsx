// ─── InstallHint ──────────────────────────────────────────────────────────────
// Invito a installare Dominio come app: pulsante su Chrome/Android (prompt
// nativo), istruzione su iPhone/iPad, niente se è già installata.

import { memo, useCallback } from 'react';
import { promptInstall, useInstallState } from '../../pwa/install';

export const InstallHint = memo(function InstallHint() {
  const state = useInstallState();
  const install = useCallback(() => { void promptInstall(); }, []);

  if (state === 'prompt') {
    return (
      <button type="button" className="btn btn--ghost btn--sm install-hint" onClick={install}>
        Installa l'app
      </button>
    );
  }
  if (state === 'ios') {
    return (
      <p className="install-hint install-hint--ios">
        Per installarla: tocca <span aria-hidden="true">⎙</span> Condividi, poi «Aggiungi alla schermata Home».
      </p>
    );
  }
  return null;
});
