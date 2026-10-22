// ─── Game Store (Zustand) ─────────────────────────────────────────────────────
// Holds the full game state and all game actions.
// Why Zustand: flat API, minimal boilerplate, perfect for complex mutable state
// with many small actions. No need for reducers or selectors wrappers.

import { create } from 'zustand';
import type {
  GameState, GameConfig, TerritoryId, PlayerId, Card, TerritoryCard, EventCardId, AttackOrder,
} from '../types';
import { isTerritoryCard } from '../types';
import {
  createInitialGameState,
  resolveAttackOrder,
  isEffect,
  reachableFriendly,
  clampAttackDice,
  validateAttack,
  calculateReinforcements,
  checkVictory,
  updatePiazzaHold,
  getEliminatedPlayerIds,
  resolveEventCard,
} from '../engine';
import type { EventCardContext } from '../engine';
import { getSetBonus } from '../data';

// ─── Store shape ──────────────────────────────────────────────────────────────

interface GameStore {
  game: GameState | null;

  // Lifecycle
  startGame: (config: GameConfig) => void;
  resetGame: () => void;

  // Reinforcement phase
  placeReinforcement: (territoryId: TerritoryId, count: number) => void;
  confirmReinforcements: () => void;

  // Card management
  cashCardSet: (cardIds: [string, string, string]) => void;
  playEventCard: (cardId: string, eventId: EventCardId, ctx: EventCardContext) => string;

  // Attack phase
  attackTerritory: (order: AttackOrder) => void;
  /** Dopo una conquista umana: porta nel territorio preso `count` truppe in totale. */
  occupy: (count: number) => void;
  confirmAttack: () => void; // after seeing dice result, advance state
  endAttackPhase: () => void;

  // Movement phase
  moveTroops: (fromId: TerritoryId, toId: TerritoryId, count: number) => void;
  endMovementPhase: () => void;

  // Turn management
  endTurn: () => void;

  // Pending reinforcement budget (troops left to place)
  reinforcementBudget: number;
  setReinforcementBudget: (n: number) => void;
}

// ─── Helper: draw a card from the territory deck ──────────────────────────────

function drawTerritoryCard(state: GameState, playerId: PlayerId): GameState {
  if (state.decks.territory.length === 0) {
    // Reshuffle discard
    const reshuffled = [...state.decks.discard].sort(() => Math.random() - 0.5);
    state = { ...state, decks: { ...state.decks, territory: reshuffled, discard: [] } };
  }
  const [drawn, ...rest] = state.decks.territory;
  if (!drawn) return state;

  const hand = [...(state.hands[playerId] ?? []), drawn];
  return {
    ...state,
    decks: { ...state.decks, territory: rest },
    hands: { ...state.hands, [playerId]: hand },
  };
}

// ─── Helper: next player index ─────────────────────────────────────────────────

function nextActivePlayerIndex(state: GameState): number {
  const { players, currentPlayerIndex } = state;
  let next = (currentPlayerIndex + 1) % players.length;
  let attempts = 0;
  while (players[next]?.isEliminated && attempts < players.length) {
    next = (next + 1) % players.length;
    attempts++;
  }
  return next;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  reinforcementBudget: 0,

  startGame: (config) => {
    const game = createInitialGameState(config);
    const currentPlayer = game.players[game.currentPlayerIndex]!;
    const budget = calculateReinforcements(currentPlayer.id, game);
    set({ game, reinforcementBudget: budget });
  },

  resetGame: () => set({ game: null, reinforcementBudget: 0 }),

  // ── Reinforcement Phase ────────────────────────────────────────────────────

  setReinforcementBudget: (n) => set({ reinforcementBudget: n }),

  placeReinforcement: (territoryId, count) => {
    const { game, reinforcementBudget } = get();
    if (!game || game.phase !== 'REINFORCEMENT') return;

    const territory = game.territories[territoryId];
    const currentPlayer = game.players[game.currentPlayerIndex]!;
    if (territory.ownerId !== currentPlayer.id) return;

    const actual = Math.min(count, reinforcementBudget);
    if (actual <= 0) return;

    set({
      reinforcementBudget: reinforcementBudget - actual,
      game: {
        ...game,
        territories: {
          ...game.territories,
          [territoryId]: { ...territory, troops: territory.troops + actual },
        },
      },
    });
  },

  confirmReinforcements: () => {
    const { game } = get();
    if (!game || game.phase !== 'REINFORCEMENT') return;
    set({ game: { ...game, phase: 'ATTACK' } });
  },

  // ── Card Set Cashing ───────────────────────────────────────────────────────

  cashCardSet: ([id1, id2, id3]) => {
    const { game } = get();
    if (!game || game.phase !== 'REINFORCEMENT') return;

    const currentPlayer = game.players[game.currentPlayerIndex]!;
    const hand = game.hands[currentPlayer.id] ?? [];

    const cards = [id1, id2, id3].map(id => hand.find(c => c.id === id)).filter(Boolean) as Card[];
    if (cards.length !== 3 || !cards.every(isTerritoryCard)) return;

    const territoryCards = cards as TerritoryCard[];
    const symbols = territoryCards.map(c => c.symbol) as [import('../types').CardSymbol, import('../types').CardSymbol, import('../types').CardSymbol];

    const troops = getSetBonus(symbols, game.setsCashedCount);
    const newHand = hand.filter(c => ![id1, id2, id3].includes(c.id));
    const discard = [...game.decks.discard, ...territoryCards];

    const { reinforcementBudget } = get();

    set({
      reinforcementBudget: reinforcementBudget + troops,
      game: {
        ...game,
        setsCashedCount: game.setsCashedCount + 1,
        hands: { ...game.hands, [currentPlayer.id]: newHand },
        decks: { ...game.decks, discard },
      },
    });
  },

  // ── Event Card ─────────────────────────────────────────────────────────────

  playEventCard: (cardId, eventId, ctx) => {
    const { game } = get();
    if (!game) return 'Partita non in corso.';
    const currentPlayer = game.players[game.currentPlayerIndex]!;
    const result = resolveEventCard(game, eventId, cardId, { ...ctx, playerId: currentPlayer.id });
    if (!result.needsInput) {
      set({ game: result.state });
    }
    return result.log;
  },

  // ── Attack Phase ────────────────────────────────────────────────────────────

  attackTerritory: (order) => {
    const { game } = get();
    if (!game || game.phase !== 'ATTACK' || game.pendingOccupation) return;
    const { fromId, toId } = order;

    const currentPlayer = game.players[game.currentPlayerIndex]!;
    const fromState = game.territories[fromId];
    const toState   = game.territories[toId];

    const validation = validateAttack(
      fromId, toId, fromState, toState,
      currentPlayer.id, game.activeEffects, game.round,
    );
    if (!validation.valid) return;

    const defenderPlayerId = toState.ownerId;
    const defenderPlayer = defenderPlayerId
      ? game.players.find(p => p.id === defenderPlayerId) ?? null
      : null;

    const barricade  = !!(game.players.find(p => p.id === defenderPlayerId)?.barricades[toId]);
    if (clampAttackDice(order.dice, fromState.troops, currentPlayer.factionId, fromId, toId) < 1) return;

    // Rappresaglia: primo attacco al territorio perduto = un lancio senza perdite per l'attaccante
    const freeTarget = game.activeEffects.find(
      e => isEffect(e, 'RAPPRESAGLIA_TARGET') && e.playerId === currentPlayer.id && e.territoryId === toId,
    );
    const effectiveOrder: AttackOrder = freeTarget ? { ...order, mode: 'single' } : order;

    const rawResult = resolveAttackOrder(effectiveOrder, {
      fromTroops: fromState.troops,
      toTroops: toState.troops,
      attackerFaction: currentPlayer.factionId,
      defenderFaction: defenderPlayer?.factionId ?? null,
      barricade,
    });
    const result = freeTarget
      ? { ...rawResult, attackerLosses: 0, rounds: rawResult.rounds.map(r => ({ ...r, attackerLosses: 0 })) }
      : rawResult;
    const lastRound = result.rounds[result.rounds.length - 1];
    const lastLosses = lastRound?.attackerLosses ?? 0;

    // Apply losses immediately. On conquest the surviving attacking dice MOVE
    // into the new territory: they must leave the source (no troop duplication).
    const movedIn = Math.max(1, result.attackDice - lastLosses);
    const newFrom = {
      ...fromState,
      troops: result.conquered
        ? Math.max(1, fromState.troops - result.attackerLosses - movedIn)
        : fromState.troops - result.attackerLosses,
    };
    const newTo   = result.conquered
      ? { ...toState, ownerId: currentPlayer.id, troops: movedIn }
      : { ...toState, troops: toState.troops - result.defenderLosses };

    // Check if defender is eliminated
    let updatedPlayers = game.players;
    const conquered = game.conqueredThisTurn || result.conquered;

    // Effetti di Rappresaglia: consumo del bersaglio usato; chi perde un territorio con la carta pronta ottiene il bersaglio
    let effects = game.activeEffects.filter(e => e !== freeTarget);
    if (result.conquered && defenderPlayerId) {
      const ready = effects.find(e => isEffect(e, 'RAPPRESAGLIA_READY') && e.playerId === defenderPlayerId);
      if (ready) {
        effects = [
          ...effects.filter(e => e !== ready),
          { type: 'RAPPRESAGLIA_TARGET', playerId: defenderPlayerId, territoryId: toId, untilTurn: game.round + 1 },
        ];
      }
    }

    if (result.conquered && defenderPlayerId) {
      const defenderTerritories = Object.values({
        ...game.territories,
        [fromId]: newFrom,
        [toId]: newTo,
      }).filter(t => t.ownerId === defenderPlayerId);

      if (defenderTerritories.length === 0) {
        updatedPlayers = game.players.map(p =>
          p.id === defenderPlayerId ? { ...p, isEliminated: true } : p
        );
        // Inherit eliminated player's cards
        const inheritedCards = game.hands[defenderPlayerId] ?? [];
        const myHand = [...(game.hands[currentPlayer.id] ?? []), ...inheritedCards];
        set({
          game: {
            ...game,
            territories: { ...game.territories, [fromId]: newFrom, [toId]: newTo },
            players: updatedPlayers,
            hands: { ...game.hands, [currentPlayer.id]: myHand, [defenderPlayerId]: [] },
            conqueredThisTurn: conquered,
            pendingAttack: { ...result, defenderId: defenderPlayerId },
            pendingOccupation: null,
            activeEffects: effects,
          },
        });
        return;
      }
    }

    // Conquista di un umano con truppe in più da scegliere: attende occupy()
    const maxOccupy = newFrom.troops + movedIn - 1;
    const pendingOccupation = result.conquered && !currentPlayer.isAI && maxOccupy > movedIn
      ? { fromId, toId, min: movedIn, max: maxOccupy }
      : null;

    set({
      game: {
        ...game,
        territories: { ...game.territories, [fromId]: newFrom, [toId]: newTo },
        players: updatedPlayers,
        conqueredThisTurn: conquered,
        pendingAttack: { ...result, defenderId: defenderPlayerId },
        pendingOccupation,
        activeEffects: effects,
      },
    });
  },

  occupy: (count) => {
    const { game } = get();
    const occ = game?.pendingOccupation;
    if (!game || !occ) return;
    const total = Math.max(occ.min, Math.min(occ.max, Math.floor(count)));
    const extra = total - occ.min;
    const from = game.territories[occ.fromId];
    const to = game.territories[occ.toId];
    set({
      game: {
        ...game,
        territories: extra > 0 ? {
          ...game.territories,
          [occ.fromId]: { ...from, troops: from.troops - extra },
          [occ.toId]: { ...to, troops: to.troops + extra },
        } : game.territories,
        pendingOccupation: null,
      },
    });
  },

  confirmAttack: () => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, pendingAttack: null } });
  },

  endAttackPhase: () => {
    const { game } = get();
    if (!game || game.phase !== 'ATTACK' || game.pendingOccupation) return;
    set({ game: { ...game, phase: 'MOVEMENT' } });
  },

  // ── Movement Phase ──────────────────────────────────────────────────────────

  moveTroops: (fromId, toId, count) => {
    const { game } = get();
    if (!game || game.phase !== 'MOVEMENT') return;

    const currentPlayer = game.players[game.currentPlayerIndex]!;
    const fromState = game.territories[fromId];
    const toState   = game.territories[toId];

    if (fromState.ownerId !== currentPlayer.id) return;
    if (toState.ownerId !== currentPlayer.id)   return;
    if (count < 1 || fromState.troops - count < 1) return; // must leave 1 behind
    if (!reachableFriendly(game, fromId, currentPlayer.id).has(toId)) return;
    set({
      game: {
        ...game,
        territories: {
          ...game.territories,
          [fromId]: { ...fromState, troops: fromState.troops - count },
          [toId]:   { ...toState,   troops: toState.troops + count },
        },
      },
    });
  },

  endMovementPhase: () => {
    const { game } = get();
    if (!game || game.phase !== 'MOVEMENT') return;
    get().endTurn();
  },

  // ── End Turn ────────────────────────────────────────────────────────────────

  endTurn: () => {
    let { game } = get();
    if (!game) return;

    const currentPlayer = game.players[game.currentPlayerIndex]!;

    // 1. Draw territory card if conquered this turn
    if (game.conqueredThisTurn) {
      game = drawTerritoryCard(game, currentPlayer.id);
    }

    // 2. Check for Porto Vecchio event card bonus
    const pvZone = ['PV1','PV2','PV3','PV4'] as TerritoryId[];
    const ownsPV = pvZone.every(tid => game!.territories[tid].ownerId === currentPlayer.id);
    if (ownsPV && game.decks.event.length > 0) {
      const [eventCard, ...rest] = game.decks.event;
      if (eventCard) {
        const hand = [...(game.hands[currentPlayer.id] ?? []), eventCard];
        game = {
          ...game,
          decks: { ...game.decks, event: rest },
          hands: { ...game.hands, [currentPlayer.id]: hand },
        };
      }
    }

    // 3. Update piazza hold counter
    const newPiazzaHold = updatePiazzaHold(game);

    // 4. Mark eliminations
    const eliminatedIds = getEliminatedPlayerIds(game);
    let updatedPlayers = game.players;
    if (eliminatedIds.length > 0) {
      updatedPlayers = game.players.map(p =>
        eliminatedIds.includes(p.id) ? { ...p, isEliminated: true } : p
      );
    }

    // 5. Check victory
    const stateForVictory: GameState = {
      ...game,
      players: updatedPlayers,
      piazzaHoldCount: newPiazzaHold,
    };
    const victoryResult = checkVictory(stateForVictory);

    if (victoryResult) {
      set({
        game: {
          ...stateForVictory,
          phase: 'GAME_OVER',
          winner: victoryResult.winner,
          victoryCondition: victoryResult.condition,
        },
      });
      return;
    }

    // 6. Advance to next player
    const nextIdx = nextActivePlayerIndex(stateForVictory);
    const isNewRound = nextIdx <= game.currentPlayerIndex;
    const nextRound  = isNewRound ? game.round + 1 : game.round;
    const nextPlayer = stateForVictory.players[nextIdx]!;
    const nextBudget = calculateReinforcements(nextPlayer.id, stateForVictory);

    // 7. Clean expired active effects
    // (il bersaglio di Rappresaglia vale solo nel turno di chi lo possiede)
    const cleanEffects = stateForVictory.activeEffects.filter(e => {
      if (isEffect(e, 'RAPPRESAGLIA_TARGET') && e.playerId === currentPlayer.id) return false;
      return 'untilTurn' in e ? e.untilTurn >= nextRound : true;
    });

    set({
      reinforcementBudget: nextBudget,
      game: {
        ...stateForVictory,
        phase: 'REINFORCEMENT',
        round: nextRound,
        currentPlayerIndex: nextIdx,
        conqueredThisTurn: false,
        pendingAttack: null,
        activeEffects: cleanEffects,
      },
    });
  },
}));
