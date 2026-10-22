// ─── useAIPlayer ──────────────────────────────────────────────────────────────
// Esegue automaticamente il turno quando tocca a un giocatore CPU.
//
// Design: un useEffect che reagisce a (fase, giocatore corrente).
//  - Rinforzi e spostamento: decisi sullo stato all'inizio della fase.
//  - Attacchi: decisi UNO ALLA VOLTA sullo stato reale dopo ogni tiro di dadi
//    (prima erano pianificati in anticipo su esiti simulati, che divergevano
//    da quelli veri e bloccavano le partite in stallo).
// Tutte le mutazioni passano dalle azioni del gameStore; i timer leggono lo
// stato fresco con getState() per evitare closure obsolete.

import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useStoryStore } from '../store/storyStore';
import { TERRITORY_DEFINITIONS, getBoardMeta } from '../data';
import { CPU_DELAY_FACTOR, useSettingsStore } from '../store/settingsStore';
import type { GameState, TerritoryId } from '../types';
import { AI_MAX_ATTACKS_PER_TURN, aiChooseAttack, aiChooseEvent, aiChooseMovement, planAITurn, summarizeTurn } from '../engine';
import { AI_COMBAT_SPEED, AI_RESULT_HOLD_MS, combatDurationMs } from '../data/combatTimeline';

const DELAY_REINFORCE = 400;  // ms fra un'azione di rinforzo e l'altra
const DELAY_EVENT     = 900;  // ms prima/dopo una carta evento giocata dalla CPU
const DELAY_ATTACK    = 650;  // ms prima di ogni attacco CPU
const DELAY_DICE      = 900;  // ms senza scena di combattimento (modale non montato)
const COMBAT_POLL     = 120;  // ms fra un controllo e l'altro della scena di combattimento
// tetto di sicurezza: anche se l'arena 3D si blocca, la partita prosegue
const COMBAT_TIMEOUT  = combatDurationMs(AI_COMBAT_SPEED) + 6000;
const DELAY_MOVE      = 500;  // ms prima dello spostamento
const DELAY_ENDPHASE  = 300;  // ms prima di passare alla fase successiva

/** Stato a inizio turno CPU, per il riepilogo di fine turno. */
let turnStart: { readonly playerId: string; readonly state: GameState; reinforced: number } | null = null;

let focusSerial = 0;
/** Porta la camera su un territorio (o sul punto medio di due) se "segui la CPU" è attivo. */
function focusOn(ids: readonly TerritoryId[], distance: number): void {
  if (!useSettingsStore.getState().followCpu) return;
  try {
    const anchors = getBoardMeta().territories;
    const pts = ids.map(id => anchors[id]);
    const x = pts.reduce((n, p) => n + p.x, 0) / pts.length;
    const z = pts.reduce((n, p) => n + p.z, 0) / pts.length;
    useUIStore.getState().setCameraFocus({ x, z, distance, key: `f${++focusSerial}` });
  } catch {
    /* metadati 3D non disponibili: la vista 2D non ha camera da muovere */
  }
}

export function useAIPlayer() {
  const phase         = useGameStore(s => s.game?.phase);
  const currentIndex  = useGameStore(s => s.game?.currentPlayerIndex);
  // La CPU aspetta che l'interludio narrativo venga chiuso
  const storyPaused   = useStoryStore(s => s.interlude !== null);
  const runningRef    = useRef(false);

  useEffect(() => {
    const store = useGameStore.getState();
    const ui = useUIStore.getState();
    const game = store.game;
    if (!game || game.phase === 'GAME_OVER' || storyPaused) return;

    const me = game.players[game.currentPlayerIndex];
    if (!me?.isAI || runningRef.current) return;
    runningRef.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    const factor = CPU_DELAY_FACTOR[useSettingsStore.getState().cpuSpeed];
    const later = (delay: number, fn: () => void) => {
      timers.push(setTimeout(() => { if (!cancelled) fn(); }, delay * factor));
    };
    // il controllo della scena di combattimento non segue la velocità scelta
    const poll = (fn: () => void) => { timers.push(setTimeout(() => { if (!cancelled) fn(); }, COMBAT_POLL)); };
    const done = () => { runningRef.current = false; };

    // ── Rinforzi ────────────────────────────────────────────────────────────
    if (game.phase === 'REINFORCEMENT') {
      if (!turnStart || turnStart.playerId !== me.id || turnStart.state.round !== game.round) {
        turnStart = { playerId: me.id, state: game, reinforced: 0 };
      }
      const runReinforce = () => {
      const g = useGameStore.getState().game;
      if (!g) { done(); return; }
      const plan = planAITurn(g, me.id);
      let t = 0;
      for (const action of plan.reinforcements) {
        if (action.type === 'CASH_SET' && action.payload?.cardIds) {
          const ids = action.payload.cardIds;
          later((t += DELAY_REINFORCE), () => {
            useGameStore.getState().cashCardSet(ids);
            ui.addLog(`${me.name} incassa un set di carte.`);
          });
        }
      }
      const reinforce = plan.reinforcements.find(a => a.type === 'REINFORCE');
      const tid = reinforce?.payload?.territoryId;
      if (tid) {
        later((t += DELAY_REINFORCE), () => {
          const s = useGameStore.getState();
          const budget = s.reinforcementBudget;
          if (turnStart) turnStart.reinforced += budget;
          focusOn([tid], 14);
          ui.addTrace({ kind: 'reinforce', to: tid });
          s.placeReinforcement(tid, budget);
          ui.addLog(`${me.name} rinforza ${TERRITORY_DEFINITIONS[tid].name} con ${budget} truppe.`);
        });
      }
      later((t += DELAY_ENDPHASE), () => { useGameStore.getState().confirmReinforcements(); done(); });
      };

      // Una carta evento (se conviene) prima dei rinforzi, con notifica leggibile
      const event = aiChooseEvent(game, me.id);
      if (event) {
        later(DELAY_EVENT, () => {
          const log = useGameStore.getState().playEventCard(event.cardId, event.eventId, event.ctx);
          ui.addLog(log);
          ui.showNotification(log, 4000);
          later(DELAY_EVENT, runReinforce);
        });
      } else {
        runReinforce();
      }
    }

    // ── Attacchi (reattivi) ─────────────────────────────────────────────────
    else if (game.phase === 'ATTACK') {
      let count = 0;
      const step = () => {
        const s = useGameStore.getState();
        const g = s.game;
        if (!g || g.phase !== 'ATTACK') { done(); return; }
        const d = count < AI_MAX_ATTACKS_PER_TURN ? aiChooseAttack(g, me.id) : null;
        if (!d?.shouldAttack || !d.order) {
          later(DELAY_ENDPHASE, () => {
            useGameStore.getState().endAttackPhase();
            if (count === 0) ui.addLog(`${me.name} resta in difesa.`);
            done();
          });
          return;
        }
        const order = d.order;
        const { fromId, toId } = order;
        focusOn([fromId, toId], 13);
        later(DELAY_ATTACK, () => {
          ui.addTrace({ kind: 'attack', from: fromId, to: toId });
          useGameStore.getState().attackTerritory(order);
          ui.addLog(`${me.name} attacca ${TERRITORY_DEFINITIONS[toId].name} da ${TERRITORY_DEFINITIONS[fromId].name}.`);
          count++;
          // Aspetta che la scena dello scontro mostri l'esito, poi lo lascia
          // a schermo un attimo. Se il modale non c'è, ripiega sul ritardo fisso.
          const confirm = () => { useGameStore.getState().confirmAttack(); step(); };
          let waited = 0;
          const waitCombat = () => {
            const stage = useUIStore.getState().combatStage;
            if (stage === 'result') { later(AI_RESULT_HOLD_MS, confirm); return; }
            if (!useGameStore.getState().game?.pendingAttack) { step(); return; } // chiuso a mano
            if ((stage === null && waited >= 600) || waited >= COMBAT_TIMEOUT) { later(DELAY_DICE, confirm); return; }
            waited += COMBAT_POLL;
            poll(waitCombat);
          };
          poll(waitCombat);
        });
      };
      step();
    }

    // ── Spostamento ─────────────────────────────────────────────────────────
    else if (game.phase === 'MOVEMENT') {
      const mv = aiChooseMovement(game, me.id);
      let t = 0;
      if (mv.shouldMove && mv.fromId && mv.toId && mv.count) {
        const { fromId, toId, count } = mv;
        focusOn([fromId, toId], 15);
        later((t += DELAY_MOVE), () => {
          ui.addTrace({ kind: 'move', from: fromId, to: toId });
          useGameStore.getState().moveTroops(fromId, toId, count);
          ui.addLog(`${me.name} sposta ${count} truppe da ${TERRITORY_DEFINITIONS[fromId].name} a ${TERRITORY_DEFINITIONS[toId].name}.`);
        });
      }
      later((t += DELAY_ENDPHASE), () => {
        ui.showNotification(`Fine turno CPU: ${me.name}`);
        ui.setCameraFocus(null);
        const after = useGameStore.getState().game;
        if (turnStart && turnStart.playerId === me.id && after) {
          ui.setTurnRecap(summarizeTurn(turnStart.state, after, me.id, turnStart.reinforced));
          turnStart = null;
        }
        useGameStore.getState().endMovementPhase();
        done();
      });
    } else {
      done();
    }

    return () => { cancelled = true; timers.forEach(clearTimeout); done(); };
  }, [phase, currentIndex, storyPaused]);
}
