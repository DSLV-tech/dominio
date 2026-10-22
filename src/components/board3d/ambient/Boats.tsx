// ─── Boats ────────────────────────────────────────────────────────────────────
// Pescherecci e traghetto che navigano su rotte chiuse: beccheggio, rollio e
// scia di schiuma che pulsa. Una curva Catmull-Rom per rotta, percorsa a
// velocità costante (getPointAt / getTangentAt usano l'ascissa curvilinea).

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, Vector3,
  type Group, type MeshBasicMaterial,
} from 'three';
import { prefersReducedMotion } from '../../common/motion';
import type { BoatKind, BoatRoute } from '../../../types';

interface BoatsProps {
  readonly routes: readonly BoatRoute[];
  readonly waterLevel: number;
}

interface HullStyle {
  readonly hull: string;
  readonly stripe: string;
  readonly cabin: string;
  readonly scale: number;
}

const STYLE: Readonly<Record<BoatKind, HullStyle>> = {
  fishing: { hull: '#f1ede3', stripe: '#b8352b', cabin: '#f6f3ea', scale: 1 },
  ferry:   { hull: '#e9e6dc', stripe: '#2f5d86', cabin: '#fbfaf6', scale: 1.15 },
};

/** Scia a "V" aperta dietro la poppa (punta in z = 0, si allarga verso -z). */
function wakeGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0, 0,   -0.22, 0, -0.9,   -0.12, 0, -0.9,
    0, 0, 0,    0.12, 0, -0.9,    0.22, 0, -0.9,
  ]), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array([
    1, 1, 1,  0, 0, 0,  0, 0, 0,
    1, 1, 1,  0, 0, 0,  0, 0, 0,
  ]), 3));
  return g;
}

const WAKE = wakeGeometry();

interface BoatProps {
  readonly route: BoatRoute;
  readonly waterLevel: number;
  readonly phase: number;
}

const Boat = memo(function Boat({ route, waterLevel, phase }: BoatProps) {
  const curve = useMemo(
    () => new CatmullRomCurve3(route.path.map(([x, z]) => new Vector3(x, waterLevel, z)), true, 'centripetal'),
    [route.path, waterLevel],
  );
  const length = useMemo(() => curve.getLength(), [curve]);
  const ref = useRef<Group>(null);
  const hullRef = useRef<Group>(null);
  const wakeMat = useRef<MeshBasicMaterial>(null);
  const u = useRef(route.start);
  const tmp = useMemo(() => ({ p: new Vector3(), t: new Vector3() }), []);
  const style = STYLE[route.kind];
  const still = prefersReducedMotion();

  useFrame(({ clock }, rawDt) => {
    const g = ref.current, h = hullRef.current;
    if (!g || !h) return;
    const dt = still ? 0 : Math.min(rawDt, 0.1);
    u.current = (u.current + (route.speed * dt) / length) % 1;
    curve.getPointAt(u.current, tmp.p);
    curve.getTangentAt(u.current, tmp.t);
    g.position.copy(tmp.p);
    g.lookAt(tmp.p.x + tmp.t.x, tmp.p.y, tmp.p.z + tmp.t.z);
    if (!still) {
      const t = clock.elapsedTime + phase;
      h.position.y = Math.sin(t * 1.8) * 0.012;
      h.rotation.z = Math.sin(t * 1.3) * 0.06;    // rollio
      h.rotation.x = Math.sin(t * 1.8 + 1) * 0.035; // beccheggio
      if (wakeMat.current) wakeMat.current.opacity = 0.32 + Math.sin(t * 3.1) * 0.08;
    }
  });

  return (
    <group ref={ref} scale={style.scale}>
      <group ref={hullRef}>
        {/* scafo + prua */}
        <mesh position={[0, 0.02, -0.03]} castShadow>
          <boxGeometry args={[0.15, 0.08, 0.36]} />
          <meshStandardMaterial color={style.hull} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.02, 0.18]} rotation={[Math.PI / 2, Math.PI / 4, 0]} scale={[1, 1, 0.55]} castShadow>
          <coneGeometry args={[0.106, 0.14, 4]} />
          <meshStandardMaterial color={style.hull} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.063, -0.03]}>
          <boxGeometry args={[0.152, 0.018, 0.362]} />
          <meshStandardMaterial color={style.stripe} roughness={0.5} />
        </mesh>
        {/* cabina con finestre accese */}
        <mesh position={[0, 0.11, -0.08]} castShadow>
          <boxGeometry args={[0.11, 0.08, 0.13]} />
          <meshStandardMaterial color={style.cabin} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.12, -0.014]}>
          <boxGeometry args={[0.09, 0.025, 0.004]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </mesh>
        {/* albero */}
        <mesh position={[0, 0.2, 0.06]}>
          <cylinderGeometry args={[0.006, 0.008, 0.26, 5]} />
          <meshStandardMaterial color="#6b4a2b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.33, 0.06]}>
          <sphereGeometry args={[0.012, 8, 6]} />
          <meshBasicMaterial color="#ff4a3a" toneMapped={false} />
        </mesh>
      </group>
      {/* scia */}
      <mesh geometry={WAKE} position={[0, 0.006, -0.2]} renderOrder={2}>
        <meshBasicMaterial ref={wakeMat} vertexColors transparent opacity={0.32} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
});

export const Boats = memo(function Boats({ routes, waterLevel }: BoatsProps) {
  return (
    <group>
      {routes.map((r, i) => <Boat key={r.id} route={r} waterLevel={waterLevel} phase={i * 1.7} />)}
    </group>
  );
});
