// ─── CPU turn readability types ───────────────────────────────────────────────

import type { TerritoryId } from './map';
import type { PlayerId } from './player';
import type { PlayedEvent } from './cards';

/** Velocità dei turni CPU: ritardi tra le azioni. */
export type CpuSpeed = 'cinematic' | 'normal' | 'fast';

/** Punto sul quale la camera si avvicina durante un'azione della CPU. */
export interface CameraFocus {
  readonly x: number;
  readonly z: number;
  /** Distanza camera→punto (unità scena). */
  readonly distance: number;
  /** Cambia a ogni nuova azione, anche sullo stesso punto. */
  readonly key: string;
}

/** Scia luminosa di un'azione CPU, che svanisce da sola. */
export interface ActionTrace {
  readonly id: string;
  readonly kind: 'attack' | 'move' | 'reinforce';
  readonly from?: TerritoryId;
  readonly to: TerritoryId;
}

/** Riepilogo di un turno (puro, calcolato dagli stati prima/dopo). */
export interface TurnRecap {
  readonly playerId: PlayerId;
  readonly reinforced: number;
  readonly conquered: readonly TerritoryId[];
  readonly lost: readonly TerritoryId[];
  readonly cardsDrawn: number;
  readonly event: PlayedEvent | null;
}
