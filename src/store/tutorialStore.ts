// ─── Tutorial Store (Zustand) ─────────────────────────────────────────────────
// Stato del primo turno guidato, persistito ('dominio.tutorial'): quali
// indicazioni sono già state viste e se la guida è disattivata.

import { create } from 'zustand';

export type CoachStepId = 'place' | 'cards' | 'attack' | 'dice' | 'move';

export const COACH_STEP_IDS: readonly CoachStepId[] = ['place', 'cards', 'attack', 'dice', 'move'];

const STORAGE_KEY = 'dominio.tutorial';

interface Persisted {
  readonly seen: readonly CoachStepId[];
  readonly enabled: boolean;
}

function read(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seen: [], enabled: true };
    const v = JSON.parse(raw) as { seen?: unknown; enabled?: unknown };
    const seen = Array.isArray(v.seen) ? COACH_STEP_IDS.filter(id => (v.seen as unknown[]).includes(id)) : [];
    return { seen, enabled: v.enabled !== false };
  } catch {
    return { seen: [], enabled: true };
  }
}

interface TutorialStore extends Persisted {
  markSeen: (id: CoachStepId) => void;
  /** "Salta la guida": non mostra più nulla. */
  skipAll: () => void;
  /** "Rivedi la guida" dal pannello Guida. */
  restart: () => void;
}

export const useTutorialStore = create<TutorialStore>()(set => ({
  ...read(),
  markSeen: id => set(s => (s.seen.includes(id) ? s : { seen: [...s.seen, id] })),
  skipAll: () => set({ enabled: false }),
  restart: () => set({ seen: [], enabled: true }),
}));

useTutorialStore.subscribe(s => {
  const next: Persisted = { seen: s.seen, enabled: s.enabled };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage non disponibile */ }
});
