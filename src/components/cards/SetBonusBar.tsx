// ─── SetBonusBar ──────────────────────────────────────────────────────────────
// Tre slot per il set in costruzione + esito: quante truppe vale, oppure
// perché la combinazione non è valida. Il pulsante compare solo se valido.

import { memo } from 'react';
import type { TerritoryCard } from '../../types';
import { CardInsignia } from './CardInsignia';
import type { SetEvaluation } from './cardMeta';

export interface SetBonusBarProps {
  readonly selected: ReadonlyArray<TerritoryCard>;
  readonly evaluation: SetEvaluation;
  readonly onCash: () => void;
  readonly onClear: () => void;
}

const SLOTS = [0, 1, 2] as const;

export const SetBonusBar = memo(function SetBonusBar({ selected, evaluation, onCash, onClear }: SetBonusBarProps) {
  const state = evaluation.kind;
  return (
    <div className={`setbar setbar--${state}`} role="group" aria-label="Set in costruzione">
      <div className="setbar__slots">
        {SLOTS.map(i => {
          const card = selected[i];
          return (
            <span key={card?.id ?? `empty-${i}`} className={`setbar__slot${card ? ' is-filled' : ''}`}>
              {card ? <CardInsignia symbol={card.symbol} size={22} /> : <span className="setbar__dot" />}
            </span>
          );
        })}
      </div>
      <div className="setbar__info" aria-live="polite">
        {state === 'incomplete' && <span>Scegli ancora {evaluation.missing} {evaluation.missing === 1 ? 'carta' : 'carte'}</span>}
        {state === 'invalid' && <span>Serve un tris o una scala</span>}
        {state === 'valid' && (
          <>
            <span className="setbar__label">{evaluation.label}</span>
            <span className="setbar__value">+{evaluation.troops} <small>truppe</small></span>
          </>
        )}
      </div>
      <div className="setbar__actions">
        {state === 'valid' && (
          <button type="button" className="btn btn--sodium btn--sm" onClick={onCash}>Incassa</button>
        )}
        <button type="button" className="link" onClick={onClear}>Annulla</button>
      </div>
    </div>
  );
});
