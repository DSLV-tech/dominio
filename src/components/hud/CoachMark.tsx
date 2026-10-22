// ─── CoachMark ────────────────────────────────────────────────────────────────
// Fumetto di guida del primo turno: uno alla volta, solo nei turni umani,
// non modale (la CPU e il resto del gioco non vengono mai bloccati).
// "Ho capito" lo segna come visto; "Salta la guida" li spegne tutti.

import { memo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useStoryStore } from '../../store/storyStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { COACH_STEPS } from '../../data/coach';

export const CoachMark = memo(function CoachMark() {
  const game         = useGameStore(s => s.game);
  const attackFromId = useUIStore(s => s.attackFromId);
  const busy         = useUIStore(s => s.eventTargeting !== null);
  const interlude    = useStoryStore(s => s.interlude !== null);
  const enabled      = useTutorialStore(s => s.enabled);
  const seen         = useTutorialStore(s => s.seen);
  const markSeen     = useTutorialStore(s => s.markSeen);
  const skipAll      = useTutorialStore(s => s.skipAll);

  const me = game ? game.players[game.currentPlayerIndex] ?? null : null;
  if (!game || !me || me.isAI || !enabled || busy || interlude || game.pendingAttack || game.pendingOccupation) return null;
  if (game.phase === 'GAME_OVER') return null;

  const ctx = { game, attackFromId, handSize: (game.hands[me.id] ?? []).length, seen };
  const step = COACH_STEPS.find(s => !seen.includes(s.id) && s.when(ctx));
  if (!step) return null;

  return (
    <aside className="coach" role="note" aria-live="polite">
      <strong className="coach__title">{step.title}</strong>
      <p className="coach__text">{step.text(ctx)}</p>
      <div className="coach__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={skipAll}>Salta la guida</button>
        <button type="button" className="btn btn--sodium btn--sm" onClick={() => markSeen(step.id)}>Ho capito</button>
      </div>
    </aside>
  );
});
