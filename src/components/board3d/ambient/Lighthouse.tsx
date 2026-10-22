// ─── Lighthouse ───────────────────────────────────────────────────────────────
// Fascio rotante del faro del Porto Vecchio: due coni additivi opposti che
// sfumano verso l'esterno (colore per vertice) + alone pulsante sulla lanterna.

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, ConeGeometry, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { prefersReducedMotion } from '../../common/motion';
import { skyRuntime } from '../skyRuntime';
import type { Vec3 } from '../../../types';

interface LighthouseProps {
  readonly lantern: Vec3;
}

const BEAM_LENGTH = 4.5;
const BEAM_RADIUS = 0.55;
const TURN_SPEED = 0.9;   // rad/s
/** Leggera inclinazione verso l'alto: il fascio sfiora i tetti senza coprirli. */
const BEAM_PITCH = 0.12;

/** Cono con l'apice nell'origine, aperto verso +X, luminoso all'apice. */
function beamGeometry(): ConeGeometry {
  const g = new ConeGeometry(BEAM_RADIUS, BEAM_LENGTH, 20, 1, true);
  g.rotateZ(Math.PI / 2);            // apice da +Y a -X
  g.translate(BEAM_LENGTH / 2, 0, 0); // apice nell'origine
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.pow(1 - pos.getX(i) / BEAM_LENGTH, 1.6);
    colors.set([1 * k, 0.86 * k, 0.55 * k], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

export const Lighthouse = memo(function Lighthouse({ lantern }: LighthouseProps) {
  const geo = useMemo(() => beamGeometry(), []);
  const rot = useRef<Group>(null);
  const halo = useRef<Mesh>(null);
  const beamMats = useRef<MeshBasicMaterial[]>([]);
  const still = prefersReducedMotion();

  useFrame(({ clock }, dt) => {
    // il fascio si vede soprattutto di notte
    const level = 0.12 + 0.88 * skyRuntime.headlights;
    for (const m of beamMats.current) m.opacity = 0.28 * level;
    if (halo.current) (halo.current.material as MeshBasicMaterial).opacity = 0.6 * level;
    if (still) return;
    if (rot.current) rot.current.rotation.y += TURN_SPEED * Math.min(dt, 0.1);
    if (halo.current) halo.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.4) * 0.15);
  });

  return (
    <group position={[lantern.x, lantern.y, lantern.z]}>
      <group ref={rot}>
        {[0, Math.PI].map(a => (
          <mesh key={a} geometry={geo} rotation={[0, a, BEAM_PITCH]} renderOrder={5}>
            <meshBasicMaterial ref={m => { if (m) beamMats.current[a === 0 ? 0 : 1] = m; }} vertexColors transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={halo} renderOrder={5}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshBasicMaterial color="#ffd98a" transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
});
