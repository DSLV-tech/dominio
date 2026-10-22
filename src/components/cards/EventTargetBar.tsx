// ─── EventTargetBar ───────────────────────────────────────────────────────────
// Guida la scelta del bersaglio di una carta evento: barra in alto sulla mappa
// con istruzione, Conferma e Annulla (Esc). Il passo "territorio" si svolge
// sulla mappa (2D o 3D, via useTerritoryInteraction); i passi giocatore/carte
// usano un pannello di scelta. Al termine risolve la carta nel gameStore.

import { memo, useCallback, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { TERRITORY_DEFINITIONS } from '../../data';
import { CardPicker, PlayerPicker } from './EventTargetDialog';
import type { EventTargetKind, PlayerId } from '../../types';

const INSTRUCTION: Readonly<Record<EventTargetKind, string>> = {
  territory: 'Scegli un territorio illuminato sulla mappa.',
  player: 'Scegli il giocatore.',
  cards: 'Scegli le tue carte da scambiare (altrettante a caso dall\'altro).',
};

export const EventTargetBar = memo(function EventTargetBar() {
  const targeting = useUIStore(s => s.eventTargeting);
  const patch     = useUIStore(s => s.patchEventTargeting);
  const cancel    = useUIStore(s => s.cancelEventTargeting);
  const addLog    = useUIStore(s => s.addLog);
  const notify    = useUIStore(s => s.showNotification);
  const playEventCard = useGameStore(s => s.playEventCard);
  const playerId  = useGameStore(s => (s.game ? s.game.players[s.game.currentPlayerIndex]?.id ?? null : null));
  const hand      = useGameStore(s => (s.game && playerId ? s.game.hands[playerId] ?? [] : []));
  const card      = targeting ? hand.find(c => c.id === targeting.cardId) : undefined;

  useEffect(() => {
    if (!targeting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [targeting, cancel]);

  // La carta non è più in mano (turno cambiato, furto…): annulla
  const gone = targeting && !card;
  useEffect(() => { if (gone) cancel(); }, [gone, cancel]);

  const commit = useCallback((extra: { targetPlayerId?: PlayerId; myCardIds?: string[] } = {}) => {
    if (!targeting || !playerId) return;
    const log = playEventCard(targeting.cardId, targeting.eventId, { ...targeting.ctx, ...extra, playerId });
    addLog(log);
    notify(log, 4000);
    cancel();
  }, [targeting, playerId, playEventCard, addLog, notify, cancel]);

  if (!targeting || !card || card.kind !== 'EVENT') return null;
  const { spec, step, ctx } = targeting;
  const kind = spec.steps[step];
  if (!kind) return null;
  const isLast = step === spec.steps.length - 1;
  const picked = ctx.targetTerritoryId ?? null;

  return (
    <section className="etarget" role="dialog" aria-label={`Bersaglio per ${card.name}`}>
      <header className="etarget__head">
        <strong className="etarget__name">{card.name}</strong>
        <span className="etarget__step">Passo {step + 1} di {spec.steps.length}</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={cancel}>Annulla <kbd>Esc</kbd></button>
      </header>
      <p className="etarget__text">{INSTRUCTION[kind]}</p>

      {kind === 'territory' && (
        <div className="etarget__row">
          <span className="etarget__picked">{picked ? TERRITORY_DEFINITIONS[picked].name : 'Nessun territorio scelto'}</span>
          <button
            type="button"
            className="btn btn--sodium btn--sm"
            disabled={!picked}
            onClick={() => (isLast ? commit() : patch({}, true))}
          >
            Conferma
          </button>
        </div>
      )}

      {kind === 'player' && (
        <PlayerPicker
          players={spec.players}
          onPick={id => (isLast ? commit({ targetPlayerId: id }) : patch({ targetPlayerId: id }, true))}
        />
      )}

      {kind === 'cards' && (
        <CardPicker
          cards={hand.filter(c => c.id !== targeting.cardId)}
          max={spec.maxCards}
          onConfirm={ids => commit({ myCardIds: ids })}
        />
      )}
    </section>
  );
});
