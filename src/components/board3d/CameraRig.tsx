// ─── CameraRig ────────────────────────────────────────────────────────────────
// Orbit controls limitati: niente camera sotto il terreno, zoom contenuto,
// pan confinato alla plancia.
// All'apertura la camera "plana" sulla città (volo d'ingresso): parte più
// lontana e ruotata, poi si posa sull'inquadratura di gioco. Qualsiasi
// interazione dell'utente interrompe subito il volo.

import { memo, useCallback, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import { useUIStore } from '../../store/uiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { prefersReducedMotion } from '../common/motion';
import {
  CAMERA_OFFSET, CAMERA_REF_ASPECT, CAMERA_TARGET, INTRO_DISTANCE, INTRO_DURATION, INTRO_ORBIT, PAN_LIMIT,
} from './constants';

const UP = new Vector3(0, 1, 0);
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

interface IntroState {
  elapsed: number;
  active: boolean;
}

const FOLLOW_LAMBDA = 3;
const RETURN_EPS = 0.05;

interface SavedView {
  readonly position: Vector3;
  readonly target: Vector3;
}

export const CameraRig = memo(function CameraRig() {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree(s => s.camera);
  const aspect = useThree(s => s.size.width / Math.max(1, s.size.height));
  const framed = useRef(false);
  const intro = useRef<IntroState>({ elapsed: 0, active: !prefersReducedMotion() });
  const finalOffset = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(...CAMERA_TARGET), []);
  const tmp = useMemo(() => new Vector3(), []);
  // Inquadratura dell'utente prima che la camera segua la CPU, e "mano dell'utente" sul turno
  const saved = useRef<SavedView | null>(null);
  const userTookOver = useRef(false);
  const dir = useMemo(() => new Vector3(), []);
  const goal = useMemo(() => new Vector3(), []);

  // Inquadratura iniziale: allontana la camera nei pannelli stretti
  // così l'intera città resta visibile. Solo al primo montaggio.
  useLayoutEffect(() => {
    if (framed.current || !Number.isFinite(aspect)) return;
    framed.current = true;
    const k = Math.max(1, CAMERA_REF_ASPECT / aspect);
    const [ox, oy, oz] = CAMERA_OFFSET;
    finalOffset.set(ox * k, oy * k, oz * k);
    const start = intro.current.active
      ? tmp.copy(finalOffset).multiplyScalar(INTRO_DISTANCE).applyAxisAngle(UP, INTRO_ORBIT)
      : tmp.copy(finalOffset);
    camera.position.copy(target).add(start);
    camera.lookAt(target);
  }, [aspect, camera, finalOffset, target, tmp]);

  // Camera che segue la CPU: si avvicina al focus, poi torna dov'era l'utente
  useFrame((_, dt) => {
    const controls = ref.current;
    if (!controls || intro.current.active) return;
    const focus = useUIStore.getState().cameraFocus;
    const follow = useSettingsStore.getState().followCpu && !userTookOver.current;
    const still = prefersReducedMotion();
    const t = controls.target;

    if (focus && follow) {
      saved.current ??= { position: camera.position.clone(), target: t.clone() };
      dir.copy(camera.position).sub(t).normalize();
      goal.set(focus.x, 0, focus.z);
      const k = still ? 1 : 1 - Math.exp(-FOLLOW_LAMBDA * dt);
      t.lerp(goal, k);
      goal.addScaledVector(dir, focus.distance);
      camera.position.lerp(goal, k);
      controls.update();
      return;
    }
    if (!focus) userTookOver.current = false;
    const back = saved.current;
    if (!focus && back) {
      const k = still ? 1 : 1 - Math.exp(-FOLLOW_LAMBDA * dt);
      t.lerp(back.target, k);
      camera.position.lerp(back.position, k);
      controls.update();
      if (camera.position.distanceTo(back.position) < RETURN_EPS) saved.current = null;
    }
  });

  useFrame((_, dt) => {
    const s = intro.current;
    if (!s.active || !framed.current) return;
    s.elapsed += dt;
    const p = Math.min(1, s.elapsed / INTRO_DURATION);
    const e = easeInOut(p);
    const dist = INTRO_DISTANCE + (1 - INTRO_DISTANCE) * e;
    tmp.copy(finalOffset).multiplyScalar(dist).applyAxisAngle(UP, INTRO_ORBIT * (1 - e));
    camera.position.copy(target).add(tmp);
    ref.current?.update();
    if (p >= 1) s.active = false;
  });

  const stopIntro = useCallback(() => {
    intro.current.active = false;
    // se l'utente muove la mappa mentre la CPU gioca, la camera smette di seguire per quel turno
    if (useUIStore.getState().cameraFocus) { userTookOver.current = true; saved.current = null; }
  }, []);

  const handleChange = useCallback(() => {
    const t = ref.current?.target;
    if (!t) return;
    t.set(clamp(t.x, PAN_LIMIT.minX, PAN_LIMIT.maxX), 0, clamp(t.z, PAN_LIMIT.minZ, PAN_LIMIT.maxZ));
  }, []);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={[...CAMERA_TARGET]}
      enableDamping
      dampingFactor={0.12}
      minDistance={7}
      maxDistance={65}
      minPolarAngle={0.15}
      maxPolarAngle={1.2}
      screenSpacePanning={false}
      onStart={stopIntro}
      onChange={handleChange}
    />
  );
});

