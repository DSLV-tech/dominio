// ─── GameMap ──────────────────────────────────────────────────────────────────
// Mappa 2D (SVG) come una carta di Novarata: fondo con trama e vignettatura,
// mare lungo il porto, quartieri incorniciati con tacche agli angoli,
// collegamenti come strade, targhe dei territori, cartiglio con rosa dei venti
// e legenda. La logica dei click vive in useTerritoryInteraction, condivisa
// con la mappa 3D. Le geometrie statiche sono in layout2d.ts.

import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { controlledZones } from '../../engine';
import { FACTION_DEFINITIONS, TERRITORY_DEFINITIONS, ZONE_DEFINITIONS, isTerritoryId } from '../../data';
import { useTerritoryInteraction } from '../../hooks/useTerritoryInteraction';
import type { ZoneDefinition, ZoneId } from '../../types';
import { cssVars } from '../common/cssVars';
import { ConnectionLines } from './ConnectionLines';
import { TerritoryNode } from './TerritoryNode';
import { MAP_H, MAP_W, ZONE_FRAMES, type ZoneFrame } from './layout2d';

// ─── Decorazioni statiche ─────────────────────────────────────────────────────

/** Costa del porto, lungo il bordo sinistro in basso. */
const SEA_PATH = 'M 0 300 C 22 330 14 372 24 410 S 30 488 18 520 S 44 552 70 560 L 0 560 Z';
const WAVE_PATHS: readonly string[] = [
  'M 4 352 q 4 -3 8 0 t 8 0',
  'M 2 430 q 4 -3 8 0 t 8 0',
  'M 6 500 q 4 -3 8 0 t 8 0',
  'M 20 548 q 4 -3 8 0 t 8 0',
];

const MapDefs = memo(function MapDefs() {
  return (
    <defs>
      <radialGradient id="map2d-bg" cx="52%" cy="48%" r="75%">
        <stop offset="0%" stopColor="#1b2433" />
        <stop offset="60%" stopColor="#111722" />
        <stop offset="100%" stopColor="#090b0f" />
      </radialGradient>
      <radialGradient id="map2d-vignette" cx="50%" cy="50%" r="72%">
        <stop offset="62%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>
      <linearGradient id="map2d-sea" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#0e3440" />
        <stop offset="100%" stopColor="#0b2029" stopOpacity="0.6" />
      </linearGradient>
      <pattern id="map2d-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" className="map2d__grid" />
      </pattern>
      <pattern id="map2d-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
        <path d="M 100 0 L 0 0 0 100" className="map2d__grid map2d__grid--major" />
      </pattern>
      <pattern id="map2d-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" className="map2d__hatch" />
      </pattern>
      {/* riflesso smaltato delle targhe */}
      <linearGradient id="tnode-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="tnode-tint" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
      </linearGradient>
      <radialGradient id="tnode-coin" cx="40%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#323b48" />
        <stop offset="70%" stopColor="#12161c" />
        <stop offset="100%" stopColor="#0b0d10" />
      </radialGradient>
      <filter id="tnode-blur" x="-20%" y="-30%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <linearGradient id="zone-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.045" />
        <stop offset="35%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
});

const Backdrop = memo(function Backdrop() {
  return (
    <g className="map2d__backdrop" aria-hidden="true">
      <rect width={MAP_W} height={MAP_H} fill="url(#map2d-bg)" />
      <rect width={MAP_W} height={MAP_H} fill="url(#map2d-grid)" />
      <rect width={MAP_W} height={MAP_H} fill="url(#map2d-grid-major)" />
      <path d={SEA_PATH} fill="url(#map2d-sea)" />
      <path d={SEA_PATH} fill="url(#map2d-hatch)" opacity={0.5} />
      <path d={SEA_PATH} className="map2d__coast" />
      {WAVE_PATHS.map(d => <path key={d} d={d} className="map2d__wave" />)}
    </g>
  );
});

/** Cartiglio in alto a destra: titolo, notte corrente, rosa dei venti. */
const Cartouche = memo(function Cartouche({ round }: { readonly round: number }) {
  return (
    <g className="map2d__cartouche" transform={`translate(${MAP_W - 20}, 30)`} aria-hidden="true">
      <g transform="translate(-22, 22)" className="map2d__compass">
        <circle r={17} className="map2d__compass-ring" />
        <circle r={12} className="map2d__compass-ring map2d__compass-ring--inner" />
        <path d="M 0 -16 L 3.2 0 L 0 16 L -3.2 0 Z" className="map2d__compass-ns" />
        <path d="M 0 -16 L 3.2 0 L -3.2 0 Z" className="map2d__compass-n" />
        <path d="M -16 0 L 0 -2.4 L 16 0 L 0 2.4 Z" className="map2d__compass-ew" />
        <text y={-21} textAnchor="middle" className="map2d__compass-label">N</text>
      </g>
      <text x={-54} y={18} textAnchor="end" className="map2d__title">NOVARATA</text>
      <text x={-54} y={34} textAnchor="end" className="map2d__subtitle">CARTA DEI QUARTIERI · NOTTE {round}</text>
      <line x1={-210} x2={-54} y1={42} y2={42} className="map2d__rule" />
    </g>
  );
});

interface ZonePanelProps {
  readonly zone: ZoneDefinition;
  readonly frame: ZoneFrame;
  readonly ownerColor: string | null;
}

/** Tacche "da rilievo topografico" ai quattro angoli della cornice. */
function cornerTicks(f: ZoneFrame): string {
  const t = 9;
  const o = 4;
  const x0 = f.x - o, y0 = f.y - o, x1 = f.x + f.width + o, y1 = f.y + f.height + o;
  return [
    `M ${x0} ${y0 + t} V ${y0} H ${x0 + t}`,
    `M ${x1 - t} ${y0} H ${x1} V ${y0 + t}`,
    `M ${x1} ${y1 - t} V ${y1} H ${x1 - t}`,
    `M ${x0 + t} ${y1} H ${x0} V ${y1 - t}`,
  ].join(' ');
}

const ZonePanel = memo(function ZonePanel({ zone, frame: f, ownerColor }: ZonePanelProps) {
  return (
    <g
      className={`zone${ownerColor ? ' is-owned' : ''}`}
      style={cssVars({ '--zone': zone.color, '--owner': ownerColor ?? zone.color })}
    >
      <rect className="zone__panel" x={f.x} y={f.y} width={f.width} height={f.height} rx={14} />
      <rect className="zone__sheen" x={f.x} y={f.y} width={f.width} height={f.height} rx={14} fill="url(#zone-sheen)" />
      <rect className="zone__inner" x={f.x + 4} y={f.y + 4} width={f.width - 8} height={f.height - 8} rx={10} />
      <path className="zone__ticks" d={cornerTicks(f)} />
      <path className="zone__divider" d={`M ${f.x + 16} ${f.y + 32} H ${f.x + f.width - 16}`} />
    </g>
  );
});

/** Intestazione del quartiere: disegnata sopra le strade, così resta leggibile. */
const ZoneHeader = memo(function ZoneHeader({ zone, frame: f, ownerColor }: ZonePanelProps) {
  const label = zone.name.toUpperCase();
  // larghezza del nome stimata (font display 10px, spaziatura 0.24em)
  const labelW = label.length * 9;
  const plateW = 12 + labelW + (zone.troopBonus > 0 ? 40 : 6);
  return (
    <g
      className={`zone zone-head${ownerColor ? ' is-owned' : ''}`}
      style={cssVars({ '--zone': zone.color, '--owner': ownerColor ?? zone.color })}
      transform={`translate(${f.x + 18}, ${f.y + 19})`}
    >
      <rect className="zone__plate" x={-10} y={-11} width={plateW + 14} height={22} rx={11} />
      <path className="zone__diamond" d="M 0 -4.5 L 4.5 0 L 0 4.5 L -4.5 0 Z" />
      <text className="zone__label" x={12} y={3.6}>{label}</text>
      {zone.troopBonus > 0 && (
        <g className="zone__chip" transform={`translate(${12 + labelW + 6}, -9)`}>
          <rect width={30} height={18} rx={9} />
          <text x={15} y={9.5} textAnchor="middle" dominantBaseline="central">+{zone.troopBonus}</text>
        </g>
      )}
    </g>
  );
});

const Legend = memo(function Legend() {
  return (
    <g className="map2d__legend" transform={`translate(${MAP_W / 2 - 160}, ${MAP_H - 30})`} aria-hidden="true">
      <rect className="map2d__legend-bg" width={320} height={22} rx={11} />
      <g transform="translate(18, 11)">
        <circle r={6.5} className="tnode__star-bg" />
        <path d="M 0 -4.5 L 1.3 -1.5 4.4 -1.3 2 .7 2.8 3.9 0 2.2 -2.8 3.9 -2 .7 -4.4 -1.3 -1.3 -1.5 Z" className="tnode__star" />
        <text x={12} y={3.2}>snodo strategico</text>
      </g>
      <g transform="translate(140, 11)">
        <path d="M -6 0 H 6" className="map2d__legend-line map2d__legend-line--attack" />
        <text x={11} y={3.2}>attaccabile</text>
      </g>
      <g transform="translate(232, 11)">
        <path d="M -6 0 H 6" className="map2d__legend-line map2d__legend-line--move" />
        <text x={11} y={3.2}>spostamento</text>
      </g>
    </g>
  );
});

// ─── Mappa ────────────────────────────────────────────────────────────────────

export function GameMap() {
  const game = useGameStore(s => s.game);
  // Sui telefoni la carta è più grande del pannello e si scorre col dito
  // (styles/mobile.css): parte centrata, e si ricentra quando il pannello
  // cambia forma (rotazione del telefono).
  const scrollerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const center = () => {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
    };
    center();
    let last = `${el.clientWidth}x${el.clientHeight}`;
    const ro = new ResizeObserver(() => {
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size !== last) { last = size; center(); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { highlightPairs, getVariant, handleClick, handleHover } = useTerritoryInteraction();

  const onNodeClick = useCallback((id: string) => {
    if (isTerritoryId(id)) handleClick(id);
  }, [handleClick]);

  const onNodeHover = useCallback((id: string | null) => {
    handleHover(id !== null && isTerritoryId(id) ? id : null);
  }, [handleHover]);

  const territories = game?.territories;
  const zoneOwners = useMemo(() => (territories ? controlledZones({ territories }) : null), [territories]);

  if (!game) return null;

  const tone = game.phase === 'MOVEMENT' ? 'move' : 'attack';
  const ownerColorOf = (zoneId: ZoneId): string | null => {
    const ownerId = zoneOwners?.get(zoneId);
    const owner = ownerId ? game.players.find(p => p.id === ownerId) : undefined;
    return owner ? FACTION_DEFINITIONS[owner.factionId].color : null;
  };

  return (
    <div className="map2d" ref={scrollerRef}>
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="map2d__svg"
        role="group"
        aria-label="Mappa 2D di Novarata"
        xmlns="http://www.w3.org/2000/svg"
      >
        <MapDefs />
        <Backdrop />

        {Object.values(ZONE_DEFINITIONS).map(zone => (
          <ZonePanel key={zone.id} zone={zone} frame={ZONE_FRAMES[zone.id]} ownerColor={ownerColorOf(zone.id)} />
        ))}

        <ConnectionLines highlightPairs={highlightPairs} tone={tone} />

        {Object.values(ZONE_DEFINITIONS).map(zone => (
          <ZoneHeader key={zone.id} zone={zone} frame={ZONE_FRAMES[zone.id]} ownerColor={ownerColorOf(zone.id)} />
        ))}

        {Object.values(TERRITORY_DEFINITIONS).map(def => {
          const state = game.territories[def.id];
          const owner = state.ownerId ? (game.players.find(p => p.id === state.ownerId) ?? null) : null;
          return (
            <TerritoryNode
              key={def.id}
              definition={def}
              state={state}
              owner={owner}
              variant={getVariant(def.id)}
              onClick={onNodeClick}
              onHover={onNodeHover}
            />
          );
        })}

        <Cartouche round={game.round} />
        <Legend />
        <rect className="map2d__vignette" width={MAP_W} height={MAP_H} fill="url(#map2d-vignette)" />
      </svg>
    </div>
  );
}
