// ─── Story Types ──────────────────────────────────────────────────────────────
// Struttura narrativa di "La Notte Lunga di Novarata".
// I contenuti vivono in data/story.ts; il rilevamento dei momenti narrativi
// in engine/narrative.ts (funzione pura, testabile senza React).

import type { TerritoryId, ZoneId } from './map';
import type { FactionId } from './player';
import type { VictoryCondition } from './game';
import type { PlayedEvent } from './cards';

/** Una pagina di testo narrativo (prologo, interludi). */
export interface StoryPage {
  readonly kicker: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

/** Capitolo che si apre all'inizio di un certo turno. */
export interface StoryAct {
  readonly number: number;
  /** Turno (round) in cui l'atto si apre. */
  readonly round: number;
  readonly title: string;
  readonly paragraphs: readonly string[];
  /** Indizio sul mistero dell'incendio, mostrato in evidenza. */
  readonly clue: string;
}

/** Forme grammaticali per comporre frasi corrette ("ai Figli", "dell'Ordine"). */
export interface FactionGrammar {
  /** Il nome regge il verbo al plurale? ("I Figli della Strada prendono") */
  readonly plural: boolean;
  /** Complemento di termine: "ai Colletti Bianchi", "alla Mano Nera". */
  readonly to: string;
  /** Specificazione: "dei Colletti Bianchi", "della Mano Nera". */
  readonly of: string;
}

export interface FactionLore {
  readonly leader: string;
  /** Pronome del leader ("lui" / "lei"). */
  readonly pronoun: 'lui' | 'lei';
  readonly grammar: FactionGrammar;
  readonly leaderRole: string;
  readonly motto: string;
  /** Perché la fazione vuole la città (1–2 frasi). */
  readonly motive: string;
  /** Cosa nasconde la fazione sulla notte dell'incendio. */
  readonly secret: string;
}

export interface TerritoryLore {
  readonly line: string;
}

export interface ZoneLore {
  readonly tagline: string;
  /** Stato in luogo con preposizione: "nel Porto Vecchio", "nelle Colline". */
  readonly inside: string;
}

export type Epilogues = Readonly<Record<FactionId, Readonly<Record<VictoryCondition, string>>>>;

// ─── Momenti narrativi rilevati durante la partita ───────────────────────────

export type StoryBeat =
  | { readonly kind: 'GAME_START' }
  | { readonly kind: 'ACT'; readonly act: StoryAct }
  | { readonly kind: 'CAPTURE'; readonly territoryId: TerritoryId; readonly by: FactionId; readonly from: FactionId | null }
  | { readonly kind: 'ZONE_SEIZED'; readonly zoneId: ZoneId; readonly by: FactionId }
  | { readonly kind: 'ZONE_BROKEN'; readonly zoneId: ZoneId; readonly from: FactionId; readonly by: FactionId }
  | { readonly kind: 'ELIMINATED'; readonly faction: FactionId; readonly by: FactionId | null }
  | { readonly kind: 'PIAZZA_THREAT'; readonly faction: FactionId }
  | { readonly kind: 'EVENT'; readonly event: PlayedEvent; readonly faction: FactionId; readonly target: FactionId | null };

export type DispatchTone = 'news' | 'alert' | 'act' | 'obituary';

/** Un articolo della Gazzetta di Novarata, generato da uno StoryBeat. */
export interface Dispatch {
  readonly id: string;
  readonly round: number;
  readonly tone: DispatchTone;
  readonly headline: string;
  readonly body: string;
  readonly faction: FactionId | null;
}
