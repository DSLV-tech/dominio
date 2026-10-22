// ─── Victory Condition Checks ─────────────────────────────────────────────────

import type { GameState, PlayerId, VictoryCondition, TerritoryId } from '../types';
import { ZONE_DEFINITIONS } from '../data';

export interface VictoryResult {
  readonly winner: PlayerId;
  readonly condition: VictoryCondition;
}

// ── 1. Total Domination ───────────────────────────────────────────────────────

export function checkTotalDomination(state: GameState): PlayerId | null {
  const activePlayers = state.players.filter(p => !p.isEliminated);
  if (activePlayers.length !== 1) {
    // Check if one player owns everything
    for (const player of activePlayers) {
      const ownsAll = Object.values(state.territories).every(
        t => t.ownerId === player.id
      );
      if (ownsAll) return player.id;
    }
    return null;
  }
  return activePlayers[0]?.id ?? null;
}

// ── 2. Political Control ──────────────────────────────────────────────────────
// Requires: ≥3 zones fully controlled AND Piazza Grande (CS1) for 2 consecutive turns.

export function checkPoliticalControl(state: GameState): PlayerId | null {
  for (const player of state.players) {
    if (player.isEliminated) continue;

    const piazzaHeld = (state.piazzaHoldCount[player.id] ?? 0) >= 2;
    if (!piazzaHeld) continue;

    const zonesOwned = Object.values(ZONE_DEFINITIONS).filter(zone =>
      zone.territories.every(
        tid => state.territories[tid as TerritoryId].ownerId === player.id
      )
    ).length;

    if (zonesOwned >= 3) return player.id;
  }
  return null;
}

// ── 3. Elimination ────────────────────────────────────────────────────────────

export function checkElimination(state: GameState): PlayerId | null {
  const active = state.players.filter(p => !p.isEliminated);
  return active.length === 1 ? (active[0]?.id ?? null) : null;
}

// ── Update piazza hold counter ─────────────────────────────────────────────────

export function updatePiazzaHold(state: GameState): Record<PlayerId, number> {
  const updated = { ...state.piazzaHoldCount };
  const piazzaOwner = state.territories['CS1'].ownerId;

  for (const player of state.players) {
    if (player.id === piazzaOwner) {
      updated[player.id] = (updated[player.id] ?? 0) + 1;
    } else {
      updated[player.id] = 0; // reset: must be consecutive
    }
  }
  return updated;
}

// ── Mark eliminated players ────────────────────────────────────────────────────

export function getEliminatedPlayerIds(state: GameState): PlayerId[] {
  return state.players
    .filter(p => !p.isEliminated)
    .filter(p =>
      Object.values(state.territories).every(t => t.ownerId !== p.id)
    )
    .map(p => p.id);
}

// ── Full victory check (call at end of each turn) ─────────────────────────────

export function checkVictory(state: GameState): VictoryResult | null {
  const elim = checkElimination(state);
  if (elim) return { winner: elim, condition: 'ELIMINATION' };

  const domination = checkTotalDomination(state);
  if (domination) return { winner: domination, condition: 'TOTAL_DOMINATION' };

  const political = checkPoliticalControl(state);
  if (political) return { winner: political, condition: 'POLITICAL_CONTROL' };

  return null;
}
