// ─── Combat Timeline ──────────────────────────────────────────────────────────
// Scaletta (in ms, a velocità 1) della sequenza di combattimento.
// Condivisa fra l'arena 3D, i dadi 2D di riserva e la CPU (useAIPlayer), che
// aspetta la fine dell'animazione prima di confermare l'attacco.

import type { CombatStage } from '../types';

export const COMBAT_MS = {
  /** Le truppe entrano in scena, i dadi vengono agitati. */
  intro: 0,
  shake: 250,
  /** Lancio dei dadi. */
  roll: 600,
  /** Durata del volo di un dado (rimbalzi compresi). */
  dieFlight: 1150,
  /** Sfasamento fra un dado e il successivo / fra attacco e difesa. */
  dieStagger: 90,
  defenderOffset: 220,
  /** Confronto a coppie: i dadi vincenti si illuminano. */
  compare: 2150,
  /** Carica delle truppe, impatto, cadute. */
  clash: 2750,
  impact: 3200,
  fallDuration: 550,
  /** Esito a schermo. */
  result: 3950,
} as const;

export const COMBAT_STAGES: readonly CombatStage[] = ['intro', 'roll', 'compare', 'clash', 'result'];

/** Velocità per gli attacchi della CPU: si vede tutto, ma senza far perdere tempo. */
export const AI_COMBAT_SPEED = 1.7;
/** Con "riduci movimento" la sequenza è quasi istantanea. */
export const REDUCED_MOTION_SPEED = 4;
/** Quanto resta visibile l'esito prima che la CPU prosegua (ms reali). */
export const AI_RESULT_HOLD_MS = 900;

export function stageAt(ms: number): CombatStage {
  if (ms >= COMBAT_MS.result) return 'result';
  if (ms >= COMBAT_MS.clash) return 'clash';
  if (ms >= COMBAT_MS.compare) return 'compare';
  if (ms >= COMBAT_MS.roll) return 'roll';
  return 'intro';
}

/** Durata reale (ms) della sequenza fino all'esito. */
export function combatDurationMs(speed: number): number {
  return COMBAT_MS.result / Math.max(0.1, speed);
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
