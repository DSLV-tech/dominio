// ─── Graphics budget ──────────────────────────────────────────────────────────
// Qualità effettiva ('high' | 'low') e cosa permette di disegnare.
// 'auto' parte alta su desktop e bassa su schermi stretti/touch, e scende a
// bassa se il monitor di prestazioni (GameBoard3D) rileva FPS insufficienti.

import { useSettingsStore } from '../../store/settingsStore';
import type { GraphicsBudget } from '../../types';

const HIGH: GraphicsBudget = { shadows: true, shadowMapSize: 2048, dpr: [1, 1.75], embers: 90, cars: 26, gulls: true, stars: true };
const LOW: GraphicsBudget = { shadows: true, shadowMapSize: 1024, dpr: [1, 1.25], embers: 24, cars: 10, gulls: false, stars: false };

/** Oggetti costanti: i componenti che li ricevono non si ri-renderizzano a vuoto. */
export function budgetFor(quality: 'high' | 'low'): GraphicsBudget {
  return quality === 'high' ? HIGH : LOW;
}

/** Dispositivo che quasi certamente non regge la qualità alta. */
export function isConstrainedDevice(): boolean {
  try {
    return window.matchMedia('(max-width: 768px)').matches || window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function useGraphicsBudget(): GraphicsBudget {
  const quality = useSettingsStore(s => s.quality);
  const degraded = useSettingsStore(s => s.degraded);
  const effective = quality === 'auto' ? (degraded || isConstrainedDevice() ? 'low' : 'high') : quality;
  return budgetFor(effective);
}
