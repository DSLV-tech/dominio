// ─── AI Player Engine ─────────────────────────────────────────────────────────
// Greedy expansion strategy with three decision layers:
//  1. Reinforce weak borders or staging territories for attack
//  2. Attack: prioritise bottlenecks → zone completion → weakest neighbour
//  3. Move: consolidate troops toward front lines

import type {
  GameState, TerritoryId, PlayerId, TerritoryCard, CardSymbol, AttackOrder, EventCard, EventCardId,
} from '../types';
import { TERRITORY_DEFINITIONS, ZONE_DEFINITIONS } from '../data';
import { isEffect, maxAttackDice, resolveAttack, validateAttack } from './combat';
import { getEventTargets } from './events';
import type { EventCardContext } from './events';
import { calculateReinforcements } from './reinforcements';
import { getSetBonus } from '../data';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIAction {
  type:
    | 'REINFORCE'
    | 'ATTACK'
    | 'MOVE'
    | 'CASH_SET'
    | 'END_PHASE';
  payload?: {
    territoryId?: TerritoryId;
    fromId?: TerritoryId;
    toId?: TerritoryId;
    count?: number;
    cardIds?: [string, string, string];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ownedTerritories(state: GameState, playerId: PlayerId): TerritoryId[] {
  return Object.values(state.territories)
    .filter(t => t.ownerId === playerId)
    .map(t => t.territoryId);
}

function borderTerritories(state: GameState, playerId: PlayerId): TerritoryId[] {
  return ownedTerritories(state, playerId).filter(tid => {
    const def = TERRITORY_DEFINITIONS[tid];
    return def.connections.some(nid => state.territories[nid].ownerId !== playerId);
  });
}

/** Score a territory as an attack target (higher = better) */
function attackTargetScore(
  targetId: TerritoryId,
  state: GameState,
  playerId: PlayerId,
): number {
  const def = TERRITORY_DEFINITIONS[targetId];
  const troops = state.territories[targetId].troops;
  let score = 0;

  // Prefer bottlenecks
  if (def.isBottleneck) score += 20;

  // Prefer zone-completing move
  const zoneDef = ZONE_DEFINITIONS[def.zone];
  if (zoneDef) {
    const alreadyOwned = zoneDef.territories.filter(
      tid => state.territories[tid as TerritoryId].ownerId === playerId
    ).length;
    score += alreadyOwned * 10; // closer to completing = higher score
  }

  // Prefer weak defenders
  score += Math.max(0, 10 - troops * 2);

  return score;
}

// ─── Phase 1: Reinforcement ───────────────────────────────────────────────────

export function aiChooseReinforcement(
  state: GameState,
  playerId: PlayerId,
  budget: number,
): AIAction[] {
  const actions: AIAction[] = [];

  // 1a. Cash any valid card sets first
  const hand = (state.hands[playerId] ?? []).filter(c => c.kind === 'TERRITORY') as TerritoryCard[];
  const setActions = findBestSet(hand, state.setsCashedCount);
  if (setActions) actions.push(setActions);

  // 1b. Identify best attack target
  const borders = borderTerritories(state, playerId);
  let bestSource: TerritoryId | null = null;
  let bestTarget: TerritoryId | null = null;
  let bestScore = -Infinity;

  for (const fromId of borders) {
    const fromDef = TERRITORY_DEFINITIONS[fromId];
    for (const toId of fromDef.connections) {
      const toState = state.territories[toId];
      if (toState.ownerId === playerId) continue;
      const score = attackTargetScore(toId, state, playerId);
      if (score > bestScore) {
        bestScore = score;
        bestSource = fromId;
        bestTarget = toId;
      }
    }
  }

  // 1c. Place all budget on the best attack source (or strongest border)
  const placeTarget = bestSource ?? borders[0] ?? ownedTerritories(state, playerId)[0];
  if (placeTarget && budget > 0) {
    actions.push({
      type: 'REINFORCE',
      payload: { territoryId: placeTarget, count: budget },
    });
  }

  void bestTarget; // used for attack phase

  actions.push({ type: 'END_PHASE' });
  return actions;
}

// ─── Find best card set ────────────────────────────────────────────────────────

function findBestSet(hand: TerritoryCard[], setCount: number): AIAction | null {
  if (hand.length < 3) return null;

  const groups: Record<CardSymbol, TerritoryCard[]> = {
    INFANTRY: [], CAVALRY: [], ARTILLERY: [],
  };
  for (const card of hand) groups[card.symbol].push(card);

  // Try 3 of same
  for (const sym of ['ARTILLERY', 'CAVALRY', 'INFANTRY'] as CardSymbol[]) {
    if (groups[sym].length >= 3) {
      const [a, b, c] = groups[sym];
      if (a && b && c) {
        return {
          type: 'CASH_SET',
          payload: { cardIds: [a.id, b.id, c.id] as [string, string, string] },
        };
      }
    }
  }

  // Try 1 of each
  const inf = groups.INFANTRY[0];
  const cav = groups.CAVALRY[0];
  const art = groups.ARTILLERY[0];
  if (inf && cav && art) {
    const bonus = getSetBonus(['INFANTRY', 'CAVALRY', 'ARTILLERY'], setCount);
    if (bonus >= 8) { // only cash if worth it
      return {
        type: 'CASH_SET',
        payload: { cardIds: [inf.id, cav.id, art.id] as [string, string, string] },
      };
    }
  }

  return null;
}

// ─── Event cards ──────────────────────────────────────────────────────────────

export interface AIEventDecision {
  readonly cardId: string;
  readonly eventId: EventCardId;
  readonly ctx: EventCardContext;
}

function territoryCount(state: GameState, playerId: PlayerId): number {
  return ownedTerritories(state, playerId).length;
}

/**
 * Sceglie al più un evento da giocare all'inizio del turno, con euristiche
 * semplici. Non gioca Accordo Commerciale (scambio alla cieca senza vantaggio
 * calcolabile) né Sciopero Generale (penalizza anche chi lo gioca).
 */
export function aiChooseEvent(state: GameState, playerId: PlayerId): AIEventDecision | null {
  const hand = state.hands[playerId] ?? [];
  const events = hand.filter((c): c is EventCard => c.kind === 'EVENT');
  const mine = territoryCount(state, playerId);
  const others = state.players.filter(p => p.id !== playerId && !p.isEliminated);
  const weakestCount = Math.min(...state.players.filter(p => !p.isEliminated).map(p => territoryCount(state, p.id)));
  const owner = (tid: TerritoryId) => state.territories[tid].ownerId;

  for (const card of events) {
    const spec = getEventTargets(state, card.eventId, playerId, card.id);
    if (spec.unplayableReason) continue;
    const base = { playerId };
    const play = (ctx: Partial<EventCardContext> = {}): AIEventDecision =>
      ({ cardId: card.id, eventId: card.eventId, ctx: { ...base, ...ctx } });

    switch (card.eventId) {
      case 'MERCATO_NERO':
        return play();
      case 'RAPPRESAGLIA':
        if (borderTerritories(state, playerId).length > 0) return play();
        break;
      case 'PROTESTA':
        if (ownedTerritories(state, playerId).some(t => TERRITORY_DEFINITIONS[t].zone === 'CS')) return play();
        break;
      case 'MEDIA_STORM':
        if (owner('CS1') === playerId && state.decks.event.length >= 2) return play();
        break;
      case 'RIOT':
        if (mine <= weakestCount) return play();
        break;
      case 'BLACKOUT': {
        // utile se un avversario ha più zone intere di me: ne approfitta meno
        const myZones = Object.values(ZONE_DEFINITIONS).filter(z => z.territories.every(t => owner(t as TerritoryId) === playerId)).length;
        const rivalZones = Object.values(ZONE_DEFINITIONS).filter(z => {
          const o = owner(z.territories[0] as TerritoryId);
          return o !== null && o !== playerId && z.territories.every(t => owner(t as TerritoryId) === o);
        }).length;
        if (rivalZones > myZones) return play();
        break;
      }
      case 'OPERAZIONE': {
        // il territorio nemico più forte che confina con uno dei miei
        const border = [...spec.territories]
          .filter(t => TERRITORY_DEFINITIONS[t].connections.some(n => owner(n) === playerId))
          .sort((a, b) => state.territories[b].troops - state.territories[a].troops)[0];
        if (border) return play({ targetTerritoryId: border });
        break;
      }
      case 'IMMIGRAZIONE': {
        // il mio territorio SE più esposto (più vicini nemici)
        const exposed = (t: TerritoryId) => TERRITORY_DEFINITIONS[t].connections.filter(n => owner(n) !== playerId).length;
        const best = [...spec.territories].sort((a, b) => exposed(b) - exposed(a))[0];
        if (best) return play({ seTargetId: best });
        break;
      }
      case 'CORRUZIONE': {
        const richest = [...spec.players].sort((a, b) => (state.hands[b]?.length ?? 0) - (state.hands[a]?.length ?? 0))[0];
        if (richest) return play({ targetPlayerId: richest });
        break;
      }
      case 'ACCORDO_PACE': {
        // tregua con il rivale più forte, se non sono io il più forte
        const strongest = [...spec.players].sort((a, b) => territoryCount(state, b) - territoryCount(state, a))[0];
        if (strongest && others.length >= 2 && territoryCount(state, strongest) > mine) return play({ targetPlayerId: strongest });
        break;
      }
      default:
        break;
    }
  }
  return null;
}

// ─── Phase 2: Attack ──────────────────────────────────────────────────────────

/**
 * Tetto di attacchi CPU per turno. La CPU decide un attacco alla volta sullo
 * stato REALE (dopo ogni tiro di dadi), finché ha un vantaggio o fino al tetto.
 */
export const AI_MAX_ATTACKS_PER_TURN = 12;

export interface AIAttackDecision {
  shouldAttack: boolean;
  fromId?: TerritoryId;
  toId?: TerritoryId;
  dice?: number;
  /** Ordine pronto per gameStore.attackTerritory. */
  order?: AttackOrder;
}

/** Vantaggio di truppe da cui la CPU attacca in automatico (blitz). */
const AI_BLITZ_ADVANTAGE = 2;
/** La CPU in blitz si ferma quando alla fonte restano queste truppe. */
const AI_BLITZ_STOP_AT = 3;

export function aiChooseAttack(
  state: GameState,
  playerId: PlayerId,
): AIAttackDecision {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { shouldAttack: false };

  let bestFrom: TerritoryId | null = null;
  let bestTo: TerritoryId | null = null;
  let bestScore = -Infinity;

  for (const fromId of ownedTerritories(state, playerId)) {
    const fromState = state.territories[fromId];
    if (fromState.troops < 2) continue;

    const fromDef = TERRITORY_DEFINITIONS[fromId];
    for (const toId of fromDef.connections) {
      const toState = state.territories[toId];
      if (toState.ownerId === playerId) continue;

      const validation = validateAttack(
        fromId, toId, fromState, toState, playerId,
        state.activeEffects, state.round
      );
      if (!validation.valid) continue;

      // Only attack if we have a significant troop advantage
      // (salvo la Rappresaglia: l'attacco è senza perdite, quindi sempre conveniente)
      const free = state.activeEffects.some(
        e => isEffect(e, 'RAPPRESAGLIA_TARGET') && e.playerId === playerId && e.territoryId === toId,
      );
      const advantage = fromState.troops - toState.troops;
      if (advantage < 1 && !free) continue; // too risky

      const score = attackTargetScore(toId, state, playerId) + advantage * 2 + (free ? 100 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestFrom = fromId;
        bestTo = toId;
      }
    }
  }

  if (!bestFrom || !bestTo) return { shouldAttack: false };

  const dice = maxAttackDice(
    state.territories[bestFrom].troops,
    player.factionId,
    bestFrom,
    bestTo
  );

  const advantage = state.territories[bestFrom].troops - state.territories[bestTo].troops;
  const order: AttackOrder = {
    fromId: bestFrom,
    toId: bestTo,
    dice,
    mode: advantage >= AI_BLITZ_ADVANTAGE ? 'blitz' : 'single',
    stopAt: AI_BLITZ_STOP_AT,
  };
  return { shouldAttack: true, fromId: bestFrom, toId: bestTo, dice, order };
}

// ─── Phase 3: Movement ────────────────────────────────────────────────────────

export interface AIMovementDecision {
  shouldMove: boolean;
  fromId?: TerritoryId;
  toId?: TerritoryId;
  count?: number;
}

export function aiChooseMovement(
  state: GameState,
  playerId: PlayerId,
): AIMovementDecision {
  // Find interior territories with excess troops
  const owned = ownedTerritories(state, playerId);
  const borders = new Set(borderTerritories(state, playerId));

  // Interior: owned but no enemy neighbours
  const interiorWithExcess = owned
    .filter(tid => !borders.has(tid) && state.territories[tid].troops > 2)
    .map(tid => ({
      tid,
      troops: state.territories[tid].troops,
      // Find closest border territory to move to
      borderNeighbour: TERRITORY_DEFINITIONS[tid].connections
        .find(nid => borders.has(nid as TerritoryId)) as TerritoryId | undefined,
    }))
    .filter(x => x.borderNeighbour !== undefined);

  if (interiorWithExcess.length === 0) return { shouldMove: false };

  // Move from the most-stacked interior to its border neighbour
  interiorWithExcess.sort((a, b) => b.troops - a.troops);
  const best = interiorWithExcess[0]!;
  const movable = best.troops - 1; // keep 1 behind

  if (movable < 1) return { shouldMove: false };

  return {
    shouldMove: true,
    fromId: best.tid,
    toId: best.borderNeighbour,
    count: movable,
  };
}

// ─── Full AI turn executor ────────────────────────────────────────────────────
// Returns a sequence of actions for the game store to apply with delays.

export interface AITurnPlan {
  reinforcements: AIAction[];
  attacks: Array<{ fromId: TerritoryId; toId: TerritoryId; dice: number }>;
  movement: AIMovementDecision;
}

export function planAITurn(state: GameState, playerId: PlayerId): AITurnPlan {
  const budget = calculateReinforcements(playerId, state);
  const reinforcements = aiChooseReinforcement(state, playerId, budget);

  // Simulate a few attacks (up to 5 attempts per turn), starting from the
  // state AFTER the planned reinforcements are placed.
  const attacks: AITurnPlan['attacks'] = [];
  let simState = { ...state };
  const reinforce = reinforcements.find(r => r.type === 'REINFORCE');
  const rtid = reinforce?.payload?.territoryId;
  if (rtid) {
    const t = simState.territories[rtid];
    simState = { ...simState, territories: { ...simState.territories, [rtid]: { ...t, troops: t.troops + budget } } };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const decision = aiChooseAttack(simState, playerId);
    if (!decision.shouldAttack || !decision.fromId || !decision.toId || !decision.dice) break;

    attacks.push({ fromId: decision.fromId, toId: decision.toId, dice: decision.dice });

    // Simulate the attack result for planning (optimistic: assume attacker wins)
    const fromState = simState.territories[decision.fromId];
    const toState   = simState.territories[decision.toId];
    const defenderPlayer = simState.players.find(p => p.id === toState.ownerId);

    const result = resolveAttack(
      decision.fromId, decision.toId, decision.dice,
      state.players.find(p => p.id === playerId)!.factionId,
      defenderPlayer?.factionId ?? null,
      false,
      toState.troops,
    );

    const movedIn = Math.max(1, decision.dice - result.attackerLosses);
    const newFrom = {
      ...fromState,
      troops: result.conquered
        ? Math.max(1, fromState.troops - result.attackerLosses - movedIn)
        : Math.max(1, fromState.troops - result.attackerLosses),
    };
    const newTo   = result.conquered
      ? { ...toState, ownerId: playerId, troops: movedIn }
      : { ...toState, troops: Math.max(0, toState.troops - result.defenderLosses) };

    simState = {
      ...simState,
      territories: { ...simState.territories, [decision.fromId]: newFrom, [decision.toId]: newTo },
    };

    if (!result.conquered) break; // stopped — don't plan more attacks from losing position
  }

  const movement = aiChooseMovement(simState, playerId);

  return { reinforcements, attacks, movement };
}
