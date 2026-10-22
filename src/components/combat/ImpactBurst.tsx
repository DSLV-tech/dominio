// ─── ImpactBurst ──────────────────────────────────────────────────────────────
// Scintille e lampo nel punto d'impatto della carica.
// Un unico <points> con buffer precalcolato: posizioni aggiornate in useFrame
// (balistica semplice), nessuna allocazione per frame.

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type PointLight, type PointsMaterial } from 'three';
import { COMBAT_MS } from '../../data/combatTimeline';
import type { CombatClockRef } from './arenaLayout';
import { seeded } from './dieMath';

const COUNT = 90;
const LIFE_MS = 750;
const GRAVITY = 5.5;

interface ImpactBurstProps {
  readonly clockRef: CombatClockRef;
  readonly seed: number;
  readonly color: string;
}

export const ImpactBurst = memo(function ImpactBurst({ clockRef, seed, color }: ImpactBurstProps) {
  const matRef = useRef<PointsMaterial>(null);
  const lightRef = useRef<PointLight>(null);

  const { geometry, velocity, origin } = useMemo(() => {
    const rnd = seeded(seed);
    const vel = new Float32Array(COUNT * 3);
    const org = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const a = rnd() * Math.PI * 2;
      const up = 0.6 + rnd() * 2.2;
      const sp = 0.8 + rnd() * 2.4;
      vel[i * 3] = Math.cos(a) * sp * 0.6;
      vel[i * 3 + 1] = up;
      vel[i * 3 + 2] = Math.sin(a) * sp;
      org[i * 3] = (rnd() - 0.5) * 0.15;
      org[i * 3 + 1] = 0.45 + rnd() * 0.2;
      org[i * 3 + 2] = (rnd() - 0.5) * 0.9;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(org.slice(), 3));
    return { geometry: geo, velocity: vel, origin: org };
  }, [seed]);

  useFrame(() => {
    const ms = clockRef.current.ms;
    const age = (ms - COMBAT_MS.impact) / 1000;
    const alive = age >= 0 && age * 1000 < LIFE_MS;
    const mat = matRef.current;
    const light = lightRef.current;
    if (light) light.intensity = age >= 0 ? Math.max(0, 9 * (1 - age / 0.28)) : 0;
    if (!mat) return;
    mat.opacity = alive ? 1 - (age * 1000) / LIFE_MS : 0;
    if (!alive) return;
    const pos = geometry.getAttribute('position');
    if (!(pos instanceof BufferAttribute)) return;
    const arr = pos.array;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3;
      arr[j] = (origin[j] ?? 0) + (velocity[j] ?? 0) * age;
      arr[j + 1] = Math.max(0.12, (origin[j + 1] ?? 0) + (velocity[j + 1] ?? 0) * age - 0.5 * GRAVITY * age * age);
      arr[j + 2] = (origin[j + 2] ?? 0) + (velocity[j + 2] ?? 0) * age;
    }
    pos.needsUpdate = true;
  });

  return (
    <group>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          ref={matRef}
          color={color}
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <pointLight ref={lightRef} position={[0, 0.7, 0]} color={color} intensity={0} distance={4} decay={2} />
    </group>
  );
});
