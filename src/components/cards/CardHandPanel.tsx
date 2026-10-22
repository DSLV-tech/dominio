// ─── CardHandPanel ────────────────────────────────────────────────────────────
// Mano del giocatore di turno: carte territorio (selezione per incassare un
// set nella fase Rinforzi) e carte evento (dispacci giocabili).
//
// Stato: la selezione è locale (useState) perché effimera e visibile solo qui;
// lo stato di gioco resta in gameStore. Selettori Zustand puntuali: il pannello
// si ri-renderizza solo quando cambiano mano, fase o contatore dei set.

import { memo, useCallback, useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import type { Card, EventCard } from '../../types';
import { isEventCard, isTerritoryCard } from '../../types';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { TerritoryCardView } from './TerritoryCardView';
import { EventCardView } from './EventCardView';
import { SetBonusBar } from './SetBonusBar';
import { evaluateSet } from './cardMeta';
import { getEventTargets } from '../../engine';
import '../../styles/cards.css';

const EMPTY_HAND: readonly Card[] = [];

function HandEmpty() {
  return (
    <div className="hand-empty">
      <div className="hand-empty__stack" aria-hidden="true"><span /><span /><span /></div>
      <p>Nessuna carta in mano.</p>
      <p className="hand-empty__hint">Conquista almeno un territorio nel tuo turno per pescarne una.</p>
    </div>
  );
}

const CardHand = memo(function CardHand() {
  const player        = useGameStore(s => (s.game ? s.game.players[s.game.currentPlayerIndex] ?? null : null));
  const hand          = useGameStore(s => {
    const g = s.game;
    const id = g?.players[g.currentPlayerIndex]?.id;
    return g && id ? g.hands[id] ?? EMPTY_HAND : EMPTY_HAND;
  });
  const phase         = useGameStore(s => s.game?.phase ?? null);
  const setsCashed    = useGameStore(s => s.game?.setsCashedCount ?? 0);
  const cashCardSet   = useGameStore(s => s.cashCardSet);
  const playEventCard = useGameStore(s => s.playEventCard);
  const addLog           = useUIStore(s => s.addLog);
  const showNotification = useUIStore(s => s.showNotification);
  const beginEventTargeting = useUIStore(s => s.beginEventTargeting);
  const game          = useGameStore(s => s.game);

  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);

  const territoryCards = useMemo(() => hand.filter(isTerritoryCard), [hand]);
  const eventCards     = useMemo(() => hand.filter(isEventCard), [hand]);
  const canCashSet     = phase === 'REINFORCEMENT';

  // La selezione considera solo carte ancora in mano (es. dopo un furto)
  const selectedCards = useMemo(
    () => selectedIds.flatMap(id => territoryCards.find(c => c.id === id) ?? []),
    [selectedIds, territoryCards],
  );
  const evaluation = useMemo(() => evaluateSet(selectedCards, setsCashed), [selectedCards, setsCashed]);

  const toggleCard = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleCashSet = useCallback(() => {
    if (!player || evaluation.kind !== 'valid') return;
    const [a, b, c] = selectedCards;
    if (!a || !b || !c) return;
    cashCardSet([a.id, b.id, c.id]);
    setSelectedIds([]);
    showNotification(`Set incassato: +${evaluation.troops} truppe!`);
    addLog(`${player.name} incassa un set: +${evaluation.troops} truppe.`);
  }, [addLog, cashCardSet, evaluation, player, selectedCards, showNotification]);

  const handlePlayEvent = useCallback((card: EventCard) => {
    if (!player) return;
    const game = useGameStore.getState().game;
    if (!game) return;
    const spec = getEventTargets(game, card.eventId, player.id, card.id);
    if (spec.unplayableReason) { showNotification(spec.unplayableReason, 4000); return; }
    if (spec.steps.length === 0) {
      const log = playEventCard(card.id, card.eventId, { playerId: player.id });
      addLog(log);
      showNotification(log, 4000);
    } else {
      beginEventTargeting({ cardId: card.id, eventId: card.eventId, spec });
      if (spec.steps[0] === 'territory') showNotification('Scegli il bersaglio sulla mappa.', 3000);
    }
  }, [addLog, beginEventTargeting, playEventCard, player, showNotification]);

  if (!player) return null;
  if (hand.length === 0) return <HandEmpty />;

  return (
    <div className="hand">
      <header className="hand__head">
        <span className="label">Carte in mano</span>
        <span className="hand__count">{hand.length}</span>
      </header>

      {territoryCards.length > 0 && (
        <section className="hand__group" aria-label="Carte territorio">
          <div className="hand__group-title">
            <span>Territorio</span>
            <span className="hand__hint">{canCashSet ? 'Scegli 3 carte per un set' : 'Set incassabili nei Rinforzi'}</span>
          </div>
          <ul className="hand__grid">
            {territoryCards.map((card, i) => {
              const pos = selectedIds.indexOf(card.id);
              return (
                <li key={card.id}>
                  <TerritoryCardView
                    card={card}
                    index={i}
                    order={pos >= 0 ? pos + 1 : null}
                    selectable={canCashSet}
                    onToggle={toggleCard}
                  />
                </li>
              );
            })}
          </ul>
          {canCashSet && selectedCards.length > 0 && (
            <SetBonusBar selected={selectedCards} evaluation={evaluation} onCash={handleCashSet} onClear={clearSelection} />
          )}
        </section>
      )}

      {eventCards.length > 0 && (
        <section className="hand__group" aria-label="Carte evento">
          <div className="hand__group-title"><span>Eventi</span></div>
          <ul className="hand__events">
            {eventCards.map((card, i) => (
              <li key={card.id}>
                <EventCardView
                  card={card}
                  index={territoryCards.length + i}
                  onPlay={handlePlayEvent}
                  disabledReason={player.isAI || !game ? 'Non è il tuo turno.' : getEventTargets(game, card.eventId, player.id, card.id).unplayableReason}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});

export const CardHandPanel = memo(function CardHandPanel() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="hand-error" role="alert">
          <p>Impossibile mostrare le carte: {error.message}</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>Riprova</button>
        </div>
      )}
    >
      <CardHand />
    </ErrorBoundary>
  );
});
