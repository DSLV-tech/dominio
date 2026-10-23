// ─── Tipi della partita online ────────────────────────────────────────────────
// Una stanza è un solo documento (Firestore `rooms/{code}`, o localStorage nel
// trasporto di prova). Contiene i posti al tavolo e, a partita iniziata, lo
// stato completo serializzato in JSON: Firestore non accetta array annidati e
// così lo stato resta identico a quello del gameStore.

import type { FactionId, GameState, MovementRule } from '../types';

/** Chi siede a un posto: chi ha creato la stanza, un amico invitato, la CPU. */
export type SeatKind = 'host' | 'friend' | 'cpu';

export interface Seat {
  readonly kind: SeatKind;
  readonly name: string;
  readonly factionId: FactionId;
  /** Utente (anonimo) seduto qui; null = posto per un amico ancora libero. */
  readonly uid: string | null;
}

export type RoomStatus = 'lobby' | 'playing';

export interface RoomDoc {
  readonly code: string;
  readonly hostUid: string;
  readonly status: RoomStatus;
  readonly movementRule: MovementRule;
  /** Stesso ordine di GameConfig.players: il posto i è game.players[i]. */
  readonly seats: readonly Seat[];
  /** uid di chi è nella stanza (serve alle regole di sicurezza). */
  readonly members: readonly string[];
  /** Cresce a ogni scrittura dello stato: chi riceve applica solo versioni nuove. */
  readonly version: number;
  /** JSON di SyncedState; null finché la partita non parte. */
  readonly state: string | null;
  /** uid dell'ultima scrittura dello stato. */
  readonly writer: string | null;
}

/** Ciò che serve a ricostruire il gameStore su un altro dispositivo. */
export interface SyncedState {
  readonly game: GameState;
  readonly reinforcementBudget: number;
}

export type RoomErrorCode = 'not-found' | 'full' | 'started' | 'exists' | 'unavailable';

export class RoomError extends Error {
  readonly code: RoomErrorCode;
  constructor(code: RoomErrorCode, message: string) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

/** Accesso alla "stanza" condivisa: Firebase in produzione, localStorage in prova. */
export interface RoomTransport {
  readonly kind: 'firebase' | 'local';
  /** Accesso anonimo; restituisce l'uid (stabile sullo stesso dispositivo). */
  signIn(): Promise<string>;
  /** Crea la stanza; RoomError('exists') se il codice è già usato. */
  createRoom(room: RoomDoc): Promise<void>;
  /**
   * Siede `uid` al primo posto libero per un amico. Se è già nella stanza
   * restituisce la stanza senza cambiarla (rientro dopo una ricarica).
   */
  claimSeat(code: string, uid: string, name: string): Promise<RoomDoc>;
  /** Segue la stanza: `onRoom(null)` se viene cancellata o non esiste. */
  watchRoom(code: string, onRoom: (room: RoomDoc | null) => void, onError: (error: Error) => void): () => void;
  /** Scrive lo stato della partita (e la porta a 'playing'). */
  writeState(code: string, uid: string, state: string, version: number): Promise<void>;
  deleteRoom(code: string): Promise<void>;
}

// ─── Lettura sicura dei documenti ─────────────────────────────────────────────

const FACTIONS: ReadonlySet<string> = new Set<FactionId>(['BIANCHI', 'MANO_NERA', 'STRADA', 'ORDINE']);
const KINDS: ReadonlySet<string> = new Set<SeatKind>(['host', 'friend', 'cpu']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseSeat(v: unknown): Seat | null {
  if (!isRecord(v)) return null;
  const { kind, name, factionId, uid } = v;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
  if (typeof name !== 'string' || typeof factionId !== 'string' || !FACTIONS.has(factionId)) return null;
  if (uid !== null && typeof uid !== 'string') return null;
  return { kind: kind as SeatKind, name, factionId: factionId as FactionId, uid };
}

/** Converte un documento letto dalla rete in RoomDoc, o null se è malformato. */
export function parseRoom(v: unknown): RoomDoc | null {
  if (!isRecord(v)) return null;
  const { code, hostUid, status, movementRule, seats, members, version, state, writer } = v;
  if (typeof code !== 'string' || typeof hostUid !== 'string') return null;
  if (status !== 'lobby' && status !== 'playing') return null;
  if (movementRule !== 'adjacent' && movementRule !== 'chain') return null;
  if (!Array.isArray(seats) || !Array.isArray(members) || typeof version !== 'number') return null;
  const parsedSeats = seats.map(parseSeat);
  if (parsedSeats.some(s => s === null)) return null;
  if (!members.every((m): m is string => typeof m === 'string')) return null;
  if (state !== null && typeof state !== 'string') return null;
  if (writer !== null && typeof writer !== 'string') return null;
  return {
    code, hostUid, status, movementRule, version, state, writer,
    seats: parsedSeats as Seat[],
    members,
  };
}

/** Lo stato arriva da un altro dispositivo: si controlla la forma essenziale. */
export function parseSyncedState(json: string): SyncedState | null {
  try {
    const v: unknown = JSON.parse(json);
    if (!isRecord(v) || typeof v.reinforcementBudget !== 'number' || !isRecord(v.game)) return null;
    const g = v.game;
    if (!Array.isArray(g.players) || !isRecord(g.territories) || typeof g.currentPlayerIndex !== 'number') return null;
    return v as unknown as SyncedState;
  } catch {
    return null;
  }
}
