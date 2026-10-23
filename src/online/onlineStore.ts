// ─── Online Store (Zustand) ───────────────────────────────────────────────────
// Stanza corrente, utente anonimo e il ponte tra gameStore e la stanza.
//
// Sincronizzazione — "scrive chi ha il turno":
//  - il motore e i dadi girano solo sul dispositivo che sta giocando (l'umano
//    di turno, o chi ha creato la stanza per le CPU);
//  - dopo ogni sua modifica quel dispositivo scrive lo stato completo
//    (raggruppando le modifiche ravvicinate) con una versione crescente;
//  - gli altri applicano ogni versione nuova al proprio gameStore e guardano.
// Così i tiri di dadi e le carte pescate sono identici per tutti senza dover
// rendere deterministico il motore.

import { create } from 'zustand';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import type { GameConfig, GameState, MovementRule, PlayerCount, FactionId } from '../types';
import { clearInviteFromUrl, makeRoomCode, readInviteCode } from './codes';
import { drivesIndex, isLocalTurn, type OnlineSeat } from './control';
import { transport } from './transport';
import { parseSyncedState, RoomError, type RoomDoc, type Seat } from './types';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface SeatDraft {
  readonly kind: 'host' | 'friend' | 'cpu';
  readonly name: string;
  readonly factionId: FactionId;
}

export interface RoomDraft {
  readonly movementRule: MovementRule;
  /** Il posto 0 è sempre di chi crea la stanza. */
  readonly seats: readonly SeatDraft[];
}

type OnlinePhase = 'idle' | 'busy' | 'room';

interface OnlineStore {
  /** Esiste un trasporto (Firebase configurato, o prova locale in sviluppo). */
  readonly available: boolean;
  readonly isLocalTransport: boolean;
  phase: OnlinePhase;
  uid: string | null;
  room: RoomDoc | null;
  error: string | null;
  /** Codice letto dal link d'invito, finché non si entra o si rinuncia. */
  inviteCode: string | null;
  /** Rientro automatico nella stanza salvata dopo una ricarica. */
  resuming: boolean;

  createRoom: (draft: RoomDraft) => Promise<void>;
  joinRoom: (code: string, name: string) => Promise<void>;
  /** Chi ha creato la stanza avvia la partita quando i posti sono pieni. */
  startMatch: () => void;
  /** Esce dalla stanza su questo dispositivo (con il link si può rientrare). */
  leave: () => void;
  /** Chi ha creato la stanza la chiude prima di iniziare. */
  cancelRoom: () => Promise<void>;
  dismissInvite: () => void;
  clearError: () => void;
}

// ─── Sessione salvata (per rientrare dopo una ricarica) ───────────────────────

const SESSION_KEY = 'dominio.online';

function saveSession(code: string): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ code, kind: transport?.kind })); } catch { /* storage non disponibile */ }
}

function loadSession(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || !('code' in v) || !('kind' in v)) return null;
    return typeof v.code === 'string' && v.kind === transport?.kind ? v.code : null;
  } catch {
    return null;
  }
}

function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage non disponibile */ }
}

function messageOf(error: unknown): string {
  if (error instanceof RoomError || error instanceof Error) return error.message;
  return 'Qualcosa è andato storto. Riprova.';
}

export function allSeatsTaken(room: RoomDoc): boolean {
  return room.seats.every(s => s.kind === 'cpu' || s.uid !== null);
}

export function configFromRoom(room: RoomDoc): GameConfig {
  return {
    playerCount: room.seats.length as PlayerCount,
    players: room.seats.map(s => ({ name: s.name, factionId: s.factionId, isAI: s.kind === 'cpu' })),
    movementRule: room.movementRule,
  };
}

// ─── Ponte gameStore ⇄ stanza ─────────────────────────────────────────────────

const FLUSH_MS = 400;   // Firestore regge circa una scrittura al secondo per documento: si raggruppa

let unwatchRoom: (() => void) | null = null;
let unsubGame: (() => void) | null = null;
/** true mentre si applica uno stato arrivato da fuori: non va riscritto. */
let applying = false;
/** Versione più alta applicata o scritta da questo dispositivo. */
let localVersion = 0;
let lastJson: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let writing = false;
let dirty = false;

function stopSync(): void {
  unwatchRoom?.();
  unsubGame?.();
  unwatchRoom = null;
  unsubGame = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  dirty = false;
  writing = false;
  localVersion = 0;
  lastJson = null;
}

/** Conserva l'oggetto dello scontro in corso se non è cambiato: il modale non riparte. */
function keepPendingAttack(before: GameState | null, next: GameState): GameState {
  if (!before?.pendingAttack || !next.pendingAttack) return next;
  return JSON.stringify(before.pendingAttack) === JSON.stringify(next.pendingAttack)
    ? { ...next, pendingAttack: before.pendingAttack }
    : next;
}

export const useOnlineStore = create<OnlineStore>((set, get) => {
  const seatOf = (): OnlineSeat | null => {
    const { room, uid } = get();
    return room && uid ? { room, uid } : null;
  };

  function applyRemote(room: RoomDoc): void {
    if (!room.state || room.version <= localVersion) return;
    const parsed = parseSyncedState(room.state);
    if (!parsed) return;
    localVersion = room.version;
    lastJson = room.state;
    const online = seatOf();
    const before = useGameStore.getState().game;
    const wasMine = before ? isLocalTurn(before, online) : false;
    applying = true;
    try {
      useGameStore.setState({ game: keepPendingAttack(before, parsed.game), reinforcementBudget: parsed.reinforcementBudget });
    } finally {
      applying = false;
    }
    const nowMine = isLocalTurn(parsed.game, online) && parsed.game.phase !== 'GAME_OVER';
    if (nowMine && !wasMine) {
      useUIStore.getState().showNotification('Tocca a te!', 3500);
      try { navigator.vibrate?.(180); } catch { /* non supportato */ }
    }
  }

  async function flush(): Promise<void> {
    flushTimer = null;
    if (!dirty || writing || !transport) return;
    dirty = false;
    const { room, uid } = get();
    const { game, reinforcementBudget } = useGameStore.getState();
    if (!room || !uid || !game) return;
    const json = JSON.stringify({ game, reinforcementBudget });
    if (json === lastJson) return;
    const version = Math.max(localVersion, room.version) + 1;
    localVersion = version;
    lastJson = json;
    writing = true;
    let failed = false;
    try {
      await transport.writeState(room.code, uid, json, version);
      if (get().error?.startsWith('Mossa non inviata')) set({ error: null });
    } catch (e) {
      failed = true;
      set({ error: `Mossa non inviata: ${messageOf(e)}` });
      dirty = true; // riprova con lo stato più recente
      lastJson = null;
    } finally {
      writing = false;
      // modifiche arrivate durante la scrittura, o nuovo tentativo dopo un errore
      if (dirty && !flushTimer) flushTimer = setTimeout(() => void flush(), failed ? FLUSH_MS * 8 : FLUSH_MS);
    }
  }

  function scheduleFlush(): void {
    dirty = true;
    if (!flushTimer && !writing) flushTimer = setTimeout(() => void flush(), FLUSH_MS);
  }

  function enterRoom(code: string): void {
    if (!transport) return;
    stopSync();
    unwatchRoom = transport.watchRoom(
      code,
      room => {
        const { uid } = get();
        if (!room || !uid || !room.members.includes(uid)) {
          // stanza chiusa, o non ne facciamo (più) parte
          const wasInGame = get().room !== null && useGameStore.getState().game !== null;
          stopSync();
          clearSession();
          set({ room: null, phase: 'idle', resuming: false, error: room ? null : 'La stanza è stata chiusa.' });
          if (wasInGame) useGameStore.getState().resetGame();
          return;
        }
        set({ room, phase: 'room', resuming: false });
        applyRemote(room);
      },
      error => set({ error: messageOf(error) }),
    );
    unsubGame = useGameStore.subscribe((next, prev) => {
      if (applying || !next.game) return;
      if (next.game === prev.game && next.reinforcementBudget === prev.reinforcementBudget) return;
      const online = seatOf();
      if (!online) return;
      // scrive chi stava giocando PRIMA della modifica (fine turno compresa);
      // la prima scrittura (avvio partita) spetta a chi ha creato la stanza
      const actor = prev.game ? drivesIndex(online, prev.game.currentPlayerIndex) : online.uid === online.room.hostUid;
      if (actor) scheduleFlush();
    });
  }

  // Rientro automatico: link d'invito, oppure stanza salvata
  const inviteCode = transport ? readInviteCode() : null;
  const saved = transport && !inviteCode ? loadSession() : null;
  const resumeWith = transport;
  if (saved && resumeWith) {
    queueMicrotask(() => {
      resumeWith.signIn()
        .then(uid => { set({ uid }); enterRoom(saved); })
        .catch(e => set({ phase: 'idle', resuming: false, error: messageOf(e) }));
    });
  }

  return {
    available: transport !== null,
    isLocalTransport: transport?.kind === 'local',
    phase: saved ? 'busy' : 'idle',
    uid: null,
    room: null,
    error: null,
    inviteCode,
    resuming: saved !== null,

    createRoom: async (draft) => {
      if (!transport) return;
      set({ phase: 'busy', error: null });
      try {
        const uid = await transport.signIn();
        const seats: Seat[] = draft.seats.map((s, i) => ({ ...s, kind: i === 0 ? 'host' : s.kind, uid: i === 0 ? uid : null }));
        let room: RoomDoc | null = null;
        for (let attempt = 0; attempt < 4 && !room; attempt++) {
          const candidate: RoomDoc = {
            code: makeRoomCode(), hostUid: uid, status: 'lobby', movementRule: draft.movementRule,
            seats, members: [uid], version: 0, state: null, writer: null,
          };
          try {
            await transport.createRoom(candidate);
            room = candidate;
          } catch (e) {
            if (!(e instanceof RoomError && e.code === 'exists')) throw e;
          }
        }
        if (!room) throw new RoomError('exists', 'Non trovo un codice libero, riprova.');
        saveSession(room.code);
        set({ uid, room, phase: 'room' });
        enterRoom(room.code);
      } catch (e) {
        set({ phase: 'idle', error: messageOf(e) });
      }
    },

    joinRoom: async (code, name) => {
      if (!transport) return;
      set({ phase: 'busy', error: null });
      try {
        const uid = await transport.signIn();
        const room = await transport.claimSeat(code, uid, name.trim() || 'Amico');
        saveSession(room.code);
        clearInviteFromUrl();
        set({ uid, room, phase: 'room', inviteCode: null });
        enterRoom(room.code);
      } catch (e) {
        set({ phase: 'idle', error: messageOf(e) });
      }
    },

    startMatch: () => {
      const { room, uid } = get();
      if (!room || room.hostUid !== uid || room.status !== 'lobby' || !allSeatsTaken(room)) return;
      useGameStore.getState().startGame(configFromRoom(room));
    },

    leave: () => {
      stopSync();
      clearSession();
      set({ room: null, phase: 'idle', resuming: false, error: null });
      useGameStore.getState().resetGame();
    },

    cancelRoom: async () => {
      const { room, uid } = get();
      if (!transport || !room) return;
      stopSync();
      clearSession();
      set({ room: null, phase: 'idle' });
      if (room.hostUid === uid) {
        try { await transport.deleteRoom(room.code); } catch { /* resta orfana: nessun danno */ }
      }
    },

    dismissInvite: () => {
      clearInviteFromUrl();
      set({ inviteCode: null, error: null });
    },

    clearError: () => set({ error: null }),
  };
});
