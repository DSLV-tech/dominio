// ─── TerritoryCardView ────────────────────────────────────────────────────────
// Carta territorio "da collezione": cornice nel metallo del grado, fascia nel
// colore della zona, insegna SVG, nome del luogo. Tilt 3D + riflesso al
// passaggio del mouse; se selezionata si solleva e mostra l'ordine di scelta.

import { memo, useCallback } from 'react';
import { TERRITORY_DEFINITIONS, ZONE_DEFINITIONS } from '../../data';
import type { TerritoryCard } from '../../types';
import { cssVars } from '../common/cssVars';
import { CardInsignia } from './CardInsignia';
import { SYMBOL_META } from './cardMeta';
import { useCardTilt } from './useCardTilt';

export interface TerritoryCardViewProps {
  readonly card: TerritoryCard;
  /** Posizione nella mano: scagliona l'animazione di pesca. */
  readonly index: number;
  /** 1..3 se selezionata, altrimenti null. */
  readonly order: number | null;
  readonly selectable: boolean;
  readonly onToggle: (id: string) => void;
}

export const TerritoryCardView = memo(function TerritoryCardView({
  card, index, order, selectable, onToggle,
}: TerritoryCardViewProps) {
  const tilt = useCardTilt<HTMLButtonElement>();
  const def  = TERRITORY_DEFINITIONS[card.territoryId];
  const zone = ZONE_DEFINITIONS[def.zone];
  const meta = SYMBOL_META[card.symbol];
  const selected = order !== null;

  const handleClick = useCallback(() => {
    if (selectable) onToggle(card.id);
  }, [card.id, onToggle, selectable]);

  return (
    <button
      type="button"
      className={`tcard tcard--${meta.metal}${selected ? ' is-selected' : ''}${selectable ? '' : ' is-locked'}`}
      style={cssVars({ '--zone': zone?.color ?? 'var(--muted)', '--i': String(index) })}
      aria-pressed={selected}
      aria-disabled={!selectable}
      aria-label={`${def.name}, ${meta.label}${selected ? `, scelta ${order}` : ''}`}
      title={selectable ? undefined : 'I set si incassano nella fase Rinforzi'}
      onClick={handleClick}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <span className="tcard__face">
        <span className="tcard__band" aria-hidden="true" />
        <span className="tcard__top">
          <span className="tcard__code">{card.territoryId}</span>
          {def.isBottleneck && <span className="tcard__key" title="Snodo strategico">★</span>}
        </span>
        <span className="tcard__emblem"><CardInsignia symbol={card.symbol} size={38} /></span>
        <span className="tcard__name">{def.name}</span>
        <span className="tcard__rank">{meta.label}</span>
        <span className="tcard__zone">{zone?.name}</span>
        <span className="tcard__foil" aria-hidden="true" />
      </span>
      {selected && <span className="tcard__order" aria-hidden="true">{order}</span>}
    </button>
  );
});
