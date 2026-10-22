// ─── Turn recap ───────────────────────────────────────────────────────────────
// Funzione pura: confronta lo stato a inizio e fine turno di un giocatore.

import type { GameState, PlayerId, TerritoryId, TurnRecap } from '../types';

export function summarizeTurn(
  before: GameState,
  after: GameState,
  playerId: PlayerId,
  reinforced = 0,
): TurnRecap {
  const ids = Object.keys(after.territories) as TerritoryId[];
  const conquered = ids.filter(id => before.territories[id].ownerId !== playerId && after.territories[id].ownerId === playerId);
  const lost = ids.filter(id => before.territories[id].ownerId === playerId && after.territories[id].ownerId !== playerId);
  const count = (s: GameState) => (s.hands[playerId] ?? []).filter(c => c.kind === 'TERRITORY').length;
  const event = after.lastEvent && after.lastEvent !== before.lastEvent && after.lastEvent.playerId === playerId
    ? after.lastEvent
    : null;
  return {
    playerId,
    reinforced,
    conquered,
    lost,
    cardsDrawn: Math.max(0, count(after) - count(before)),
    event,
  };
}
