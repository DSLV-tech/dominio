// ─── useStageCursorSide ───────────────────────────────────────────────────────
// In quale metà della mappa (.stage) si trova il puntatore. Serve alle schede
// sovrapposte (TerritoryInfoCard) per aprirsi dal lato opposto e non coprire
// il territorio che si sta guardando.
// Store esterno minimo: un solo ascoltatore globale, condiviso, attivo solo
// finché qualcuno è iscritto. Isteresi al centro per evitare salti continui.

import { useSyncExternalStore } from 'react';

export type StageSide = 'left' | 'right';

/** Fascia centrale (in frazioni della larghezza) in cui il lato non cambia. */
const HYSTERESIS_LOW = 0.44;
const HYSTERESIS_HIGH = 0.56;

let side: StageSide = 'right';
const listeners = new Set<() => void>();

function onPointerMove(e: PointerEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  const stage = target?.closest('.stage');
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  if (r.width <= 0) return;
  const rel = (e.clientX - r.left) / r.width;
  const next: StageSide = rel < HYSTERESIS_LOW ? 'left' : rel > HYSTERESIS_HIGH ? 'right' : side;
  if (next === side) return;
  side = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('pointermove', onPointerMove, { passive: true });
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('pointermove', onPointerMove);
  };
}

const getSnapshot = (): StageSide => side;
const getServerSnapshot = (): StageSide => 'right';

/** Lato della mappa in cui si trova il puntatore. */
export function useStageCursorSide(): StageSide {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
