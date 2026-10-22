// ─── Ambient Types ────────────────────────────────────────────────────────────
// Vita della città sulla plancia 3D: traffico, barche, faro, gabbiani.
// Puramente decorativo: nessun legame con lo stato di gioco.

import type { TerritoryId } from './map';
import type { Vec3 } from './board3d';

/** Strada campionata (scripts/traffic.ts): punti sulla superficie dell'asfalto. */
export interface RoadPath {
  readonly from: TerritoryId;
  readonly to: TerritoryId;
  readonly elevated: boolean;
  readonly points: readonly Vec3[];
}

export interface TrafficData {
  readonly lighthouse: Vec3;
  readonly roads: readonly RoadPath[];
}

export type BoatKind = 'fishing' | 'ferry';

/** Rotta chiusa di una barca sull'acqua, nel piano XZ. */
export interface BoatRoute {
  readonly id: string;
  readonly kind: BoatKind;
  /** Punti di controllo (x, z) della curva chiusa. */
  readonly path: ReadonlyArray<readonly [number, number]>;
  /** Unità al secondo. */
  readonly speed: number;
  /** Posizione iniziale lungo la rotta, 0..1. */
  readonly start: number;
}

export interface GullFlock {
  readonly center: readonly [number, number, number];
  readonly count: number;
  readonly radius: readonly [number, number];
}
