// ─── Sky ──────────────────────────────────────────────────────────────────────
// Il ciclo crepuscolo → notte fonda → alba, legato ai turni (e agli atti
// della storia, che iniziano ai turni 1, 3, 5, 7).

import type { GamePhase, SkyKey, SkyState } from '../types';

export const SKY_STATES: Readonly<Record<SkyKey, SkyState>> = {
  dusk: {
    background: '#2b2f47', fog: [60, 140],
    sun: { color: '#ffb877', intensity: 1.7, position: [-16, 12, 12] },
    hemi: { sky: '#b8c4ea', ground: '#3b3226', intensity: 0.85 },
    glow: 0.6, headlights: 0.45, stars: 0,
  },
  evening: {
    background: '#171c30', fog: [55, 130],
    sun: { color: '#ff9a63', intensity: 0.9, position: [-16, 12, 12] },
    hemi: { sky: '#6f7fb0', ground: '#2a2a33', intensity: 0.62 },
    glow: 0.95, headlights: 0.8, stars: 0.25,
  },
  night: {
    background: '#0b1020', fog: [50, 120],
    sun: { color: '#9db4ff', intensity: 1.05, position: [14, 26, -10] },
    hemi: { sky: '#3a4a78', ground: '#191c28', intensity: 0.5 },
    glow: 1.25, headlights: 1, stars: 0.7,
  },
  deep: {
    background: '#070a14', fog: [45, 110],
    sun: { color: '#8aa2f0', intensity: 0.85, position: [16, 26, -12] },
    hemi: { sky: '#2c3a63', ground: '#12141d', intensity: 0.42 },
    glow: 1.45, headlights: 1, stars: 1,
  },
  dawn: {
    background: '#3d3a56', fog: [60, 140],
    sun: { color: '#ffd2a0', intensity: 1.9, position: [18, 10, 10] },
    hemi: { sky: '#e6d3c4', ground: '#4a3d32', intensity: 0.9 },
    glow: 0.45, headlights: 0.3, stars: 0.12,
  },
};

/** 1 tramonto · 2–3 sera · 4–6 notte · 7+ notte fonda · fine partita: alba. */
export function skyKeyForRound(round: number, phase: GamePhase): SkyKey {
  if (phase === 'GAME_OVER') return 'dawn';
  if (round <= 1) return 'dusk';
  if (round <= 3) return 'evening';
  if (round <= 6) return 'night';
  return 'deep';
}
