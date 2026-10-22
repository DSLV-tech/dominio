// ─── useBoardModels ───────────────────────────────────────────────────────────
// Carica i tre GLB esportati da Blender (Draco) e li prepara una volta sola:
//  - materiale "VC_Glow" → MeshBasicMaterial (luci, finestre, neon sempre accesi)
//  - ombre attive
//  - indicizza monumenti per territorio e pedine/bandiere per fazione
// Sospende (Suspense) finché i modelli non sono pronti.

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import {
  BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3, type BufferGeometry, type Object3D,
} from 'three';
import { ALL_FACTION_IDS, DRACO_DECODER_PATH, MODEL_URLS, isTerritoryId } from '../../data';
import type { BoardModels, FactionId, TerritoryId } from '../../types';

const GLOW_MATERIAL = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
GLOW_MATERIAL.name = 'VC_Glow_Runtime';

/** Intensità di finestre e lampioni: moltiplica i colori per vertice. */
export function setGlowLevel(level: number): void {
  GLOW_MATERIAL.color.setScalar(level);
}

/**
 * Fianchi della vasca del mare: nel GLB il mare è un parallelepipedo e i suoi
 * lati (lucidi) spuntavano sopra la cornice "DOMINIO" come un riflesso azzurro.
 * Diventano parte della cornice: legno opaco, nessun riflesso.
 */
const FRAME_SIDE_MATERIAL = new MeshStandardMaterial({ color: '#2a1c13', roughness: 0.9, metalness: 0 });
FRAME_SIDE_MATERIAL.name = 'Cornice_Fianco';

/** Quota (Y three.js) del piano superiore della cornice e del filetto d'oro. */
const FRAME_TOP_Y = -0.8;
/** Mezze misure del filetto d'oro (più largo della base di 0.05 per lato). */
const GOLD_HALF_X = 22.45;
const GOLD_HALF_Z = 16.45;
const EPS = 1e-3;

/** Mare: le facce rivolte verso l'alto restano acqua, le altre diventano cornice. */
function splitSeaSides(mesh: Mesh, water: MeshStandardMaterial): void {
  const geo: BufferGeometry = mesh.geometry;
  const pos = geo.getAttribute('position');
  const index = geo.getIndex();
  if (!pos || !index || geo.groups.length > 0) return;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const top: number[] = [];
  const sides: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2);
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    const ny = b.sub(a).cross(c.sub(a)).normalize().y;
    (ny > 0.5 ? top : sides).push(ia, ib, ic);
  }
  geo.setIndex(new BufferAttribute(new Uint32Array([...top, ...sides]), 1));
  geo.addGroup(0, top.length, 0);
  geo.addGroup(top.length, sides.length, 1);
  mesh.material = [water, FRAME_SIDE_MATERIAL];
}

/**
 * Il filetto d'oro e il piano della cornice erano complanari (y = -0.8):
 * sfarfallio sul bordo superiore. Abbasso di poco il piano del filetto, così
 * dall'alto si vede il legno e di lato resta la riga d'oro.
 */
function lowerGoldTrim(mesh: Mesh): void {
  const pos = mesh.geometry.getAttribute('position');
  if (!pos) return;
  let moved = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - FRAME_TOP_Y) > EPS) continue;
    const onGold = Math.abs(Math.abs(pos.getX(i)) - GOLD_HALF_X) < EPS || Math.abs(Math.abs(pos.getZ(i)) - GOLD_HALF_Z) < EPS;
    if (!onGold) continue;
    pos.setY(i, FRAME_TOP_Y - 0.006);
    moved++;
  }
  if (moved > 0) pos.needsUpdate = true;
}

export interface ShadowFlags { readonly cast: boolean; readonly receive: boolean }

export function prepareModel(root: Object3D, shadows: ShadowFlags): void {
  root.traverse(obj => {
    if (!(obj instanceof Mesh)) return;
    const mat: unknown = obj.material;
    if (mat instanceof MeshStandardMaterial) {
      if (mat.name === 'VC_Glow') obj.material = GLOW_MATERIAL;
      else if (mat.name === 'Mare') {
        mat.roughness = 0.22; mat.metalness = 0.15;
        splitSeaSides(obj, mat);
      } else if (mat.name === 'VC') lowerGoldTrim(obj);
    }
    obj.castShadow = shadows.cast;
    obj.receiveShadow = shadows.receive;
  });
}

const LANDMARK_RE = /^Monumento_([A-Z]{2}\d)/;
const PIECE_RE    = /^(Truppa|Bandiera)_(.+?)(?:\d{3})?$/;

function isFactionId(v: string): v is FactionId {
  return (ALL_FACTION_IDS as readonly string[]).includes(v);
}

export function useBoardModels(): BoardModels<Object3D> {
  const city      = useGLTF(MODEL_URLS.city, DRACO_DECODER_PATH);
  const landmarks = useGLTF(MODEL_URLS.landmarks, DRACO_DECODER_PATH);
  const troops    = useGLTF(MODEL_URLS.troops, DRACO_DECODER_PATH);

  return useMemo<BoardModels<Object3D>>(() => {
    prepareModel(city.scene, { cast: true, receive: true });
    prepareModel(landmarks.scene, { cast: true, receive: true });
    prepareModel(troops.scene, { cast: true, receive: false });

    const lm: Partial<Record<TerritoryId, Object3D>> = {};
    for (const node of landmarks.scene.children) {
      const id = LANDMARK_RE.exec(node.name)?.[1];
      if (id && isTerritoryId(id)) lm[id] = node;
    }

    const figs: Partial<Record<FactionId, Object3D>> = {};
    const flags: Partial<Record<FactionId, Object3D>> = {};
    for (const node of troops.scene.children) {
      const m = PIECE_RE.exec(node.name);
      const faction = m?.[2];
      if (!m || !faction || !isFactionId(faction)) continue;
      if (m[1] === 'Truppa') figs[faction] = node; else flags[faction] = node;
    }

    return { city: city.scene, landmarks: lm, troops: figs, flags };
  }, [city.scene, landmarks.scene, troops.scene]);
}

// Avvia il download appena il modulo viene importato.
useGLTF.preload(MODEL_URLS.city, DRACO_DECODER_PATH);
useGLTF.preload(MODEL_URLS.landmarks, DRACO_DECODER_PATH);
useGLTF.preload(MODEL_URLS.troops, DRACO_DECODER_PATH);
