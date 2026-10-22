// ─── Matematica del lancio dei dadi ───────────────────────────────────────────
// Niente motore fisico: il risultato è già deciso dalle regole, quindi il volo
// è un'animazione deterministica che ATTERRA ESATTAMENTE sulla faccia giusta.
//  - traiettoria: caduta + 3 rimbalzi smorzati
//  - rotazione: orientamento finale × giro residuo che si esaurisce (ease-out)
// Facce del modello (blender/build_pezzi.py → three.js):
//   1:+Y  6:-Y  2:+Z  5:-Z  3:+X  4:-X

import { Quaternion, Vector3 } from 'three';

const FACE_NORMALS: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0],
};

const UP = new Vector3(0, 1, 0);

/** Orientamento a riposo con `value` verso l'alto e rotazione casuale attorno alla verticale. */
export function restingQuaternion(value: number, yaw: number): Quaternion {
  const n = FACE_NORMALS[value] ?? FACE_NORMALS[1]!;
  const align = new Quaternion().setFromUnitVectors(new Vector3(n[0], n[1], n[2]), UP);
  return new Quaternion().setFromAxisAngle(UP, yaw).multiply(align);
}

/** Frazioni del volo occupate da caduta e rimbalzi, e relative altezze. */
const SEGMENTS: ReadonlyArray<{ readonly span: number; readonly height: number }> = [
  { span: 0.42, height: 1 },     // caduta dal lancio (altezza relativa al punto di rilascio)
  { span: 0.28, height: 0.34 },
  { span: 0.18, height: 0.12 },
  { span: 0.12, height: 0.035 },
];

/** Istanti (0..1) dei contatti col tavolo, con l'energia relativa del colpo. */
export const BOUNCES: ReadonlyArray<{ readonly at: number; readonly energy: number }> = (() => {
  const out: Array<{ at: number; energy: number }> = [];
  let acc = 0;
  SEGMENTS.forEach((s, i) => { acc += s.span; if (i < SEGMENTS.length - 1) out.push({ at: acc, energy: [1, 0.55, 0.28][i] ?? 0.2 }); });
  return out;
})();

/** Altezza sopra il piano di appoggio, t ∈ [0,1], h0 = altezza di rilascio. */
export function bounceHeight(t: number, h0: number): number {
  if (t >= 1) return 0;
  let start = 0;
  for (let i = 0; i < SEGMENTS.length; i++) {
    const seg = SEGMENTS[i]!;
    if (t < start + seg.span) {
      const u = (t - start) / seg.span;
      return i === 0 ? h0 * (1 - u * u) : h0 * seg.height * 4 * u * (1 - u);
    }
    start += seg.span;
  }
  return 0;
}

export const easeOutCubic = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export const easeInOutQuad = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/** Generatore pseudo-casuale deterministico (mulberry32): stessa partita, stesso lancio. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
