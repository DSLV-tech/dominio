// ─── 3D Board Data ────────────────────────────────────────────────────────────
// Validazione runtime di board3d.json (generato da Blender) + URL dei modelli.
// Il parsing è pigro: un JSON corrotto lancia un errore dentro il componente 3D,
// dove l'ErrorBoundary lo intercetta e il gioco ripiega sulla mappa 2D.

import raw from './board3d.json';
import { TERRITORY_DEFINITIONS } from './territories';
import type { BoardMeta, TerritoryAnchor, TerritoryId } from '../types';

// import.meta.env esiste solo sotto Vite: fallback per script Node (scripts/simulate.ts)
const base: string = (import.meta.env as ImportMetaEnv | undefined)?.BASE_URL ?? '/';

export const MODEL_URLS = {
  city:      `${base}models/citta.glb`,
  landmarks: `${base}models/monumenti.glb`,
  troops:    `${base}models/truppe.glb`,
  dice:      `${base}models/dadi.glb`,
  arena:     `${base}models/arena.glb`,
} as const;

/** Stemmi delle fazioni renderizzati da Blender (blender/build_pezzi.py). */
export const EMBLEM_URLS = {
  BIANCHI:   `${base}ui/stemma_bianchi.png`,
  MANO_NERA: `${base}ui/stemma_mano_nera.png`,
  STRADA:    `${base}ui/stemma_strada.png`,
  ORDINE:    `${base}ui/stemma_ordine.png`,
} as const;

export const DRACO_DECODER_PATH = `${base}draco/`;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function toAnchor(v: unknown, id: TerritoryId): TerritoryAnchor {
  if (!isRecord(v) || !isFiniteNumber(v.x) || !isFiniteNumber(v.y) || !isFiniteNumber(v.z) || !isFiniteNumber(v.base)) {
    throw new Error(`board3d.json: ancora non valida per ${id}`);
  }
  return { x: v.x, y: v.y, z: v.z, base: v.base };
}

function parseBoardMeta(data: unknown): BoardMeta {
  if (!isRecord(data) || !isRecord(data.territories) || !isRecord(data.board)) {
    throw new Error('board3d.json: struttura non valida');
  }
  const src = data.territories;
  const ids = Object.keys(TERRITORY_DEFINITIONS) as TerritoryId[];
  const territories = Object.fromEntries(ids.map(id => [id, toAnchor(src[id], id)])) as Record<TerritoryId, TerritoryAnchor>;
  const { width, depth } = data.board;
  if (!isFiniteNumber(width) || !isFiniteNumber(depth)) throw new Error('board3d.json: dimensioni mancanti');
  return {
    unitPerSvgPx: isFiniteNumber(data.unitPerSvgPx) ? data.unitPerSvgPx : 0.05,
    svgOrigin: Array.isArray(data.svgOrigin) && isFiniteNumber(data.svgOrigin[0]) && isFiniteNumber(data.svgOrigin[1])
      ? [data.svgOrigin[0], data.svgOrigin[1]] as const
      : [360, 260] as const,
    waterLevel:   isFiniteNumber(data.waterLevel) ? data.waterLevel : -0.14,
    troopScale:   isFiniteNumber(data.troopScale) ? data.troopScale : 0.42,
    board: { width, depth },
    territories,
  };
}

let cached: BoardMeta | null = null;

export function getBoardMeta(): BoardMeta {
  cached ??= parseBoardMeta(raw);
  return cached;
}
