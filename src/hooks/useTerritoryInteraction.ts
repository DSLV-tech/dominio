// ─── useTerritoryInteraction ──────────────────────────────────────────────────
// Logica di interazione con i territori, condivisa da mappa 2D (SVG) e 3D.
// Calcola i bersagli validi per la fase corrente e gestisce i click
// (rinforzo → attacco → spostamento). Nessuno stato proprio: legge gameStore
// e uiStore, quindi le due mappe restano sempre sincronizzate.

import { useCallback, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { TERRITORY_DEFINITIONS } from '../data';
import { orderFromPrefs, reachableFriendly } from '../engine';
import type { PlayerId, TerritoryId, TerritoryPair, TerritoryVariant } from '../types';

export interface TerritoryInteraction {
  readonly currentPlayerId: PlayerId | null;
  /** true se tocca a un umano: i click sulla mappa sono attivi. */
  readonly isHumanTurn: boolean;
  readonly attackable: ReadonlySet<TerritoryId>;
  readonly moveable: ReadonlySet<TerritoryId>;
  readonly highlightPairs: ReadonlyArray<TerritoryPair>;
  readonly getVariant: (id: TerritoryId) => TerritoryVariant;
  readonly handleClick: (id: TerritoryId) => void;
  readonly handleHover: (id: TerritoryId | null) => void;
  readonly clearSelection: () => void;
}

const EMPTY: ReadonlySet<TerritoryId> = new Set<TerritoryId>();

export function useTerritoryInteraction(): TerritoryInteraction {
  const game                = useGameStore(s => s.game);
  const placeReinforcement  = useGameStore(s => s.placeReinforcement);
  const attackTerritory     = useGameStore(s => s.attackTerritory);
  const moveTroops          = useGameStore(s => s.moveTroops);
  const reinforcementBudget = useGameStore(s => s.reinforcementBudget);

  const attackFromId        = useUIStore(s => s.attackFromId);
  const attackToId          = useUIStore(s => s.attackToId);
  const eventTargeting      = useUIStore(s => s.eventTargeting);
  const patchEventTargeting = useUIStore(s => s.patchEventTargeting);
  const setAttackTo         = useUIStore(s => s.setAttackTo);
  const attackPrefs         = useUIStore(s => s.attackPrefs);
  const moveFromId          = useUIStore(s => s.moveFromId);
  const selectedTerritoryId = useUIStore(s => s.selectedTerritoryId);
  const stagingTroops       = useUIStore(s => s.stagingTroops);
  const setAttackFrom       = useUIStore(s => s.setAttackFrom);
  const setMoveFrom         = useUIStore(s => s.setMoveFrom);
  const selectTerritory     = useUIStore(s => s.selectTerritory);
  const hoverTerritory      = useUIStore(s => s.hoverTerritory);

  const currentPlayer   = game ? game.players[game.currentPlayerIndex] ?? null : null;
  const currentPlayerId = currentPlayer?.id ?? null;
  const isHumanTurn     = !!currentPlayer && !currentPlayer.isAI && game?.phase !== 'GAME_OVER';
  const phase           = game?.phase ?? null;
  const territories     = game?.territories ?? null;
  const movementRule    = game?.movementRule ?? null;

  const attackable = useMemo<ReadonlySet<TerritoryId>>(() => {
    if (phase !== 'ATTACK' || !attackFromId || !territories) return EMPTY;
    return new Set(
      TERRITORY_DEFINITIONS[attackFromId].connections.filter(id => {
        const t = territories[id];
        return t.ownerId !== currentPlayerId && t.troops > 0;
      }),
    );
  }, [phase, attackFromId, territories, currentPlayerId]);

  const moveable = useMemo<ReadonlySet<TerritoryId>>(() => {
    if (phase !== 'MOVEMENT' || !moveFromId || !territories || !currentPlayerId || !movementRule) return EMPTY;
    return reachableFriendly({ territories, movementRule }, moveFromId, currentPlayerId);
  }, [phase, moveFromId, territories, currentPlayerId, movementRule]);

  const highlightPairs = useMemo<ReadonlyArray<TerritoryPair>>(() => {
    if (attackFromId) return [...attackable].map(to => [attackFromId, to] as const);
    if (moveFromId)   return [...moveable].map(to => [moveFromId, to] as const);
    return [];
  }, [attackFromId, moveFromId, attackable, moveable]);

  // Passo "territorio" di una carta evento: i bersagli validi si illuminano
  const targetingTerritories = eventTargeting && eventTargeting.spec.steps[eventTargeting.step] === 'territory'
    ? eventTargeting.spec.territories
    : null;
  const pickedTarget = eventTargeting?.ctx.targetTerritoryId ?? null;

  const getVariant = useCallback((id: TerritoryId): TerritoryVariant => {
    if (!territories) return 'neutral';
    if (targetingTerritories) {
      if (id === pickedTarget) return 'selected';
      if (targetingTerritories.has(id)) return 'targetable';
    }
    if (id === attackFromId || id === attackToId || id === moveFromId || id === selectedTerritoryId) return 'selected';
    if (attackable.has(id)) return 'attackable';
    if (moveable.has(id))   return 'moveable';
    const ownerId = territories[id].ownerId;
    if (!ownerId) return 'neutral';
    return ownerId !== currentPlayerId ? 'enemy' : 'default';
  }, [territories, targetingTerritories, pickedTarget, attackFromId, attackToId, moveFromId, selectedTerritoryId, attackable, moveable, currentPlayerId]);

  const clearSelection = useCallback(() => {
    setAttackFrom(null);
    setAttackTo(null);
    setMoveFrom(null);
    selectTerritory(null);
  }, [setAttackFrom, setAttackTo, setMoveFrom, selectTerritory]);

  const handleClick = useCallback((tid: TerritoryId) => {
    if (!game || !isHumanTurn || game.pendingAttack || game.pendingOccupation) return;
    if (targetingTerritories) {
      if (targetingTerritories.has(tid)) patchEventTargeting({ targetTerritoryId: tid });
      return;
    }
    const territory = game.territories[tid];
    const mine = territory.ownerId === currentPlayerId;

    if (game.phase === 'REINFORCEMENT') {
      if (mine && reinforcementBudget > 0) placeReinforcement(tid, stagingTroops);
      return;
    }

    if (game.phase === 'ATTACK') {
      if (attackFromId && tid !== attackFromId && attackable.has(tid)) {
        if (attackPrefs.confirmEachAttack) { setAttackTo(tid === attackToId ? null : tid); return; }
        const me = game.players[game.currentPlayerIndex]!;
        attackTerritory(orderFromPrefs(attackPrefs, attackFromId, tid, game.territories[attackFromId].troops, me.factionId));
        // la fonte resta selezionata se può ancora attaccare
        const after = useGameStore.getState().game;
        if (!after || after.territories[attackFromId].troops < 2 || after.territories[attackFromId].ownerId !== currentPlayerId) clearSelection();
        return;
      }
      if (tid === attackFromId) { clearSelection(); return; }
      if (mine && territory.troops >= 2) { setAttackFrom(tid); setAttackTo(null); selectTerritory(tid); }
      return;
    }

    if (game.phase === 'MOVEMENT') {
      if (moveFromId && tid !== moveFromId && moveable.has(tid)) {
        moveTroops(moveFromId, tid, stagingTroops);
        clearSelection();
        return;
      }
      if (tid === moveFromId) { clearSelection(); return; }
      if (mine && territory.troops >= 2) { setMoveFrom(tid); selectTerritory(tid); }
    }
  }, [
    game, isHumanTurn, currentPlayerId, targetingTerritories, patchEventTargeting, reinforcementBudget, stagingTroops,
    attackFromId, attackToId, attackPrefs, moveFromId, attackable, moveable,
    placeReinforcement, attackTerritory, moveTroops,
    setAttackFrom, setAttackTo, setMoveFrom, selectTerritory, clearSelection,
  ]);

  const handleHover = useCallback((id: TerritoryId | null) => hoverTerritory(id), [hoverTerritory]);

  return {
    currentPlayerId, isHumanTurn, attackable, moveable, highlightPairs,
    getVariant, handleClick, handleHover, clearSelection,
  };
}
