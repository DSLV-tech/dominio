// ─── Reinforcement Engine ─────────────────────────────────────────────────────

import type { GameState, PlayerId, TerritoryId, ZoneId } from '../types';
import { ZONE_DEFINITIONS } from '../data';

// ─── Base troops ──────────────────────────────────────────────────────────────

export function baseReinforcements(territoriesControlled: number): number {
  return Math.max(3, Math.floor(territoriesControlled / 3));
}

// ─── Controlled zones ─────────────────────────────────────────────────────────

/** Zone interamente in mano a un solo giocatore (fonte unica per UI e narrativa). */
export function controlledZones(
  state: Pick<GameState, 'territories'>,
): ReadonlyMap<ZoneId, PlayerId> {
  const result = new Map<ZoneId, PlayerId>();
  for (const zone of Object.values(ZONE_DEFINITIONS)) {
    const first = state.territories[zone.territories[0] as TerritoryId].ownerId;
    if (first && zone.territories.every(t => state.territories[t as TerritoryId].ownerId === first)) {
      result.set(zone.id, first);
    }
  }
  return result;
}

// ─── Zone bonus ───────────────────────────────────────────────────────────────

export function zoneBonus(
  playerId: PlayerId,
  state: GameState,
  suppressPV = false, // used during BLACKOUT effect
): number {
  let bonus = 0;

  for (const zone of Object.values(ZONE_DEFINITIONS)) {
    if (suppressPV && zone.eventCardBonus) continue; // PV check: PV is the zone with eventCardBonus
    if (zone.troopBonus === 0) continue;

    const fullyOwned = zone.territories.every(
      tid => state.territories[tid as TerritoryId].ownerId === playerId
    );
    if (fullyOwned) {
      bonus += zone.troopBonus;
    }
  }

  return bonus;
}

// ─── Faction-specific bonus ───────────────────────────────────────────────────

export function factionBonus(
  playerId: PlayerId,
  state: GameState,
): number {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return 0;

  let bonus = 0;

  if (player.factionId === 'MANO_NERA') {
    // +1 per Porto Vecchio territory controlled
    const pvZone = ZONE_DEFINITIONS['PV'];
    const pvControlled = pvZone.territories.filter(
      tid => state.territories[tid as TerritoryId].ownerId === playerId
    ).length;
    bonus += pvControlled; // max +4
  }

  return bonus;
}

// ─── Sciopero penalty ─────────────────────────────────────────────────────────

export function scioperoPenalty(state: GameState, turn: number): boolean {
  return state.activeEffects.some(
    e => e.type === 'SCIOPERO' && (e as { untilTurn: number }).untilTurn >= turn
  );
}

// ─── Total reinforcements for a player ───────────────────────────────────────

export function calculateReinforcements(
  playerId: PlayerId,
  state: GameState,
): number {
  const owned = Object.values(state.territories).filter(
    t => t.ownerId === playerId
  ).length;

  const blackoutActive = state.activeEffects.some(
    e => e.type === 'NO_ZONE_BONUS_EXCEPT_PV' &&
      (e as { untilTurn: number }).untilTurn >= state.round
  );

  const base    = baseReinforcements(owned);
  const zone    = zoneBonus(playerId, state, blackoutActive);
  const faction = factionBonus(playerId, state);
  const scio    = scioperoPenalty(state, state.round) ? -1 : 0;

  return Math.max(1, base + zone + faction + scio);
}
