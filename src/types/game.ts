// ─── Core Game State Types ────────────────────────────────────────────────────

import type { TerritoryId } from './map';
import type { Card, TerritoryCard, EventCard, ActiveEffect, PlayedEvent } from './cards';
import type { AttackMode, CombatRoundLog, PendingOccupation } from './combat';
import type { Player, PlayerId } from './player';

export type GamePhase =
  | 'SETUP'
  | 'REINFORCEMENT'
  | 'ATTACK'
  | 'MOVEMENT'
  | 'EVENT_PHASE'
  | 'GAME_OVER';

export type VictoryCondition =
  | 'TOTAL_DOMINATION'
  | 'POLITICAL_CONTROL'
  | 'ELIMINATION';

export interface TerritoryState {
  readonly territoryId: TerritoryId;
  ownerId: PlayerId | null;
  troops: number;
}

// ─── Pending attack — tracks an in-progress combat ───────────────────────────

export interface PendingAttack {
  readonly fromId: TerritoryId;
  readonly toId: TerritoryId;
  readonly attackDice: number;
  attackerLosses: number;
  defenderLosses: number;
  readonly rolls: {
    attacker: readonly number[];
    defender: readonly number[];
  };
  conquered: boolean;
  /** Proprietario del territorio PRIMA dell'attacco (null = neutrale). */
  readonly defenderId?: PlayerId | null;
  /** 'blitz' = più lanci risolti insieme; rolls è l'ultimo lancio, le perdite sono i totali. */
  readonly mode: AttackMode;
  /** Tutti i lanci dell'attacco (uno solo in modalità 'single'). */
  readonly rounds: readonly CombatRoundLog[];
}

// ─── Game Config (before game starts) ────────────────────────────────────────

export type PlayerCount = 2 | 3 | 4;

/** 'adjacent' = solo territori vicini; 'chain' = lungo catene di territori propri. */
export type MovementRule = 'adjacent' | 'chain';

export interface GameConfig {
  readonly playerCount: PlayerCount;
  readonly players: ReadonlyArray<{
    readonly name: string;
    readonly factionId: import('./player').FactionId;
    readonly isAI: boolean;
  }>;
  /** Default 'adjacent'. */
  readonly movementRule?: MovementRule;
}

// ─── Full game state ──────────────────────────────────────────────────────────

export interface GameState {
  readonly id: string;
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;

  readonly players: readonly Player[];
  territories: Record<TerritoryId, TerritoryState>;

  decks: {
    territory: TerritoryCard[];
    event: EventCard[];
    discard: TerritoryCard[];
  };

  hands: Record<PlayerId, Card[]>;

  /** How many sets have been cashed globally (for escalation) */
  setsCashedCount: number;

  /**
   * How many consecutive turns each player has held Piazza Grande (CS1).
   * Used for POLITICAL_CONTROL win condition.
   */
  piazzaHoldCount: Record<PlayerId, number>;

  /** Whether the current player has conquered at least one territory this turn */
  conqueredThisTurn: boolean;

  /** Currently resolved attack (for UI animation) */
  pendingAttack: PendingAttack | null;

  /** Ultimo evento giocato (per Gazzetta e riepiloghi). */
  lastEvent: PlayedEvent | null;

  /** Regola di spostamento scelta a inizio partita. */
  readonly movementRule: MovementRule;

  /** Dopo una conquista umana: scelta di quante truppe far entrare. */
  pendingOccupation: PendingOccupation | null;

  /** Active multi-turn effects from event cards */
  activeEffects: ActiveEffect[];

  winner: PlayerId | null;
  victoryCondition: VictoryCondition | null;
}
