// ─── ConnectionArcs ───────────────────────────────────────────────────────────
// Archi luminosi fra la fonte selezionata e i bersagli validi
// (rosso = attacco, verde = spostamento) + arco dello scontro in corso.
// Ogni arco ha un alone, un tratteggio che scorre verso il bersaglio e una
// "cometa" che lo percorre: la direzione dell'azione si legge a colpo d'occhio.

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { QuadraticBezierLine, type QuadraticBezierLineRef } from '@react-three/drei';
import { AdditiveBlending, QuadraticBezierCurve3, Vector3, type Mesh } from 'three';
import type { TerritoryAnchor, TerritoryId, TerritoryPair } from '../../types';
import { prefersReducedMotion } from '../common/motion';

interface ConnectionArcsProps {
  readonly pairs: ReadonlyArray<TerritoryPair>;
  readonly anchors: Readonly<Record<TerritoryId, TerritoryAnchor>>;
  readonly color: string;
  readonly lineWidth?: number;
}

interface FlowingArcProps {
  readonly start: Vector3;
  readonly mid: Vector3;
  readonly end: Vector3;
  readonly color: string;
  readonly lineWidth: number;
  /** Sfasamento della cometa, così più archi non partono insieme. */
  readonly offset: number;
}

const LIFT = 0.9;
const DASH_SPEED = 1.6;     // unità di tratteggio al secondo
const COMET_PERIOD = 1.6;   // secondi per percorrere l'arco

const FlowingArc = memo(function FlowingArc({ start, mid, end, color, lineWidth, offset }: FlowingArcProps) {
  const dashRef  = useRef<QuadraticBezierLineRef>(null);
  const cometRef = useRef<Mesh>(null);
  const curve = useMemo(() => new QuadraticBezierCurve3(start, mid, end), [start, mid, end]);
  const tmp   = useMemo(() => new Vector3(), []);
  const still = prefersReducedMotion();

  useFrame(({ clock }) => {
    if (still) return;
    const line = dashRef.current;
    if (line) line.material.dashOffset = -clock.elapsedTime * DASH_SPEED;
    const comet = cometRef.current;
    if (comet) {
      const t = ((clock.elapsedTime + offset) / COMET_PERIOD) % 1;
      curve.getPoint(t, tmp);
      comet.position.copy(tmp);
      const s = 0.6 + Math.sin(Math.PI * t) * 0.6;   // più grande a metà arco
      comet.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* alone morbido */}
      <QuadraticBezierLine
        start={start} end={end} mid={mid}
        color={color} lineWidth={lineWidth * 3.2}
        transparent opacity={0.18} depthWrite={false} toneMapped={false}
      />
      {/* tratteggio che scorre verso il bersaglio */}
      <QuadraticBezierLine
        ref={dashRef}
        start={start} end={end} mid={mid}
        color={color} lineWidth={lineWidth}
        dashed={!still} dashSize={0.35} gapSize={0.2} dashScale={1}
        toneMapped={false}
      />
      {!still && (
        <mesh ref={cometRef} renderOrder={4}>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
});

export const ConnectionArcs = memo(function ConnectionArcs({ pairs, anchors, color, lineWidth = 3 }: ConnectionArcsProps) {
  const arcs = useMemo(() => pairs.map(([a, b], i) => {
    const A = anchors[a];
    const B = anchors[b];
    const dist = Math.hypot(B.x - A.x, B.z - A.z);
    return {
      key: `${a}-${b}`,
      start: new Vector3(A.x, A.y + LIFT, A.z),
      end:   new Vector3(B.x, B.y + LIFT, B.z),
      mid:   new Vector3((A.x + B.x) / 2, Math.max(A.y, B.y) + LIFT + dist * 0.25, (A.z + B.z) / 2),
      offset: i * 0.37,
    };
  }), [pairs, anchors]);

  return (
    <group>
      {arcs.map(arc => (
        <FlowingArc
          key={arc.key}
          start={arc.start} mid={arc.mid} end={arc.end}
          color={color} lineWidth={lineWidth} offset={arc.offset}
        />
      ))}
    </group>
  );
});
