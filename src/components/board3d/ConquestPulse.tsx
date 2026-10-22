// ─── ConquestPulse ────────────────────────────────────────────────────────────
// Onda d'urto esagonale + colonna di luce quando un territorio cambia
// proprietario. Il componente va montato con `key` legata al proprietario:
// ogni cambio rimonta l'effetto, che si spegne da solo dopo DURATION secondi.

import { memo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, type Mesh, type MeshBasicMaterial } from 'three';
import { HEX_RADIUS } from './constants';

interface ConquestPulseProps {
  readonly color: string;
}

const DURATION = 1.4;
const BEAM_HEIGHT = 2.4;
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

export const ConquestPulse = memo(function ConquestPulse({ color }: ConquestPulseProps) {
  const ring   = useRef<Mesh>(null);
  const ringM  = useRef<MeshBasicMaterial>(null);
  const beam   = useRef<Mesh>(null);
  const beamM  = useRef<MeshBasicMaterial>(null);
  const t      = useRef(0);
  const [done, setDone] = useState(false);

  useFrame((_, dt) => {
    if (done) return;
    t.current += dt;
    const p = Math.min(1, t.current / DURATION);
    const e = easeOut(p);
    if (ring.current && ringM.current) {
      const s = 1 + e * 1.6;
      ring.current.scale.set(s, s, s);
      ringM.current.opacity = (1 - p) * 0.9;
    }
    if (beam.current && beamM.current) {
      const h = 0.2 + e * 1.2;
      beam.current.scale.y = h;
      beam.current.position.y = BEAM_HEIGHT / 2 * h;   // cresce dalla base
      beamM.current.opacity = Math.sin(Math.PI * p) * 0.45;
    }
    if (p >= 1) setDone(true);
  });

  if (done) return null;

  return (
    <group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} renderOrder={3} raycast={() => undefined}>
        <ringGeometry args={[HEX_RADIUS * 0.9, HEX_RADIUS * 1.05, 6, 1, Math.PI / 6]} />
        <meshBasicMaterial ref={ringM} color={color} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={beam} position={[0, 0, 0]} renderOrder={3} raycast={() => undefined}>
        <cylinderGeometry args={[HEX_RADIUS * 0.75, HEX_RADIUS * 0.9, BEAM_HEIGHT, 6, 1, true]} />
        <meshBasicMaterial ref={beamM} color={color} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
});
