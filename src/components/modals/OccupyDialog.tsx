// ─── OccupyDialog ─────────────────────────────────────────────────────────────
// Dopo una conquista: quante truppe far entrare nel territorio preso.
// Compare a scontro chiuso (non si sovrappone alla scena di combattimento).

import { memo, useState } from 'react';
import type { PendingOccupation } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { TERRITORY_DEFINITIONS } from '../../data';
import { TroopStepper } from '../common/TroopStepper';

export const OccupyDialog = memo(function OccupyDialog() {
  const occupation = useGameStore(s => s.game?.pendingOccupation ?? null);
  const combatOpen = useGameStore(s => s.game?.pendingAttack != null);
  if (!occupation || combatOpen) return null;
  return <OccupyBody key={`${occupation.fromId}>${occupation.toId}`} occupation={occupation} />;
});

function OccupyBody({ occupation }: { readonly occupation: PendingOccupation }) {
  const occupy = useGameStore(s => s.occupy);
  const { fromId, toId, min, max } = occupation;
  const [count, setCount] = useState(max);
  const value = Math.max(min, Math.min(max, count));

  return (
    <div className="occupy" role="dialog" aria-modal="true" aria-labelledby="occupy-title">
      <div className="occupy__card">
        <h2 id="occupy-title" className="occupy__title">Occupa {TERRITORY_DEFINITIONS[toId].name}</h2>
        <p className="occupy__text">
          Quante truppe fai entrare? Da {TERRITORY_DEFINITIONS[fromId].name} ne possono passare fino a {max}
          ; ne restano {max - value + 1} lì.
        </p>
        <div className="occupy__stepper">
          <TroopStepper value={value - min + 1} max={max - min + 1} onChange={n => setCount(min + n - 1)} />
          <span className="occupy__total">{value} nel nuovo territorio</span>
        </div>
        <button type="button" className="btn btn--sodium" autoFocus onClick={() => occupy(value)}>Occupa</button>
      </div>
    </div>
  );
}
