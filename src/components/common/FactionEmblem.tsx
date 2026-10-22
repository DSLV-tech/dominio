// ─── FactionEmblem ────────────────────────────────────────────────────────────
// Stemma della fazione renderizzato in Blender (public/ui/stemma_*.png).
// Se l'immagine non si carica ripiega su un tondo nel colore della fazione;
// per i territori neutrali mostra uno scudo grigio vuoto.

import { memo, useState } from 'react';
import { EMBLEM_URLS, FACTION_DEFINITIONS } from '../../data';
import type { FactionId } from '../../types';
import { cssVars } from './cssVars';

interface FactionEmblemProps {
  readonly faction: FactionId | null;
  readonly size?: number;
  readonly className?: string;
}

export const FactionEmblem = memo(function FactionEmblem({ faction, size = 28, className }: FactionEmblemProps) {
  const [failed, setFailed] = useState(false);
  const cls = `emblem${className ? ` ${className}` : ''}`;
  const color = faction ? FACTION_DEFINITIONS[faction].color : '#6b7280';

  if (!faction || failed) {
    return <span className={`${cls} emblem--fallback`} style={cssVars({ '--emblem': color, '--emblem-size': `${size}px` })} aria-hidden="true" />;
  }
  return (
    <img
      className={cls}
      src={EMBLEM_URLS[faction]}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
});
