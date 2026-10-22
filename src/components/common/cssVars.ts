// ─── cssVars ──────────────────────────────────────────────────────────────────
// Passa custom properties CSS (es. --faction) a `style` in modo tipizzato.

import type { CSSProperties } from 'react';

export type CSSVarName = `--${string}`;

export function cssVars(vars: Readonly<Record<CSSVarName, string>>): CSSProperties {
  return vars as CSSProperties;
}
