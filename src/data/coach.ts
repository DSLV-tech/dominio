// ─── Coach ────────────────────────────────────────────────────────────────────
// Le indicazioni del primo turno guidato: quando compaiono e cosa dicono.
// Le condizioni sono funzioni pure sullo stato di gioco e sulla selezione.

import type { GameState } from '../types';
import type { CoachStepId } from '../store/tutorialStore';

export interface CoachContext {
  readonly game: GameState;
  /** Territorio d'attacco selezionato, se c'è. */
  readonly attackFromId: string | null;
  /** Numero di carte in mano al giocatore di turno. */
  readonly handSize: number;
  /** Passi già visti. */
  readonly seen: readonly CoachStepId[];
}

export interface CoachStep {
  readonly id: CoachStepId;
  readonly title: string;
  readonly text: (ctx: CoachContext) => string;
  readonly when: (ctx: CoachContext) => boolean;
}

/** In ordine di priorità: se più passi sono validi, compare il primo non ancora visto. */
export const COACH_STEPS: readonly CoachStep[] = [
  {
    id: 'place',
    title: 'Piazza le truppe',
    text: () => 'Tocca un tuo territorio per metterci le truppe; con − e + scegli quante per volta. Quando hai finito, premi «All\'attacco».',
    when: ({ game }) => game.phase === 'REINFORCEMENT',
  },
  {
    id: 'cards',
    title: 'Hai delle carte',
    text: () => 'Nella scheda «Carte» puoi incassare tre carte territorio per truppe extra, o giocare un dispaccio evento.',
    when: ({ game, handSize, seen }) => game.phase === 'REINFORCEMENT' && handSize > 0 && seen.includes('place'),
  },
  {
    id: 'attack',
    title: 'Attacca',
    text: () => 'Scegli un tuo territorio con almeno 2 truppe, poi un bersaglio rosso confinante. Il difensore vince i pareggi.',
    when: ({ game }) => game.phase === 'ATTACK',
  },
  {
    id: 'dice',
    title: 'Dadi e attacco automatico',
    text: () => 'Nel pannello in basso scegli con quanti dadi attaccare e se ripetere fino alla conquista. Le scelte restano salvate per le prossime partite.',
    when: ({ game, attackFromId, seen }) => game.phase === 'ATTACK' && attackFromId !== null && seen.includes('attack'),
  },
  {
    id: 'move',
    title: 'Sposta e chiudi la notte',
    text: ({ game }) => game.movementRule === 'chain'
      ? 'Scegli da dove spostare, poi una destinazione verde: va bene qualsiasi territorio raggiungibile attraverso i tuoi. Poi chiudi la notte.'
      : 'Scegli da dove spostare, poi un territorio verde confinante. Poi chiudi la notte.',
    when: ({ game }) => game.phase === 'MOVEMENT',
  },
];
