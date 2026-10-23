// ─── Trasporto Firebase ───────────────────────────────────────────────────────
// Accesso anonimo (Firebase Auth) + un documento Firestore per stanza.
// L'SDK (~300 KB) si scarica solo quando si gioca online: import dinamici.
// Configurazione da .env.local (vedi .env.example e scripts/firebase-setup.sh).

import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { parseRoom, RoomError, type RoomTransport } from './types';

interface FirebaseConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
  readonly storageBucket?: string;
  readonly messagingSenderId?: string;
}

function readConfig(): FirebaseConfig | null {
  const env = import.meta.env;
  const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_AUTH_DOMAIN: authDomain, VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: appId } = env;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey, authDomain, projectId, appId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

type FirestoreModule = typeof import('firebase/firestore');
type AuthModule = typeof import('firebase/auth');

interface Loaded {
  readonly auth: Auth;
  readonly db: Firestore;
  readonly fs: FirestoreModule;
  readonly fa: AuthModule;
}

let loading: Promise<Loaded> | null = null;

function load(): Promise<Loaded> {
  loading ??= (async () => {
    const config = readConfig();
    if (!config) throw new RoomError('unavailable', 'Il gioco online non è configurato.');
    const [{ initializeApp }, fa, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(config);
    const auth = fa.getAuth(app);
    const db = fs.getFirestore(app);
    const emulator = import.meta.env.VITE_FIREBASE_EMULATOR_HOST;
    if (emulator) {
      fa.connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
      fs.connectFirestoreEmulator(db, emulator, 8080);
    }
    return { auth, db, fs, fa };
  })();
  // un errore di rete non deve bloccare per sempre i tentativi successivi
  loading.catch(() => { loading = null; });
  return loading;
}

function toRoomError(error: unknown): Error {
  if (error instanceof RoomError) return error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'unavailable' || code.includes('network')) {
    return new RoomError('unavailable', 'Connessione assente: riprova quando sei online.');
  }
  if (code === 'permission-denied') {
    return new RoomError('unavailable', 'La stanza non accetta questa operazione.');
  }
  return error instanceof Error ? error : new Error(String(error));
}

export const firebaseTransport: RoomTransport = {
  kind: 'firebase',

  async signIn() {
    try {
      const { auth, fa } = await load();
      await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser.uid;
      const cred = await fa.signInAnonymously(auth);
      return cred.user.uid;
    } catch (e) {
      throw toRoomError(e);
    }
  },

  async createRoom(room) {
    try {
      const { db, fs } = await load();
      const ref = fs.doc(db, 'rooms', room.code);
      await fs.runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (snap.exists()) throw new RoomError('exists', 'Codice già in uso.');
        tx.set(ref, { ...room, updatedAt: fs.serverTimestamp() });
      });
    } catch (e) {
      throw toRoomError(e);
    }
  },

  async claimSeat(code, uid, name) {
    try {
      const { db, fs } = await load();
      const ref = fs.doc(db, 'rooms', code);
      return await fs.runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        const room = snap.exists() ? parseRoom(snap.data()) : null;
        if (!room) throw new RoomError('not-found', 'Stanza non trovata.');
        if (room.members.includes(uid)) return room;
        if (room.status !== 'lobby') throw new RoomError('started', 'La partita è già iniziata.');
        const free = room.seats.findIndex(s => s.kind === 'friend' && s.uid === null);
        if (free < 0) throw new RoomError('full', 'La stanza è al completo.');
        const seats = room.seats.map((s, i) => (i === free ? { ...s, uid, name } : s));
        const members = [...room.members, uid];
        tx.update(ref, { seats, members, updatedAt: fs.serverTimestamp() });
        return { ...room, seats, members };
      });
    } catch (e) {
      throw toRoomError(e);
    }
  },

  watchRoom(code, onRoom, onError) {
    let unsubscribe: (() => void) | null = null;
    let stopped = false;
    load()
      .then(({ db, fs }) => {
        if (stopped) return;
        unsubscribe = fs.onSnapshot(
          fs.doc(db, 'rooms', code),
          snap => onRoom(snap.exists() ? parseRoom(snap.data()) : null),
          err => onError(toRoomError(err)),
        );
      })
      .catch(e => onError(toRoomError(e)));
    return () => { stopped = true; unsubscribe?.(); };
  },

  async writeState(code, uid, state, version) {
    try {
      const { db, fs } = await load();
      await fs.updateDoc(fs.doc(db, 'rooms', code), {
        state, version, writer: uid, status: 'playing', updatedAt: fs.serverTimestamp(),
      });
    } catch (e) {
      throw toRoomError(e);
    }
  },

  async deleteRoom(code) {
    try {
      const { db, fs } = await load();
      await fs.deleteDoc(fs.doc(db, 'rooms', code));
    } catch (e) {
      throw toRoomError(e);
    }
  },
};
