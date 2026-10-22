// ─── Movement rules ───────────────────────────────────────────────────────────
// Pure functions: dove si possono spostare le truppe, secondo la regola scelta
// a inizio partita ('adjacent' = solo vicini, 'chain' = lungo catene di territori propri).

import type { GameState, MovementRule, PlayerId, TerritoryId } from '../types';
import { TERRITORY_DEFINITIONS } from '../data';

type MovementState = Pick<GameState, 'territories' | 'movementRule'>;

/** Destinazioni raggiungibili da `from` con le truppe di `playerId`. */
export function reachableFriendly(
  state: MovementState,
  from: TerritoryId,
  playerId: PlayerId,
  rule: MovementRule = state.movementRule,
): ReadonlySet<TerritoryId> {
  const mine = (id: TerritoryId) => state.territories[id].ownerId === playerId;
  const result = new Set<TerritoryId>();
  if (!mine(from)) return result;

  if (rule === 'adjacent') {
    for (const n of TERRITORY_DEFINITIONS[from].connections) if (mine(n)) result.add(n);
    return result;
  }

  const queue: TerritoryId[] = [from];
  const seen = new Set<TerritoryId>([from]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of TERRITORY_DEFINITIONS[cur].connections) {
      if (seen.has(n) || !mine(n)) continue;
      seen.add(n);
      result.add(n);
      queue.push(n);
    }
  }
  return result;
}
