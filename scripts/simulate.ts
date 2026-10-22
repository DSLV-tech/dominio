// Simulazione headless: N partite CPU vs CPU sul vero gameStore.
// Riproduce la sequenza di useAIPlayer (senza ritardi) per verificare che
// le partite arrivino alla fine. Uso: npx tsx scripts/simulate.ts [partite] [giocatori]
import { TERRITORY_CARDS } from '../src/data';
import { useGameStore } from '../src/store/gameStore';
import { planAITurn, aiChooseEvent, aiChooseAttack, aiChooseMovement, AI_MAX_ATTACKS_PER_TURN } from '../src/engine';
import { ALL_FACTION_IDS } from '../src/data';
import type { GameConfig, PlayerCount } from '../src/types';

const GAMES = Number(process.argv[2] ?? 20);
const PLAYERS = Number(process.argv[3] ?? 4) as PlayerCount;
const MAX_TURNS = 600;

const results: Record<string, number> = {};
const rounds: number[] = [];
let stuck = 0;
let eventsPlayed = 0;

for (let g = 0; g < GAMES; g++) {
  const config: GameConfig = {
    playerCount: PLAYERS,
    movementRule: g % 2 ? 'chain' : 'adjacent',
    players: [...ALL_FACTION_IDS].sort(() => Math.random() - 0.5).slice(0, PLAYERS).map((f, i) => ({ name: `CPU ${i + 1}`, factionId: f, isAI: true })),
  };
  const st = useGameStore.getState();
  st.startGame(config);
  let turns = 0;
  while (turns++ < MAX_TURNS) {
    const s = useGameStore.getState();
    const game = s.game!;
    if (game.phase === 'GAME_OVER') break;
    const me = game.players[game.currentPlayerIndex]!;
    const ev = aiChooseEvent(game, me.id);
    if (ev) { s.playEventCard(ev.cardId, ev.eventId, ev.ctx); eventsPlayed++; }
    const plan = planAITurn(useGameStore.getState().game!, me.id);
    // rinforzi
    for (const a of plan.reinforcements) if (a.type === 'CASH_SET' && a.payload?.cardIds) s.cashCardSet(a.payload.cardIds);
    const r = plan.reinforcements.find(a => a.type === 'REINFORCE');
    const budget = useGameStore.getState().reinforcementBudget;
    if (r?.payload?.territoryId) s.placeReinforcement(r.payload.territoryId, budget);
    s.confirmReinforcements();
    // attacchi
    for (let k = 0; k < AI_MAX_ATTACKS_PER_TURN; k++) {
      const d = aiChooseAttack(useGameStore.getState().game!, me.id);
      if (!d.shouldAttack || !d.order) break;
      s.attackTerritory(d.order); s.confirmAttack();
      const occ = useGameStore.getState().game!.pendingOccupation;
      if (occ) s.occupy(occ.min);
    }
    s.endAttackPhase();
    // spostamento (deciso sullo stato reale)
    const mv = aiChooseMovement(useGameStore.getState().game!, me.id);
    if (mv.shouldMove && mv.fromId && mv.toId && mv.count) s.moveTroops(mv.fromId, mv.toId, mv.count);
    s.endMovementPhase();
  }
  const end = useGameStore.getState().game!;
  // Le carte territorio non si perdono né si duplicano mai
  const terrCards = end.decks.territory.length + end.decks.discard.length
    + Object.values(end.hands).reduce((n, h) => n + h.filter(c => c.kind === 'TERRITORY').length, 0);
  if (terrCards !== TERRITORY_CARDS.length) { console.error(`Carte territorio: ${terrCards} invece di ${TERRITORY_CARDS.length}`); process.exit(1); }
  if (end.phase !== 'GAME_OVER') { stuck++; continue; }
  const wi = end.players.findIndex(p => p.id === end.winner);
  const key = `${end.players[wi]?.factionId} (posto ${wi + 1})`;
  results[key] = (results[key] ?? 0) + 1;
  rounds.push(end.round);
}
rounds.sort((a, b) => a - b);
console.log({ eventsPlayed, games: GAMES, players: PLAYERS, finished: GAMES - stuck, stuck, results,
  roundsMedian: rounds[Math.floor(rounds.length / 2)], roundsMax: rounds.at(-1) });
