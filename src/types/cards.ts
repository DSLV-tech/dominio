// ─── Card Types ───────────────────────────────────────────────────────────────

import type { TerritoryId } from './map';
import type { PlayerId } from './player';

export type CardSymbol = 'INFANTRY' | 'CAVALRY' | 'ARTILLERY';

export interface TerritoryCard {
  readonly id: string;
  readonly kind: 'TERRITORY';
  readonly territoryId: TerritoryId;
  readonly symbol: CardSymbol;
}

export type EventCardId =
  | 'PROTESTA'
  | 'BLACKOUT'
  | 'OPERAZIONE'
  | 'ACCORDO_PACE'
  | 'MERCATO_NERO'
  | 'IMMIGRAZIONE'
  | 'CORRUZIONE'
  | 'SCIOPERO'
  | 'RIOT'
  | 'ACCORDO_COMM'
  | 'MEDIA_STORM'
  | 'RAPPRESAGLIA';

export interface EventCard {
  readonly id: string;
  readonly kind: 'EVENT';
  readonly eventId: EventCardId;
  readonly name: string;
  readonly description: string;
}

export type Card = TerritoryCard | EventCard;

/** A valid set of 3 territory cards that can be cashed in for troops */
export type CardSet =
  | [TerritoryCard, TerritoryCard, TerritoryCard];

export type SetBonus = {
  readonly troops: number;
  readonly setIndex: number; // 0-based global counter for escalation
};

/** Result of selecting a set: which cards to remove + how many troops */
export interface CashSetResult {
  readonly cards: CardSet;
  readonly troops: number;
}

// ─── Discriminated union helpers ─────────────────────────────────────────────

export function isTerritoryCard(card: Card): card is TerritoryCard {
  return card.kind === 'TERRITORY';
}

export function isEventCard(card: Card): card is EventCard {
  return card.kind === 'EVENT';
}

// ─── Active Event Effects ─────────────────────────────────────────────────────

export type ActiveEffect =
  | { readonly type: 'NO_ATTACK_CENTRO'; readonly untilTurn: number }
  | { readonly type: 'NO_ZONE_BONUS_EXCEPT_PV'; readonly untilTurn: number }
  | { readonly type: 'TRUCE'; readonly player1: PlayerId; readonly player2: PlayerId; readonly untilTurn: number }
  | { readonly type: 'SCIOPERO'; readonly untilTurn: number }
  /** Carta giocata: se perdi un territorio entro `untilTurn`, ottieni il bersaglio di rappresaglia. */
  | { readonly type: 'RAPPRESAGLIA_READY'; readonly playerId: PlayerId; readonly untilTurn: number }
  /** Nel tuo turno il primo attacco a `territoryId` è senza perdite per te (un solo lancio). */
  | { readonly type: 'RAPPRESAGLIA_TARGET'; readonly playerId: PlayerId; readonly territoryId: TerritoryId; readonly untilTurn: number };

// ─── Event targeting ──────────────────────────────────────────────────────────

/** Tipo di scelta richiesta da un passo: un territorio sulla mappa, un giocatore, le proprie carte. */
export type EventTargetKind = 'territory' | 'player' | 'cards';

/** Cosa serve a un evento per essere risolto, calcolato dal motore. */
export interface EventTargetSpec {
  /** Passi in ordine; vuoto = l'evento si gioca subito. */
  readonly steps: readonly EventTargetKind[];
  /** Bersagli validi del passo 'territory'. */
  readonly territories: ReadonlySet<TerritoryId>;
  /** Bersagli validi del passo 'player'. */
  readonly players: readonly PlayerId[];
  /** Passo 'cards': quante carte proprie si possono offrire (max). */
  readonly maxCards: number;
  /** Se non c'è alcun bersaglio valido: perché l'evento non è giocabile. */
  readonly unplayableReason?: string;
}

/** Ultimo evento giocato: serve a Gazzetta e riepiloghi. */
export interface PlayedEvent {
  readonly eventId: EventCardId;
  readonly playerId: PlayerId;
  readonly targetTerritoryId?: TerritoryId;
  readonly targetPlayerId?: PlayerId;
  readonly round: number;
}
