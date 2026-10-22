// ─── ConnectionLines ──────────────────────────────────────────────────────────
// Collegamenti fra territori, disegnati come strade: un'ombra scura sotto e
// una mezzeria tratteggiata sopra. Quelli fra quartieri diversi sono "viali"
// (più marcati). Gli evidenziati (bersagli d'attacco o di spostamento) si
// accendono e il tratteggio scorre verso la destinazione.
// I tracciati (dritti o curvi attorno ai territori) sono precalcolati in layout2d.

import { memo, useMemo } from 'react';
import type { TerritoryId } from '../../types';
import { CONNECTION_ROUTES, pairKey } from './layout2d';

export type LineTone = 'attack' | 'move';

interface Props {
  readonly highlightPairs?: ReadonlyArray<readonly [TerritoryId, TerritoryId]>;
  readonly tone?: LineTone;
}

export const ConnectionLines = memo(function ConnectionLines({ highlightPairs, tone = 'attack' }: Props) {
  // chiave → territorio di partenza dell'evidenziazione
  const highlighted = useMemo(() => {
    const m = new Map<string, TerritoryId>();
    for (const [from, to] of highlightPairs ?? []) m.set(pairKey(from, to), from);
    return m;
  }, [highlightPairs]);

  return (
    <g className="clines">
      <g className="clines__base">
        {CONNECTION_ROUTES.map(r => (
          <g key={r.key} className={r.crossZone ? 'croad croad--avenue' : 'croad'}>
            <path className="croad__casing" d={r.d} />
            <path className="croad__line" d={r.d} />
          </g>
        ))}
      </g>
      <g className="clines__hl">
        {CONNECTION_ROUTES.map(r => {
          const from = highlighted.get(r.key);
          if (!from) return null;
          const d = from === r.a ? r.d : r.dReverse;
          return (
            <g key={r.key} className={`croad-hl croad-hl--${tone}`}>
              <path className="croad-hl__glow" d={d} />
              <path className="croad-hl__line" d={d} />
            </g>
          );
        })}
      </g>
    </g>
  );
});
