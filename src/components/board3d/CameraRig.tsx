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
  CAMERA_FOV, CAMERA_OFFSET, CAMERA_REF_ASPECT, CAMERA_TARGET, INTRO_DISTANCE, INTRO_DURATION, INTRO_ORBIT, PAN_LIMIT,
} from './constants';

const UP = new Vector3(0, 1, 0);
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

interface IntroState {
  elapsed: number;
  active: boolean;
}

const FOLLOW_LAMBDA = 3;
const BASE_MAX_DISTANCE = 65;
const OFFSET_LENGTH = Math.hypot(...CAMERA_OFFSET);
/** Variazione relativa della distanza d'inquadratura oltre la quale si rifà
 *  l'inquadratura (oltre a ogni cambio di orientamento della camera). */
const REFRAME_THRESHOLD = 0.08;
/** Ingombro dei territori (board3d.json: x −12…13.9, z −9.5…9.85) più il
 *  margine per gettoni e targhe delle zone: mezza estensione su x (lato
 *  lungo) e su z. In verticale si inquadrano i quartieri, non il mare. */
const CITY_HALF_X = 15;
const CITY_HALF_Z = 15;
const FIT_MARGIN = 1.04;
/** Pannello verticale (telefono): la camera gira di 90° attorno alla città,
 *  così il lato lungo della plancia corre lungo il lato lungo dello schermo
 *  e il porto sta in primo piano in basso. */
const PORTRAIT_YAW = -Math.PI / 2;
/** Centro dei territori (board3d.json). */
const CITY_CENTER: readonly [number, number, number] = [0.95, 0, 0.18];
/** In verticale la camera guarda il centro dei territori, spostato verso nord
 *  perché le targhe delle zone sporgono su quel lato. */
const PORTRAIT_TARGET: readonly [number, number, number] = [0.95, 0, -2.4];
/** Oltre questo aspect (telefono in orizzontale) conta anche l'altezza: la
 *  città deve entrare in verticale in un pannello basso e largo. */
const WIDE_ASPECT = 2.2;

interface CameraView {
  /** Moltiplicatore dell'offset camera. */
  readonly fit: number;
  /** Rotazione attorno all'asse verticale (radianti). */
  readonly yaw: number;
  /** Punto guardato. */
  readonly target: readonly [number, number, number];
}

/** Distanza minima perché un ingombro (mezza larghezza sullo schermo, mezza
 *  profondità lungo lo sguardo) entri nel campo orizzontale e verticale. */
function fitDistance(halfAcross: number, halfAlong: number, aspect: number): number {
  const tanHalfV = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const [ox, oy, oz] = CAMERA_OFFSET;
  const tilt = Math.atan2(Math.hypot(ox, oz), oy);          // inclinazione dalla verticale
  const near = halfAlong * Math.sin(tilt);                  // il bordo vicino si avvicina alla camera
  const across = halfAcross / (tanHalfV * aspect) + near;
  const along = (halfAlong * Math.cos(tilt)) / tanHalfV + near;
  return Math.max(across, along) * FIT_MARGIN;
}

/** Inquadratura per la forma del pannello: sui pannelli larghi la proporzione
 *  di sempre; su quelli verticali camera ruotata e distanza che fa entrare
 *  tutta la città. */
function cameraView(aspect: number): CameraView {
  if (!Number.isFinite(aspect) || aspect <= 0) return { fit: 1, yaw: 0, target: CAMERA_TARGET };
  const linear = Math.max(1, CAMERA_REF_ASPECT / aspect);
  if (aspect >= WIDE_ASPECT) {
    const fit = Math.max(linear, fitDistance(CITY_HALF_X, CITY_HALF_Z, aspect) / OFFSET_LENGTH);
    return { fit, yaw: 0, target: CITY_CENTER };
  }
  if (aspect >= 1) return { fit: linear, yaw: 0, target: CAMERA_TARGET };
  // ruotata: in orizzontale sullo schermo va l'asse z, lungo lo sguardo l'asse x
  return { fit: fitDistance(CITY_HALF_Z, CITY_HALF_X, aspect) / OFFSET_LENGTH, yaw: PORTRAIT_YAW, target: PORTRAIT_TARGET };
}
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

  // Quanto allontanare la camera perché l'intera città entri nel pannello e
  // da che lato guardarla (telefono in verticale: ruotata di 90°).
  const { fit, yaw, target: aim } = useMemo(() => cameraView(aspect), [aspect]);
  // lo zoom massimo non deve impedire l'inquadratura completa
  const maxDistance = Math.max(BASE_MAX_DISTANCE, OFFSET_LENGTH * fit * 1.15);
  const framedView = useRef<{ fit: number; yaw: number } | null>(null);

  // Inquadratura iniziale; si ripete solo se il pannello cambia forma in modo
  // netto (rotazione del telefono), senza volo d'ingresso.
  useLayoutEffect(() => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const first = !framed.current;
    const last = framedView.current;
    if (!first && last && last.yaw === yaw && Math.abs(fit - last.fit) / last.fit < REFRAME_THRESHOLD) return;
    framed.current = true;
    framedView.current = { fit, yaw };
    const [ox, oy, oz] = CAMERA_OFFSET;
    finalOffset.set(ox * fit, oy * fit, oz * fit).applyAxisAngle(UP, yaw);
    target.set(aim[0], aim[1], aim[2]);
    const start = first && intro.current.active
      ? tmp.copy(finalOffset).multiplyScalar(INTRO_DISTANCE).applyAxisAngle(UP, INTRO_ORBIT)
      : tmp.copy(finalOffset);
    if (!first) { intro.current.active = false; saved.current = null; }
    ref.current?.target.copy(target);
    camera.position.copy(target).add(start);
    camera.lookAt(target);
    ref.current?.update();
  }, [aspect, fit, yaw, aim, camera, finalOffset, target, tmp]);

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
      target={target}
      enableDamping
      dampingFactor={0.12}
      minDistance={7}
      maxDistance={maxDistance}
      minPolarAngle={0.15}
      maxPolarAngle={1.2}
      screenSpacePanning={false}
      onStart={stopIntro}
      onChange={handleChange}
    />
  );
});

