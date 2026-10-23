// ─── SetupScreen ──────────────────────────────────────────────────────────────
// Lobby: numero di giocatori, nome, CPU/umano e fazione. Ogni fazione mostra
// il proprio dossier (leader, motto, movente, abilità) per legare la scelta
// strategica alla storia.
//
// Due impaginazioni con gli stessi pezzi (FactionPicker, Dossier):
// - desktop/tablet: una scheda completa per giocatore;
// - telefono (useIsNarrow): tutto in uno schermo, senza scorrere. I giocatori
//   sono righe compatte; si tocca una riga per sceglierne la fazione, e sotto
//   compaiono un solo selettore e un solo dossier.

import { memo, useId, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useStoryStore } from '../../store/storyStore';
import { FACTION_DEFINITIONS, ALL_FACTION_IDS, FACTION_LORE, ZONE_DEFINITIONS } from '../../data';
import type { FactionId, GameConfig, MovementRule, PlayerCount } from '../../types';
import { SegmentedControl, type SegmentOption } from '../common/SegmentedControl';
import { cssVars } from '../common/cssVars';
import { FactionEmblem } from '../common/FactionEmblem';
import { useIsNarrow } from '../../hooks/useIsNarrow';
import { InstallHint } from './InstallHint';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface PlayerDraft {
  readonly name: string;
  readonly factionId: FactionId;
  readonly isAI: boolean;
}

/** Fazioni degli altri giocatori → nome di chi le guida (toccarle le scambia). */
type TakenFactions = ReadonlyMap<FactionId, string>;

type DraftChange = (index: number, patch: Partial<PlayerDraft>) => void;

type Control = 'HUMAN' | 'CPU';

// ─── Opzioni e funzioni pure ──────────────────────────────────────────────────

const COUNT_OPTIONS: ReadonlyArray<SegmentOption<PlayerCount>> = [
  { value: 2, label: '2 giocatori' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

const COUNT_OPTIONS_COMPACT: ReadonlyArray<SegmentOption<PlayerCount>> = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

const MOVE_OPTIONS: ReadonlyArray<SegmentOption<MovementRule>> = [
  { value: 'adjacent', label: 'Solo vicini' },
  { value: 'chain', label: 'A catena' },
];

const MOVE_OPTIONS_COMPACT: ReadonlyArray<SegmentOption<MovementRule>> = [
  { value: 'adjacent', label: 'Vicini' },
  { value: 'chain', label: 'Catena' },
];

const CONTROL_OPTIONS: ReadonlyArray<SegmentOption<Control>> = [
  { value: 'HUMAN', label: 'Umano' },
  { value: 'CPU', label: 'CPU' },
];

const MOVE_HINT: Record<MovementRule, string> = {
  adjacent: 'Le truppe passano solo a un territorio vicino.',
  chain: 'Le truppe attraversano qualsiasi catena di tuoi territori.',
};

function leaderName(faction: FactionId): string {
  return FACTION_LORE[faction].leader.split(' ')[0] ?? faction;
}

function makeDefault(index: number, faction: FactionId): PlayerDraft {
  return { name: index === 0 ? 'Tu' : leaderName(faction), factionId: faction, isAI: index > 0 };
}

function displayName(draft: PlayerDraft, index: number): string {
  return draft.name.trim() || `Giocatore ${index + 1}`;
}

/** Cambio fazione: se il nome era quello del capo della vecchia fazione, segue la nuova. */
function withFaction(draft: PlayerDraft, factionId: FactionId): PlayerDraft {
  const name = draft.name === leaderName(draft.factionId) ? leaderName(factionId) : draft.name;
  return { ...draft, factionId, name };
}

/**
 * Applica una modifica alla scheda `index`. Se la fazione scelta è già di un
 * altro giocatore, i due se la scambiano: con 4 giocatori tutte le
 * fazioni sono occupate e lo scambio è l'unico modo di cambiarla.
 */
function applyPatch(drafts: readonly PlayerDraft[], index: number, patch: Partial<PlayerDraft>): readonly PlayerDraft[] {
  const current = drafts[index];
  if (!current) return drafts;
  const { factionId, ...rest } = patch;
  if (!factionId || factionId === current.factionId) {
    return drafts.map((d, i) => (i === index ? { ...d, ...rest } : d));
  }
  // Si cerca anche tra le schede nascoste (meno giocatori): così le quattro
  // fazioni restano sempre distinte quando si torna a 3 o 4 giocatori.
  const other = drafts.findIndex((d, i) => i !== index && d.factionId === factionId);
  return drafts.map((d, i) => {
    if (i === index) return withFaction({ ...d, ...rest }, factionId);
    if (i === other) return withFaction(d, current.factionId);
    return d;
  });
}

function takenFor(active: readonly PlayerDraft[], index: number): TakenFactions {
  return new Map(active.flatMap((d, i) => (i === index ? [] : [[d.factionId, displayName(d, i)] as const])));
}

// ─── FactionPicker ────────────────────────────────────────────────────────────

interface FactionPickerProps {
  readonly value: FactionId;
  readonly taken: TakenFactions;
  readonly onPick: (faction: FactionId) => void;
  readonly ariaLabel: string;
}

const FactionPicker = memo(function FactionPicker({ value, taken, onPick, ariaLabel }: FactionPickerProps) {
  return (
    <div className="pcard__factions" role="radiogroup" aria-label={ariaLabel}>
      {ALL_FACTION_IDS.map(fid => {
        const f = FACTION_DEFINITIONS[fid];
        const selected = value === fid;
        const owner = selected ? undefined : taken.get(fid);
        return (
          <button
            key={fid}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={owner ? `${f.name}, ora di ${owner}: tocca per scambiare` : f.name}
            title={owner ? `Scambia con ${owner}` : undefined}
            className={`fchip${selected ? ' is-active' : ''}${owner ? ' is-taken' : ''}`}
            style={cssVars({ '--chip': f.color })}
            onClick={() => onPick(fid)}
          >
            <FactionEmblem faction={fid} size={22} className="fchip__emblem" />
            <span className="fchip__name">{f.shortName}</span>
          </button>
        );
      })}
    </div>
  );
});

// ─── Dossier ──────────────────────────────────────────────────────────────────

interface DossierProps {
  readonly factionId: FactionId;
}

const Dossier = memo(function Dossier({ factionId }: DossierProps) {
  const faction = FACTION_DEFINITIONS[factionId];
  const lore = FACTION_LORE[factionId];
  const home = ZONE_DEFINITIONS[faction.startingZone];
  // Sul telefono restano visibili solo fazione e abilità; base, capo, motto e
  // movente si aprono a richiesta (su desktop è sempre tutto visibile).
  const [open, setOpen] = useState(false);
  const storyId = useId();

  return (
    <div id={storyId} className={`dossier${open ? ' is-open' : ''}`} style={cssVars({ '--faction': faction.color, '--faction-bg': faction.bgColor })}>
      <div className="dossier__head">
        <span className="dossier__faction">
          <FactionEmblem faction={factionId} size={30} className="dossier__emblem" />
          {faction.name}
        </span>
        <span className="dossier__home">base: {home?.name}</span>
      </div>
      <p className="dossier__leader">{lore.leader} <span>· {lore.leaderRole}</span></p>
      <p className="dossier__motto">«{lore.motto}»</p>
      <p className="dossier__motive">{lore.motive}</p>
      <button
        type="button"
        className="dossier__more"
        aria-expanded={open}
        aria-controls={storyId}
        onClick={() => setOpen(o => !o)}
      >
        {open ? 'Chiudi il dossier' : 'Leggi il dossier'}
      </button>
      <p className="dossier__ability"><strong>{faction.abilityName}</strong> — {faction.abilityDescription}</p>
    </div>
  );
});

// ─── Scheda giocatore (desktop/tablet) ────────────────────────────────────────

interface PlayerCardProps {
  readonly index: number;
  readonly draft: PlayerDraft;
  readonly taken: TakenFactions;
  readonly onChange: DraftChange;
}

const PlayerCard = memo(function PlayerCard({ index, draft, taken, onChange }: PlayerCardProps) {
  const faction = FACTION_DEFINITIONS[draft.factionId];

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
        <SegmentedControl<Control>
          options={CONTROL_OPTIONS}
          value={draft.isAI ? 'CPU' : 'HUMAN'}
          onChange={v => onChange(index, { isAI: v === 'CPU' })}
          ariaLabel={`Controllo giocatore ${index + 1}`}
          size="sm"
        />
      </div>

      <FactionPicker
        value={draft.factionId}
        taken={taken}
        onPick={fid => onChange(index, { factionId: fid })}
        ariaLabel="Fazione"
      />
      <Dossier key={draft.factionId} factionId={draft.factionId} />
    </li>
  );
});

// ─── Riga giocatore (telefono) ────────────────────────────────────────────────

interface PlayerRowProps {
  readonly index: number;
  readonly draft: PlayerDraft;
  readonly current: boolean;
  readonly onSelect: (index: number) => void;
  readonly onChange: DraftChange;
}

const PlayerRow = memo(function PlayerRow({ index, draft, current, onSelect, onChange }: PlayerRowProps) {
  const faction = FACTION_DEFINITIONS[draft.factionId];

  return (
    <li
      className={`lrow${current ? ' is-current' : ''}`}
      style={cssVars({ '--faction': faction.color, '--faction-bg': faction.bgColor })}
      onFocusCapture={() => onSelect(index)}
    >
      <button
        type="button"
        className="lrow__pick"
        aria-pressed={current}
        aria-label={`Scegli la fazione di ${displayName(draft, index)} (ora ${faction.name})`}
        onClick={() => onSelect(index)}
      >
        <FactionEmblem faction={draft.factionId} size={26} />
      </button>
      <label className="sr-only" htmlFor={`prow-${index}`}>Nome giocatore {index + 1}</label>
      <input
        id={`prow-${index}`}
        className="input lrow__name"
        value={draft.name}
        maxLength={18}
        onChange={e => onChange(index, { name: e.target.value })}
        placeholder={`Giocatore ${index + 1}`}
      />
      <SegmentedControl<Control>
        options={CONTROL_OPTIONS}
        value={draft.isAI ? 'CPU' : 'HUMAN'}
        onChange={v => onChange(index, { isAI: v === 'CPU' })}
        ariaLabel={`Controllo giocatore ${index + 1}`}
        size="sm"
      />
    </li>
  );
});

// ─── Lobby ────────────────────────────────────────────────────────────────────

export function SetupScreen() {
  const startGame = useGameStore(s => s.startGame);
  const replayPrologue = useStoryStore(s => s.replayPrologue);
  const compact = useIsNarrow();
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [drafts, setDrafts] = useState<readonly PlayerDraft[]>(() => ALL_FACTION_IDS.map((f, i) => makeDefault(i, f)));
  const [movementRule, setMovementRule] = useState<MovementRule>('adjacent');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const active = drafts.slice(0, playerCount);
  // Se si scende di giocatori, la riga selezionata potrebbe sparire.
  const current = Math.min(currentIndex, playerCount - 1);
  const currentDraft = active[current] ?? active[0];

  function setDraft(index: number, patch: Partial<PlayerDraft>) {
    setError(null);
    setDrafts(prev => applyPatch(prev, index, patch));
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
      players: active.map((p, i) => ({ ...p, name: displayName(p, i) })),
      movementRule,
    };
    startGame(config);
  }

  const startBlock = (
    <div className="lobby__start">
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="btn btn--sodium btn--xl" onClick={handleStart}>
        Inizia la partita →
      </button>
    </div>
  );

  return (
    <main className={`lobby${compact ? ' lobby--compact' : ''}`}>
      <header className="lobby__head">
        <span className="brand-mark brand-mark--xl">DOMINIO</span>
        <p className="lobby__sub">Trenta notti. Quattro fazioni. Una sola città.</p>
        <div className="lobby__links">
          <button type="button" className="link" onClick={replayPrologue}>Rivedi il prologo</button>
          <InstallHint />
        </div>
      </header>

      {compact && currentDraft ? (
        <section className="lobby__config" aria-label="Configura la partita">
          <div className="lobby__settings">
            <div className="lobby__field">
              <span className="label">Giocatori</span>
              <SegmentedControl options={COUNT_OPTIONS_COMPACT} value={playerCount} onChange={setPlayerCount} ariaLabel="Numero di giocatori" size="sm" stretch />
            </div>
            <div className="lobby__field">
              <span className="label">Spostamento</span>
              <SegmentedControl options={MOVE_OPTIONS_COMPACT} value={movementRule} onChange={setMovementRule} ariaLabel="Regola di spostamento" size="sm" stretch />
            </div>
            <p className="lobby__hint">{MOVE_HINT[movementRule]}</p>
          </div>

          <ol className="lrow-list">
            {active.map((draft, i) => (
              <PlayerRow key={i} index={i} draft={draft} current={i === current} onSelect={setCurrentIndex} onChange={setDraft} />
            ))}
          </ol>

          <div className="lobby__pick">
            <span className="label">Fazione di <strong>{displayName(currentDraft, current)}</strong></span>
            <FactionPicker
              value={currentDraft.factionId}
              taken={takenFor(active, current)}
              onPick={fid => setDraft(current, { factionId: fid })}
              ariaLabel={`Fazione di ${displayName(currentDraft, current)}`}
            />
            <Dossier key={currentDraft.factionId} factionId={currentDraft.factionId} />
          </div>

          {startBlock}
        </section>
      ) : (
        <section className="lobby__config" aria-label="Configura la partita">
          <div className="lobby__row">
            <span className="label">Giocatori</span>
            <SegmentedControl options={COUNT_OPTIONS} value={playerCount} onChange={setPlayerCount} ariaLabel="Numero di giocatori" />
          </div>

          <div className="lobby__row">
            <span className="label">Spostamento</span>
            <SegmentedControl options={MOVE_OPTIONS} value={movementRule} onChange={setMovementRule} ariaLabel="Regola di spostamento" />
          </div>
          <p className="lobby__hint">{MOVE_HINT[movementRule]}</p>

          <ol className="pcard-list">
            {active.map((draft, i) => (
              <PlayerCard key={i} index={i} draft={draft} taken={takenFor(active, i)} onChange={setDraft} />
            ))}
          </ol>

          {startBlock}
        </section>
      )}
    </main>
  );
}
