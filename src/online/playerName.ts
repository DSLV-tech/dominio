// ─── Nome del giocatore online ────────────────────────────────────────────────
// Ricordato su questo dispositivo: lo usa chi entra da un invito e chi crea
// una stanza lasciando il nome predefinito "Tu" (che agli altri non dice nulla).

const NAME_KEY = 'dominio.nome';
export const DEFAULT_ONLINE_NAME = 'Sfidante';

export function loadPlayerName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

export function savePlayerName(name: string): void {
  const clean = name.trim();
  if (!clean) return;
  try { localStorage.setItem(NAME_KEY, clean); } catch { /* storage non disponibile */ }
}
