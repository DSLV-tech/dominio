// ─── phaseMeta ────────────────────────────────────────────────────────────────
// Etichetta, colore e suggerimento delle tre fasi del turno: condivisi da
// PhaseBar (barra del turno) e MapDock (fascia sotto la mappa sui telefoni).

import type { GamePhase } from '../../types';

export type PlayablePhase = Extract<GamePhase, 'REINFORCEMENT' | 'ATTACK' | 'MOVEMENT'>;

export interface PhaseMeta {
  readonly label: string;
  readonly token: string;          // variabile CSS del colore
  readonly hint: string;
}

export const PHASES: ReadonlyArray<readonly [PlayablePhase, PhaseMeta]> = [
  ['REINFORCEMENT', { label: 'Rinforzi',    token: 'var(--phase-reinforce)', hint: 'Tocca un tuo territorio per piazzare truppe.' }],
  ['ATTACK',        { label: 'Attacco',     token: 'var(--phase-attack)',    hint: 'Scegli un tuo territorio con almeno 2 truppe, poi un bersaglio rosso.' }],
  ['MOVEMENT',      { label: 'Spostamento', token: 'var(--phase-move)',      hint: 'Scegli da dove spostare, poi una destinazione verde. Poi chiudi il turno.' }],
];

export const PHASE_INDEX: Readonly<Record<GamePhase, number>> = {
  SETUP: -1, REINFORCEMENT: 0, ATTACK: 1, MOVEMENT: 2, EVENT_PHASE: 2, GAME_OVER: 3,
};

/** Cosa fare adesso nella fase (null fuori dalle fasi giocabili). */
export function phaseHint(phase: GamePhase): string | null {
  return PHASES[PHASE_INDEX[phase]]?.[1].hint ?? null;
}

