// ─── CombatSquad ──────────────────────────────────────────────────────────────
// Le pedine di uno schieramento: entrano sul piedistallo, caricano verso il
// centro con un balzo, si scontrano; chi ha perso il proprio dado cade
// all'indietro e svanisce, chi vince arretra (e festeggia se conquista).

import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, MeshStandardMaterial, type Group, type Object3D } from 'three';
import { COMBAT_MS } from '../../data/combatTimeline';
import type { CombatSide } from '../../types';
import { FIGURE_SCALE, collectMaterials, figureHome, figureTarget, sideSign, type CombatClockRef, type Vec3Tuple } from './arenaLayout';
import { clamp01, easeInOutQuad, easeOutCubic } from './dieMath';

const NEUTRAL_TINT = new Color('#8b9099');

function instantiate(template: Object3D, neutral: boolean): Object3D {
  const root = template.clone();
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const m: unknown = o.material;
    if (m instanceof MeshStandardMaterial) {
      const c = m.clone();
      c.transparent = true;
      if (neutral) c.color.copy(NEUTRAL_TINT);
      o.material = c;
    }
  });
  return root;
}

interface FigureProps {
  readonly template: Object3D;
  readonly neutral: boolean;
  readonly side: CombatSide;
  readonly index: number;
  readonly home: Vec3Tuple;
  readonly target: Vec3Tuple;
  readonly falls: boolean;
  readonly celebrates: boolean;
  readonly clockRef: CombatClockRef;
}

const Figure = memo(function Figure(p: FigureProps) {
  const group = useRef<Group>(null);
  const inst = useMemo(() => instantiate(p.template, p.neutral), [p.template, p.neutral]);
  const matsRef = useRef<MeshStandardMaterial[] | null>(null);
  const s = sideSign(p.side);
  const facing = -s * Math.PI / 2; // fronte del modello (+Z) verso il centro

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const ms = p.clockRef.current.ms;
    const [hx, hy, hz] = p.home;
    const [tx, ty, tz] = p.target;

    // ingresso: sale dal piedistallo con un piccolo rimbalzo
    const enter = easeOutCubic(clamp01((ms - 80 - p.index * 70) / 420));
    let x = hx, y = hy - 0.5 * (1 - enter), z = hz;
    let tilt = 0, opacity = enter;
    const breathe = Math.sin((ms + p.index * 400) / 380) * 0.012;
    let scaleY = 1 + breathe;

    if (ms >= COMBAT_MS.clash) {
      const c = easeInOutQuad(clamp01((ms - COMBAT_MS.clash) / (COMBAT_MS.impact - COMBAT_MS.clash)));
      const hop = Math.sin(Math.PI * c) * 0.38;
      x = hx + (tx - hx) * c; z = hz + (tz - hz) * c; y = hy + (ty - hy) * c + hop;
      scaleY = 1;
    }
    if (ms >= COMBAT_MS.impact) {
      const f = clamp01((ms - COMBAT_MS.impact) / COMBAT_MS.fallDuration);
      if (p.falls) {
        // contraccolpo, caduta all'indietro, poi svanisce sprofondando
        x = tx + s * 0.32 * easeOutCubic(f);
        y = ty + Math.sin(Math.PI * Math.min(1, f * 1.6)) * 0.12 - 0.25 * clamp01((f - 0.7) / 0.3);
        tilt = (Math.PI / 2) * easeOutCubic(clamp01(f * 1.25));
        opacity = 1 - clamp01((ms - COMBAT_MS.impact - COMBAT_MS.fallDuration * 0.7) / 450);
      } else {
        const back = easeOutCubic(clamp01(f * 1.4)) * 0.35;
        x = tx + s * back; z = tz; y = ty;
        if (p.celebrates && ms >= COMBAT_MS.result - 200) {
          y += Math.abs(Math.sin((ms - COMBAT_MS.result + 200) / 170)) * 0.16 * Math.max(0, 1 - (ms - COMBAT_MS.result) / 1600);
        }
      }
    }

    g.position.set(x, y, z);
    g.rotation.set(0, facing, 0);
    g.rotateX(-tilt); // cade all'indietro rispetto al proprio fronte
    g.scale.set(FIGURE_SCALE, FIGURE_SCALE * scaleY, FIGURE_SCALE);
    g.visible = opacity > 0.01;
    matsRef.current ??= collectMaterials(g);
    for (const m of matsRef.current) {
      m.opacity = opacity;
      m.depthWrite = opacity > 0.98;
    }
  });

  return (
    <group ref={group}>
      <primitive object={inst} />
    </group>
  );
});

interface CombatSquadProps {
  readonly side: CombatSide;
  readonly template: Object3D;
  readonly neutral: boolean;
  readonly fallen: readonly boolean[];
  readonly pairs: number;
  readonly celebrates: boolean;
  readonly clockRef: CombatClockRef;
}

export const CombatSquad = memo(function CombatSquad({ side, template, neutral, fallen, pairs, celebrates, clockRef }: CombatSquadProps) {
  const n = fallen.length;
  const slots = useMemo(
    () => fallen.map((falls, i) => ({ falls, home: figureHome(side, i, n), target: figureTarget(side, i, pairs) })),
    [fallen, side, n, pairs],
  );
  return (
    <group>
      {slots.map((slot, i) => (
        <Figure
          key={i}
          template={template}
          neutral={neutral}
          side={side}
          index={i}
          home={slot.home}
          target={slot.target}
          falls={slot.falls}
          celebrates={celebrates && !slot.falls}
          clockRef={clockRef}
        />
      ))}
    </group>
  );
});
