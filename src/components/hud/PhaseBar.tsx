// ─── PhaseBar ─────────────────────────────────────────────────────────────────
// Barra del turno: chi gioca, a che punto del turno siamo (stepper a 3 fasi),
// cosa fare adesso e i controlli della fase. Sotto-componenti atomici:
// TurnIdentity · PhaseStepper · TroopStepper · PhaseHint.

import { memo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { FACTION_DEFINITIONS, FACTION_LORE } from '../../data';
import type { GamePhase, Player } from '../../types';
import { PHASES, PHASE_INDEX } from './phaseMeta';
import { cssVars } from '../common/cssVars';
import { FactionEmblem } from '../common/FactionEmblem';
import { TroopStepper } from '../common/TroopStepper';

// ─── Sotto-componenti ─────────────────────────────────────────────────────────

const TurnIdentity = memo(function TurnIdentity({ player, round }: { player: Player; round: number }) {
  const faction = FACTION_DEFINITIONS[player.factionId];
  return (
    <div className="turn-id" style={cssVars({ '--faction': faction.color })}>
      <span className="turn-id__emblem" aria-hidden="true">
        <FactionEmblem faction={player.factionId} size={30} />
      </span>
      <div className="turn-id__text">
        <span className="turn-id__night">Notte {round}</span>
        <span className="turn-id__name">{player.name}{player.isAI && <span className="tag">CPU</span>}</span>
        <span className="turn-id__leader">{FACTION_LORE[player.factionId].leader} · {faction.shortName}</span>
      </div>
    </div>
  );
});

const PhaseStepper = memo(function PhaseStepper({ phase }: { phase: GamePhase }) {
  const active = PHASE_INDEX[phase];
  return (
    <ol className="stepper" aria-label="Fasi del turno">
      {PHASES.map(([key, meta], i) => (
        <li
          key={key}
          className={`stepper__step${i === active ? ' is-active' : ''}${i < active ? ' is-done' : ''}`}
          style={cssVars({ '--step': meta.token })}
          aria-current={i === active ? 'step' : undefined}
        >
          <span className="stepper__num">{i < active ? '✓' : i + 1}</span>
          <span className="stepper__label">{meta.label}</span>
        </li>
      ))}
    </ol>
  );
});

// ─── PhaseBar ─────────────────────────────────────────────────────────────────

export const PhaseBar = memo(function PhaseBar() {
  const phase               = useGameStore(s => s.game?.phase);
  const round               = useGameStore(s => s.game?.round ?? 1);
  const current             = useGameStore(s => (s.game ? s.game.players[s.game.currentPlayerIndex] ?? null : null));
  const confirmReinforcements = useGameStore(s => s.confirmReinforcements);
  const endAttackPhase      = useGameStore(s => s.endAttackPhase);
  const endMovementPhase    = useGameStore(s => s.endMovementPhase);
  const reinforcementBudget = useGameStore(s => s.reinforcementBudget);

  const stagingTroops    = useUIStore(s => s.stagingTroops);
  const setStagingTroops = useUIStore(s => s.setStagingTroops);
  const setAttackFrom    = useUIStore(s => s.setAttackFrom);
  const setMoveFrom      = useUIStore(s => s.setMoveFrom);

  if (!phase || !current) return null;

  const meta = PHASES[PHASE_INDEX[phase]]?.[1];
  const human = !current.isAI;

  function handleNextPhase() {
    if (phase === 'REINFORCEMENT') confirmReinforcements();
    else if (phase === 'ATTACK')   { setAttackFrom(null); endAttackPhase(); }
    else if (phase === 'MOVEMENT') { setMoveFrom(null); endMovementPhase(); }
  }

  return (
    <section className="turnbar" style={cssVars({ '--phase': meta?.token ?? 'var(--muted)' })} aria-label="Turno corrente">
      {/* bagliore che attraversa la barra a ogni cambio di fase o di giocatore */}
      <span key={`${current.id}-${phase}`} className="turnbar__sweep" aria-hidden="true" />
      <TurnIdentity player={current} round={round} />
      <PhaseStepper phase={phase} />

      <div className="turnbar__controls">
        {!human ? (
          <span className="cpu-thinking" role="status">
            {FACTION_LORE[current.factionId].leader} sta muovendo
            <span className="cpu-thinking__dots" aria-hidden="true"><i /><i /><i /></span>
          </span>
        ) : (
          <>
            {phase === 'REINFORCEMENT' && (
              <>
                <span className="budget"><strong>{reinforcementBudget}</strong> da piazzare</span>
                <TroopStepper value={Math.min(stagingTroops, Math.max(1, reinforcementBudget))} max={Math.max(1, reinforcementBudget)} onChange={setStagingTroops} />
                <button
                  type="button"
                  className={`btn btn--phase${reinforcementBudget === 0 ? ' btn--ready' : ''}`}
                  onClick={handleNextPhase}
                  disabled={reinforcementBudget > 0}
                >
                  All'attacco →
                </button>
              </>
            )}
            {phase === 'ATTACK' && (
              <button type="button" className="btn btn--phase" onClick={handleNextPhase}>Basta attacchi →</button>
            )}
            {phase === 'MOVEMENT' && (
              <>
                <TroopStepper value={stagingTroops} onChange={setStagingTroops} />
                <button type="button" className="btn btn--phase" onClick={handleNextPhase}>Chiudi la notte →</button>
              </>
            )}
          </>
        )}
      </div>

      {human && meta && <p className="turnbar__hint">{meta.hint}</p>}
    </section>
  );
});
