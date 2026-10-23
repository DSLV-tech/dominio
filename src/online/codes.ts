// ─── Codici stanza e link d'invito ────────────────────────────────────────────

/** Niente 0/O, 1/I/L: il codice si legge e si detta senza equivoci. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
const JOIN_PARAM = 'stanza';

export function makeRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

/** Normalizza un codice scritto a mano; null se non è valido. */
export function normalizeRoomCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every(c => ALPHABET.includes(c)) ? code : null;
}

/** Parametro che in sviluppo forza il trasporto locale (vedi transport.ts). */
export const LOCAL_PARAM = 'rete';

export function inviteLink(code: string, local = false): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(JOIN_PARAM, code);
  if (local) url.searchParams.set(LOCAL_PARAM, 'locale');
  return url.toString();
}

/** Codice d'invito presente nell'indirizzo (?stanza=ABCDE), se c'è. */
export function readInviteCode(): string | null {
  const raw = new URLSearchParams(window.location.search).get(JOIN_PARAM);
  return raw ? normalizeRoomCode(raw) : null;
}

/** Toglie il codice dall'indirizzo, così una ricarica non ripropone l'invito. */
export function clearInviteFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(JOIN_PARAM)) return;
  url.searchParams.delete(JOIN_PARAM);
  window.history.replaceState(null, '', url.toString());
}
