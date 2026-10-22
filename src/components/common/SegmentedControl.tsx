// ─── SegmentedControl ─────────────────────────────────────────────────────────
// Gruppo di bottoni mutuamente esclusivi, generico sul tipo di valore:
// usato per vista mappa (MapMode), schede della sidebar e numero di giocatori.

import { memo, type ReactNode } from 'react';

export interface SegmentOption<T extends string | number> {
  readonly value: T;
  readonly label: ReactNode;
  /** Contatore opzionale (es. articoli non letti). */
  readonly badge?: number;
}

interface SegmentedControlProps<T extends string | number> {
  readonly options: ReadonlyArray<SegmentOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly stretch?: boolean;
}

function SegmentedControlInner<T extends string | number>({
  options, value, onChange, ariaLabel, size = 'md', stretch = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`seg seg--${size}${stretch ? ' seg--stretch' : ''}`}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            className={`seg__btn${active ? ' is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {opt.badge !== undefined && opt.badge > 0 && (
              <span className="seg__badge" aria-label={`${opt.badge} nuovi`}>{opt.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// memo perde i generics: il cast preserva la firma generica per i chiamanti.
export const SegmentedControl = memo(SegmentedControlInner) as typeof SegmentedControlInner;
