// ─── Layout dell'arena ────────────────────────────────────────────────────────
// Misure in unità three.js, coerenti con blender/build_pezzi.py → arena():
//  - vassoio dei dadi al centro (2.1 × 1.05, piano a quota 0.11)
//  - piedistalli degli schieramenti a x = ∓2.05 (piano a quota 0.10)
// Sinistra = attacco, destra = difesa.

import type { RefObject } from 'react';
import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { CombatSide } from '../../types';

export interface CombatClock {
  /** Tempo della sequenza, in ms "a velocità 1". */
  ms: number;
}
export type CombatClockRef = RefObject<CombatClock>;

export type Vec3Tuple = readonly [number, number, number];

export const TRAY_TOP = 0.11;
export const PLINTH_TOP = 0.1;
export const PLINTH_X = 2.05;
export const DIE_SIZE = 0.28;
export const FIGURE_SCALE = 0.9;
export const DIE_COLUMN_X = 0.5;

export const sideSign = (side: CombatSide): -1 | 1 => (side === 'attacker' ? -1 : 1);

/** Righe allineate: il dado i dell'attacco sta di fronte al dado i della difesa. */
export function dieRowZ(i: number, n: number): number {
  if (n <= 1) return 0;
  const spacing = Math.min(0.4, 0.78 / (n - 1));
  return (i - (n - 1) / 2) * spacing;
}

export function dieRestPosition(side: CombatSide, i: number, n: number): Vec3Tuple {
  return [sideSign(side) * DIE_COLUMN_X, TRAY_TOP + DIE_SIZE / 2, dieRowZ(i, n)];
}

export function figureHome(side: CombatSide, i: number, n: number): Vec3Tuple {
  const z = n <= 1 ? 0 : (i - (n - 1) / 2) * Math.min(0.44, 1.2 / (n - 1));
  const stagger = (i % 2) * 0.16;
  return [sideSign(side) * (PLINTH_X + stagger - 0.05), PLINTH_TOP, z];
}

/** Punto d'incontro della carica: le coppie si affrontano al centro. */
export function figureTarget(side: CombatSide, i: number, pairs: number): Vec3Tuple {
  if (i >= pairs) return [sideSign(side) * 1.05, TRAY_TOP, dieRowZ(i, i + 1) * 0.6];
  return [sideSign(side) * 0.27, TRAY_TOP, pairs <= 1 ? 0 : (i - (pairs - 1) / 2) * 0.5];
}

/** Materiali (già clonati) di un sottoalbero: letti dal ref, quindi modificabili nei frame. */
export function collectMaterials(root: Object3D): MeshStandardMaterial[] {
  const out: MeshStandardMaterial[] = [];
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const m: unknown = o.material;
    if (m instanceof MeshStandardMaterial) out.push(m);
  });
  return out;
}
