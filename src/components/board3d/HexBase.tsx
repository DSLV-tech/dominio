// ─── HexBase ──────────────────────────────────────────────────────────────────
// Basamento esagonale: bordo nel colore del proprietario + piano lastricato.
// Coordinate locali: y = 0 è la superficie del piano.
// Il colore sfuma verso quello del nuovo proprietario e il bagliore "respira":
// tutto in useFrame sui materiali, senza re-render React.

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type MeshStandardMaterial } from 'three';
import { damp, prefersReducedMotion } from '../common/motion';
import { HEX_RADIUS, HEX_SKIRT_DEPTH, HEX_TOP_RADIUS, PAVING_COLOR } from './constants';

interface HexBaseProps {
  /** Distanza fra piano dell'esagono e terreno (anchor.y - anchor.base). */
  readonly lift: number;
  readonly color: string;
  readonly glow: number;
  /** Fase iniziale del "respiro", per non far pulsare tutti i territori all'unisono. */
  readonly phase: number;
}

const COLOR_LAMBDA = 4;   // ~0.6 s per completare la transizione di colore
const GLOW_LAMBDA  = 8;
const BREATH       = 0.12;

export const HexBase = memo(function HexBase({ lift, color, glow, phase }: HexBaseProps) {
  const rimHeight = lift + HEX_SKIRT_DEPTH - 0.06;
  const matRef = useRef<MeshStandardMaterial>(null);
  const target = useMemo(() => new Color(color), [color]);
  const glowRef = useRef(glow);
  const still = prefersReducedMotion();

  useFrame(({ clock }, dt) => {
    const m = matRef.current;
    if (!m) return;
    if (still) {
      m.color.copy(target);
      m.emissive.copy(target);
      m.emissiveIntensity = glow;
      return;
    }
    const k = 1 - Math.exp(-COLOR_LAMBDA * dt);
    m.color.lerp(target, k);
    m.emissive.lerp(target, k);
    glowRef.current = damp(glowRef.current, glow, GLOW_LAMBDA, dt);
    m.emissiveIntensity = glowRef.current + BREATH * Math.sin(clock.elapsedTime * 1.6 + phase);
  });

  return (
    <group>
      <mesh position={[0, -0.06 - rimHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[HEX_RADIUS, HEX_RADIUS, rimHeight, 6]} />
        <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={glow} roughness={0.42} metalness={0.25} />
      </mesh>
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <cylinderGeometry args={[HEX_TOP_RADIUS, HEX_TOP_RADIUS, 0.06, 6]} />
        <meshStandardMaterial color={PAVING_COLOR} roughness={0.85} />
      </mesh>
    </group>
  );
});
