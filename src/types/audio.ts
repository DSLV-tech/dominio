// ─── Audio Types ──────────────────────────────────────────────────────────────
// Tutto l'audio è sintetizzato in tempo reale con la Web Audio API:
// nessun file da scaricare, nessuna licenza da gestire.

/** Effetti sonori disponibili (vedi src/audio/sfx.ts). */
export type SfxName =
  | 'click'
  | 'diceShake'
  | 'diceHit'
  | 'clash'
  | 'impact'
  | 'fall'
  | 'conquest'
  | 'repelled'
  | 'reinforce'
  | 'move'
  | 'phase'
  | 'turn'
  | 'event'
  | 'victory'
  | 'eliminated';

/** Atmosfera della colonna sonora: decide quali strati suonano. */
export type MusicMood = 'calm' | 'tension' | 'combat' | 'victory';

export interface SfxOptions {
  /** 0..1, moltiplica il volume dell'effetto (default 1). */
  readonly intensity?: number;
  /** -1 (sinistra) … 1 (destra). */
  readonly pan?: number;
  /** Ritardo in secondi rispetto ad ora. */
  readonly delay?: number;
}

export interface AudioSettings {
  readonly muted: boolean;
  /** 0..1 */
  readonly music: number;
  /** 0..1 */
  readonly sfx: number;
}
