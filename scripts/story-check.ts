// Verifica narrativa headless: partite CPU vs CPU sul vero gameStore,
// ogni cambio di stato passa dal motore narrativo come in useStoryDirector.
// Controlla che i momenti scattino e che ogni articolo/epilogo abbia testo.
// Uso: npx tsx scripts/story-check.ts [partite] [giocatori]
import { useGameStore } from '../src/store/gameStore';
import {
  planAITurn, aiChooseEvent, aiChooseAttack, aiChooseMovement, AI_MAX_ATTACKS_PER_TURN,
  detectStoryBeats, filterNewsworthy, beatToDispatch,
} from '../src/engine';
import { ALL_FACTION_IDS, EPILOGUES } from '../src/data';
import type { Dispatch, GameConfig, PlayerCount } from '../src/types';

const GAMES = Number(process.argv[2] ?? 30);
const PLAYERS = Number(process.argv[3] ?? 3) as PlayerCount;

let eventsPlayed = 0;
const kinds: Record<string, number> = {};
let chronicle: Dispatch[] = [];
let serial = 0;
let problems = 0;
let seen: ReadonlySet<string> = new Set<string>();

useGameStore.subscribe((s, prev) => {
  if (s.game === prev.game || !s.game) return;
  if (!prev.game || prev.game.id !== s.game.id) { chronicle = []; seen = new Set<string>(); }
  const sel = filterNewsworthy(detectStoryBeats(prev.game, s.game), seen, s.game.round);
  seen = sel.seen;
  for (const beat of sel.beats) {
    kinds[beat.kind] = (kinds[beat.kind] ?? 0) + 1;
    const d = beatToDispatch(beat, s.game.round, serial++);
    if (!d.headline.trim() || !d.body.trim() || /undefined|null/.test(d.headline + d.body)) {
      problems++; console.log('PROBLEMA', beat, d);
    } else chronicle.push(d);
  }
});

let lastChronicle: Dispatch[] = [];
let lastEpilogue = '';
for (let g = 0; g < GAMES; g++) {
  const config: GameConfig = {
    playerCount: PLAYERS,
    players: [...ALL_FACTION_IDS].sort(() => Math.random() - 0.5).slice(0, PLAYERS).map((f, i) => ({ name: `CPU ${i + 1}`, factionId: f, isAI: true })),
  };
  const s = useGameStore.getState();
  s.startGame(config);
  for (let turns = 0; turns < 600; turns++) {
    const game = useGameStore.getState().game!;
    if (game.phase === 'GAME_OVER') break;
    const me = game.players[game.currentPlayerIndex]!;
    const ev = aiChooseEvent(game, me.id);
    if (ev) { s.playEventCard(ev.cardId, ev.eventId, ev.ctx); eventsPlayed++; }
    const plan = planAITurn(useGameStore.getState().game!, me.id);
    for (const a of plan.reinforcements) if (a.type === 'CASH_SET' && a.payload?.cardIds) s.cashCardSet(a.payload.cardIds);
    const r = plan.reinforcements.find(a => a.type === 'REINFORCE');
    if (r?.payload?.territoryId) s.placeReinforcement(r.payload.territoryId, useGameStore.getState().reinforcementBudget);
    s.confirmReinforcements();
    for (let k = 0; k < AI_MAX_ATTACKS_PER_TURN; k++) {
      const d = aiChooseAttack(useGameStore.getState().game!, me.id);
      if (!d.shouldAttack || !d.order) break;
      s.attackTerritory(d.order); s.confirmAttack();
      const occ = useGameStore.getState().game!.pendingOccupation;
      if (occ) s.occupy(occ.min);
    }
    s.endAttackPhase();
    const mv = aiChooseMovement(useGameStore.getState().game!, me.id);
    if (mv.shouldMove && mv.fromId && mv.toId && mv.count) s.moveTroops(mv.fromId, mv.toId, mv.count);
    s.endMovementPhase();
  }
  const end = useGameStore.getState().game!;
  const w = end.players.find(p => p.id === end.winner);
  if (w && end.victoryCondition) {
    lastEpilogue = EPILOGUES[w.factionId][end.victoryCondition];
    if (!lastEpilogue) problems++;
  }
  lastChronicle = chronicle;
}

const perGame = Math.round(Object.values(kinds).reduce((a, b) => a + b, 0) / GAMES);
console.log({ games: GAMES, players: PLAYERS, published: kinds, perGame, problems });
console.log('\n— Ultima partita, articoli:', lastChronicle.length);
for (const d of lastChronicle.slice(0, 40)) console.log(`[N${d.round}] ${d.headline} — ${d.body}`);
console.log('\n— Epilogo:', lastEpilogue);
process.exit(problems > 0 ? 1 : 0);
