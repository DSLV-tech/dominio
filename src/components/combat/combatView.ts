// ─── combatView ───────────────────────────────────────────────────────────────
// Traduce l'attacco risolto (PendingAttack) nella vista da mettere in scena.
// Pura: stessa entrata → stessa uscita, nessun accesso agli store.

import { AI_COMBAT_SPEED, REDUCED_MOTION_SPEED } from '../../data/combatTimeline';
import type { CombatView, DieVerdict, FactionId, GameState, PendingAttack } from '../../types';

export function diceVerdicts(mine: readonly number[], theirs: readonly number[], isDefender: boolean): DieVerdict[] {
  const pairs = Math.min(mine.length, theirs.length);
  return mine.map((d, i) => {
    if (i >= pairs) return null;
    const other = theirs[i] ?? 0;
    return isDefender ? d >= other : d > other; // la difesa vince i pareggi
  });
}

export function buildCombatView(game: GameState, attack: PendingAttack, reducedMotion: boolean): CombatView {
  const attacker = game.players[game.currentPlayerIndex];
  // A conquista avvenuta il territorio è già passato all'attaccante: il
  // difensore originale è annotato nell'attacco stesso.
  const defenderId = attack.defenderId !== undefined ? attack.defenderId : game.territories[attack.toId].ownerId;
  const defender = defenderId ? game.players.find(p => p.id === defenderId) ?? null : null;

  const { attacker: aDice, defender: dDice } = attack.rolls;
  const aVerdicts = diceVerdicts(aDice, dDice, false);
  const dVerdicts = diceVerdicts(dDice, aDice, true);
  const speed = reducedMotion ? REDUCED_MOTION_SPEED : attacker?.isAI ? AI_COMBAT_SPEED : 1;

  return {
    attacker: {
      side: 'attacker',
      faction: attacker?.factionId ?? null,
      name: attacker?.name ?? 'Attaccante',
      dice: aDice,
      verdicts: aVerdicts,
      figures: aDice.length,
      fallen: aVerdicts.map(v => v === false),
    },
    defender: {
      side: 'defender',
      faction: defender?.factionId ?? null,
      name: defender?.name ?? 'Neutrali',
      dice: dDice,
      verdicts: dVerdicts,
      figures: dDice.length,
      // a territorio conquistato cade tutta la guarnigione
      fallen: dVerdicts.map(v => attack.conquered || v === false),
    },
    conquered: attack.conquered,
    speed,
  };
}

export function factionLabel(f: FactionId | null): string {
  return f ?? 'NEUTRO';
}
