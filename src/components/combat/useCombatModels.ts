// ─── useCombatModels ──────────────────────────────────────────────────────────
// Carica i pezzi dell'arena (Blender → GLB Draco) e li indicizza per nome.
// Le truppe arrivano dallo stesso truppe.glb della plancia: useGLTF lo tiene
// in cache, quindi il secondo caricamento è gratuito.

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Object3D } from 'three';
import { ALL_FACTION_IDS, DRACO_DECODER_PATH, MODEL_URLS } from '../../data';
import { prepareModel } from '../board3d/useBoardModels';
import type { FactionId } from '../../types';

export interface CombatModels {
  readonly arena: Object3D;
  readonly dieAttack: Object3D;
  readonly dieDefense: Object3D;
  readonly troops: Readonly<Partial<Record<FactionId, Object3D>>>;
  readonly emblems: Readonly<Partial<Record<FactionId, Object3D>>>;
}

function byName(root: Object3D, name: string): Object3D {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`Modello mancante: ${name}`);
  return found;
}

export function useCombatModels(): CombatModels {
  const arena = useGLTF(MODEL_URLS.arena, DRACO_DECODER_PATH);
  const dice = useGLTF(MODEL_URLS.dice, DRACO_DECODER_PATH);
  const troops = useGLTF(MODEL_URLS.troops, DRACO_DECODER_PATH);

  return useMemo<CombatModels>(() => {
    prepareModel(arena.scene, { cast: false, receive: true });
    prepareModel(dice.scene, { cast: true, receive: false });
    prepareModel(troops.scene, { cast: true, receive: false });
    const figs: Partial<Record<FactionId, Object3D>> = {};
    const emblems: Partial<Record<FactionId, Object3D>> = {};
    for (const f of ALL_FACTION_IDS) {
      const t = troops.scene.getObjectByName(`Truppa_${f}`);
      const e = arena.scene.getObjectByName(`Stemma_${f}`);
      if (t) figs[f] = t;
      if (e) emblems[f] = e;
    }
    return {
      arena: byName(arena.scene, 'Arena'),
      dieAttack: byName(dice.scene, 'Dado_Attacco'),
      dieDefense: byName(dice.scene, 'Dado_Difesa'),
      troops: figs,
      emblems,
    };
  }, [arena.scene, dice.scene, troops.scene]);
}

export function preloadCombatModels(): void {
  useGLTF.preload(MODEL_URLS.arena, DRACO_DECODER_PATH);
  useGLTF.preload(MODEL_URLS.dice, DRACO_DECODER_PATH);
  useGLTF.preload(MODEL_URLS.troops, DRACO_DECODER_PATH);
}
