// ─── Scelta del trasporto ─────────────────────────────────────────────────────
// Firebase se configurato (.env.local); in sviluppo, senza configurazione o con
// ?rete=locale nell'indirizzo, il trasporto locale tra schede dello stesso
// browser. In produzione senza Firebase il gioco online non compare.

import { LOCAL_PARAM } from './codes';
import { firebaseTransport, isFirebaseConfigured } from './firebaseTransport';
import { localTransport } from './localTransport';
import type { RoomTransport } from './types';

function choose(): RoomTransport | null {
  const forceLocal = import.meta.env.DEV && new URLSearchParams(window.location.search).get(LOCAL_PARAM) === 'locale';
  if (forceLocal) return localTransport;
  if (isFirebaseConfigured()) return firebaseTransport;
  return import.meta.env.DEV ? localTransport : null;
}

/** Deciso una volta per scheda: cambiare trasporto a metà partita non ha senso. */
export const transport: RoomTransport | null = choose();
