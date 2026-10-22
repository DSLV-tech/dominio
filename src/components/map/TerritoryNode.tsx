// ─── TerritoryNode ────────────────────────────────────────────────────────────
// Un territorio sulla mappa SVG: una "targa" smaltata con
//  - corpo scuro nel tono della fazione, riflesso in alto e filo luminoso
//  - fascia verticale nel colore della fazione, nome su una o due righe
//  - gettone delle truppe a moneta (pop al cambio del numero)
//  - stella per gli snodi strategici
// Stile in styles/map2d.css (classi per variante + custom property --faction).
// Hover: la targa si solleva (CSS, rispetta reduced-motion). Nessun <title>
// nativo: il nome e i dettagli li mostra la scheda TerritoryInfoCard.

import { memo, useCallback, useState, type KeyboardEvent } from 'react';
import type { TerritoryDefinition, TerritoryState, Player, TerritoryVariant } from '../../types';
import { FACTION_DEFINITIONS } from '../../data';
import { cssVars } from '../common/cssVars';
import { NODE_H, NODE_W } from './layout2d';

export type NodeVariant = TerritoryVariant;

interface Props {
  readonly definition: TerritoryDefinition;
  readonly state: TerritoryState;
  readonly owner: Player | null;
  readonly variant: NodeVariant;
  readonly isJustConquered?: boolean;
  readonly onClick: (id: string) => void;
  readonly onHover: (id: string | null) => void;
}

/** Nome su una o due righe: si spezza a metà se è lungo. */
function splitName(name: string): readonly [string, string | null] {
  const parts = name.split(' ');
  if (name.length <= 13 || parts.length < 2) return [name, null];
  const half = Math.ceil(parts.length / 2);
  return [parts.slice(0, half).join(' '), parts.slice(half).join(' ')];
}

const STAR_PATH = 'M 0 -5.5 L 1.6 -1.8 5.4 -1.6 2.5 0.9 3.4 4.8 0 2.7 -3.4 4.8 -2.5 0.9 -5.4 -1.6 -1.6 -1.8 Z';
const BAND_X = 7;
const TEXT_X = NODE_W / 2 + 4;

export const TerritoryNode = memo(function TerritoryNode({
  definition, state, owner, variant, isJustConquered = false, onClick, onHover,
}: Props) {
  const { id, name, svgPosition, isBottleneck } = definition;
  const faction = owner ? FACTION_DEFINITIONS[owner.factionId] : null;
  const [isHovered, setIsHovered] = useState(false);
  const handleClick      = useCallback(() => onClick(id), [id, onClick]);
  const handleMouseEnter = useCallback(() => { setIsHovered(true);  onHover(id);   }, [id, onHover]);
  const handleMouseLeave = useCallback(() => { setIsHovered(false); onHover(null); }, [onHover]);
  const handleKeyDown    = useCallback((e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(id); }
  }, [id, onClick]);
  const [line1, line2] = splitName(name);

  const classes = ['tnode', `tnode--${variant}`];
  if (isHovered) classes.push('is-hover');
  if (isJustConquered) classes.push('is-conquered');
  if (!faction) classes.push('is-neutral');

  const style = cssVars({
    '--faction': faction?.color ?? 'var(--faint)',
    '--faction-bg': faction?.bgColor ?? 'var(--ink-2)',
    '--faction-text': faction?.textColor ?? 'var(--muted)',
  });

  const ownerLabel = faction ? faction.shortName : 'neutrale';

  return (
    <g
      className={classes.join(' ')}
      style={style}
      transform={`translate(${svgPosition.x - NODE_W / 2}, ${svgPosition.y - NODE_H / 2})`}
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${ownerLabel}, ${state.troops} truppe${isBottleneck ? ', snodo strategico' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {/* area di hit fissa e un po' più ampia: non segue il sollevamento, niente sfarfallio */}
      <rect className="tnode__hit" x={-6} y={-8} width={NODE_W + 14} height={NODE_H + 14} rx={12} />

      <g className="tnode__lift">
        <rect className="tnode__shadow" x={2} y={5} width={NODE_W - 4} height={NODE_H} rx={10} />
        <rect className="tnode__body" width={NODE_W} height={NODE_H} rx={10} />
        <rect className="tnode__tint" width={NODE_W} height={NODE_H} rx={10} />
        <rect className="tnode__sheen" x={1} y={1} width={NODE_W - 2} height={NODE_H / 2} rx={9} />
        <rect className="tnode__rim" x={0.75} y={0.75} width={NODE_W - 1.5} height={NODE_H - 1.5} rx={9.5} />
        <rect className="tnode__band" x={BAND_X} y={9} width={3} height={NODE_H - 18} rx={1.5} />

        <text className="tnode__name" x={TEXT_X} y={line2 ? NODE_H / 2 - 2.5 : NODE_H / 2 + 3.5} textAnchor="middle">
          {line1}
        </text>
        {line2 && (
          <text className="tnode__name" x={TEXT_X} y={NODE_H / 2 + 9.5} textAnchor="middle">{line2}</text>
        )}

        {isBottleneck && (
          <g className="tnode__star-wrap" transform="translate(4 3)">
            <circle r={7.5} className="tnode__star-bg" />
            <path className="tnode__star" d={STAR_PATH} />
          </g>
        )}

        {state.troops > 0 && (
          <g className="tnode__badge" transform={`translate(${NODE_W - 3}, 2)`}>
            <g key={state.troops} className="tnode__badge-pop">
              <circle className="tnode__coin" r={12.5} />
              <circle className="tnode__coin-ring" r={9.5} />
              <text textAnchor="middle" dominantBaseline="central">{state.troops}</text>
            </g>
          </g>
        )}
      </g>
    </g>
  );
});
