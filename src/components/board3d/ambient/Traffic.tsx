// ─── Traffic ──────────────────────────────────────────────────────────────────
// Auto che percorrono le strade della città. Ogni auto viaggia sulla corsia di
// destra; arrivata a un quartiere "entra" nell'esagono (rimpicciolendo) e
// riappare su un'altra strada che ne parte.
// Costo: 4 InstancedMesh (carrozzeria, abitacolo, fari, fanali) aggiornate in
// useFrame, nessun re-render React.

import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry, Color, Object3D, Vector3,
  type BufferGeometry, type InstancedMesh, type MeshBasicMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { prefersReducedMotion } from '../../common/motion';
import { skyRuntime } from '../skyRuntime';
import { buildRoadNetwork, pointAt, type RoadNetwork } from './roadNetwork';
import { mulberry32, pick, smoothstep } from './rng';
import type { RoadPath } from '../../../types';

interface TrafficProps {
  readonly roads: readonly RoadPath[];
  readonly count: number;
}

interface CarState {
  road: number;
  dir: 1 | -1;
  /** Distanza percorsa dall'ingresso nella strada corrente. */
  s: number;
  speed: number;
}

const LANE_OFFSET = 0.08;      // metà carreggiata: 0.16
/** Le auto sono in scala "giocattolo": a vera scala sparirebbero a questa distanza. */
const CAR_SCALE = 1.5;
const LOOK_AHEAD = 0.12;
const FADE_DIST = 0.35;        // tratto in cui l'auto "esce/entra" nell'esagono
const SPEED_RANGE = [0.45, 0.8] as const;
const BODY_COLORS = ['#e9e4d8', '#b8352b', '#2f4f6f', '#e0b04a', '#3a3d42', '#7a9a8a', '#f4f2ec', '#5b3a5e'] as const;
const UP = new Vector3(0, 1, 0);

/** Geometrie in coordinate locali: muso verso +Z, ruote a y = 0. */
function buildCarGeometries(): Record<'body' | 'cabin' | 'head' | 'tail', BufferGeometry> {
  const body = new BoxGeometry(0.085, 0.042, 0.17).translate(0, 0.029, 0);
  const cabin = new BoxGeometry(0.07, 0.036, 0.085).translate(0, 0.068, -0.014);
  const lamp = (x: number, z: number) => new BoxGeometry(0.02, 0.012, 0.006).translate(x, 0.034, z);
  const head = mergeGeometries([lamp(-0.027, 0.086), lamp(0.027, 0.086)]);
  const tail = mergeGeometries([lamp(-0.027, -0.086), lamp(0.027, -0.086)]);
  if (!head || !tail) throw new Error('Traffic: geometrie dei fari non valide');
  return { body, cabin, head, tail };
}

function initCars(net: RoadNetwork, count: number): CarState[] {
  const rng = mulberry32(1997);
  return Array.from({ length: count }, () => {
    const road = Math.floor(rng() * net.tracks.length);
    const track = net.tracks[road]!;
    return {
      road,
      dir: rng() < 0.5 ? 1 : -1,
      s: rng() * track.length,
      speed: SPEED_RANGE[0] + rng() * (SPEED_RANGE[1] - SPEED_RANGE[0]),
    };
  });
}

export const Traffic = memo(function Traffic({ roads, count }: TrafficProps) {
  const net  = useMemo(() => buildRoadNetwork(roads), [roads]);
  const geo  = useMemo(() => buildCarGeometries(), []);
  const cars = useMemo(() => (net.tracks.length > 0 ? initCars(net, count) : []), [net, count]);

  const bodyRef  = useRef<InstancedMesh>(null);
  const cabinRef = useRef<InstancedMesh>(null);
  const headRef  = useRef<InstancedMesh>(null);
  const tailRef  = useRef<InstancedMesh>(null);
  const headMat  = useRef<MeshBasicMaterial>(null);

  const tmp = useMemo(() => ({
    dummy: new Object3D(), a: new Vector3(), b: new Vector3(), fwd: new Vector3(), right: new Vector3(), target: new Vector3(),
  }), []);
  const rng = useMemo(() => mulberry32(42), []);
  const still = prefersReducedMotion();

  // Colori per istanza: una volta sola
  useLayoutEffect(() => {
    const m = bodyRef.current;
    if (!m) return;
    const c = new Color();
    cars.forEach((_, i) => m.setColorAt(i, c.set(BODY_COLORS[i % BODY_COLORS.length]!)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame((_, rawDt) => {
    // fari: spenti di giorno, accesi di notte (livello dal cielo)
    headMat.current?.color.set('#fff2c2').multiplyScalar(0.12 + 0.88 * skyRuntime.headlights);
    const meshes = [bodyRef.current, cabinRef.current, headRef.current, tailRef.current];
    if (meshes.some(m => !m)) return;
    const dt = still ? 0 : Math.min(rawDt, 0.1);   // niente "teletrasporti" dopo un tab in background
    const { dummy, a, b, fwd, right, target } = tmp;

    cars.forEach((car, i) => {
      let track = net.tracks[car.road]!;
      car.s += car.speed * dt;
      if (car.s >= track.length) {
        // arrivo in un quartiere: si riparte da una delle sue strade
        const arrived = car.dir > 0 ? track.to : track.from;
        const options = net.exits.get(arrived) ?? [];
        const others = options.filter(e => e.road !== car.road);
        const next = pick(rng, others.length > 0 ? others : options);
        car.road = next.road; car.dir = next.dir; car.s = 0;
        track = net.tracks[car.road]!;
      }

      const d = car.dir > 0 ? car.s : track.length - car.s;
      pointAt(track, d, a);
      pointAt(track, d + car.dir * LOOK_AHEAD, b);
      fwd.subVectors(b, a);
      if (fwd.lengthSq() < 1e-8) {           // a fine strada: direzione dal tratto precedente
        pointAt(track, d - car.dir * LOOK_AHEAD, b);
        fwd.subVectors(a, b);
      }
      fwd.normalize();
      right.crossVectors(fwd, UP).normalize();

      const k = smoothstep(0, FADE_DIST, Math.min(car.s, track.length - car.s));
      dummy.position.copy(a).addScaledVector(right, LANE_OFFSET);
      target.copy(dummy.position).add(fwd);
      dummy.lookAt(target);
      dummy.scale.setScalar(Math.max(k, 0.001) * CAR_SCALE);
      dummy.updateMatrix();
      for (const m of meshes) m!.setMatrixAt(i, dummy.matrix);
    });

    for (const m of meshes) m!.instanceMatrix.needsUpdate = true;
  });

  if (cars.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[geo.body, undefined, cars.length]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.35} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={cabinRef} args={[geo.cabin, undefined, cars.length]} frustumCulled={false}>
        <meshStandardMaterial color="#1b2430" roughness={0.15} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[geo.head, undefined, cars.length]} frustumCulled={false}>
        <meshBasicMaterial ref={headMat} color="#fff2c2" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tailRef} args={[geo.tail, undefined, cars.length]} frustumCulled={false}>
        <meshBasicMaterial color="#ff3b2f" toneMapped={false} />
      </instancedMesh>
    </group>
  );
});
