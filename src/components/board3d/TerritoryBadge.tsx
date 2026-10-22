// ─── TerritoryBadge ───────────────────────────────────────────────────────────
// Etichetta HTML sopra il territorio: numero truppe (con "pop" quando cambia)
// e, su hover/selezione, la targa con il nome del territorio.
// La targa è posizionata in assoluto sopra il gettone: comparendo non cambia
// le dimensioni del contenitore, quindi il gettone resta fermo (prima saltava
// verso il basso e il puntatore ne usciva → sfarfallio). Quando è visibile la
// targa sale in primo piano rispetto ai gettoni vicini.

import { memo, useLayoutEffect, useRef } from 'react';
import { StableHtml } from './StableHtml';
import type { TerritoryId } from '../../types';

interface TerritoryBadgeProps {
  readonly id: TerritoryId;
  readonly troops: number;
  readonly color: string;
  readonly name: string;
  readonly showName: boolean;
  readonly isBottleneck: boolean;
  readonly interactive: boolean;
  readonly onSelect: (id: TerritoryId) => void;
  readonly onHover: (id: TerritoryId | null) => void;
}

/** Distanza minima (px) della targa dai bordi della plancia. */
const EDGE_MARGIN = 8;
/** Distanza (px) fra targa e gettone: deve combaciare con board3d.css (.b3d-name). */
const PLATE_GAP = 9;

/**
 * Targa del nome. Vicino ai bordi della plancia veniva tagliata (la tela 3D
 * ha overflow nascosto): finché è visibile la tengo dentro, spostandola in
 * orizzontale (--plate-dx) e, se non c'è spazio sopra, aprendola sotto il
 * gettone. La punta continua a indicare il territorio.
 */
function NamePlate({ name, isBottleneck }: { readonly name: string; readonly isBottleneck: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const root = el?.closest('.b3d-root');
    if (!el || !root) return;
    let dx = 0;
    let below = false;
    let frame = 0;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      // posizione "naturale", senza lo spostamento già applicato
      const left = r.left - dx;
      const right = r.right - dx;
      let next = 0;
      if (left < box.left + EDGE_MARGIN) next = box.left + EDGE_MARGIN - left;
      else if (right > box.right - EDGE_MARGIN) next = box.right - EDGE_MARGIN - right;
      // dove starebbe il bordo alto della targa se fosse aperta sopra il gettone
      const badge = el.parentElement?.querySelector('.b3d-badge')?.getBoundingClientRect();
      const topIfAbove = badge ? badge.top - PLATE_GAP - r.height : r.top;
      const nextBelow = topIfAbove < box.top + EDGE_MARGIN;
      if (Math.abs(next - dx) > 0.5) {
        dx = next;
        el.style.setProperty('--plate-dx', `${dx.toFixed(1)}px`);
      }
      if (nextBelow !== below) {
        below = nextBelow;
        el.classList.toggle('is-below', below);
      }
      frame = requestAnimationFrame(fit);   // la camera può muoversi mentre la targa è aperta
    };
    fit();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={ref} className="b3d-name" aria-hidden="true">
      {isBottleneck && <span className="b3d-star">★</span>}
      {name}
    </div>
  );
}

/** Profondità HTML: le targhe aperte stanno sopra a tutti i gettoni. */
const Z_IDLE: [number, number] = [20, 0];
const Z_NAMED: [number, number] = [40, 21];

export const TerritoryBadge = memo(function TerritoryBadge({
  id, troops, color, name, showName, isBottleneck, interactive, onSelect, onHover,
}: TerritoryBadgeProps) {
  return (
    <StableHtml position={[0, 0.55, 0.95]} center zIndexRange={showName ? Z_NAMED : Z_IDLE}>
      <div
        className={showName ? 'b3d-badge-wrap is-named' : 'b3d-badge-wrap'}
        data-territory={id}
        role="button"
        tabIndex={interactive ? 0 : -1}
        aria-label={`${name}: ${troops} truppe`}
        style={{ cursor: interactive ? 'pointer' : 'default' }}
        onClick={() => onSelect(id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } }}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
      >
        {showName && <NamePlate name={name} isBottleneck={isBottleneck} />}
        <div key={troops} className="b3d-badge" style={{ borderColor: color, color }}>
          {troops}
        </div>
      </div>
    </StableHtml>
  );
});
