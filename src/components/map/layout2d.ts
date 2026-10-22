// ─── layout2d ─────────────────────────────────────────────────────────────────
// Geometria statica della mappa 2D, calcolata una volta al caricamento:
//  - cornici delle zone ricavate dalle posizioni dei territori (così un
//    territorio non esce mai dal suo quartiere; svgBounds resta alla vista 3D)
//  - tracciati dei collegamenti: dritti se liberi, curvi se una linea dritta
//    passerebbe sopra un altro territorio.

import { CONNECTION_PAIRS, TERRITORY_DEFINITIONS, ZONE_DEFINITIONS } from '../../data';
import type { SvgBounds, TerritoryId } from '../../types';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface Point { readonly x: number; readonly y: number }

export interface ZoneFrame extends SvgBounds {
  readonly id: string;
}

export interface ConnectionRoute {
  readonly key: string;
  readonly a: TerritoryId;
  readonly b: TerritoryId;
  /** Tracciato da a → b. */
  readonly d: string;
  /** Tracciato da b → a (serve perché il tratteggio evidenziato scorra verso il bersaglio). */
  readonly dReverse: string;
  /** Collegamento fra quartieri diversi. */
  readonly crossZone: boolean;
}

// ─── Misure ───────────────────────────────────────────────────────────────────

export const MAP_W = 800;
export const MAP_H = 560;
export const NODE_W = 96;
export const NODE_H = 42;

const ZONE_PAD_X = 16;
const ZONE_PAD_BOTTOM = 16;
/** Spazio in alto nella cornice per il nome del quartiere. */
const ZONE_HEADER = 44;
/** Margine attorno ai territori quando si controlla se una linea li attraversa. */
const NODE_CLEARANCE = 6;
/** Curvature provate, in frazioni della lunghezza del collegamento. */
const BENDS: readonly number[] = [0.18, -0.18, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6];

export const pairKey = (a: string, b: string): string => [a, b].sort().join('-');

// ─── Zone ─────────────────────────────────────────────────────────────────────

export const ZONE_FRAMES: Readonly<Record<string, ZoneFrame>> = Object.fromEntries(
  Object.values(ZONE_DEFINITIONS).map(zone => {
    const pts = zone.territories.map(id => TERRITORY_DEFINITIONS[id].svgPosition);
    const minX = Math.min(...pts.map(p => p.x)) - NODE_W / 2 - ZONE_PAD_X;
    const maxX = Math.max(...pts.map(p => p.x)) + NODE_W / 2 + ZONE_PAD_X;
    const minY = Math.min(...pts.map(p => p.y)) - NODE_H / 2 - ZONE_HEADER;
    const maxY = Math.max(...pts.map(p => p.y)) + NODE_H / 2 + ZONE_PAD_BOTTOM;
    const frame: ZoneFrame = { id: zone.id, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    return [zone.id, frame];
  }),
);

// ─── Collegamenti ─────────────────────────────────────────────────────────────

interface Rect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

const NODE_RECTS: ReadonlyArray<readonly [TerritoryId, Rect]> = Object.values(TERRITORY_DEFINITIONS).map(def => [
  def.id,
  {
    x0: def.svgPosition.x - NODE_W / 2 - NODE_CLEARANCE,
    y0: def.svgPosition.y - NODE_H / 2 - NODE_CLEARANCE,
    x1: def.svgPosition.x + NODE_W / 2 + NODE_CLEARANCE,
    y1: def.svgPosition.y + NODE_H / 2 + NODE_CLEARANCE,
  },
]);

const inside = (p: Point, r: Rect): boolean => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;

function quad(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
}

/** Il tratto (campionato) passa sopra un territorio che non è un suo estremo? */
function hitsOtherNode(p0: Point, c: Point, p1: Point, a: TerritoryId, b: TerritoryId): boolean {
  for (let i = 1; i < 40; i++) {
    const p = quad(p0, c, p1, i / 40);
    for (const [id, r] of NODE_RECTS) if (id !== a && id !== b && inside(p, r)) return true;
  }
  return false;
}

function outOfMap(p0: Point, c: Point, p1: Point): boolean {
  const m = quad(p0, c, p1, 0.5);
  return m.x < 8 || m.x > MAP_W - 8 || m.y < 8 || m.y > MAP_H - 8;
}

function routeFor(a: TerritoryId, b: TerritoryId): ConnectionRoute {
  const p0 = TERRITORY_DEFINITIONS[a].svgPosition;
  const p1 = TERRITORY_DEFINITIONS[b].svgPosition;
  const mid: Point = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  let control: Point = mid;
  if (hitsOtherNode(p0, mid, p1, a, b)) {
    for (const bend of BENDS) {
      // il punto di controllo sta al doppio della freccia voluta
      const c = { x: mid.x + nx * len * bend * 2, y: mid.y + ny * len * bend * 2 };
      if (!hitsOtherNode(p0, c, p1, a, b) && !outOfMap(p0, c, p1)) { control = c; break; }
    }
  }
  const f = (n: number): string => n.toFixed(1);
  const curve = (s: Point, e: Point): string => `M ${f(s.x)} ${f(s.y)} Q ${f(control.x)} ${f(control.y)} ${f(e.x)} ${f(e.y)}`;
  return {
    key: pairKey(a, b),
    a, b,
    d: curve(p0, p1),
    dReverse: curve(p1, p0),
    crossZone: TERRITORY_DEFINITIONS[a].zone !== TERRITORY_DEFINITIONS[b].zone,
  };
}

export const CONNECTION_ROUTES: readonly ConnectionRoute[] = CONNECTION_PAIRS.map(([a, b]) => routeFor(a, b));
