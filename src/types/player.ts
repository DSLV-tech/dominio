// ─── Player & Faction Types ───────────────────────────────────────────────────

import type { TerritoryId, ZoneId } from './map';

export type FactionId = 'BIANCHI' | 'MANO_NERA' | 'STRADA' | 'ORDINE';

export type PlayerId = string;

export interface FactionDefinition {
  readonly id: FactionId;
  readonly name: string;
  readonly shortName: string;
  readonly color: string;
  readonly bgColor: string;
  readonly textColor: string;
  readonly startingZone: ZoneId;
  readonly abilityName: string;
  readonly abilityDescription: string;
}

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly factionId: FactionId;
  readonly isAI: boolean;
  isEliminated: boolean;
  /** Barricade bonus per territory — only Ordine Civico can set these */
  readonly barricades: Partial<Record<TerritoryId, 1>>;
}
