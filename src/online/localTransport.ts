// ─── Trasporto locale (prova senza Firebase) ──────────────────────────────────
// Le stanze stanno in localStorage e le schede si avvisano con un
// BroadcastChannel: due schede dello stesso browser giocano "online" tra loro.
// Ogni scheda ha il suo uid (sessionStorage). Solo in sviluppo: vedi transport.ts.

import { parseRoom, RoomError, type RoomDoc, type RoomTransport } from './types';

const PREFIX = 'dominio.localroom.';
const UID_KEY = 'dominio.localuid';
const CHANNEL = 'dominio-rooms';

function read(code: string): RoomDoc | null {
  try {
    const raw = localStorage.getItem(PREFIX + code);
    return raw ? parseRoom(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel {
  channel ??= new BroadcastChannel(CHANNEL);
  return channel;
}

interface RoomMessage {
  readonly code: string;
  readonly room: unknown;
}

/** Listener della scheda stessa: BroadcastChannel non recapita a chi invia. */
const localListeners = new Set<(msg: RoomMessage) => void>();

function write(code: string, room: RoomDoc | null): void {
  if (room) localStorage.setItem(PREFIX + code, JSON.stringify(room));
  else localStorage.removeItem(PREFIX + code);
  // la stanza viaggia nel messaggio: nelle altre schede localStorage può
  // aggiornarsi un attimo dopo l'arrivo dell'avviso
  const msg: RoomMessage = { code, room };
  getChannel().postMessage(msg);
  // asincrono come la rete vera: niente aggiornamenti dentro il set() di Zustand
  queueMicrotask(() => localListeners.forEach(fn => fn(msg)));
}

export const localTransport: RoomTransport = {
  kind: 'local',

  async signIn() {
    let uid = sessionStorage.getItem(UID_KEY);
    if (!uid) {
      uid = `local-${crypto.randomUUID()}`;
      sessionStorage.setItem(UID_KEY, uid);
    }
    return uid;
  },

  async createRoom(room) {
    if (read(room.code)) throw new RoomError('exists', 'Codice già in uso.');
    write(room.code, room);
  },

  async claimSeat(code, uid, name) {
    const room = read(code);
    if (!room) throw new RoomError('not-found', 'Stanza non trovata.');
    if (room.members.includes(uid)) return room;
    if (room.status !== 'lobby') throw new RoomError('started', 'La partita è già iniziata.');
    const free = room.seats.findIndex(s => s.kind === 'friend' && s.uid === null);
    if (free < 0) throw new RoomError('full', 'La stanza è al completo.');
    const next: RoomDoc = {
      ...room,
      seats: room.seats.map((s, i) => (i === free ? { ...s, uid, name } : s)),
      members: [...room.members, uid],
    };
    write(code, next);
    return next;
  },

  watchRoom(code, onRoom) {
    const notify = (msg: RoomMessage) => {
      if (msg.code === code) onRoom(msg.room === null ? null : parseRoom(msg.room));
    };
    const onMessage = (e: MessageEvent<unknown>) => {
      const d = e.data;
      if (typeof d === 'object' && d !== null && 'code' in d && 'room' in d && typeof d.code === 'string') {
        notify({ code: d.code, room: d.room });
      }
    };
    const ch = getChannel();
    ch.addEventListener('message', onMessage);
    localListeners.add(notify);
    queueMicrotask(() => notify({ code, room: read(code) }));
    return () => { ch.removeEventListener('message', onMessage); localListeners.delete(notify); };
  },

  async writeState(code, uid, state, version) {
    const room = read(code);
    if (!room) throw new RoomError('not-found', 'Stanza non trovata.');
    if (version <= room.version) return; // come la regola di Firestore: niente scritture vecchie
    write(code, { ...room, state, version, writer: uid, status: 'playing' });
  },

  async deleteRoom(code) {
    write(code, null);
  },
};
