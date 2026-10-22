// ─── Story Store (Zustand) ────────────────────────────────────────────────────
// Stato narrativo separato dal gioco: articoli della Gazzetta, interludio
// d'atto aperto, avanzamento del prologo. Separato da gameStore perché la
// storia non deve mai influenzare le regole, solo la presentazione.
//
// Scelta: Zustand (già nel progetto) invece di Context → i componenti si
// abbonano solo alla fetta che leggono (es. il badge "non letti").

import { create } from 'zustand';
import type { Dispatch, StoryAct } from '../types';

const MAX_DISPATCHES = 60;

interface StoryStore {
  /** Prologo visto in questa sessione: si passa direttamente alla lobby. */
  prologueDone: boolean;
  finishPrologue: () => void;
  replayPrologue: () => void;

  /** Articoli, dal più recente. */
  dispatches: readonly Dispatch[];
  unread: number;
  publish: (items: readonly Dispatch[]) => void;
  markRead: () => void;

  /** Atto mostrato a tutto schermo. Mentre è aperto la CPU aspetta. */
  interlude: StoryAct | null;
  openInterlude: (act: StoryAct) => void;
  closeInterlude: () => void;

  reset: () => void;
}

export const useStoryStore = create<StoryStore>((set) => ({
  prologueDone: false,
  finishPrologue: () => set({ prologueDone: true }),
  replayPrologue: () => set({ prologueDone: false }),

  dispatches: [],
  unread: 0,
  publish: (items) => {
    if (items.length === 0) return;
    set(s => ({
      // dentro un lotto l'ordine è già narrativo (es. apertura prima dell'atto)
      dispatches: [...items, ...s.dispatches].slice(0, MAX_DISPATCHES),
      unread: s.unread + items.length,
    }));
  },
  markRead: () => set({ unread: 0 }),

  interlude: null,
  openInterlude: (act) => set({ interlude: act }),
  closeInterlude: () => set({ interlude: null }),

  reset: () => set({ dispatches: [], unread: 0, interlude: null }),
}));
