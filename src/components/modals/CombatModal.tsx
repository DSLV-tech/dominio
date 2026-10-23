// ─── CombatModal ──────────────────────────────────────────────────────────────
// Regia dello scontro. Per ogni attacco risolto (pendingAttack) monta una
// CombatSequence che:
//  - mette in scena l'arena 3D (dadi lanciati, carica, cadute) — caricata a
//    richiesta e scaricata in anticipo all'avvio della partita;
//  - ripiega sui dadi 2D se WebGL manca o la scena 3D va in errore;
//  - mostra in HTML ciò che deve restare leggibile: chi attacca chi, i valori
//    dei dadi, le perdite, l'esito; pulsanti Salta / Continua.
// La fase corrente viene pubblicata in uiStore.combatStage: la CPU aspetta
// l'esito prima di proseguire.

import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { FACTION_DEFINITIONS, TERRITORY_DEFINITIONS, TERRITORY_LORE } from '../../data';
import { COMBAT_STAGES, prefersReducedMotion } from '../../data/combatTimeline';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { FactionEmblem } from '../common/FactionEmblem';
import { cssVars } from '../common/cssVars';
import { hasWebGL } from '../common/webgl';
import { CombatDice2D } from '../combat/CombatDice2D';
import { buildCombatView } from '../combat/combatView';
import type { CombatSideView, CombatStage, GameState, PendingAttack } from '../../types';
import { useDrivesCurrent } from '../../online/useControl';

const CombatArena3D = lazy(() => import('../combat/CombatArena3D'));

const stageIndex = (s: CombatStage): number => COMBAT_STAGES.indexOf(s);

// ── Sotto-componenti ─────────────────────────────────────────────────────────

const SideHeader = memo(function SideHeader({ side, territory, align }: {
  readonly side: CombatSideView; readonly territory: string; readonly align: 'start' | 'end';
}) {
  const color = side.faction ? FACTION_DEFINITIONS[side.faction].textColor : 'var(--muted)';
  return (
    <div className={`combat__side combat__side--${align}`} style={cssVars({ '--side': color })}>
      <FactionEmblem faction={side.faction} size={44} />
      <div className="combat__side-text">
        <span className="combat__role">{side.side === 'attacker' ? 'Attacca' : 'Difende'}</span>
        <strong className="combat__name">{side.name}</strong>
        <span className="combat__terr">{territory}</span>
      </div>
    </div>
  );
});

const DiceTally = memo(function DiceTally({ side, visible }: { readonly side: CombatSideView; readonly visible: boolean }) {
  return (
    <ol className={`tally tally--${side.side}`} data-visible={visible} aria-label={`Dadi ${side.side === 'attacker' ? 'attacco' : 'difesa'}`}>
      {side.dice.map((d, i) => {
        const v = side.verdicts[i];
        return (
          <li key={i} className={`tally__die${v === true ? ' is-won' : v === false ? ' is-lost' : ''}`}>
            <span className="sr-only">{v === true ? 'vinto' : v === false ? 'perso' : 'non confrontato'}: </span>{d}
          </li>
        );
      })}
    </ol>
  );
});

function ArenaLoading() {
  return (
    <div className="combat__loading" role="status">
      <span className="spinner" aria-hidden="true" />
      La piazza si prepara…
    </div>
  );
}

/** Riepilogo dell'attacco automatico: la scena anima solo l'ultimo lancio. */
const BlitzSummary = memo(function BlitzSummary({ attack, visible }: { readonly attack: PendingAttack; readonly visible: boolean }) {
  const total = attack.attackerLosses + attack.defenderLosses;
  const attShare = total > 0 ? Math.round((attack.defenderLosses / total) * 100) : 50;
  return (
    <div className="blitz" data-visible={visible} aria-live="polite">
      <span>
        <strong>{attack.rounds.length}</strong> lanci · perdite totali: attacco −{attack.attackerLosses}, difesa −{attack.defenderLosses}
      </span>
      <div className="blitz__bar" aria-hidden="true">
        <i className="is-att" style={{ width: `${attShare}%` }} />
        <i className="is-def" style={{ width: `${100 - attShare}%` }} />
      </div>
    </div>
  );
});

// ── Sequenza (una per attacco) ───────────────────────────────────────────────

interface CombatSequenceProps {
  readonly game: GameState;
  readonly attack: PendingAttack;
  readonly onContinue: () => void;
}

function seedOf(a: PendingAttack): number {
  return [...a.rolls.attacker, ...a.rolls.defender].reduce((h, d) => (h * 31 + d) >>> 0, a.fromId.charCodeAt(0) * 977 + a.toId.charCodeAt(2));
}

function CombatSequence({ game, attack, onContinue }: CombatSequenceProps) {
  // vista congelata al primo render: lo stato di gioco può cambiare sotto
  const [view] = useState(() => buildCombatView(game, attack, prefersReducedMotion()));
  const [stage, setStage] = useState<CombatStage>('intro');
  const [skipToken, setSkipToken] = useState(0);
  const [use3D, setUse3D] = useState(() => hasWebGL());
  const setCombatStage = useUIStore(s => s.setCombatStage);
  const current = game.players[game.currentPlayerIndex];
  const isAI = current?.isAI ?? false;
  // online: lo scontro di un altro dispositivo si guarda, lo chiude chi attacca
  const drives = useDrivesCurrent();
  const remoteName = !drives && current && !current.isAI ? current.name : null;
  const seed = useMemo(() => seedOf(attack), [attack]);

  const onStage = useCallback((st: CombatStage) => {
    setStage(prev => (stageIndex(st) > stageIndex(prev) ? st : prev));
  }, []);

  useEffect(() => { setCombatStage(stage); }, [stage, setCombatStage]);
  useEffect(() => () => setCombatStage(null), [setCombatStage]);

  const done = stage === 'result';
  const skip = useCallback(() => setSkipToken(t => t + 1), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !done) skip();
      if ((e.key === 'Enter' || e.key === ' ') && done && drives) { e.preventDefault(); onContinue(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, drives, skip, onContinue]);

  const fromName = TERRITORY_DEFINITIONS[attack.fromId].name;
  const toName = TERRITORY_DEFINITIONS[attack.toId].name;
  const showTally = stageIndex(stage) >= stageIndex('compare');

  return (
    <div className="combat" role="dialog" aria-modal="true" aria-labelledby="combat-title">
      <div className="combat__card">
        <h2 id="combat-title" className="sr-only">Scontro: {fromName} contro {toName}</h2>
        <header className="combat__head">
          <SideHeader side={view.attacker} territory={fromName} align="start" />
          <span className="combat__vs" aria-hidden="true">⚔</span>
          <SideHeader side={view.defender} territory={toName} align="end" />
        </header>
        <p className="combat__lore">{TERRITORY_LORE[attack.toId].line}</p>

        <div className="combat__stage">
          {use3D ? (
            <ErrorBoundary fallback={() => null} onError={() => setUse3D(false)}>
              <Suspense fallback={<ArenaLoading />}>
                <CombatArena3D view={view} seed={seed} skipToken={skipToken} onStage={onStage} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <CombatDice2D view={view} skipToken={skipToken} onStage={onStage} />
          )}
          {use3D && (
            <div className="combat__tallies">
              <DiceTally side={view.attacker} visible={showTally} />
              <DiceTally side={view.defender} visible={showTally} />
            </div>
          )}
          {(isAI || remoteName) && <span className="combat__cpu">{remoteName ? `Turno di ${remoteName}` : 'Turno CPU'}</span>}
        </div>

        {attack.mode === 'blitz' && attack.rounds.length > 1 && (
          <BlitzSummary attack={attack} visible={done} />
        )}

        <div className="combat__outcome" data-visible={done} aria-live="polite">
          <div className="combat__losses">
            <span className={view.attacker.fallen.some(Boolean) ? 'is-loss' : 'is-ok'}>
              {attack.attackerLosses > 0 ? `${view.attacker.name}: −${attack.attackerLosses}` : `${view.attacker.name}: nessuna perdita`}
            </span>
            <span className={attack.defenderLosses > 0 ? 'is-loss' : 'is-ok'}>
              {attack.defenderLosses > 0 ? `${view.defender.name}: −${attack.defenderLosses}` : `${view.defender.name}: nessuna perdita`}
            </span>
          </div>
          {done && (
            <p className={`combat__banner ${attack.conquered ? 'is-win' : 'is-hold'}`}>
              {attack.conquered ? `Conquista: ${toName}!` : `${toName} resiste!`}
            </p>
          )}
        </div>

        <div className="combat__actions">
          {!done && (
            <button type="button" className="btn btn--ghost" onClick={skip}>
              Salta <kbd>Esc</kbd>
            </button>
          )}
          {drives ? (
            <button type="button" className="btn btn--sodium" onClick={onContinue} disabled={!done} autoFocus={done}>
              Continua
            </button>
          ) : (
            done && <span className="combat__wait" role="status">Aspetta {current?.name ?? 'l\'avversario'}…</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modale ───────────────────────────────────────────────────────────────────

const attackKeys = new WeakMap<PendingAttack, number>();
let attackCounter = 0;
function keyOf(a: PendingAttack): number {
  let k = attackKeys.get(a);
  if (k === undefined) { k = ++attackCounter; attackKeys.set(a, k); }
  return k;
}

export const CombatModal = memo(function CombatModal() {
  const game = useGameStore(s => s.game);
  const confirmAttack = useGameStore(s => s.confirmAttack);

  // scarica in anticipo arena e modelli, così il primo scontro parte subito
  useEffect(() => {
    if (!hasWebGL()) return;
    void import('../combat/useCombatModels').then(m => m.preloadCombatModels()).catch(() => undefined);
    void import('../combat/CombatArena3D').catch(() => undefined);
  }, []);

  const attack = game?.pendingAttack ?? null;
  if (!game || !attack) return null;
  return <CombatSequence key={keyOf(attack)} game={game} attack={attack} onContinue={confirmAttack} />;
});
