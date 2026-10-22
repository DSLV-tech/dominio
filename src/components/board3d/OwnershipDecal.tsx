// ─── OwnershipDecal ───────────────────────────────────────────────────────────
// Alone sul terreno attorno a un territorio, nel colore della fazione che lo
// controlla: il possesso si legge anche senza guardare il gettone.
// Una sola CanvasTexture radiale condivisa; il colore sfuma al cambio di
// proprietario come in HexBase (useFrame sul materiale, nessun re-render).

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Color, type MeshBasicMaterial } from 'three';
import { prefersReducedMotion } from '../common/motion';

/** Disattiva il raycast di una mesh. */
const NO_RAYCAST = (): void => undefined;

const DECAL_RADIUS = 1.9;
const DECAL_OPACITY = 0.5;
const COLOR_LAMBDA = 4;

let sharedTexture: CanvasTexture | null = null;

/** Disco bianco con bordo sfumato; il colore arriva dal materiale. */
function getFalloffTexture(): CanvasTexture {
  if (sharedTexture) return sharedTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  sharedTexture = new CanvasTexture(canvas);
  return sharedTexture;
}

interface OwnershipDecalProps {
  /** Altezza del piano dell'esagono sul terreno (anchor.y - anchor.base). */
  readonly lift: number;
  /** null = territorio neutrale: nessun alone. */
  readonly color: string | null;
}

export const OwnershipDecal = memo(function OwnershipDecal({ lift, color }: OwnershipDecalProps) {
  const matRef = useRef<MeshBasicMaterial>(null);
  const texture = useMemo(getFalloffTexture, []);
  const target = useMemo(() => new Color(color ?? '#000000'), [color]);
  const opacityRef = useRef(color ? DECAL_OPACITY : 0);
  const still = prefersReducedMotion();

  useFrame((_, dt) => {
    const m = matRef.current;
    if (!m) return;
    const goal = color ? DECAL_OPACITY : 0;
    if (still) {
      m.color.copy(target);
      m.opacity = goal;
      return;
    }
    const k = 1 - Math.exp(-COLOR_LAMBDA * dt);
    if (color) m.color.lerp(target, k);
    opacityRef.current += (goal - opacityRef.current) * k;
    m.opacity = opacityRef.current;
  });

  return (
    // raycast spento: l'alone è solo decorativo e non deve catturare hover/click dei territori vicini
    <mesh position={[0, -lift + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} raycast={NO_RAYCAST}>
      <circleGeometry args={[DECAL_RADIUS, 40]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        color={color ?? '#000000'}
        transparent
        opacity={color ? DECAL_OPACITY : 0}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
});
