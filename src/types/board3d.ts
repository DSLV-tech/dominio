// ─── 3D Board Types ───────────────────────────────────────────────────────────
// Metadati esportati da Blender (blender/export_gltf.py → board3d.json).
// Coordinate three.js: Y in alto, 1 unità = 20 px della mappa SVG.

import type { TerritoryId } from './map';
import type { FactionId } from './player';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Punto di appoggio di un territorio: (x, y, z) = centro del piano dell'esagono. */
export interface TerritoryAnchor extends Vec3 {
  /** Quota del terreno sotto l'esagono. */
  readonly base: number;
}

export interface BoardMeta {
  readonly unitPerSvgPx: number;
  /** Pixel SVG che corrispondono all'origine (x=0, z=0) della scena. */
  readonly svgOrigin: readonly [x: number, y: number];
  readonly waterLevel: number;
  readonly board: { readonly width: number; readonly depth: number };
  readonly troopScale: number;
  readonly territories: Readonly<Record<TerritoryId, TerritoryAnchor>>;
}

export type MapMode = '2D' | '3D';

/** Modelli pronti all'uso, già preparati (materiali, ombre). */
export interface BoardModels<TObject> {
  readonly city: TObject;
  readonly landmarks: Readonly<Partial<Record<TerritoryId, TObject>>>;
  readonly troops: Readonly<Partial<Record<FactionId, TObject>>>;
  readonly flags: Readonly<Partial<Record<FactionId, TObject>>>;
}

// ─── Cielo e qualità grafica ──────────────────────────────────────────────────

/** Cielo e illuminazione in un dato momento della notte. */
export interface SkyState {
  readonly background: string;
  readonly fog: readonly [near: number, far: number];
  /** Luce direzionale: sole al tramonto/alba, luna di notte. */
  readonly sun: { readonly color: string; readonly intensity: number; readonly position: readonly [number, number, number] };
  readonly hemi: { readonly sky: string; readonly ground: string; readonly intensity: number };
  /** 0..1.5: intensità di finestre e lampioni (materiale VC_Glow). */
  readonly glow: number;
  /** 0..1: fari delle auto e fascio del faro. */
  readonly headlights: number;
  /** 0..1: visibilità delle stelle. */
  readonly stars: number;
}

export type SkyKey = 'dusk' | 'evening' | 'night' | 'deep' | 'dawn';

export type GraphicsQuality = 'auto' | 'high' | 'low';

/** Cosa ci si può permettere di disegnare: dipende dalla qualità effettiva. */
export interface GraphicsBudget {
  readonly shadows: boolean;
  readonly shadowMapSize: 1024 | 2048;
  readonly dpr: readonly [min: number, max: number];
  readonly embers: number;
  readonly cars: number;
  readonly gulls: boolean;
  readonly stars: boolean;
}
