// ─── MapDock ──────────────────────────────────────────────────────────────────
// Fascia fissa sotto la mappa, solo sui telefoni (useIsNarrow): ospita i
// riquadri che su schermo grande galleggiano sulla mappa, così sul telefono
// non coprono mai i territori. Ha altezza fissa: quando un riquadro compare o
// sparisce la mappa non si sposta (i tocchi restano dove l'utente mira).
// Si vede un riquadro alla volta, il primo presente in quest'ordine:
// bersaglio di una carta evento → attacco → riepilogo del turno CPU →
// guida del primo turno → territorio toccato → cosa fare nella fase.
// (L'ordine è nel JSX; il CSS nasconde tutti tranne il primo figlio.)

import { memo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { AttackPanel } from './AttackPanel';
import { useLocalTurn } from '../../online/useControl';
import { waitingLabel } from '../../online/control';
import { TurnRecap } from './TurnRecap';
import { CoachMark } from './CoachMark';
import { phaseHint } from './phaseMeta';
import { EventTargetBar } from '../cards/EventTargetBar';
import { TerritoryInfoCard } from '../story/TerritoryInfoCard';

const PhaseHint = memo(function PhaseHint() {
  const phase   = useGameStore(s => s.game?.phase);
  const current = useGameStore(s => (s.game ? s.game.players[s.game.currentPlayerIndex] ?? null : null));
  const localTurn = useLocalTurn();
  if (!phase || !current) return null;
  const text = localTurn ? phaseHint(phase) : `${waitingLabel(current)}…`;
  if (!text) return null;
  return <p className="dock__hint" role="status">{text}</p>;
});

export const MapDock = memo(function MapDock() {
  return (
    <section className="dock" aria-label="Informazioni sulla mappa">
      <EventTargetBar />
      <AttackPanel compact />
      <TurnRecap />
      <CoachMark />
      <TerritoryInfoCard compact />
      <PhaseHint />
    </section>
  );
});
