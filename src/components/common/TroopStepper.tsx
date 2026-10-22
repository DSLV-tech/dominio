// ─── TroopStepper ─────────────────────────────────────────────────────────────
// Selettore numerico − / + con "Tutte": rinforzi, spostamenti, soglia del blitz.

import { memo } from 'react';

interface TroopStepperProps {
  readonly value: number;
  readonly max?: number;
  readonly onChange: (n: number) => void;
}

export const TroopStepper = memo(function TroopStepper({ value, max, onChange }: TroopStepperProps) {
  const atMax = max !== undefined && value >= max;
  return (
    <div className="troops" role="group" aria-label="Truppe per click">
      <button type="button" className="troops__btn" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Meno truppe">−</button>
      <span className="troops__value" aria-live="polite">{value}</span>
      <button type="button" className="troops__btn" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)} disabled={atMax} aria-label="Più truppe">+</button>
      {max !== undefined && max > 1 && (
        <button type="button" className="troops__all" onClick={() => onChange(max)} disabled={atMax}>Tutte</button>
      )}
    </div>
  );
});
