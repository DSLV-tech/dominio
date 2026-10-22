// ─── Event Card Logic ─────────────────────────────────────────────────────────
// Pure functions — each card returns a new GameState or requires UI input.
// Cards that need a target (territory, player) accept it as a parameter.

import type {
  GameState, PlayerId, TerritoryId, EventCardId, ActiveEffect, EventTargetSpec,
} from '../types';
import { hasTruce } from './combat';
import { TERRITORY_CARDS, TERRITORY_DEFINITIONS } from '../data';

// ─── Context required by some cards ──────────────────────────────────────────

export interface EventCardContext {
  /** The player playing the card */
  playerId: PlayerId;
  /** For OPERAZIONE: which territory to remove troops from */
  targetTerritoryId?: TerritoryId;
  /** For ACCORDO_PACE / ACCORDO_COMM: which player to involve */
  targetPlayerId?: PlayerId;
  /** For ACCORDO_COMM: which card ids to exchange (sender, receiver) */
  myCardIds?: string[];
  targetCardIds?: string[];
  /** For IMMIGRAZIONE: which SE territory to place troops in */
  seTargetId?: TerritoryId;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function removeCardFromHand(state: GameState, playerId: PlayerId, cardId: string): GameState {
  const hand = (state.hands[playerId] ?? []).filter(c => c.id !== cardId);
  return { ...state, hands: { ...state.hands, [playerId]: hand } };
}

function drawTerritoryCards(state: GameState, playerId: PlayerId, count: number): GameState {
  let s = { ...state };
  for (let i = 0; i < count; i++) {
    if (s.decks.territory.length === 0) {
      const reshuffled = [...s.decks.discard].sort(() => Math.random() - 0.5);
      s = { ...s, decks: { ...s.decks, territory: reshuffled, discard: [] } };
    }
    const [drawn, ...rest] = s.decks.territory;
    if (!drawn) break;
    const hand = [...(s.hands[playerId] ?? []), drawn];
    s = {
      ...s,
      decks: { ...s.decks, territory: rest },
      hands: { ...s.hands, [playerId]: hand },
    };
  }
  return s;
}

function drawEventCards(state: GameState, playerId: PlayerId, count: number): GameState {
  let s = { ...state };
  for (let i = 0; i < count; i++) {
    if (s.decks.event.length === 0) break;
    const [drawn, ...rest] = s.decks.event;
    if (!drawn) break;
    const hand = [...(s.hands[playerId] ?? []), drawn];
    s = {
      ...s,
      decks: { ...s.decks, event: rest },
      hands: { ...s.hands, [playerId]: hand },
    };
  }
  return s;
}

function addEffect(state: GameState, effect: ActiveEffect): GameState {
  return { ...state, activeEffects: [...state.activeEffects, effect] };
}

// ─── Card resolver ─────────────────────────────────────────────────────────────

export interface EventCardResult {
  state: GameState;
  /** Human-readable description of what happened */
  log: string;
  /** If true, the card requires additional UI input before resolving */
  needsInput?: boolean;
}

export function resolveEventCard(
  state: GameState,
  eventCardId: EventCardId,
  playingCardId: string,
  ctx: EventCardContext,
): EventCardResult {
  const result = resolveEventInner(state, eventCardId, playingCardId, ctx);
  if (result.needsInput || result.state === state) return result;
  return {
    ...result,
    state: {
      ...result.state,
      lastEvent: {
        eventId: eventCardId,
        playerId: ctx.playerId,
        targetTerritoryId: ctx.targetTerritoryId ?? ctx.seTargetId,
        targetPlayerId: ctx.targetPlayerId,
        round: state.round,
      },
    },
  };
}

function resolveEventInner(
  state: GameState,
  eventCardId: EventCardId,
  playingCardId: string,
  ctx: EventCardContext,
): EventCardResult {
  const { playerId } = ctx;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { state, log: 'Giocatore non trovato.' };

  // Remove the event card from hand first
  let s = removeCardFromHand(state, playerId, playingCardId);

  switch (eventCardId) {

    // ── Protesta di Piazza ────────────────────────────────────────────────────
    case 'PROTESTA': {
      s = addEffect(s, { type: 'NO_ATTACK_CENTRO', untilTurn: s.round });
      return { state: s, log: `${player.name} gioca Protesta di Piazza: il Centro Storico è intoccabile questo turno.` };
    }

    // ── Blackout ──────────────────────────────────────────────────────────────
    case 'BLACKOUT': {
      s = addEffect(s, { type: 'NO_ZONE_BONUS_EXCEPT_PV', untilTurn: s.round + 1 });
      return { state: s, log: `${player.name} gioca Blackout: nessun bonus zona (tranne Porto) al prossimo turno.` };
    }

    // ── Operazione di Polizia ─────────────────────────────────────────────────
    case 'OPERAZIONE': {
      const tid = ctx.targetTerritoryId;
      if (!tid) return { state, log: 'Seleziona un territorio bersaglio.', needsInput: true };
      const territory = s.territories[tid];
      if (!territory) return { state: s, log: 'Territorio non valido.' };
      const removed = Math.min(2, territory.troops - 1); // always leave 1
      const actualRemoved = Math.max(0, removed);
      s = {
        ...s,
        territories: {
          ...s.territories,
          [tid]: { ...territory, troops: territory.troops - actualRemoved },
        },
      };
      return { state: s, log: `${player.name} gioca Operazione di Polizia: -${actualRemoved} truppe da ${tid}.` };
    }

    // ── Accordo di Pace ───────────────────────────────────────────────────────
    case 'ACCORDO_PACE': {
      const tp = ctx.targetPlayerId;
      if (!tp) return { state, log: 'Seleziona il giocatore con cui fare la tregua.', needsInput: true };
      s = addEffect(s, { type: 'TRUCE', player1: playerId, player2: tp, untilTurn: s.round + 1 });
      const tpName = s.players.find(p => p.id === tp)?.name ?? tp;
      return { state: s, log: `${player.name} gioca Accordo di Pace con ${tpName}: tregua fino al prossimo turno.` };
    }

    // ── Mercato Nero ──────────────────────────────────────────────────────────
    case 'MERCATO_NERO': {
      s = drawTerritoryCards(s, playerId, 2);
      return { state: s, log: `${player.name} gioca Mercato Nero: pesca 2 Carte Territorio.` };
    }

    // ── Immigrazione Massiccia ────────────────────────────────────────────────
    case 'IMMIGRAZIONE': {
      const tid = ctx.seTargetId ?? ctx.targetTerritoryId;
      if (!tid) return { state, log: 'Seleziona una zona della Suburbia Est.', needsInput: true };
      const territory = s.territories[tid];
      if (!territory) return { state: s, log: 'Territorio non trovato.' };
      // zone lives on TerritoryDefinition, not TerritoryState
      if (TERRITORY_DEFINITIONS[tid].zone !== 'SE') {
        return { state, log: 'Seleziona una zona nella Suburbia Est.', needsInput: true };
      }
      if (territory.ownerId !== playerId) {
        return { state: s, log: 'Devi controllare il territorio bersaglio.' };
      }
      s = {
        ...s,
        territories: {
          ...s.territories,
          [tid]: { ...territory, troops: territory.troops + 3 },
        },
      };
      return { state: s, log: `${player.name} gioca Immigrazione Massiccia: +3 truppe in ${tid}.` };
    }

    // ── Corruzione ────────────────────────────────────────────────────────────
    case 'CORRUZIONE': {
      const tp = ctx.targetPlayerId;
      if (!tp) {
        return { state, log: 'Seleziona il giocatore a cui rubare una carta.', needsInput: true };
      }
      const targetHand = (s.hands[tp] ?? []);
      // si pesca alla cieca fra le Carte Territorio (D3), salvo carta indicata
      const targetCardId = ctx.targetCardIds?.[0];
      const pool = targetHand.filter(c => c.kind === 'TERRITORY');
      const stolen = targetCardId
        ? targetHand.find(c => c.id === targetCardId)
        : pool[Math.floor(Math.random() * pool.length)];
      if (!stolen) return { state: s, log: 'Carta non trovata nella mano avversaria.' };

      const newTargetHand = targetHand.filter(c => c.id !== stolen.id);
      const myNewHand = [...(s.hands[playerId] ?? []), stolen];
      s = {
        ...s,
        hands: { ...s.hands, [tp]: newTargetHand, [playerId]: myNewHand },
      };
      const tpName = s.players.find(p => p.id === tp)?.name ?? tp;
      return { state: s, log: `${player.name} gioca Corruzione: ruba una carta da ${tpName}.` };
    }

    // ── Sciopero Generale ─────────────────────────────────────────────────────
    case 'SCIOPERO': {
      s = addEffect(s, { type: 'SCIOPERO', untilTurn: s.round + 1 });
      return { state: s, log: `${player.name} gioca Sciopero Generale: tutti -1 rinforzo al prossimo turno.` };
    }

    // ── Riot ──────────────────────────────────────────────────────────────────
    case 'RIOT': {
      // Weakest player = fewest territories
      const activePlayers = s.players.filter(p => !p.isEliminated);
      const territoryCounts = activePlayers.map(p => ({
        id: p.id,
        name: p.name,
        count: Object.values(s.territories).filter(t => t.ownerId === p.id).length,
      }));
      const weakest = territoryCounts.reduce((a, b) => a.count <= b.count ? a : b);

      // Choose first owned territory to add troops (AI/simplified — for real game, ask player)
      const weakestTerritory = Object.values(s.territories).find(t => t.ownerId === weakest.id);
      if (!weakestTerritory) return { state: s, log: 'Nessun territorio trovato.' };

      s = {
        ...s,
        territories: {
          ...s.territories,
          [weakestTerritory.territoryId]: {
            ...weakestTerritory,
            troops: weakestTerritory.troops + 3,
          },
        },
      };
      return { state: s, log: `${player.name} gioca Riot: ${weakest.name} riceve +3 truppe (giocatore più debole).` };
    }

    // ── Accordo Commerciale ───────────────────────────────────────────────────
    case 'ACCORDO_COMM': {
      const tp = ctx.targetPlayerId;
      const myCards = ctx.myCardIds ?? [];
      const theirCards = ctx.targetCardIds ?? [];
      if (!tp || myCards.length === 0) {
        return { state, log: 'Seleziona le carte da scambiare.', needsInput: true };
      }
      const myHand = [...(s.hands[playerId] ?? [])];
      const theirHand = [...(s.hands[tp] ?? [])];

      const giving   = myHand.filter(c => myCards.includes(c.id));
      // lo scambio è imposto e alla cieca (D3): altrettante carte a caso dell'altro
      const chosen = theirCards.length > 0
        ? theirHand.filter(c => theirCards.includes(c.id))
        : [...theirHand].sort(() => Math.random() - 0.5).slice(0, giving.length);
      const receiving = chosen;
      const takenIds = chosen.map(c => c.id);

      const newMyHand    = [...myHand.filter(c => !myCards.includes(c.id)), ...receiving];
      const newTheirHand = [...theirHand.filter(c => !takenIds.includes(c.id)), ...giving];

      s = {
        ...s,
        hands: { ...s.hands, [playerId]: newMyHand, [tp]: newTheirHand },
      };
      const tpName = s.players.find(p => p.id === tp)?.name ?? tp;
      return { state: s, log: `${player.name} gioca Accordo Commerciale con ${tpName}.` };
    }

    // ── Media Storm ────────────────────────────────────────────────────────────
    case 'MEDIA_STORM': {
      const piazzaOwner = s.territories['CS1'].ownerId;
      if (!piazzaOwner) return { state: s, log: 'Nessuno controlla Piazza Grande.' };
      s = drawEventCards(s, piazzaOwner, 2);
      const ownerName = s.players.find(p => p.id === piazzaOwner)?.name ?? piazzaOwner;
      return { state: s, log: `${player.name} gioca Media Storm: ${ownerName} pesca 2 Carte Evento.` };
    }

    // ── Rappresaglia ───────────────────────────────────────────────────────────
    case 'RAPPRESAGLIA': {
      // Mark the effect: player can do a free attack when they lose a territory
      s = addEffect(s, { type: 'RAPPRESAGLIA_READY', playerId, untilTurn: s.round + 1 });
      return { state: s, log: `${player.name} gioca Rappresaglia: se perdi un territorio, il tuo prossimo turno inizia con un attacco senza perdite per riprenderlo.` };
    }

    default: {
      const _: never = eventCardId;
      void _;
      return { state: s, log: 'Carta evento sconosciuta.' };
    }
  }
}

// ─── Validate event card can be played ────────────────────────────────────────

export function canPlayEventCard(
  state: GameState,
  eventCardId: EventCardId,
  playerId: PlayerId,
): { allowed: boolean; reason?: string } {
  // IMMIGRAZIONE requires owning at least one SE territory
  if (eventCardId === 'IMMIGRAZIONE') {
    const ownsSE = Object.values(state.territories).some(
      t => t.ownerId === playerId && t.territoryId.startsWith('SE')
    );
    if (!ownsSE) return { allowed: false, reason: 'Devi controllare almeno una zona della Suburbia Est.' };
  }

  // ACCORDO_COMM requires opponent with cards
  if (eventCardId === 'ACCORDO_COMM') {
    const hasOpponentWithCards = state.players.some(
      p => p.id !== playerId && !p.isEliminated && (state.hands[p.id]?.length ?? 0) > 0
    );
    if (!hasOpponentWithCards) return { allowed: false, reason: 'Nessun avversario ha carte da scambiare.' };
  }

  // CORRUZIONE requires opponent with territory cards
  if (eventCardId === 'CORRUZIONE') {
    const hasOpponentWithTCards = state.players.some(
      p => p.id !== playerId && !p.isEliminated &&
        (state.hands[p.id] ?? []).some(c => c.kind === 'TERRITORY')
    );
    if (!hasOpponentWithTCards) return { allowed: false, reason: 'Nessun avversario ha Carte Territorio.' };
  }

  return { allowed: true };
}

// Suppress unused import
void TERRITORY_CARDS;


// ─── Targets ──────────────────────────────────────────────────────────────────

const NO_TERRITORIES: ReadonlySet<TerritoryId> = new Set<TerritoryId>();

/** Passi di scelta e bersagli validi di un evento (pura, usata da UI e CPU). */
export function getEventTargets(
  state: GameState,
  eventId: EventCardId,
  playerId: PlayerId,
  playingCardId?: string,
): EventTargetSpec {
  const others = state.players.filter(p => p.id !== playerId && !p.isEliminated);
  const base: EventTargetSpec = { steps: [], territories: NO_TERRITORIES, players: [], maxCards: 0 };
  const none = (reason: string): EventTargetSpec => ({ ...base, unplayableReason: reason });

  switch (eventId) {
    case 'OPERAZIONE': {
      const t = Object.values(state.territories)
        .filter(x => x.ownerId !== null && x.ownerId !== playerId && x.troops >= 2)
        .map(x => x.territoryId);
      return t.length === 0
        ? none('Nessun territorio avversario con almeno 2 truppe.')
        : { ...base, steps: ['territory'], territories: new Set(t) };
    }
    case 'IMMIGRAZIONE': {
      const t = Object.values(state.territories)
        .filter(x => x.ownerId === playerId && TERRITORY_DEFINITIONS[x.territoryId].zone === 'SE')
        .map(x => x.territoryId);
      return t.length === 0
        ? none('Devi controllare almeno una zona della Suburbia Est.')
        : { ...base, steps: ['territory'], territories: new Set(t) };
    }
    case 'ACCORDO_PACE': {
      const p = others.filter(o => !hasTruce(state.activeEffects, playerId, o.id, state.round)).map(o => o.id);
      return p.length === 0
        ? none('Nessun avversario con cui stringere una tregua.')
        : { ...base, steps: ['player'], players: p };
    }
    case 'CORRUZIONE': {
      const p = others.filter(o => (state.hands[o.id] ?? []).some(c => c.kind === 'TERRITORY')).map(o => o.id);
      return p.length === 0
        ? none('Nessun avversario ha Carte Territorio.')
        : { ...base, steps: ['player'], players: p };
    }
    case 'ACCORDO_COMM': {
      const mine = (state.hands[playerId] ?? []).filter(c => c.id !== playingCardId);
      const p = others.filter(o => (state.hands[o.id] ?? []).length > 0).map(o => o.id);
      if (mine.length === 0) return none('Non hai altre carte da scambiare.');
      return p.length === 0
        ? none('Nessun avversario ha carte da scambiare.')
        : { ...base, steps: ['player', 'cards'], players: p, maxCards: Math.min(2, mine.length) };
    }
    default:
      return base;
  }
}
