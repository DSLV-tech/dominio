// ─── roadNetwork ──────────────────────────────────────────────────────────────
// Strade pronte per il traffico: polilinee 3D con lunghezze cumulative per
// campionare in O(log n) e un indice "territorio → strade che ne partono"
// per far proseguire le auto da una strada all'altra.

import { Vector3 } from 'three';
import type { RoadPath, TerritoryId } from '../../../types';

export interface RoadTrack {
  readonly from: TerritoryId;
  readonly to: TerritoryId;
  readonly points: readonly Vector3[];
  /** cum[i] = distanza dal primo punto al punto i. */
  readonly cum: readonly number[];
  readonly length: number;
}

/** Ingresso in una strada: indice + verso di percorrenza (+1 from→to, -1 to→from). */
export interface RoadEntry {
  readonly road: number;
  readonly dir: 1 | -1;
}

export interface RoadNetwork {
  readonly tracks: readonly RoadTrack[];
  readonly exits: ReadonlyMap<TerritoryId, readonly RoadEntry[]>;
}

/** Strade più corte di così non ospitano traffico (un'auto sparirebbe subito). */
const MIN_LENGTH = 1.2;

export function buildRoadNetwork(roads: readonly RoadPath[]): RoadNetwork {
  const tracks: RoadTrack[] = [];
  const exits = new Map<TerritoryId, RoadEntry[]>();
  const addExit = (t: TerritoryId, e: RoadEntry): void => {
    const list = exits.get(t);
    if (list) list.push(e); else exits.set(t, [e]);
  };

  for (const r of roads) {
    const points = r.points.map(p => new Vector3(p.x, p.y, p.z));
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
    const length = cum[cum.length - 1]!;
    if (length < MIN_LENGTH) continue;
    const road = tracks.length;
    tracks.push({ from: r.from, to: r.to, points, cum, length });
    addExit(r.from, { road, dir: 1 });
    addExit(r.to, { road, dir: -1 });
  }
  return { tracks, exits };
}

/** Punto a distanza `s` dall'inizio della strada (scritto in `out`). */
export function pointAt(track: RoadTrack, s: number, out: Vector3): Vector3 {
  const { cum, points } = track;
  const d = Math.min(Math.max(s, 0), track.length);
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= d) lo = mid; else hi = mid;
  }
  const seg = cum[hi]! - cum[lo]!;
  const t = seg > 0 ? (d - cum[lo]!) / seg : 0;
  return out.copy(points[lo]!).lerp(points[hi]!, t);
}
