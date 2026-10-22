// ─── useIsNarrow ──────────────────────────────────────────────────────────────
// true sotto i 768 px o su un telefono in orizzontale (poca altezza):
// schermi dove la sidebar diventa un cassetto. Stessa condizione di styles/mobile.css.

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 768px), (max-height: 520px) and (max-width: 1024px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
