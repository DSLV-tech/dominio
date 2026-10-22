// ─── Static Map Data ──────────────────────────────────────────────────────────

import type { TerritoryDefinition, ZoneDefinition, TerritoryId } from '../types';

export const TERRITORY_DEFINITIONS: Record<TerritoryId, TerritoryDefinition> = {
  // ── Centro Storico ──────────────────────────────────────────────────────────
  CS1: { id: 'CS1', name: 'Piazza Grande',      zone: 'CS', connections: ['CS2','CS3','CS4','PV1','CR4'],        isBottleneck: true,  svgPosition: { x: 416, y: 334 } },
  CS2: { id: 'CS2', name: 'Cattedrale',          zone: 'CS', connections: ['CS1','CS3','CR1'],                   isBottleneck: false, svgPosition: { x: 474, y: 262 } },
  CS3: { id: 'CS3', name: 'Palazzo del Potere',  zone: 'CS', connections: ['CS1','CS2','CS4'],                   isBottleneck: false, svgPosition: { x: 358, y: 262 } },
  CS4: { id: 'CS4', name: 'Mercato Centrale',    zone: 'CS', connections: ['CS1','CS3','SE3','SE1'],             isBottleneck: false, svgPosition: { x: 416, y: 410 } },

  // ── Porto Vecchio ───────────────────────────────────────────────────────────
  PV1: { id: 'PV1', name: 'Banchine',            zone: 'PV', connections: ['CS1','PV2','PV4'],                   isBottleneck: false, svgPosition: { x: 215, y: 388 } },
  PV2: { id: 'PV2', name: 'Magazzini',           zone: 'PV', connections: ['PV1','PV3','PV4','PN4'],             isBottleneck: true,  svgPosition: { x: 100, y: 388 } },
  PV3: { id: 'PV3', name: 'Q. Pescatori',        zone: 'PV', connections: ['PV2','PV4','PN1'],                   isBottleneck: false, svgPosition: { x: 100, y: 460 } },
  PV4: { id: 'PV4', name: 'Dogana',              zone: 'PV', connections: ['PV1','PV2','PV3'],                   isBottleneck: false, svgPosition: { x: 215, y: 460 } },

  // ── Periferia Nord ──────────────────────────────────────────────────────────
  PN1: { id: 'PN1', name: 'Fabbriche',           zone: 'PN', connections: ['PV3','PN2','PN3'],                   isBottleneck: false, svgPosition: { x: 100, y: 262 } },
  PN2: { id: 'PN2', name: 'Q. Operaio',          zone: 'PN', connections: ['PN1','PN3','PN4','CR3'],             isBottleneck: false, svgPosition: { x: 215, y: 190 } },
  PN3: { id: 'PN3', name: 'Aeroporto Civile',    zone: 'PN', connections: ['PN1','PN2','PN4'],                   isBottleneck: false, svgPosition: { x: 100, y: 190 } },
  PN4: { id: 'PN4', name: 'Raccordo Nord',       zone: 'PN', connections: ['PV2','PN2','PN3','SE4'],             isBottleneck: true,  svgPosition: { x: 215, y: 262 } },

  // ── Colline Residenziali ────────────────────────────────────────────────────
  CR1: { id: 'CR1', name: 'Villette',            zone: 'CR', connections: ['CS2','CR2','CR4'],                   isBottleneck: false, svgPosition: { x: 728, y: 190 } },
  CR2: { id: 'CR2', name: 'Q. Universitario',    zone: 'CR', connections: ['CR1','CR3','CR4','SE3'],             isBottleneck: false, svgPosition: { x: 728, y: 262 } },
  CR3: { id: 'CR3', name: 'Parco Regionale',     zone: 'CR', connections: ['PN2','CR2','CR4'],                   isBottleneck: false, svgPosition: { x: 612, y: 190 } },
  CR4: { id: 'CR4', name: 'Ospedale Centrale',   zone: 'CR', connections: ['CS1','CR1','CR2','CR3'],             isBottleneck: true,  svgPosition: { x: 612, y: 262 } },

  // ── Suburbia Est ────────────────────────────────────────────────────────────
  SE1: { id: 'SE1', name: 'Palazzi Popolari',    zone: 'SE', connections: ['CS4','SE2','SE3'],                   isBottleneck: false, svgPosition: { x: 612, y: 460 } },
  SE2: { id: 'SE2', name: 'Centro Commerciale',  zone: 'SE', connections: ['SE1','SE3','SE4'],                   isBottleneck: false, svgPosition: { x: 728, y: 460 } },
  SE3: { id: 'SE3', name: 'Stazione Ferroviaria',zone: 'SE', connections: ['CS4','CR2','SE1','SE2'],             isBottleneck: true,  svgPosition: { x: 612, y: 388 } },
  SE4: { id: 'SE4', name: 'Zona Ind. Est',       zone: 'SE', connections: ['PN4','SE2'],                         isBottleneck: false, svgPosition: { x: 728, y: 388 } },
};

export const ZONE_DEFINITIONS: Record<string, ZoneDefinition> = {
  CS: {
    id: 'CS', name: 'Centro Storico',
    territories: ['CS1','CS2','CS3','CS4'],
    troopBonus: 3, eventCardBonus: false,
    color: '#4a7acd', darkColor: '#1a3a7a',
    svgBounds: { x: 293, y: 208, width: 212, height: 188 },
  },
  PV: {
    id: 'PV', name: 'Porto Vecchio',
    territories: ['PV1','PV2','PV3','PV4'],
    troopBonus: 2, eventCardBonus: true,
    color: '#cd4a4a', darkColor: '#7a1a1a',
    svgBounds: { x: 58, y: 308, width: 234, height: 188 },
  },
  PN: {
    id: 'PN', name: 'Periferia Nord',
    territories: ['PN1','PN2','PN3','PN4'],
    troopBonus: 3, eventCardBonus: false,
    color: '#4acd4a', darkColor: '#1a5a1a',
    svgBounds: { x: 58, y: 28, width: 274, height: 198 },
  },
  CR: {
    id: 'CR', name: 'Colline Residenziali',
    territories: ['CR1','CR2','CR3','CR4'],
    troopBonus: 2, eventCardBonus: false,
    color: '#cdcd4a', darkColor: '#5a5a1a',
    svgBounds: { x: 488, y: 88, width: 224, height: 234 },
  },
  SE: {
    id: 'SE', name: 'Suburbia Est',
    territories: ['SE1','SE2','SE3','SE4'],
    troopBonus: 2, eventCardBonus: false,
    color: '#cd4acd', darkColor: '#5a1a5a',
    svgBounds: { x: 448, y: 338, width: 274, height: 178 },
  },
};

/** All connection pairs (undirected) for drawing lines on the SVG */
export const CONNECTION_PAIRS: ReadonlyArray<readonly [TerritoryId, TerritoryId]> = (() => {
  const seen = new Set<string>();
  const pairs: [TerritoryId, TerritoryId][] = [];
  for (const t of Object.values(TERRITORY_DEFINITIONS)) {
    for (const conn of t.connections) {
      const key = [t.id, conn].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([t.id, conn as TerritoryId]);
      }
    }
  }
  return pairs;
})();

/** Type guard: la stringa è un id di territorio valido? */
export function isTerritoryId(value: string): value is TerritoryId {
  return Object.hasOwn(TERRITORY_DEFINITIONS, value);
}
