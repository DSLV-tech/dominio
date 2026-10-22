// ─── SetupScreen ──────────────────────────────────────────────────────────────
// Lobby: numero di giocatori, nome, CPU/umano e fazione. Ogni fazione mostra
// il proprio dossier (leader, motto, movente, abilità) per legare la scelta
// strategica alla storia.

import { memo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useStoryStore } from '../../store/storyStore';
import { FACTION_DEFINITIONS, ALL_FACTION_IDS, FACTION_LORE, ZONE_DEFINITIONS } from '../../data';
import type { FactionId, GameConfig, MovementRule, PlayerCount } from '../../types';
import { SegmentedControl, type SegmentOption } from '../common/SegmentedControl';
import { cssVars } from '../common/cssVars';
import { FactionEmblem } from '../common/FactionEmblem';
import { InstallHint } from './InstallHint';

interface PlayerDraft {
  readonly name: string;
  readonly factionId: FactionId;
  readonly isAI: boolean;
}

const COUNT_OPTIONS: ReadonlyArray<SegmentOption<PlayerCount>> = [
  { value: 2, label: '2 giocatori' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

function makeDefault(index: number, faction: FactionId): PlayerDraft {
  return { name: index === 0 ? 'Tu' : FACTION_LORE[faction].leader.split(' ')[0] ?? `CPU ${index}`, factionId: faction, isAI: index > 0 };
}

// ─── Scheda giocatore ─────────────────────────────────────────────────────────

interface PlayerCardProps {
  readonly index: number;
  readonly draft: PlayerDraft;
  readonly taken: ReadonlySet<FactionId>;
  readonly onChange: (index: number, patch: Partial<PlayerDraft>) => void;
}

const PlayerCard = memo(function PlayerCard({ index, draft, taken, onChange }: PlayerCardProps) {
  const faction = FACTION_DEFINITIONS[draft.factionId];
  const lore = FACTION_LORE[draft.factionId];
  const home = ZONE_DEFINITIONS[faction.startingZone];

  return (
    <li className="pcard" style={cssVars({ '--faction': faction.color, '--faction-bg': faction.bgColor })}>
      <div className="pcard__top">
        <label className="sr-only" htmlFor={`pname-${index}`}>Nome giocatore {index + 1}</label>
        <input
          id={`pname-${index}`}
          className="input"
          value={draft.name}
          maxLength={18}
          onChange={e => onChange(index, { name: e.target.value })}
          placeholder={`Giocatore ${index + 1}`}
        />
        <SegmentedControl<'HUMAN' | 'CPU'>
          options={[{ value: 'HUMAN', label: 'Umano' }, { value: 'CPU', label: 'CPU' }]}
          value={draft.isAI ? 'CPU' : 'HUMAN'}
          onChange={v => onChange(index, { isAI: v === 'CPU' })}
          ariaLabel={`Controllo giocatore ${index + 1}`}
          size="sm"
        />
      </div>

      <div className="pcard__factions" role="radiogroup" aria-label="Fazione">
        {ALL_FACTION_IDS.map(fid => {
          const f = FACTION_DEFINITIONS[fid];
          const selected = draft.factionId === fid;
          const disabled = taken.has(fid) && !selected;
          return (
            <button
              key={fid}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              className={`fchip${selected ? ' is-active' : ''}`}
              style={cssVars({ '--chip': f.color })}
              onClick={() => onChange(index, { factionId: fid })}
            >
              {f.shortName}
            </button>
          );
        })}
      </div>

      <div className="dossier">
        <div className="dossier__head">
          <span className="dossier__faction">
            <FactionEmblem faction={draft.factionId} size={30} className="dossier__emblem" />
            {faction.name}
          </span>
          <span className="dossier__home">base: {home?.name}</span>
        </div>
        <p className="dossier__leader">{lore.leader} <span>· {lore.leaderRole}</span></p>
        <p className="dossier__motto">«{lore.motto}»</p>
        <p className="dossier__motive">{lore.motive}</p>
        <p className="dossier__ability"><strong>{faction.abilityName}</strong> — {faction.abilityDescription}</p>
      </div>
    </li>
  );
});

// ─── Lobby ────────────────────────────────────────────────────────────────────

const MOVE_OPTIONS: ReadonlyArray<SegmentOption<MovementRule>> = [
  { value: 'adjacent', label: 'Solo vicini' },
  { value: 'chain', label: 'A catena' },
];

export function SetupScreen() {
  const startGame = useGameStore(s => s.startGame);
  const replayPrologue = useStoryStore(s => s.replayPrologue);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [drafts, setDrafts] = useState<readonly PlayerDraft[]>(() => ALL_FACTION_IDS.map((f, i) => makeDefault(i, f)));
  const [movementRule, setMovementRule] = useState<MovementRule>('adjacent');
  const [error, setError] = useState<string | null>(null);

  const active = drafts.slice(0, playerCount);
  const taken = new Set(active.map(d => d.factionId));

  function setDraft(index: number, patch: Partial<PlayerDraft>) {
    setError(null);
    setDrafts(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function handleStart() {
    if (new Set(active.map(p => p.factionId)).size !== active.length) {
      setError('Ogni giocatore deve guidare una fazione diversa.');
      return;
    }
    if (active.every(p => p.isAI)) {
      setError('Serve almeno un giocatore umano.');
      return;
    }
    const config: GameConfig = {
      playerCount,
      players: active.map((p, i) => ({ ...p, name: p.name.trim() || `Giocatore ${i + 1}` })),
      movementRule,
    };
    startGame(config);
  }

  return (
    <main className="lobby">
      <header className="lobby__head">
        <span className="brand-mark brand-mark--xl">DOMINIO</span>
        <p className="lobby__sub">Trenta notti. Quattro fazioni. Una sola città.</p>
        <button type="button" className="link" onClick={replayPrologue}>Rivedi il prologo</button>
        <InstallHint />
      </header>

      <section className="lobby__config" aria-label="Configura la partita">
        <div className="lobby__row">
          <span className="label">Giocatori</span>
          <SegmentedControl options={COUNT_OPTIONS} value={playerCount} onChange={setPlayerCount} ariaLabel="Numero di giocatori" />
        </div>

        <div className="lobby__row">
          <span className="label">Spostamento</span>
          <SegmentedControl options={MOVE_OPTIONS} value={movementRule} onChange={setMovementRule} ariaLabel="Regola di spostamento" />
        </div>
        <p className="lobby__hint">
          {movementRule === 'adjacent'
            ? 'Le truppe passano solo a un territorio vicino.'
            : 'Le truppe attraversano qualsiasi catena di tuoi territori.'}
        </p>

        <ol className="pcard-list">
          {active.map((draft, i) => (
            <PlayerCard key={i} index={i} draft={draft} taken={taken} onChange={setDraft} />
          ))}
        </ol>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button type="button" className="btn btn--sodium btn--xl" onClick={handleStart}>
          Inizia la partita →
        </button>
      </section>
    </main>
  );
}
