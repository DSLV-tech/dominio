// ─── cardMeta ─────────────────────────────────────────────────────────────────
// Metadati di presentazione delle carte (nessuna regola di gioco qui).
// Ogni simbolo è un grado militare in un metallo diverso: bronzo, argento, oro
// — in ordine di valore del tris (4 / 6 / 8 truppe).

import type { CardSymbol, EventCardId, TerritoryCard } from '../../types';
import { getSetBonus } from '../../data';

export type CardMetal = 'bronze' | 'silver' | 'gold';

export interface SymbolMeta {
  readonly label: string;
  readonly short: string;
  readonly metal: CardMetal;
  /** Numero di galloni dell'insegna. */
  readonly chevrons: 1 | 2;
  /** Stella sopra i galloni (solo artiglieria). */
  readonly star: boolean;
}

export const SYMBOL_META: Readonly<Record<CardSymbol, SymbolMeta>> = {
  INFANTRY:  { label: 'Fanteria',    short: 'FAN', metal: 'bronze', chevrons: 1, star: false },
  CAVALRY:   { label: 'Motorizzati', short: 'MOT', metal: 'silver', chevrons: 2, star: false },
  ARTILLERY: { label: 'Artiglieria', short: 'ART', metal: 'gold',   chevrons: 2, star: true  },
};

/** Eventi giocabili subito, senza scegliere un bersaglio sulla mappa. */
export const INSTANT_EVENTS: ReadonlySet<EventCardId> = new Set<EventCardId>([
  'PROTESTA', 'BLACKOUT', 'MERCATO_NERO', 'SCIOPERO', 'RIOT', 'MEDIA_STORM', 'RAPPRESAGLIA',
]);

export type SetEvaluation =
  | { readonly kind: 'incomplete'; readonly missing: number }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'valid'; readonly troops: number; readonly label: string };

/** Valuta la selezione: tris (3 uguali) o scala (1 per tipo). */
export function evaluateSet(cards: ReadonlyArray<TerritoryCard>, setsCashed: number): SetEvaluation {
  if (cards.length < 3) return { kind: 'incomplete', missing: 3 - cards.length };
  const symbols = cards.slice(0, 3).map(c => c.symbol) as [CardSymbol, CardSymbol, CardSymbol];
  const distinct = new Set(symbols).size;
  if (distinct === 2) return { kind: 'invalid' };
  // getSetBonus ordina l'array in place: gli passiamo una copia
  const troops = getSetBonus([...symbols], setsCashed);
  const label = distinct === 1 ? `Tris di ${SYMBOL_META[symbols[0]].label}` : 'Scala completa';
  return { kind: 'valid', troops, label };
}
