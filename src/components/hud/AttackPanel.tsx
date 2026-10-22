// ─── AttackPanel ──────────────────────────────────────────────────────────────
// Pannello ancorato in basso sulla mappa mentre un territorio d'attacco è
// selezionato: quanti dadi, un lancio o "fino alla conquista", soglia di arresto.
// Le scelte sono preferenze persistite (uiStore.attackPrefs): il click sul
// bersaglio attacca subito con queste impostazioni, salvo "Chiedi ogni volta".

import { memo, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { maxAttackDice, orderFromPrefs } from '../../engine';
import { TERRITORY_DEFINITIONS } from '../../data';
import { SegmentedControl, type SegmentOption } from '../common/SegmentedControl';
import { TroopStepper } from '../common/TroopStepper';
import type { AttackMode, AttackPreferences } from '../../types';

type DiceChoice = AttackPreferences['dice'];

const MODE_OPTIONS: ReadonlyArray<SegmentOption<AttackMode>> = [
  { value: 'single', label: 'Un lancio' },
  { value: 'blitz',  label: 'Fino alla conquista' },
];

export const AttackPanel = memo(function AttackPanel() {
  const game        = useGameStore(s => s.game);
  const attackTerritory = useGameStore(s => s.attackTerritory);
  const fromId      = useUIStore(s => s.attackFromId);
  const toId        = useUIStore(s => s.attackToId);
  const prefs       = useUIStore(s => s.attackPrefs);
  const setPrefs    = useUIStore(s => s.setAttackPrefs);
  const setAttackTo = useUIStore(s => s.setAttackTo);

  const me = game ? game.players[game.currentPlayerIndex] ?? null : null;
  const troops = fromId && game ? game.territories[fromId].troops : 0;

  // Il massimo dipende anche dal bersaglio (dado extra dei Colletti Bianchi)
  const maxDice = useMemo(() => {
    if (!fromId || !me) return 0;
    const target = toId ?? TERRITORY_DEFINITIONS[fromId].connections[0];
    return target ? maxAttackDice(troops, me.factionId, fromId, target) : 0;
  }, [fromId, toId, me, troops]);

  const diceOptions = useMemo<ReadonlyArray<SegmentOption<DiceChoice>>>(() => {
    const opts: SegmentOption<DiceChoice>[] = [];
    for (let n = 1; n < maxDice; n++) {
      if (n <= 3) opts.push({ value: n as 1 | 2 | 3, label: String(n) });
    }
    opts.push({ value: 'max', label: `Max (${maxDice})` });
    return opts;
  }, [maxDice]);

  const freeTargets = game && me
    ? game.activeEffects.filter(e => e.type === 'RAPPRESAGLIA_TARGET' && e.playerId === me.id)
    : [];

  if (!game || !me || me.isAI || game.phase !== 'ATTACK' || !fromId) return null;
  if (game.pendingAttack || game.pendingOccupation || maxDice < 1) return null;

  const from = TERRITORY_DEFINITIONS[fromId].name;
  // un valore salvato più alto del massimo attuale si legge come "Max"
  const shownDice: DiceChoice = prefs.dice !== 'max' && prefs.dice >= maxDice ? 'max' : prefs.dice;

  const launch = () => {
    if (!toId) return;
    attackTerritory(orderFromPrefs(prefs, fromId, toId, troops, me.factionId));
    setAttackTo(null);
  };

  return (
    <section className="attackpanel" aria-label={`Attacco da ${from}`}>
      {freeTargets.map(e => e.type === 'RAPPRESAGLIA_TARGET' && (
        <p key={e.territoryId} className="attackpanel__reprisal">
          Rappresaglia: il primo lancio su {TERRITORY_DEFINITIONS[e.territoryId].name} è senza perdite per te.
        </p>
      ))}
      <div className="attackpanel__row">
        <span className="attackpanel__label">Dadi</span>
        <SegmentedControl options={diceOptions} value={shownDice} onChange={dice => setPrefs({ dice })} ariaLabel="Dadi d'attacco" size="sm" />
      </div>
      <div className="attackpanel__row">
        <span className="attackpanel__label">Modo</span>
        <SegmentedControl options={MODE_OPTIONS} value={prefs.mode} onChange={mode => setPrefs({ mode })} ariaLabel="Modalità d'attacco" size="sm" />
      </div>
      {prefs.mode === 'blitz' && (
        <div className="attackpanel__row">
          <span className="attackpanel__label">Fermati a</span>
          <TroopStepper value={Math.min(prefs.stopAt, Math.max(2, troops))} max={Math.max(2, troops)} onChange={stopAt => setPrefs({ stopAt: Math.max(2, stopAt) })} />
          <span className="attackpanel__note">truppe rimaste</span>
        </div>
      )}
      <label className="attackpanel__check">
        <input type="checkbox" checked={prefs.confirmEachAttack} onChange={e => setPrefs({ confirmEachAttack: e.target.checked })} />
        Chiedi conferma ogni volta
      </label>
      {prefs.confirmEachAttack && (
        <button type="button" className="btn btn--sodium" onClick={launch} disabled={!toId}>
          {toId ? `Attacca ${TERRITORY_DEFINITIONS[toId].name}` : 'Scegli un bersaglio'}
        </button>
      )}
    </section>
  );
});
