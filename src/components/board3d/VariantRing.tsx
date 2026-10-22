// ─── VariantRing ──────────────────────────────────────────────────────────────
// Anello esagonale luminoso e pulsante: selezione, bersaglio d'attacco,
// destinazione di spostamento o semplice hover.

import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, type MeshBasicMaterial } from 'three';
import { HEX_RADIUS } from './constants';

interface VariantRingProps {
  readonly color: string;
  readonly pulse: boolean;
}

export const VariantRing = memo(function VariantRing({ color, pulse }: VariantRingProps) {
  const matRef = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;
    m.opacity = pulse ? 0.55 + 0.45 * Math.sin(clock.elapsedTime * 5) ** 2 : 0.6;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={2} raycast={() => undefined}>
      <ringGeometry args={[HEX_RADIUS - 0.04, HEX_RADIUS + 0.16, 6, 1, Math.PI / 6]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
});
