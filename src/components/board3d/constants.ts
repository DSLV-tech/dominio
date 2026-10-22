// ─── Costanti visive della plancia 3D ─────────────────────────────────────────

import type { TerritoryVariant } from '../../types';

export const HEX_RADIUS        = 0.95;
export const HEX_TOP_RADIUS    = 0.9;
export const HEX_SKIRT_DEPTH   = 0.6;
export const MAX_FIGURES       = 5;
export const FIGURE_RING       = 0.72;
export const FIGURE_ARC        = 1.5;   // radianti, ventaglio frontale delle pedine
export const NEUTRAL_COLOR     = '#6b7280';
export const PAVING_COLOR      = '#cfc6b4';
export const BACKGROUND_COLOR  = '#0f1622';

/** Offset camera→target per un pannello largo (aspect ≥ CAMERA_REF_ASPECT). */
export const CAMERA_OFFSET: readonly [number, number, number] = [0.5, 25.4, 17.8];
export const CAMERA_TARGET: readonly [number, number, number] = [-0.5, 0, 1];
export const CAMERA_REF_ASPECT = 1.6;
export const CAMERA_FOV = 40;   // gradi, verticale
export const PAN_LIMIT = { minX: -17, maxX: 17, minZ: -12, maxZ: 13 } as const;

/** Colore dell'anello di evidenziazione per variante (null = nessun anello). */
export const VARIANT_RING: Readonly<Record<TerritoryVariant, string | null>> = {
  default:    null,
  enemy:      null,
  neutral:    null,
  selected:   '#58a6ff',
  attackable: '#f85149',
  moveable:   '#3fb950',
  targetable: '#e8a33d',
};

/** Braci ambientali (Sparkles) sopra la città. */
export const EMBER_COLOR = '#ffb347';
export const EMBER_FIELD = {
  count: 90,
  scale: [40, 7, 30] as [number, number, number],
  position: [0, 3.5, 1] as [number, number, number],
} as const;

/** Volo d'ingresso della camera: parte più lontana e più alta, poi si posa. */
export const INTRO_DURATION = 2.2;   // secondi
export const INTRO_DISTANCE = 1.9;   // moltiplicatore dell'offset finale
export const INTRO_ORBIT    = 0.55;  // radianti di rotazione attorno al target
