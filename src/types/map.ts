// ─── Map & Territory Types ───────────────────────────────────────────────────

export type ZoneId = 'CS' | 'PV' | 'PN' | 'CR' | 'SE';

export type TerritoryId =
  | 'CS1' | 'CS2' | 'CS3' | 'CS4'
  | 'PV1' | 'PV2' | 'PV3' | 'PV4'
  | 'PN1' | 'PN2' | 'PN3' | 'PN4'
  | 'CR1' | 'CR2' | 'CR3' | 'CR4'
  | 'SE1' | 'SE2' | 'SE3' | 'SE4';

export interface SvgPosition {
  x: number;
  y: number;
}

export interface SvgBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TerritoryDefinition {
  readonly id: TerritoryId;
  readonly name: string;
  readonly zone: ZoneId;
  readonly connections: readonly TerritoryId[];
  readonly isBottleneck: boolean;
  readonly svgPosition: SvgPosition;
}

export interface ZoneDefinition {
  readonly id: ZoneId;
  readonly name: string;
  readonly territories: readonly TerritoryId[];
  readonly troopBonus: number;
  readonly eventCardBonus: boolean;
  readonly color: string;
  readonly darkColor: string;
  readonly svgBounds: SvgBounds;
}

/** Stato visivo di un territorio sulla mappa (condiviso fra mappa 2D e 3D). */
export type TerritoryVariant =
  | 'default'
  | 'selected'
  | 'attackable'
  | 'moveable'
  | 'targetable'
  | 'enemy'
  | 'neutral';

/** Coppia non orientata di territori collegati. */
export type TerritoryPair = readonly [TerritoryId, TerritoryId];
