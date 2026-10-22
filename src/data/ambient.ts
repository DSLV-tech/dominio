// ─── Ambient Data ─────────────────────────────────────────────────────────────
// Traffico (traffic.json, generato da scripts/traffic.ts sulla mesh della città)
// + rotte delle barche e stormo di gabbiani, disegnati a mano sulle acque di
// Novarata. Coordinate three.js (x, z); il livello del mare è in board3d.json.
// Validazione pigra come per board3d: un JSON corrotto viene intercettato
// dall'ErrorBoundary della vita cittadina e la plancia resta giocabile.

import raw from './traffic.json';
import { isTerritoryId } from './territories';
import type { BoatRoute, GullFlock, RoadPath, TrafficData, Vec3 } from '../types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function toVec3(v: unknown, what: string): Vec3 {
  if (!isRecord(v) || !isFiniteNumber(v.x) || !isFiniteNumber(v.y) || !isFiniteNumber(v.z)) {
    throw new Error(`traffic.json: ${what} non valido`);
  }
  return { x: v.x, y: v.y, z: v.z };
}

function toRoad(v: unknown, i: number): RoadPath {
  if (!isRecord(v) || typeof v.from !== 'string' || typeof v.to !== 'string' || !Array.isArray(v.points)) {
    throw new Error(`traffic.json: strada ${i} non valida`);
  }
  const { from, to } = v;
  const flat: unknown[] = v.points;
  if (!isTerritoryId(from) || !isTerritoryId(to) || flat.length < 6 || flat.length % 3 !== 0 || !flat.every(isFiniteNumber)) {
    throw new Error(`traffic.json: strada ${i} con dati incompleti`);
  }
  const nums = flat as number[];
  const points: Vec3[] = [];
  for (let k = 0; k < nums.length; k += 3) points.push({ x: nums[k]!, y: nums[k + 1]!, z: nums[k + 2]! });
  return { from, to, elevated: v.elevated === true, points };
}

function parseTraffic(data: unknown): TrafficData {
  if (!isRecord(data) || !Array.isArray(data.roads)) throw new Error('traffic.json: struttura non valida');
  return { lighthouse: toVec3(data.lighthouse, 'faro'), roads: data.roads.map(toRoad) };
}

let cached: TrafficData | null = null;

export function getTrafficData(): TrafficData {
  cached ??= parseTraffic(raw);
  return cached;
}

/**
 * Rotte delle barche. Le acque navigabili sono il mare a ovest (x < -15.5),
 * il bacino a sud del Porto Vecchio (z > 13) e lo stretto canale del porto,
 * dove sono ormeggiati due pescherecci statici al centro: il traghetto usa
 * le due corsie laterali.
 */
export const BOAT_ROUTES: readonly BoatRoute[] = [
  {
    id: 'pesca-ovest-1', kind: 'fishing', speed: 0.55, start: 0,
    path: [[-19.4, -12.6], [-20.9, -6], [-21.0, 2], [-20.4, 9.2], [-19.0, 11.4], [-18.1, 8], [-18.2, 0], [-18.4, -8], [-18.6, -12]],
  },
  {
    id: 'pesca-ovest-2', kind: 'fishing', speed: 0.5, start: 0.52,
    path: [[-19.4, -12.6], [-20.9, -6], [-21.0, 2], [-20.4, 9.2], [-19.0, 11.4], [-18.1, 8], [-18.2, 0], [-18.4, -8], [-18.6, -12]],
  },
  {
    // entra nel canale del Porto Vecchio dalla corsia est, gira in fondo ed
    // esce dalla corsia ovest: i pescherecci ormeggiati stanno nel mezzo
    id: 'traghetto-porto', kind: 'ferry', speed: 0.38, start: 0.15,
    path: [[-5.45, 13.6], [-5.45, 10.2], [-5.5, 7.9], [-5.9, 7.3], [-6.3, 7.9], [-6.35, 10.2], [-6.35, 13.2], [-7.1, 14.6], [-6.1, 15.4], [-5.0, 14.7]],
  },
];

/** Gabbiani che volteggiano sopra il Porto Vecchio. */
export const GULL_FLOCKS: readonly GullFlock[] = [
  { center: [-9.6, 2.2, 8.4], count: 5, radius: [0.9, 2.2] },
  { center: [-16.2, 1.8, 3.0], count: 3, radius: [0.6, 1.4] },
];
