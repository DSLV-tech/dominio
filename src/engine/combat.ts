// ─── Combat Engine ────────────────────────────────────────────────────────────
// Pure functions — no side effects, no React dependencies.

import type {
  TerritoryId, FactionId, PendingAttack, TerritoryState, ActiveEffect, PlayerId,
  AttackOrder, CombatRoundLog, AttackPreferences,
} from '../types';
import { TERRITORY_DEFINITIONS } from '../data';

// ─── Dice ─────────────────────────────────────────────────────────────────────

/** Generatore di numeri in [0,1): iniettabile per test deterministici. */
export type Rng = () => number;

export function rollDie(rng: Rng = Math.random): number {
  return Math.floor(rng() * 6) + 1;
}

export function rollDice(count: number, rng: Rng = Math.random): number[] {
  return Array.from({ length: count }, () => rollDie(rng)).sort((a, b) => b - a);
}

// ─── Max dice helpers ─────────────────────────────────────────────────────────

export function maxAttackDice(
  troops: number,
  attackerFaction: FactionId,
  fromId: TerritoryId,
  toId: TerritoryId,
): number {
  const base = Math.min(3, troops - 1); // must keep ≥ 1 troop behind
  if (base <= 0) return 0;

  // Colletti Bianchi: +1 die when attacking adjacent to Centro Storico
  if (attackerFaction === 'BIANCHI') {
    const targetDef = TERRITORY_DEFINITIONS[toId];
    const fromDef   = TERRITORY_DEFINITIONS[fromId];
    const targetAdjacentCS = targetDef.zone === 'CS' ||
      targetDef.connections.some(c => TERRITORY_DEFINITIONS[c].zone === 'CS');
    if (targetAdjacentCS || fromDef.zone === 'CS') {
      return Math.min(4, troops - 1);
    }
  }

  return base;
}

export function maxDefendDice(troops: number): number {
  return Math.min(2, troops);
}

// ─── Combat resolution ────────────────────────────────────────────────────────

export interface CombatRoll {
  readonly attackerDice: readonly number[];
  readonly defenderDice: readonly number[];
  readonly attackerLosses: number;
  readonly defenderLosses: number;
}

export function resolveCombatRoll(
  attackDiceCount: number,
  defendDiceCount: number,
  defenderFaction: FactionId | null,
  defenderTerritoryId: TerritoryId,
  rng: Rng = Math.random,
): CombatRoll {
  const attackerDice = rollDice(attackDiceCount, rng);
  let defenderDice   = rollDice(defendDiceCount, rng);

  // Figli della Strada: +1 to all defense dice in SE or PN zones
  if (defenderFaction === 'STRADA') {
    const zone = TERRITORY_DEFINITIONS[defenderTerritoryId].zone;
    if (zone === 'SE' || zone === 'PN') {
      defenderDice = defenderDice.map(d => Math.min(6, d + 1)).sort((a, b) => b - a);
    }
  }

  const comparisons = Math.min(attackerDice.length, defenderDice.length);
  let attackerLosses = 0;
  let defenderLosses = 0;

  for (let i = 0; i < comparisons; i++) {
    // Defender wins ties
    if ((attackerDice[i] ?? 0) > (defenderDice[i] ?? 0)) {
      defenderLosses++;
    } else {
      attackerLosses++;
    }
  }

  return {
    attackerDice,
    defenderDice,
    attackerLosses,
    defenderLosses,
  };
}

// ─── Active effects helpers ───────────────────────────────────────────────────

export function isEffect<T extends ActiveEffect['type']>(
  e: ActiveEffect,
  type: T,
): e is Extract<ActiveEffect, { type: T }> {
  return e.type === type;
}

/** True se esiste una tregua ancora valida fra i due giocatori. */
export function hasTruce(
  effects: readonly ActiveEffect[],
  a: PlayerId,
  b: PlayerId | null,
  round: number,
): boolean {
  if (b === null) return false;
  return effects.some(
    e => isEffect(e, 'TRUCE') && e.untilTurn >= round &&
      ((e.player1 === a && e.player2 === b) || (e.player1 === b && e.player2 === a)),
  );
}

// ─── Attack validity ──────────────────────────────────────────────────────────

export interface AttackValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export function validateAttack(
  fromId: TerritoryId,
  toId: TerritoryId,
  fromState: TerritoryState,
  toState: TerritoryState,
  currentPlayerId: string,
  activeEffects: readonly ActiveEffect[],
  currentTurn: number,
): AttackValidationResult {
  if (fromState.ownerId !== currentPlayerId) {
    return { valid: false, reason: 'Non controlli questo territorio.' };
  }
  if (toState.ownerId === currentPlayerId) {
    return { valid: false, reason: 'Non puoi attaccare un tuo territorio.' };
  }
  if (fromState.troops < 2) {
    return { valid: false, reason: 'Servono almeno 2 truppe per attaccare.' };
  }

  const fromDef = TERRITORY_DEFINITIONS[fromId];
  if (!fromDef.connections.includes(toId)) {
    return { valid: false, reason: 'I territori non sono adiacenti.' };
  }

  // Check NO_ATTACK_CENTRO effect
  const centroBlocked = activeEffects.some(
    e => isEffect(e, 'NO_ATTACK_CENTRO') && e.untilTurn >= currentTurn
  );
  if (centroBlocked && TERRITORY_DEFINITIONS[toId].zone === 'CS') {
    return { valid: false, reason: 'Il Centro Storico è protetto (Protesta di Piazza).' };
  }

  if (hasTruce(activeEffects, fromState.ownerId, toState.ownerId, currentTurn)) {
    return { valid: false, reason: 'Tregua in corso con questo giocatore (Accordo di Pace).' };
  }

  return { valid: true };
}

// ─── Full attack resolution ───────────────────────────────────────────────────

export function resolveAttack(
  fromId: TerritoryId,
  toId: TerritoryId,
  attackDiceCount: number,
  attackerFaction: FactionId,
  defenderFaction: FactionId | null,
  defenderTerritoryBarricade: boolean,
  defenderTroops: number,
  rng: Rng = Math.random,
): PendingAttack {
  // La barricata concede un terzo dado in difesa (D7: da confermare col GDD).
  const defendCap = defenderTerritoryBarricade ? 3 : 2;
  const actualDefendDice = Math.max(1, Math.min(defendCap, defenderTroops));

  const roll = resolveCombatRoll(attackDiceCount, actualDefendDice, defenderFaction, toId, rng);

  // Suppress TS unused — attackerFaction used for dice calc only, kept for future
  void attackerFaction;

  return {
    fromId,
    toId,
    attackDice: attackDiceCount,
    attackerLosses: roll.attackerLosses,
    defenderLosses: roll.defenderLosses,
    rolls: {
      attacker: roll.attackerDice,
      defender: roll.defenderDice,
    },
    conquered: roll.defenderLosses >= defenderTroops,
    mode: 'single',
    rounds: [{
      attacker: roll.attackerDice,
      defender: roll.defenderDice,
      attackerLosses: roll.attackerLosses,
      defenderLosses: roll.defenderLosses,
    }],
  };
}

// ─── Attack order resolution (single roll or blitz) ───────────────────────────

/** Tetto di sicurezza ai lanci di un blitz. */
export const MAX_BLITZ_ROUNDS = 60;

export interface AttackOrderContext {
  readonly fromTroops: number;
  readonly toTroops: number;
  readonly attackerFaction: FactionId;
  readonly defenderFaction: FactionId | null;
  readonly barricade: boolean;
}

/** Dadi effettivi: quelli scelti, entro il massimo consentito dalle truppe correnti. */
export function clampAttackDice(
  wanted: number, troops: number, faction: FactionId, fromId: TerritoryId, toId: TerritoryId,
): number {
  return Math.max(0, Math.min(Math.floor(wanted), maxAttackDice(troops, faction, fromId, toId)));
}

/**
 * Risolve un ordine di attacco. In modalità 'single' un solo lancio; in 'blitz'
 * ripete finché: conquista, la fonte scende a `stopAt` truppe o si raggiunge il
 * tetto di sicurezza. Pura: nessuno stato esterno oltre all'RNG.
 */
export function resolveAttackOrder(order: AttackOrder, ctx: AttackOrderContext, rng: Rng = Math.random): PendingAttack {
  const rounds: CombatRoundLog[] = [];
  let fromTroops = ctx.fromTroops;
  let toTroops = ctx.toTroops;
  let attackerLosses = 0;
  let defenderLosses = 0;
  let conquered = false;
  let lastDice = 0;
  const stopAt = Math.max(2, Math.floor(order.stopAt));
  const limit = order.mode === 'blitz' ? MAX_BLITZ_ROUNDS : 1;

  while (rounds.length < limit) {
    const dice = clampAttackDice(order.dice, fromTroops, ctx.attackerFaction, order.fromId, order.toId);
    if (dice < 1) break;
    const r = resolveAttack(
      order.fromId, order.toId, dice, ctx.attackerFaction, ctx.defenderFaction, ctx.barricade, toTroops, rng,
    );
    const round = r.rounds[0]!;
    rounds.push(round);
    lastDice = dice;
    fromTroops -= r.attackerLosses;
    toTroops -= r.defenderLosses;
    attackerLosses += r.attackerLosses;
    defenderLosses += r.defenderLosses;
    if (r.conquered) { conquered = true; break; }
    if (fromTroops <= stopAt) break;
  }

  const last = rounds[rounds.length - 1];
  return {
    fromId: order.fromId,
    toId: order.toId,
    attackDice: lastDice,
    attackerLosses,
    defenderLosses,
    rolls: { attacker: last?.attacker ?? [], defender: last?.defender ?? [] },
    conquered,
    mode: order.mode,
    rounds,
  };
}

/** Traduce le preferenze del giocatore in un ordine valido per le truppe attuali. */
export function orderFromPrefs(
  prefs: AttackPreferences,
  fromId: TerritoryId,
  toId: TerritoryId,
  fromTroops: number,
  faction: FactionId,
): AttackOrder {
  const max = maxAttackDice(fromTroops, faction, fromId, toId);
  const dice = prefs.dice === 'max' ? max : Math.min(prefs.dice, max);
  return { fromId, toId, dice, mode: prefs.mode, stopAt: Math.max(2, prefs.stopAt) };
}
