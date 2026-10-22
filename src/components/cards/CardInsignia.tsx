// ─── CardInsignia ─────────────────────────────────────────────────────────────
// Insegna di grado in SVG (sostituisce le emoji): galloni ed eventuale stella,
// riempiti con il gradiente del metallo della carta.

import { memo, useId } from 'react';
import type { CardSymbol } from '../../types';
import { SYMBOL_META, type CardMetal } from './cardMeta';

const METAL_STOPS: Readonly<Record<CardMetal, readonly [string, string, string]>> = {
  bronze: ['#f3c79a', '#c07a43', '#6e3f1c'],
  silver: ['#ffffff', '#b9c3cf', '#5c6773'],
  gold:   ['#fff0b8', '#e5b04a', '#8a5a12'],
};

interface CardInsigniaProps {
  readonly symbol: CardSymbol;
  readonly size?: number;
}

const CHEVRON = 'M8 24 L24 12 L40 24 L40 31 L24 19 L8 31 Z';
const STAR = 'M24 2.5 l2.6 5.3 5.9 .9 -4.25 4.1 1 5.85 -5.25 -2.75 -5.25 2.75 1 -5.85 -4.25 -4.1 5.9 -.9 Z';

export const CardInsignia = memo(function CardInsignia({ symbol, size = 44 }: CardInsigniaProps) {
  const meta = SYMBOL_META[symbol];
  const gid = useId();
  const [hi, mid, lo] = METAL_STOPS[meta.metal];
  // senza stella i galloni si centrano più in alto
  const baseY = meta.star ? 6 : meta.chevrons === 1 ? 2.5 : -2;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hi} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={lo} />
        </linearGradient>
      </defs>
      <g fill={`url(#${gid})`} stroke="rgba(0,0,0,0.45)" strokeWidth="0.8" strokeLinejoin="round">
        {meta.star && <path d={STAR} transform="translate(0 -1)" />}
        {Array.from({ length: meta.chevrons }, (_, i) => (
          <path key={i} d={CHEVRON} transform={`translate(0 ${baseY + i * 9})`} />
        ))}
      </g>
    </svg>
  );
});
