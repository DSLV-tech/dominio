// ─── EventCardView ────────────────────────────────────────────────────────────
// Carta evento come "dispaccio" della Gazzetta: sigillo, occhiello, titolo
// serif e testo leggibile per intero (prima era nascosto in un tooltip).

import { memo, useCallback } from 'react';
import type { EventCard } from '../../types';
import { cssVars } from '../common/cssVars';
import { INSTANT_EVENTS } from './cardMeta';
import { useCardTilt } from './useCardTilt';

export interface EventCardViewProps {
  readonly card: EventCard;
  readonly index: number;
  readonly onPlay: (card: EventCard) => void;
  /** Se presente, la carta non è giocabile ora e questo ne spiega il motivo. */
  readonly disabledReason?: string;
}

export const EventCardView = memo(function EventCardView({ card, index, onPlay, disabledReason }: EventCardViewProps) {
  const tilt = useCardTilt<HTMLElement>();
  const instant = INSTANT_EVENTS.has(card.eventId);
  const handlePlay = useCallback(() => onPlay(card), [card, onPlay]);

  return (
    <article
      className="ecard"
      style={cssVars({ '--i': String(index) })}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <div className="ecard__seal" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />
        </svg>
      </div>
      <div className="ecard__body">
        <span className="ecard__kicker">
          Dispaccio · Evento{!instant && <span className="ecard__tag">Bersaglio</span>}
        </span>
        <h4 className="ecard__title">{card.name}</h4>
        <p className="ecard__desc">{card.description}</p>
      </div>
      <button
        type="button"
        className="btn btn--sodium btn--sm ecard__play"
        onClick={handlePlay}
        disabled={!!disabledReason}
        title={disabledReason}
      >
        Gioca
      </button>
      {disabledReason && <p className="ecard__why">{disabledReason}</p>}
      <span className="ecard__foil" aria-hidden="true" />
    </article>
  );
});
