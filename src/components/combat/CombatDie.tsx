// ─── CombatDie ────────────────────────────────────────────────────────────────
// Un dado lanciato: vola, rimbalza, si ferma sulla faccia decisa dalle regole,
// poi si illumina (vinto) o si spegne (perso). Sparisce quando parte la carica.
// Nessuno stato React per frame: tutto in useFrame sugli oggetti three.js.

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Group, type Object3D } from 'three';
import { COMBAT_MS } from '../../data/combatTimeline';
import type { DieVerdict } from '../../types';
import { DIE_SIZE, collectMaterials, type CombatClockRef, type Vec3Tuple } from './arenaLayout';
import { bounceHeight, clamp01, easeOutCubic, restingQuaternion } from './dieMath';

interface CombatDieProps {
  readonly template: Object3D;
  readonly value: number;
  readonly verdict: DieVerdict;
  readonly from: Vec3Tuple;
  readonly to: Vec3Tuple;
  readonly startMs: number;
  readonly yaw: number;
  readonly spinAxis: Vec3Tuple;
  readonly spinTurns: number;
  readonly clockRef: CombatClockRef;
}

const WIN_GLOW = new Color('#46e37a');
const LOSE_TINT = new Color('#5a5a5a');
const WHITE = new Color('#ffffff');
const BLACK = new Color('#000000');

function instantiate(template: Object3D): Object3D {
  const root = template.clone();
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const m: unknown = o.material;
    if (m instanceof MeshStandardMaterial) o.material = m.clone();
  });
  return root;
}

export const CombatDie = memo(function CombatDie(props: CombatDieProps) {
  const { template, value, verdict, from, to, startMs, yaw, spinAxis, spinTurns, clockRef } = props;
  const group = useRef<Group>(null);
  const inst = useMemo(() => instantiate(template), [template]);
  const matsRef = useRef<MeshStandardMaterial[] | null>(null);
  const target = useMemo(() => restingQuaternion(value, yaw), [value, yaw]);
  const axis = useMemo(() => new Vector3(...spinAxis).normalize(), [spinAxis]);
  const scratch = useMemo(() => ({ q: new Quaternion(), spin: new Quaternion() }), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const ms = clockRef.current.ms;
    const t = (ms - startMs) / COMBAT_MS.dieFlight;
    g.visible = t >= 0 && ms < COMBAT_MS.clash + 260;
    if (!g.visible) return;

    const tt = clamp01(t);
    const e = easeOutCubic(tt);
    const h0 = from[1] - to[1];
    g.position.set(
      from[0] + (to[0] - from[0]) * e,
      to[1] + bounceHeight(tt, h0),
      from[2] + (to[2] - from[2]) * e,
    );
    scratch.spin.setFromAxisAngle(axis, spinTurns * Math.PI * 2 * (1 - e));
    scratch.q.copy(target).multiply(scratch.spin);
    g.quaternion.copy(scratch.q);

    // confronto: i vincitori si alzano e brillano, i perdenti si spengono
    const k = clamp01((ms - COMBAT_MS.compare) / 280);
    if (verdict === true) g.position.y += 0.07 * Math.sin(k * Math.PI * 0.5);
    matsRef.current ??= collectMaterials(g);
    for (const m of matsRef.current) {
      if (verdict === true) { m.emissive.copy(BLACK).lerp(WIN_GLOW, k); m.emissiveIntensity = 0.55 * k; }
      else if (verdict === false) m.color.copy(WHITE).lerp(LOSE_TINT, k * 0.75);
    }
    // via dal tavolo quando parte la carica
    const out = clamp01((ms - COMBAT_MS.clash) / 240);
    g.scale.setScalar(DIE_SIZE * (1 - out));
  });

  return (
    <group ref={group} visible={false} scale={DIE_SIZE}>
      <primitive object={inst} />
    </group>
  );
});
