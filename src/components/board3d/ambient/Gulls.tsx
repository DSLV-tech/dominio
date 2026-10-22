// ─── Gulls ────────────────────────────────────────────────────────────────────
// Gabbiani che volteggiano sul porto: cerchi a raggio e quota diversi,
// battito d'ali sfasato. Due ali per gabbiano, condivise fra tutti.

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, PlaneGeometry, type Group } from 'three';
import { prefersReducedMotion } from '../../common/motion';
import { mulberry32 } from './rng';
import type { GullFlock } from '../../../types';

interface GullsProps {
  readonly flocks: readonly GullFlock[];
}

interface GullSpec {
  readonly cx: number; readonly cy: number; readonly cz: number;
  readonly r: number; readonly speed: number; readonly phase: number; readonly bob: number;
}

const WING = new PlaneGeometry(0.16, 0.05).translate(0.08, 0, 0);

export const Gulls = memo(function Gulls({ flocks }: GullsProps) {
  const specs = useMemo<GullSpec[]>(() => {
    const rng = mulberry32(7);
    return flocks.flatMap(f => Array.from({ length: f.count }, () => ({
      cx: f.center[0], cy: f.center[1] + rng() * 0.6, cz: f.center[2],
      r: f.radius[0] + rng() * (f.radius[1] - f.radius[0]),
      speed: (0.35 + rng() * 0.25) * (rng() < 0.3 ? -1 : 1),
      phase: rng() * Math.PI * 2,
      bob: rng() * Math.PI * 2,
    })));
  }, [flocks]);

  const refs = useRef<(Group | null)[]>([]);
  const still = prefersReducedMotion();

  useFrame(({ clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    specs.forEach((g, i) => {
      const node = refs.current[i];
      if (!node) return;
      const a = g.phase + t * g.speed;
      node.position.set(g.cx + Math.cos(a) * g.r, g.cy + Math.sin(t * 0.8 + g.bob) * 0.15, g.cz + Math.sin(a) * g.r);
      node.rotation.y = -a + (g.speed > 0 ? 0 : Math.PI);   // tangente al cerchio
      node.rotation.z = Math.sin(a) * 0.25 * Math.sign(g.speed);   // inclinazione in virata
      const flap = Math.sin(t * 9 + g.bob) * 0.55;
      const [left, right] = node.children;
      if (left) left.rotation.z = 0.25 + flap;
      if (right) right.rotation.z = Math.PI - 0.25 - flap;
    });
  });

  return (
    <group>
      {specs.map((_, i) => (
        <group key={i} ref={el => { refs.current[i] = el; }}>
          <mesh geometry={WING}><meshStandardMaterial color="#f7f5ef" side={DoubleSide} roughness={0.9} /></mesh>
          <mesh geometry={WING}><meshStandardMaterial color="#f7f5ef" side={DoubleSide} roughness={0.9} /></mesh>
        </group>
      ))}
    </group>
  );
});
