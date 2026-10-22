// ─── TroopFigures ─────────────────────────────────────────────────────────────
// Pedine della fazione disposte a ventaglio sul fronte dell'esagono
// (max MAX_FIGURES, il numero esatto è nel badge) + bandiera di possesso.
// I cloni condividono geometrie e materiali del modello: costo minimo.

import { memo, useMemo } from 'react';
import type { Object3D } from 'three';
import { FIGURE_ARC, FIGURE_RING, MAX_FIGURES } from './constants';

interface TroopFiguresProps {
  readonly template: Object3D;
  readonly flag: Object3D | undefined;
  readonly troops: number;
  readonly scale: number;
}

interface Placement {
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
}

function fanPlacements(count: number): Placement[] {
  if (count <= 0) return [];
  const step = count > 1 ? FIGURE_ARC / (count - 1) : 0;
  const start = count > 1 ? -FIGURE_ARC / 2 : 0;
  return Array.from({ length: count }, (_, i) => {
    const a = start + i * step;
    return {
      position: [FIGURE_RING * Math.sin(a), 0, FIGURE_RING * Math.cos(a)] as const,
      rotationY: ((i * 37) % 11 - 5) * 0.04,
    };
  });
}

export const TroopFigures = memo(function TroopFigures({ template, flag, troops, scale }: TroopFiguresProps) {
  const count = Math.min(troops, MAX_FIGURES);
  const placements = useMemo(() => fanPlacements(count), [count]);
  const clones = useMemo(() => placements.map(() => template.clone()), [placements, template]);
  const flagClone = useMemo(() => flag?.clone(), [flag]);

  return (
    <group>
      {clones.map((obj, i) => {
        const p = placements[i];
        return p ? (
          <primitive key={obj.uuid} object={obj} position={p.position} rotation={[0, p.rotationY, 0]} scale={scale} />
        ) : null;
      })}
      {flagClone && <primitive object={flagClone} position={[-0.61, 0, -0.51]} />}
    </group>
  );
});
