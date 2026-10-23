// ─── ActInterlude ─────────────────────────────────────────────────────────────
// Cartello di apertura atto, a tutto schermo. Mentre è aperto la CPU è in
// pausa (vedi useAIPlayer). Se tocca a una CPU si chiude da solo dopo qualche
// secondo, così le partite tra sole CPU non restano bloccate.

import { memo, useEffect } from 'react';
import { useStoryStore } from '../../store/storyStore';
import { useGameStore } from '../../store/gameStore';
import { FACTION_DEFINITIONS } from '../../data';
import { useLocalTurn } from '../../online/useControl';

const AUTO_CLOSE_MS = 7000;

export const ActInterlude = memo(function ActInterlude() {
  const act = useStoryStore(s => s.interlude);
  const close = useStoryStore(s => s.closeInterlude);
  const current = useGameStore(s => (s.game ? s.game.players[s.game.currentPlayerIndex] ?? null : null));

  // turno di una CPU o, online, di un altro dispositivo: si chiude da solo
  const localTurn = useLocalTurn();
  const cpuTurn = !!current && !localTurn;

  useEffect(() => {
    if (!act) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); close(); }
    };
    window.addEventListener('keydown', onKey);
    const timer = cpuTurn ? setTimeout(close, AUTO_CLOSE_MS) : undefined;
    return () => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer); };
  }, [act, close, cpuTurn]);

  if (!act) return null;

  const faction = current ? FACTION_DEFINITIONS[current.factionId] : null;

  return (
    <div className="interlude" role="dialog" aria-modal="true" aria-labelledby="interlude-title">
      <div className="interlude__card">
        <p className="kicker">Atto {act.number}</p>
        <h2 id="interlude-title" className="interlude__title">{act.title}</h2>
        <div className="interlude__body">
          {act.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <aside className="clue">
          <span className="clue__label">Indizio</span>
          <span className="clue__text">{act.clue}</span>
        </aside>
        <div className="interlude__footer">
          {faction && current && (
            <span className="interlude__next">
              Apre la notte: <strong style={{ color: faction.color }}>{current.name}</strong> · {faction.name}
            </span>
          )}
          <button type="button" className="btn btn--sodium" onClick={close} autoFocus data-shot-next>
            {cpuTurn ? 'Continua' : 'Scendi in strada →'}
          </button>
        </div>
        {cpuTurn && <div className="interlude__timer" style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }} aria-hidden="true" />}
      </div>
    </div>
  );
});
