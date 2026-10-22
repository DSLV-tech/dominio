// Verifica del motore di combattimento con RNG deterministico.
// Uso: npm run combat
import { resolveAttackOrder, maxAttackDice, hasTruce, validateAttack, reachableFriendly } from '../src/engine';
import type { Rng } from '../src/engine';
import type { AttackOrder, TerritoryId, TerritoryState, ActiveEffect } from '../src/types';
import { TERRITORY_DEFINITIONS } from '../src/data';

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) { failures++; console.error('FAIL:', msg); }
}

const fromId = Object.keys(TERRITORY_DEFINITIONS)[0] as TerritoryId;
const toId = TERRITORY_DEFINITIONS[fromId].connections[0]!;

for (let seed = 1; seed <= 300; seed++) {
  const rng = mulberry32(seed);
  const fromTroops = 2 + Math.floor(rng() * 14);
  const toTroops = 1 + Math.floor(rng() * 10);
  const mode = seed % 2 ? 'blitz' : 'single';
  const stopAt = 2 + Math.floor(rng() * 3);
  const dice = 1 + Math.floor(rng() * 3);
  const order: AttackOrder = { fromId, toId, dice, mode, stopAt };
  const r = resolveAttackOrder(order, {
    fromTroops, toTroops, attackerFaction: 'ORDINE', defenderFaction: 'STRADA', barricade: seed % 5 === 0,
  }, rng);

  const sumA = r.rounds.reduce((n, x) => n + x.attackerLosses, 0);
  const sumD = r.rounds.reduce((n, x) => n + x.defenderLosses, 0);
  check(sumA === r.attackerLosses && sumD === r.defenderLosses, `seed ${seed}: perdite incoerenti`);
  check(fromTroops - r.attackerLosses >= 1, `seed ${seed}: la fonte scende sotto 1`);
  check(r.rounds.length >= 1 && (mode === 'blitz' || r.rounds.length === 1), `seed ${seed}: numero di lanci errato`);
  check(r.conquered === (r.defenderLosses >= toTroops), `seed ${seed}: conquista incoerente`);
  for (const rd of r.rounds) {
    check(rd.attacker.length <= maxAttackDice(fromTroops, 'ORDINE', fromId, toId), `seed ${seed}: troppi dadi`);
  }
  if (mode === 'blitz' && !r.conquered && r.rounds.length < 60) {
    check(fromTroops - r.attackerLosses <= stopAt, `seed ${seed}: blitz fermato prima della soglia`);
  }
}

// Tregua: bloccata finché valida, poi scade
const effects: ActiveEffect[] = [{ type: 'TRUCE', player1: 'a', player2: 'b', untilTurn: 3 }];
check(hasTruce(effects, 'a', 'b', 3) && hasTruce(effects, 'b', 'a', 2), 'tregua non riconosciuta');
check(!hasTruce(effects, 'a', 'b', 4) && !hasTruce(effects, 'a', 'c', 1), 'tregua scaduta o fra altri giocatori');
const st = (ownerId: string): TerritoryState => ({ ownerId, troops: 3 }) as TerritoryState;
check(!validateAttack(fromId, toId, st('a'), st('b'), 'a', effects, 3).valid, 'attacco in tregua consentito');

// Spostamento: a catena raggiunge almeno quanto 'adjacent'; senza territori propri non raggiunge nulla
{
  const ids = Object.keys(TERRITORY_DEFINITIONS) as TerritoryId[];
  const allMine = Object.fromEntries(ids.map(id => [id, { ownerId: 'p', troops: 2 }])) as unknown as Record<TerritoryId, TerritoryState>;
  const adj = reachableFriendly({ territories: allMine, movementRule: 'adjacent' }, fromId, 'p');
  const chain = reachableFriendly({ territories: allMine, movementRule: 'chain' }, fromId, 'p');
  check(adj.size === TERRITORY_DEFINITIONS[fromId].connections.length, 'adjacent: vicini attesi');
  check(chain.size === ids.length - 1, 'chain: tutta la mappa connessa attesa');
  check(reachableFriendly({ territories: allMine, movementRule: 'chain' }, fromId, 'q').size === 0, 'chain: nulla per un altro giocatore');
}

if (failures > 0) { console.error(`${failures} controlli falliti`); process.exit(1); }
console.log('combat-check: ok');
