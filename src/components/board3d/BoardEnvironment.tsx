// ─── BoardEnvironment ─────────────────────────────────────────────────────────
// Cielo, nebbia e luci. Il cielo segue i turni (data/sky.ts): tramonto →
// sera → notte → notte fonda, alba a fine partita. Ogni valore sfuma con
// smorzamento in useFrame (nessun re-render). La luce direzionale è il sole al
// tramonto e la luna di notte. Finestre e fari ricevono il livello in skyRuntime.
// Braci e bagliore caldo restano, scalati dal budget grafico.

import { memo, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sparkles, Stars } from '@react-three/drei';
import { Color, Fog, type DirectionalLight, type Group, type HemisphereLight, type PointLight } from 'three';
import { useGameStore } from '../../store/gameStore';
import { SKY_STATES, skyKeyForRound } from '../../data';
import { damp, prefersReducedMotion } from '../common/motion';
import { EMBER_COLOR, EMBER_FIELD } from './constants';
import { useGraphicsBudget } from './graphics';
import { skyRuntime } from './skyRuntime';
import { setGlowLevel } from './useBoardModels';

const SKY_LAMBDA = 1.6;   // ~2 s per passare da uno stato del cielo al successivo

const CityGlow = memo(function CityGlow() {
  const ref = useRef<PointLight>(null);
  const still = prefersReducedMotion();
  useFrame(({ clock }) => {
    if (!ref.current || still) return;
    const t = clock.elapsedTime;
    // due onde lente sovrapposte: un tremolio organico, non meccanico
    const base = 14 + skyRuntime.glow * 14;
    ref.current.intensity = base + Math.sin(t * 0.7) * 5 + Math.sin(t * 2.3) * 1.5;
  });
  return <pointLight ref={ref} position={[0, 6, 2]} color={EMBER_COLOR} intensity={26} distance={34} decay={1.6} />;
});

/** Porta cielo e luci verso lo stato richiesto dal turno corrente. */
const SkyDirector = memo(function SkyDirector({ starsRef, sunRef, hemiRef }: {
  readonly starsRef: React.RefObject<Group | null>;
  readonly sunRef: React.RefObject<DirectionalLight | null>;
  readonly hemiRef: React.RefObject<HemisphereLight | null>;
}) {
  const key = useGameStore(s => (s.game ? skyKeyForRound(s.game.round, s.game.phase) : 'dusk'));
  const sky = SKY_STATES[key];
  const scene = useThree(s => s.scene);
  const still = prefersReducedMotion();
  const targets = useMemo(() => ({
    bg: new Color(sky.background), sun: new Color(sky.sun.color),
    hemiSky: new Color(sky.hemi.sky), hemiGround: new Color(sky.hemi.ground),
  }), [sky]);
  const tmpBg = useMemo(() => new Color(sky.background), []);   // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const k = still ? 1 : 1 - Math.exp(-SKY_LAMBDA * dt);
    tmpBg.lerp(targets.bg, k);
    scene.background = tmpBg;
    if (scene.fog instanceof Fog) {
      scene.fog.color.copy(tmpBg);
      scene.fog.near = damp(scene.fog.near, sky.fog[0], SKY_LAMBDA, dt);
      scene.fog.far = damp(scene.fog.far, sky.fog[1], SKY_LAMBDA, dt);
    }
    const sun = sunRef.current;
    if (sun) {
      sun.color.lerp(targets.sun, k);
      sun.intensity = damp(sun.intensity, sky.sun.intensity, SKY_LAMBDA, dt);
      sun.position.x = damp(sun.position.x, sky.sun.position[0], SKY_LAMBDA, dt);
      sun.position.y = damp(sun.position.y, sky.sun.position[1], SKY_LAMBDA, dt);
      sun.position.z = damp(sun.position.z, sky.sun.position[2], SKY_LAMBDA, dt);
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.lerp(targets.hemiSky, k);
      hemi.groundColor.lerp(targets.hemiGround, k);
      hemi.intensity = damp(hemi.intensity, sky.hemi.intensity, SKY_LAMBDA, dt);
    }
    skyRuntime.glow = damp(skyRuntime.glow, sky.glow, SKY_LAMBDA, dt);
    skyRuntime.headlights = damp(skyRuntime.headlights, sky.headlights, SKY_LAMBDA, dt);
    setGlowLevel(skyRuntime.glow);
    if (starsRef.current) starsRef.current.visible = sky.stars > 0.2;
  });
  return null;
});

export const BoardEnvironment = memo(function BoardEnvironment() {
  const still = prefersReducedMotion();
  const budget = useGraphicsBudget();
  const first = SKY_STATES.dusk;
  const starsRef = useRef<Group>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);

  return (
    <>
      <color attach="background" args={[first.background]} />
      <fog attach="fog" args={[first.background, first.fog[0], first.fog[1]]} />
      <hemisphereLight ref={hemiRef} args={[first.hemi.sky, first.hemi.ground, first.hemi.intensity]} />
      <directionalLight
        // la dimensione della mappa d'ombra cambia solo rimontando la luce
        key={budget.shadowMapSize}
        ref={sunRef}
        position={[...first.sun.position]}
        intensity={first.sun.intensity}
        color={first.sun.color}
        castShadow={budget.shadows}
        shadow-mapSize={[budget.shadowMapSize, budget.shadowMapSize]}
        // il frustum copre tutta la plancia anche con il sole basso (altrimenti i bordi sfarfallano ruotando)
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      <SkyDirector starsRef={starsRef} sunRef={sunRef} hemiRef={hemiRef} />
      {budget.stars && (
        <group ref={starsRef} visible={false}>
          <Stars radius={110} depth={30} count={1400} factor={4} saturation={0} fade speed={still ? 0 : 0.4} />
        </group>
      )}
      <CityGlow />
      {!still && budget.embers > 0 && (
        <Sparkles
          count={budget.embers}
          scale={EMBER_FIELD.scale}
          position={EMBER_FIELD.position}
          size={3.2}
          speed={0.35}
          opacity={0.75}
          noise={1.2}
          color={EMBER_COLOR}
        />
      )}
    </>
  );
});
