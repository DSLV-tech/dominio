// ─── useIsNarrow ──────────────────────────────────────────────────────────────
// true sotto i 768 px: schermi stretti dove la sidebar diventa un cassetto.

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 768px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
