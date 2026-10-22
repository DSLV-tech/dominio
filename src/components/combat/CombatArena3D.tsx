// ─── CombatArena3D ────────────────────────────────────────────────────────────
// La piazza dello scontro: dadi 3D lanciati sul panno, truppe delle due
// fazioni che caricano, scintille, camera che trema all'impatto.
//
// Un solo orologio (CombatClock, in ref) guida tutto: ogni componente legge
// `clockRef.current.ms` nel proprio useFrame. Il genitore riceve solo i cambi di
// fase (onStage) — una manciata di setState per l'intera sequenza.
// Gli effetti sonori sono agganciati agli stessi istanti dell'immagine.

import { memo, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { audio } from '../../audio/engine';
import { COMBAT_MS, stageAt } from '../../data/combatTimeline';
import { FACTION_DEFINITIONS } from '../../data';
import type { CombatSide, CombatStage, CombatView, SfxName } from '../../types';
import { CombatDie } from './CombatDie';
import { CombatSquad } from './CombatSquad';
import { ImpactBurst } from './ImpactBurst';
import { useCombatModels } from './useCombatModels';
import { BOUNCES, seeded } from './dieMath';
import { PLINTH_X, dieRestPosition, sideSign, type CombatClock, type CombatClockRef, type Vec3Tuple } from './arenaLayout';

// ── Eventi sonori sulla linea del tempo ──────────────────────────────────────

interface TimedSfx {
  readonly at: number;
  readonly name: SfxName;
  readonly intensity: number;
  readonly pan: number;
}

interface DieThrow {
  readonly side: CombatSide;
  readonly index: number;
  readonly value: number;
  readonly from: Vec3Tuple;
  readonly to: Vec3Tuple;
  readonly startMs: number;
  readonly yaw: number;
  readonly spinAxis: Vec3Tuple;
  readonly spinTurns: number;
}

function planThrows(view: CombatView, seed: number): DieThrow[] {
  const rnd = seeded(seed);
  const out: DieThrow[] = [];
  for (const sv of [view.attacker, view.defender]) {
    const s = sideSign(sv.side);
    const base = COMBAT_MS.roll + (sv.side === 'defender' ? COMBAT_MS.defenderOffset : 0);
    sv.dice.forEach((value, i) => {
      out.push({
        side: sv.side,
        index: i,
        value,
        from: [s * (2.3 + rnd() * 0.3), 1.5 + rnd() * 0.4, (rnd() - 0.5) * 1.2],
        to: dieRestPosition(sv.side, i, sv.dice.length),
        startMs: base + i * COMBAT_MS.dieStagger,
        yaw: (rnd() - 0.5) * 0.7,
        spinAxis: [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5],
        spinTurns: 2 + rnd() * 1.5,
      });
    });
  }
  return out;
}

function planSounds(view: CombatView, throws: readonly DieThrow[]): TimedSfx[] {
  const ev: TimedSfx[] = [
    { at: COMBAT_MS.shake, name: 'diceShake', intensity: 0.9, pan: -0.5 },
    { at: COMBAT_MS.shake + COMBAT_MS.defenderOffset, name: 'diceShake', intensity: 0.7, pan: 0.5 },
    { at: COMBAT_MS.clash + 80, name: 'move', intensity: 0.7, pan: 0 },
    { at: COMBAT_MS.impact, name: 'clash', intensity: 1, pan: 0 },
    { at: COMBAT_MS.impact, name: 'impact', intensity: 0.9, pan: 0 },
    { at: COMBAT_MS.result, name: view.conquered ? 'conquest' : 'repelled', intensity: 1, pan: 0 },
  ];
  for (const t of throws) {
    for (const b of BOUNCES) {
      ev.push({ at: t.startMs + b.at * COMBAT_MS.dieFlight, name: 'diceHit', intensity: b.energy, pan: t.to[0] / 1.5 });
    }
  }
  const fallers = view.attacker.fallen.filter(Boolean).length + view.defender.fallen.filter(Boolean).length;
  if (fallers > 0) ev.push({ at: COMBAT_MS.impact + 160, name: 'fall', intensity: Math.min(1, 0.5 + fallers * 0.15), pan: 0 });
  return ev.sort((a, b) => a.at - b.at);
}

// ── Orologio ─────────────────────────────────────────────────────────────────

interface ClockDriverProps {
  readonly clockRef: CombatClockRef;
  readonly speed: number;
  readonly skipToken: number;
  readonly sounds: readonly TimedSfx[];
  readonly onStage: (stage: CombatStage) => void;
}

function ClockDriver({ clockRef, speed, skipToken, sounds, onStage }: ClockDriverProps) {
  const lastStage = useRef<CombatStage>('intro');
  const lastMs = useRef(0);
  const handledSkip = useRef(skipToken);

  useFrame((_, delta) => {
    const c = clockRef.current;
    const prev = c.ms;
    if (skipToken !== handledSkip.current) {
      handledSkip.current = skipToken;
      if (c.ms < COMBAT_MS.result) { c.ms = COMBAT_MS.result - 1; lastMs.current = c.ms; }
    }
    c.ms = Math.min(COMBAT_MS.result + 4000, c.ms + Math.min(delta, 0.1) * 1000 * speed);
    const from = Math.max(prev, lastMs.current);
    for (const s of sounds) {
      if (s.at > from && s.at <= c.ms) audio.play(s.name, { intensity: s.intensity, pan: s.pan });
    }
    lastMs.current = c.ms;
    const st = stageAt(c.ms);
    if (st !== lastStage.current) { lastStage.current = st; onStage(st); }
  });
  return null;
}

// ── Camera ───────────────────────────────────────────────────────────────────

const CAM_FROM = new Vector3(0.5, 3.6, 5.6);
const CAM_TO = new Vector3(0, 2.55, 4.45);
const CAM_CLASH = new Vector3(0, 2.0, 3.45);
const LOOK = new Vector3(0, 0.38, -0.1);

function CombatCamera({ clockRef }: { readonly clockRef: CombatClockRef }) {
  const tmp = useMemo(() => new Vector3(), []);
  useFrame(state => {
    const ms = clockRef.current.ms;
    const intro = Math.min(1, ms / 900);
    const e = 1 - (1 - intro) ** 3;
    tmp.lerpVectors(CAM_FROM, CAM_TO, e);
    const push = Math.min(1, Math.max(0, (ms - COMBAT_MS.clash) / 600));
    const pull = Math.min(1, Math.max(0, (ms - COMBAT_MS.result) / 900));
    tmp.lerp(CAM_CLASH, (push - pull) * 0.6);
    // schermi stretti: si arretra per far stare tutta la piazza
    const { width, height } = state.size;
    const aspect = width / Math.max(1, height);
    tmp.multiplyScalar(Math.max(1, 1.6 / aspect));
    const age = ms - COMBAT_MS.impact;
    const a = age > 0 && age < 450 ? 0.09 * (1 - age / 450) : 0;
    state.camera.position.set(tmp.x + Math.sin(age * 0.11) * a, tmp.y + Math.cos(age * 0.137) * a, tmp.z);
    state.camera.lookAt(LOOK);
  });
  return null;
}

// ── Scena ────────────────────────────────────────────────────────────────────

interface SceneProps {
  readonly view: CombatView;
  readonly seed: number;
  readonly clockRef: CombatClockRef;
}

function ArenaScene({ view, seed, clockRef }: SceneProps) {
  const models = useCombatModels();
  const throws = useMemo(() => planThrows(view, seed), [view, seed]);
  const pairs = Math.min(view.attacker.figures, view.defender.figures);
  const fallback = models.troops.BIANCHI;
  const atkTpl = (view.attacker.faction && models.troops[view.attacker.faction]) || fallback;
  const defTpl = (view.defender.faction && models.troops[view.defender.faction]) || fallback;
  const atkEmblem = view.attacker.faction ? models.emblems[view.attacker.faction] : undefined;
  const defEmblem = view.defender.faction ? models.emblems[view.defender.faction] : undefined;
  const sparkColor = view.conquered ? '#ffcf6b' : '#ff9a5c';

  return (
    <>
      <primitive object={models.arena} />
      {atkEmblem && <primitive object={atkEmblem} position={[-1.05, 0.1, -2.05]} scale={0.62} />}
      {defEmblem && <primitive object={defEmblem} position={[1.05, 0.1, -2.05]} scale={0.62} />}

      {throws.map(t => (
        <CombatDie
          key={`${t.side}-${t.index}`}
          template={t.side === 'attacker' ? models.dieAttack : models.dieDefense}
          value={t.value}
          verdict={(t.side === 'attacker' ? view.attacker : view.defender).verdicts[t.index] ?? null}
          from={t.from}
          to={t.to}
          startMs={t.startMs}
          yaw={t.yaw}
          spinAxis={t.spinAxis}
          spinTurns={t.spinTurns}
          clockRef={clockRef}
        />
      ))}

      {atkTpl && (
        <CombatSquad side="attacker" template={atkTpl} neutral={!view.attacker.faction} fallen={view.attacker.fallen}
          pairs={pairs} celebrates={view.conquered} clockRef={clockRef} />
      )}
      {defTpl && (
        <CombatSquad side="defender" template={defTpl} neutral={!view.defender.faction} fallen={view.defender.fallen}
          pairs={pairs} celebrates={!view.conquered} clockRef={clockRef} />
      )}
      <ImpactBurst clockRef={clockRef} seed={seed} color={sparkColor} />
    </>
  );
}

function Lights({ attackColor, defendColor }: { readonly attackColor: string; readonly defendColor: string }) {
  return (
    <>
      <hemisphereLight args={['#a9bde0', '#2a2018', 0.9]} />
      <directionalLight
        position={[2.5, 6, 3.5]}
        intensity={1.6}
        color="#ffe2bf"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0004}
      />
      {/* lampioni */}
      <pointLight position={[-2.0, 2.0, -2.0]} color="#ffc76e" intensity={5} distance={6} decay={2} />
      <pointLight position={[2.0, 2.0, -2.0]} color="#ffc76e" intensity={5} distance={6} decay={2} />
      {/* luci di fazione dietro gli schieramenti */}
      <pointLight position={[-PLINTH_X - 0.6, 1.4, 0.8]} color={attackColor} intensity={3} distance={4} decay={2} />
      <pointLight position={[PLINTH_X + 0.6, 1.4, 0.8]} color={defendColor} intensity={3} distance={4} decay={2} />
    </>
  );
}

// ── Componente pubblico ──────────────────────────────────────────────────────

export interface CombatArena3DProps {
  readonly view: CombatView;
  readonly seed: number;
  readonly skipToken: number;
  readonly onStage: (stage: CombatStage) => void;
}

export const CombatArena3D = memo(function CombatArena3D({ view, seed, skipToken, onStage }: CombatArena3DProps) {
  const clockRef = useRef<CombatClock>({ ms: 0 });
  const throws = useMemo(() => planThrows(view, seed), [view, seed]);
  const sounds = useMemo(() => planSounds(view, throws), [view, throws]);
  const atkColor = view.attacker.faction ? FACTION_DEFINITIONS[view.attacker.faction].color : '#8b9099';
  const defColor = view.defender.faction ? FACTION_DEFINITIONS[view.defender.faction].color : '#8b9099';

  // nuovo attacco → orologio da capo
  useEffect(() => { clockRef.current.ms = 0; }, [view]);

  return (
    <Canvas
      className="arena3d__canvas"
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [CAM_FROM.x, CAM_FROM.y, CAM_FROM.z], fov: 38, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#0b0d10']} />
      <fog attach="fog" args={['#0b0d10', 7, 15]} />
      <Lights attackColor={atkColor} defendColor={defColor} />
      <Suspense fallback={null}>
        <ArenaScene view={view} seed={seed} clockRef={clockRef} />
        {/* l'orologio parte solo a modelli caricati */}
        <ClockDriver clockRef={clockRef} speed={view.speed} skipToken={skipToken} sounds={sounds} onStage={onStage} />
      </Suspense>
      <CombatCamera clockRef={clockRef} />
    </Canvas>
  );
});

export default CombatArena3D;
