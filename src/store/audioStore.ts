// ─── Audio Store (Zustand) ────────────────────────────────────────────────────
// Preferenze audio dell'utente (muto, volume musica/effetti), salvate in
// localStorage. Lo store è la fonte di verità: ogni modifica viene inoltrata
// al motore audio con una sottoscrizione, così i componenti non devono
// conoscere il motore.

import { create } from 'zustand';
import { audio } from '../audio/engine';
import type { AudioSettings } from '../types';

const STORAGE_KEY = 'dominio.audio';
const DEFAULTS: AudioSettings = { muted: false, music: 0.6, sfx: 0.8 };

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

function readSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return DEFAULTS;
    const o = v as Record<string, unknown>;
    return {
      muted: typeof o.muted === 'boolean' ? o.muted : DEFAULTS.muted,
      music: clamp01(o.music, DEFAULTS.music),
      sfx: clamp01(o.sfx, DEFAULTS.sfx),
    };
  } catch {
    return DEFAULTS;
  }
}

function writeSettings(s: AudioSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage non disponibile */ }
}

interface AudioStore extends AudioSettings {
  toggleMuted: () => void;
  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
}

export const useAudioStore = create<AudioStore>()(set => ({
  ...readSettings(),
  toggleMuted: () => set(s => ({ muted: !s.muted })),
  setMusic: v => set({ music: clamp01(v, DEFAULTS.music) }),
  setSfx: v => set({ sfx: clamp01(v, DEFAULTS.sfx) }),
}));

function snapshot(s: AudioSettings): AudioSettings {
  return { muted: s.muted, music: s.music, sfx: s.sfx };
}

audio.configure(snapshot(useAudioStore.getState()));
useAudioStore.subscribe(s => {
  const next = snapshot(s);
  audio.configure(next);
  writeSettings(next);
});
