// ─── Static Card Data ─────────────────────────────────────────────────────────

import type { TerritoryCard, EventCard, TerritoryId, CardSymbol } from '../types';

// ── Territory Cards (1 per territory, symbol distributed evenly) ──────────────

const SYMBOL_ASSIGNMENT: Record<TerritoryId, CardSymbol> = {
  CS1: 'INFANTRY',  CS2: 'CAVALRY',   CS3: 'ARTILLERY', CS4: 'INFANTRY',
  PV1: 'CAVALRY',   PV2: 'ARTILLERY', PV3: 'INFANTRY',  PV4: 'CAVALRY',
  PN1: 'ARTILLERY', PN2: 'INFANTRY',  PN3: 'CAVALRY',   PN4: 'ARTILLERY',
  CR1: 'INFANTRY',  CR2: 'CAVALRY',   CR3: 'INFANTRY',  CR4: 'ARTILLERY',
  SE1: 'CAVALRY',   SE2: 'INFANTRY',  SE3: 'ARTILLERY', SE4: 'CAVALRY',
};

export const TERRITORY_CARDS: readonly TerritoryCard[] = (
  Object.entries(SYMBOL_ASSIGNMENT) as [TerritoryId, CardSymbol][]
).map(([territoryId, symbol]) => ({
  id: `tc-${territoryId}`,
  kind: 'TERRITORY' as const,
  territoryId,
  symbol,
}));

// ── Set bonus table (escalating: base + 2 per subsequent set) ─────────────────
// setIndex = 0-based count of sets cashed globally across the whole game

export function getSetBonus(
  symbols: [CardSymbol, CardSymbol, CardSymbol],
  setIndex: number,
): number {
  const [a, b, c] = symbols.sort();
  let base: number;

  if (a === b && b === c) {
    // 3 of the same
    switch (a) {
      case 'INFANTRY':  base = 4; break;
      case 'CAVALRY':   base = 6; break;
      case 'ARTILLERY': base = 8; break;
    }
  } else if (a !== b && b !== c && a !== c) {
    // 1 of each
    base = 10;
  } else {
    // shouldn't happen with valid input
    base = 4;
  }

  return base + setIndex * 2;
}

// ── Event Cards ───────────────────────────────────────────────────────────────

export const EVENT_CARDS: readonly EventCard[] = [
  {
    id: 'ev-protesta',
    kind: 'EVENT',
    eventId: 'PROTESTA',
    name: 'Protesta di Piazza',
    description: 'Nessun territorio del Centro Storico può essere attaccato questo turno (da nessuno).',
  },
  {
    id: 'ev-blackout',
    kind: 'EVENT',
    eventId: 'BLACKOUT',
    name: 'Blackout',
    description: 'Tutte le zone, tranne Porto Vecchio, perdono il bonus zona il prossimo turno.',
  },
  {
    id: 'ev-operazione',
    kind: 'EVENT',
    eventId: 'OPERAZIONE',
    name: 'Operazione di Polizia',
    description: 'Rimuovi 2 truppe da qualsiasi territorio (anche il tuo).',
  },
  {
    id: 'ev-accordo-pace',
    kind: 'EVENT',
    eventId: 'ACCORDO_PACE',
    name: 'Accordo di Pace',
    description: 'Dichiari una tregua con 1 giocatore: nessuno dei due può attaccare l\'altro per 1 turno completo.',
  },
  {
    id: 'ev-mercato-nero',
    kind: 'EVENT',
    eventId: 'MERCATO_NERO',
    name: 'Mercato Nero',
    description: 'Pesca 2 Carte Territorio extra.',
  },
  {
    id: 'ev-immigrazione',
    kind: 'EVENT',
    eventId: 'IMMIGRAZIONE',
    name: 'Immigrazione Massiccia',
    description: 'Aggiungi 3 truppe in qualsiasi zona della Suburbia Est che controlli.',
  },
  {
    id: 'ev-corruzione',
    kind: 'EVENT',
    eventId: 'CORRUZIONE',
    name: 'Corruzione',
    description: 'Ruba 1 Carta Territorio a scelta da qualsiasi avversario.',
  },
  {
    id: 'ev-sciopero',
    kind: 'EVENT',
    eventId: 'SCIOPERO',
    name: 'Sciopero Generale',
    description: 'Tutti i giocatori ricevono -1 truppa ai rinforzi del prossimo turno (min 1).',
  },
  {
    id: 'ev-riot',
    kind: 'EVENT',
    eventId: 'RIOT',
    name: 'Riot',
    description: 'Il giocatore con meno territori guadagna +3 truppe da posizionare dove vuole.',
  },
  {
    id: 'ev-accordo-comm',
    kind: 'EVENT',
    eventId: 'ACCORDO_COMM',
    name: 'Accordo Commerciale',
    description: 'Scambia fino a 2 Carte Territorio con qualsiasi altro giocatore.',
  },
  {
    id: 'ev-media-storm',
    kind: 'EVENT',
    eventId: 'MEDIA_STORM',
    name: 'Media Storm',
    description: 'Il giocatore che controlla Piazza Grande pesca immediatamente 2 Carte Evento.',
  },
  {
    id: 'ev-rappresaglia',
    kind: 'EVENT',
    eventId: 'RAPPRESAGLIA',
    name: 'Rappresaglia',
    description: 'Dopo aver perso un territorio, ottieni 1 attacco gratuito immediato contro quel territorio.',
  },
];

/** 2-player variant: use a trimmed event deck of 6 cards */
export const EVENT_CARDS_2P: readonly EventCard[] = EVENT_CARDS.slice(0, 6);
