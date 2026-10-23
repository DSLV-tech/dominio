// ─── Chi agisce da questo dispositivo ─────────────────────────────────────────
// Offline (stesso telefono) questo dispositivo fa tutto: gli umani con le mani,
// le CPU con useAIPlayer. Online ogni posto ha un "padrone": l'amico seduto lì,
// e per le CPU chi ha creato la stanza. Funzioni pure: gli hook che le
// collegano agli store sono in useControl.ts. L'interfaccia usa useLocalTurn()
// al posto di `!player.isAI` per decidere se mostrare i comandi.

import { FACTION_LORE } from '../data';
import type { GameState, Player, PlayerId } from '../types';
import type { RoomDoc } from './types';

export interface OnlineSeat {
  readonly room: RoomDoc;
  readonly uid: string;
}

/** uid del dispositivo che fa agire il giocatore all'indice dato (null = posto vuoto). */
export function controllerUid(room: RoomDoc, index: number): string | null {
  const seat = room.seats[index];
  if (!seat) return null;
  return seat.kind === 'cpu' ? room.hostUid : seat.uid;
}

/** Questo dispositivo fa agire il giocatore `index` (a mano o come CPU)? */
export function drivesIndex(online: OnlineSeat | null, index: number): boolean {
  return online ? controllerUid(online.room, index) === online.uid : true;
}

/** Tocca a un umano che gioca da questo dispositivo: si mostrano i comandi. */
export function isLocalTurn(game: GameState, online: OnlineSeat | null): boolean {
  const current = game.players[game.currentPlayerIndex];
  if (!current || current.isAI) return false;
  return drivesIndex(online, game.currentPlayerIndex);
}

/** Le CPU girano solo su un dispositivo: offline qui, online da chi ha creato la stanza. */
export function runsAI(online: OnlineSeat | null): boolean {
  return online ? online.uid === online.room.hostUid : true;
}

/** Di chi è la mano di carte da mostrare: online la propria, offline di chi è di turno. */
export function viewerId(game: GameState, online: OnlineSeat | null): PlayerId | null {
  if (!online) return game.players[game.currentPlayerIndex]?.id ?? null;
  const seat = online.room.seats.findIndex(s => s.uid === online.uid);
  return seat >= 0 ? game.players[seat]?.id ?? null : null;
}

/** Testo d'attesa quando non tocca a questo dispositivo. */
export function waitingLabel(player: Player): string {
  return player.isAI ? `${FACTION_LORE[player.factionId].leader} sta muovendo` : `${player.name} sta giocando`;
}
