// ─── Game Initialization ──────────────────────────────────────────────────────

import type {
  GameState, GameConfig, Player, TerritoryState, TerritoryId,
} from '../types';
import { TERRITORY_DEFINITIONS, TERRITORY_CARDS, EVENT_CARDS, EVENT_CARDS_2P } from '../data';

// ─── Shuffle utility ──────────────────────────────────────────────────────────

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function uuid(): string {
  return Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
}

// ─── Initial troops by player count ──────────────────────────────────────────

const INITIAL_TROOPS: Record<number, number> = {
  2: 40,
  3: 35,
  4: 30,
};

// ─── Territory assignment ─────────────────────────────────────────────────────

function assignTerritories(
  players: Player[],
): Record<TerritoryId, TerritoryState> {
  const allIds = Object.keys(TERRITORY_DEFINITIONS) as TerritoryId[];
  const shuffled = shuffle(allIds);

  const territories: Partial<Record<TerritoryId, TerritoryState>> = {};

  // Each player gets a guaranteed starting zone territory
  const zoneMap: Record<string, TerritoryId[]> = {};
  for (const [id, def] of Object.entries(TERRITORY_DEFINITIONS)) {
    (zoneMap[def.zone] ??= []).push(id as TerritoryId);
  }

  const assigned = new Set<TerritoryId>();

  // 1. Assign starting zone territories (first 2 per player)
  for (const player of players) {
    const zoneTerritories = shuffle(zoneMap[player.factionId === 'BIANCHI' ? 'CS'
      : player.factionId === 'MANO_NERA' ? 'PV'
      : player.factionId === 'STRADA' ? 'SE'
      : 'CR'] ?? []);

    let count = 0;
    for (const tid of zoneTerritories) {
      if (count >= 2) break;
      if (!assigned.has(tid)) {
        territories[tid] = { territoryId: tid, ownerId: player.id, troops: 1 };
        assigned.add(tid);
        count++;
      }
    }
  }

  // 2. Distribute remaining territories round-robin
  const remaining = shuffled.filter(id => !assigned.has(id));
  let pi = 0;
  for (const tid of remaining) {
    const player = players[pi % players.length]!;
    territories[tid] = { territoryId: tid, ownerId: player.id, troops: 1 };
    pi++;
  }

  return territories as Record<TerritoryId, TerritoryState>;
}

// ─── Distribute initial troops ────────────────────────────────────────────────

function distributeInitialTroops(
  territories: Record<TerritoryId, TerritoryState>,
  players: Player[],
  totalTroops: number,
): Record<TerritoryId, TerritoryState> {
  const result = { ...territories };

  for (const player of players) {
    const owned = Object.keys(result).filter(
      id => result[id as TerritoryId].ownerId === player.id
    ) as TerritoryId[];

    // Troops to distribute = total - already placed (1 per territory)
    const toPlace = totalTroops - owned.length;
    let remaining = toPlace;

    // Simple random distribution: add 1 at a time to random owned territory
    while (remaining > 0) {
      const tid = owned[Math.floor(Math.random() * owned.length)]!;
      result[tid] = { ...result[tid]!, troops: result[tid]!.troops + 1 };
      remaining--;
    }
  }

  return result;
}

// ─── Main factory ─────────────────────────────────────────────────────────────

export function createInitialGameState(config: GameConfig): GameState {
  const players: Player[] = config.players.map((p, i) => ({
    id: uuid(),
    name: p.name,
    factionId: p.factionId,
    isAI: p.isAI,
    isEliminated: false,
    barricades: {},
    // index used only during setup
    _setupIndex: i,
  })) as unknown as Player[];

  const totalTroops = INITIAL_TROOPS[config.playerCount] ?? 30;

  const territories = distributeInitialTroops(
    assignTerritories(players),
    players,
    totalTroops,
  );

  const eventDeck = config.playerCount === 2
    ? shuffle(EVENT_CARDS_2P)
    : shuffle(EVENT_CARDS);

  const hands: Record<string, never[]> = {};
  for (const p of players) {
    hands[p.id] = [];
  }

  const piazzaHoldCount: Record<string, number> = {};
  for (const p of players) {
    piazzaHoldCount[p.id] = 0;
  }

  return {
    id: uuid(),
    phase: 'REINFORCEMENT',
    round: 1,
    currentPlayerIndex: 0,
    players,
    territories,
    decks: {
      territory: shuffle(TERRITORY_CARDS),
      event: eventDeck,
      discard: [],
    },
    hands,
    setsCashedCount: 0,
    piazzaHoldCount,
    conqueredThisTurn: false,
    pendingAttack: null,
    pendingOccupation: null,
    lastEvent: null,
    movementRule: config.movementRule ?? 'adjacent',
    activeEffects: [],
    winner: null,
    victoryCondition: null,
  };
}
