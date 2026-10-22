// ─── motion ───────────────────────────────────────────────────────────────────
// Preferenza "riduci animazioni" del sistema, letta una volta sola.
// Le animazioni decorative (mappa, carte) la rispettano.

let cached: boolean | null = null;

export function prefersReducedMotion(): boolean {
  if (cached !== null) return cached;
  cached = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return cached;
}

/** Avvicinamento esponenziale indipendente dal frame-rate (smooth damping). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
