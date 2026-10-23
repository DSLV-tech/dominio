// ─── Hook di controllo ────────────────────────────────────────────────────────
// Collegano le regole pure di control.ts a gameStore e onlineStore.

import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import type { PlayerId } from '../types';
import { drivesIndex, isLocalTurn, runsAI, viewerId, type OnlineSeat } from './control';
import { useOnlineStore } from './onlineStore';

export function useOnlineSeat(): OnlineSeat | null {
  const room = useOnlineStore(s => s.room);
  const uid = useOnlineStore(s => s.uid);
  return useMemo(() => (room && uid ? { room, uid } : null), [room, uid]);
}

export function useLocalTurn(): boolean {
  const online = useOnlineSeat();
  return useGameStore(s => (s.game ? isLocalTurn(s.game, online) : false));
}

export function useRunsAI(): boolean {
  return runsAI(useOnlineSeat());
}

export function useViewerId(): PlayerId | null {
  const online = useOnlineSeat();
  return useGameStore(s => (s.game ? viewerId(s.game, online) : null));
}

/** Questo dispositivo fa agire il giocatore di turno (a mano o come CPU)? */
export function useDrivesCurrent(): boolean {
  const online = useOnlineSeat();
  return useGameStore(s => (s.game ? drivesIndex(online, s.game.currentPlayerIndex) : false));
}
