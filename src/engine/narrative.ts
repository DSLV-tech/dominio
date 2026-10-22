// ─── Narrative Engine ─────────────────────────────────────────────────────────
// Funzioni pure: confrontano due stati di gioco e producono i "momenti
// narrativi" (StoryBeat), poi li traducono in articoli della Gazzetta.
// Nessuna dipendenza da React o dagli store → testabile e usabile dalla CPU.

import type {
  GameState, StoryBeat, Dispatch, FactionId, PlayerId, TerritoryId, ZoneId,
} from '../types';
import {
  TERRITORY_DEFINITIONS, ZONE_DEFINITIONS, FACTION_DEFINITIONS, FACTION_LORE, ZONE_LORE, STORY_ACTS, actForRound, EVENT_ARTICLES,
} from '../data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZONE_IDS: readonly ZoneId[] = ['CS', 'PV', 'PN', 'CR', 'SE'];

function factionOf(state: GameState, playerId: PlayerId | null): FactionId | null {
  if (!playerId) return null;
  return state.players.find(p => p.id === playerId)?.factionId ?? null;
}

function zoneOwner(state: GameState, zoneId: ZoneId): PlayerId | null {
  const zone = ZONE_DEFINITIONS[zoneId];
  if (!zone) return null;
  const first = state.territories[zone.territories[0] as TerritoryId].ownerId;
  if (!first) return null;
  return zone.territories.every(t => state.territories[t as TerritoryId].ownerId === first) ? first : null;
}

function zonesOwnedBy(state: GameState, playerId: PlayerId): number {
  return ZONE_IDS.filter(z => zoneOwner(state, z) === playerId).length;
}

/** Scelta deterministica da una lista: stesso seed → stesso testo. */
function pick<T>(items: readonly [T, ...T[]], seed: number): T {
  return items[Math.abs(seed) % items.length] ?? items[0];
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return h;
}

// ─── Rilevamento ──────────────────────────────────────────────────────────────

/**
 * Confronta lo stato precedente con il successivo e restituisce i momenti
 * narrativi avvenuti nel mezzo. `prev = null` significa partita appena iniziata.
 */
export function detectStoryBeats(prev: GameState | null, next: GameState | null): StoryBeat[] {
  if (!next) return [];

  if (!prev || prev.id !== next.id) {
    const beats: StoryBeat[] = [{ kind: 'GAME_START' }];
    const act = actForRound(next.round);
    if (act) beats.push({ kind: 'ACT', act });
    return beats;
  }

  const beats: StoryBeat[] = [];

  // Nuovo turno → eventuale apertura d'atto
  if (next.round > prev.round) {
    const act = actForRound(next.round);
    if (act) beats.push({ kind: 'ACT', act });
  }

  // Conquiste di territori chiave (colli di bottiglia)
  for (const def of Object.values(TERRITORY_DEFINITIONS)) {
    const before = prev.territories[def.id].ownerId;
    const after  = next.territories[def.id].ownerId;
    if (before === after || !after || !def.isBottleneck) continue;
    const by = factionOf(next, after);
    if (by) beats.push({ kind: 'CAPTURE', territoryId: def.id, by, from: factionOf(prev, before) });
  }

  // Quartieri interi conquistati o spezzati
  for (const zoneId of ZONE_IDS) {
    const before = zoneOwner(prev, zoneId);
    const after  = zoneOwner(next, zoneId);
    if (before === after) continue;
    const afterFaction = factionOf(next, after);
    if (after && afterFaction) beats.push({ kind: 'ZONE_SEIZED', zoneId, by: afterFaction });
    if (before && !after) {
      const fromFaction = factionOf(prev, before);
      // chi ha rotto il quartiere: il nuovo proprietario del territorio cambiato
      const zone = ZONE_DEFINITIONS[zoneId];
      const brokenAt = zone?.territories.find(
        t => next.territories[t as TerritoryId].ownerId !== before,
      ) as TerritoryId | undefined;
      const byFaction = brokenAt ? factionOf(next, next.territories[brokenAt].ownerId) : null;
      if (fromFaction && byFaction) beats.push({ kind: 'ZONE_BROKEN', zoneId, from: fromFaction, by: byFaction });
    }
  }

  // Carte evento giocate
  if (next.lastEvent && next.lastEvent !== prev.lastEvent) {
    const faction = factionOf(next, next.lastEvent.playerId);
    if (faction) {
      beats.push({ kind: 'EVENT', event: next.lastEvent, faction, target: factionOf(next, next.lastEvent.targetPlayerId ?? null) });
    }
  }

  // Eliminazioni
  for (const player of next.players) {
    const was = prev.players.find(p => p.id === player.id);
    if (player.isEliminated && was && !was.isEliminated) {
      const current = next.players[next.currentPlayerIndex];
      const by = current && current.id !== player.id ? current.factionId : null;
      beats.push({ kind: 'ELIMINATED', faction: player.factionId, by });
    }
  }

  // Minaccia di Controllo Politico: un turno su Piazza Grande e ≥3 quartieri
  for (const player of next.players) {
    const before = prev.piazzaHoldCount[player.id] ?? 0;
    const after  = next.piazzaHoldCount[player.id] ?? 0;
    if (after === 1 && before === 0 && zonesOwnedBy(next, player.id) >= 3) {
      beats.push({ kind: 'PIAZZA_THREAT', faction: player.factionId });
    }
  }

  return beats;
}

// ─── Filtro notiziabilità ─────────────────────────────────────────────────────
// Senza filtro una partita produce 100+ articoli ripetitivi (i quartieri
// passano di mano di continuo). Regole:
//  - atti, inizio, eliminazioni, minacce: sempre
//  - Piazza Grande: una volta per fazione per atto
//  - snodi e quartieri conquistati: solo la prima volta per fazione
//  - quartiere spezzato: solo se è la base della fazione colpita

function actNumber(round: number): number {
  return STORY_ACTS.filter(a => a.round <= round).length;
}

function newsKey(beat: StoryBeat, round: number): string | null | 'always' {
  switch (beat.kind) {
    case 'GAME_START':
    case 'ACT':
    case 'ELIMINATED':
    case 'PIAZZA_THREAT':
    case 'EVENT':
      return 'always';
    case 'CAPTURE':
      return beat.territoryId === 'CS1'
        ? `piazza:${beat.by}:${actNumber(round)}`
        : `cap:${beat.territoryId}:${beat.by}`;
    case 'ZONE_SEIZED':
      return `zone:${beat.zoneId}:${beat.by}`;
    case 'ZONE_BROKEN':
      return FACTION_DEFINITIONS[beat.from].startingZone === beat.zoneId
        ? `broken:${beat.zoneId}:${beat.from}:${beat.by}`
        : null;
  }
}

export interface NewsSelection {
  readonly beats: readonly StoryBeat[];
  readonly seen: ReadonlySet<string>;
}

/** Tiene solo i momenti da pubblicare; restituisce la memoria aggiornata. */
export function filterNewsworthy(
  beats: readonly StoryBeat[],
  seen: ReadonlySet<string>,
  round: number,
): NewsSelection {
  const nextSeen = new Set(seen);
  const kept: StoryBeat[] = [];
  for (const beat of beats) {
    const key = newsKey(beat, round);
    if (key === null) continue;
    if (key !== 'always') {
      if (nextSeen.has(key)) continue;
      nextSeen.add(key);
    }
    kept.push(beat);
  }
  return { beats: kept, seen: nextSeen };
}

// ─── Traduzione in articoli ───────────────────────────────────────────────────

const capitalize = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
/** Nome della fazione a metà frase: "la Mano Nera", "i Colletti Bianchi". */
const midName = (f: FactionId): string => {
  const n = FACTION_DEFINITIONS[f].name;
  return n.charAt(0).toLowerCase() + n.slice(1);
};
/** Concorda il verbo con la fazione: verb('BIANCHI', 'prende', 'prendono'). */
const verb = (f: FactionId, singular: string, plural: string): string =>
  FACTION_LORE[f].grammar.plural ? plural : singular;
/** "a" eufonica: ad Adele, a Rosaria. */
const toPerson = (name: string): string => (/^[AEIOU]/i.test(name) ? `ad ${name}` : `a ${name}`);

/** Trasforma un momento narrativo in un articolo. */
export function beatToDispatch(beat: StoryBeat, round: number, serial: number): Dispatch {
  const id = `d-${round}-${serial}-${beat.kind}`;

  switch (beat.kind) {
    case 'GAME_START':
      return {
        id, round, tone: 'act', faction: null,
        headline: 'Novarata senza sindaco',
        body: 'Venier morto nel rogo di Palazzo del Potere. Trenta notti all\'arrivo del commissario. Le fazioni sono già in strada.',
      };

    case 'ACT':
      return {
        id, round, tone: 'act', faction: null,
        headline: `Atto ${beat.act.number} · ${beat.act.title}`,
        body: beat.act.clue,
      };

    case 'CAPTURE': {
      const t    = TERRITORY_DEFINITIONS[beat.territoryId];
      const by   = FACTION_DEFINITIONS[beat.by];
      const lore = FACTION_LORE[beat.by];
      const from = beat.from ? FACTION_LORE[beat.from].grammar.to : null;
      const seed = hash(beat.territoryId + beat.by) + round;
      if (beat.territoryId === 'CS1') {
        return {
          id, round, tone: 'alert', faction: beat.by,
          headline: pick(['Cambia la bandiera su Piazza Grande', 'Piazza Grande passa di mano', `${by.shortName}: «La Piazza è nostra»`], seed),
          body: `${by.name} ${verb(beat.by, 'prende', 'prendono')} Piazza Grande${from ? `, strappandola ${from}` : ''}. ${lore.leader} si fa fotografare davanti alle macerie del Palazzo.`,
        };
      }
      return {
        id, round, tone: 'news', faction: beat.by,
        headline: pick([`${t.name}: cambia padrone`, `Snodo conteso: ${t.name}`, `${t.name} sotto nuova bandiera`], seed),
        body: `Il controllo di ${t.name} passa ${lore.grammar.to}${from ? `: un altro snodo tolto ${from}` : ''}. Da qui il traffico di uomini cambia direzione.`,
      };
    }

    case 'ZONE_SEIZED': {
      const zone = ZONE_DEFINITIONS[beat.zoneId];
      const lore = FACTION_LORE[beat.by];
      const home = FACTION_DEFINITIONS[beat.by].startingZone === beat.zoneId;
      return {
        id, round, tone: 'alert', faction: beat.by,
        headline: `${zone?.name ?? beat.zoneId}: tutto in mano ${lore.grammar.to}`,
        body: home
          ? `La base ${lore.grammar.of} è compatta. Ogni strada ${ZONE_LORE[beat.zoneId].inside} risponde ${toPerson(lore.leader)}.`
          : `L'intero quartiere risponde ora ${toPerson(lore.leader)}. «${lore.motto}» compare sui muri entro mezzanotte.`,
      };
    }

    case 'ZONE_BROKEN': {
      const zone = ZONE_LORE[beat.zoneId];
      const by = FACTION_DEFINITIONS[beat.by];
      return {
        id, round, tone: 'news', faction: beat.by,
        headline: `Breccia ${zone.inside}`,
        body: `${by.name} ${verb(beat.by, 'entra', 'entrano')} in casa ${FACTION_LORE[beat.from].grammar.of}. ${FACTION_LORE[beat.from].leader} non controlla più il proprio quartiere.`,
      };
    }

    case 'ELIMINATED': {
      const lore = FACTION_LORE[beat.faction];
      const by = beat.by ? ` per mano ${FACTION_LORE[beat.by].grammar.of}` : '';
      return {
        id, round, tone: 'obituary', faction: beat.faction,
        headline: `Fine della corsa per ${midName(beat.faction)}`,
        body: `${lore.leader} lascia la città${by}. Con ${lore.pronoun} se ne va un segreto: ${lore.secret.charAt(0).toLowerCase()}${lore.secret.slice(1)}`,
      };
    }

    case 'EVENT': {
      const actor = { leader: FACTION_LORE[beat.faction].leader, name: FACTION_DEFINITIONS[beat.faction].name };
      const target = beat.target ? { leader: FACTION_LORE[beat.target].leader, name: FACTION_DEFINITIONS[beat.target].name } : null;
      const place = beat.event.targetTerritoryId ? TERRITORY_DEFINITIONS[beat.event.targetTerritoryId].name : null;
      const article = EVENT_ARTICLES[beat.event.eventId](actor, target, place);
      return { id, round, tone: 'news', faction: beat.faction, headline: article.headline, body: article.body };
    }

    case 'PIAZZA_THREAT': {
      const f = FACTION_DEFINITIONS[beat.faction];
      return {
        id, round, tone: 'alert', faction: beat.faction,
        headline: 'Il commissario ha già un interlocutore?',
        body: `${capitalize(f.name)} ${verb(beat.faction, 'tiene', 'tengono')} Piazza Grande e tre quartieri. Se ${verb(beat.faction, 'resiste', 'resistono')} un altro turno, la città è ${verb(beat.faction, 'sua', 'loro')}. Qualcuno deve fermarli adesso.`,
      };
    }
  }
}
