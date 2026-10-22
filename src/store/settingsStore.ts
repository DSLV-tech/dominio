// ─── Settings Store (Zustand) ─────────────────────────────────────────────────
// Preferenze di gioco dell'utente persistite in localStorage ('dominio.settings'):
// velocità dei turni CPU e camera che li segue. Come audioStore: nessun
// legame con lo stato della partita.

import { create } from 'zustand';
import type { CpuSpeed, GraphicsQuality } from '../types';

const STORAGE_KEY = 'dominio.settings';

export interface Settings {
  readonly cpuSpeed: CpuSpeed;
  /** La camera segue le azioni della CPU. */
  readonly followCpu: boolean;
  /** Qualità grafica 3D; 'auto' scende da sola se gli FPS calano. */
  readonly quality: GraphicsQuality;
}

const DEFAULTS: Settings = { cpuSpeed: 'normal', followCpu: true, quality: 'auto' };
const QUALITIES: readonly GraphicsQuality[] = ['auto', 'high', 'low'];
const SPEEDS: readonly CpuSpeed[] = ['cinematic', 'normal', 'fast'];

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      cpuSpeed: SPEEDS.find(s => s === v.cpuSpeed) ?? DEFAULTS.cpuSpeed,
      followCpu: typeof v.followCpu === 'boolean' ? v.followCpu : DEFAULTS.followCpu,
      quality: QUALITIES.find(q => q === v.quality) ?? DEFAULTS.quality,
    };
  } catch {
    return DEFAULTS;
  }
}

interface SettingsStore extends Settings {
  setCpuSpeed: (speed: CpuSpeed) => void;
  setFollowCpu: (follow: boolean) => void;
  setQuality: (quality: GraphicsQuality) => void;
  /** Non persistito: il monitor delle prestazioni ha rilevato FPS bassi in questa sessione. */
  degraded: boolean;
  setDegraded: (degraded: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(set => ({
  ...read(),
  setCpuSpeed: cpuSpeed => set({ cpuSpeed }),
  setFollowCpu: followCpu => set({ followCpu }),
  setQuality: quality => set({ quality }),
  degraded: false,
  setDegraded: degraded => set({ degraded }),
}));

useSettingsStore.subscribe(s => {
  const next: Settings = { cpuSpeed: s.cpuSpeed, followCpu: s.followCpu, quality: s.quality };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage non disponibile */ }
});

/** Moltiplicatore dei ritardi CPU per velocità. */
export const CPU_DELAY_FACTOR: Readonly<Record<CpuSpeed, number>> = { cinematic: 1.7, normal: 1, fast: 0.45 };
