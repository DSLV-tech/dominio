// ─── UI Store (Zustand) ───────────────────────────────────────────────────────
// Holds purely presentational state: selected territories, open modals, etc.
// Kept separate from gameStore to avoid re-rendering the entire game on UI events.

import { create } from 'zustand';
import type { ActionTrace, AttackPreferences, CameraFocus, TurnRecap, CombatStage, EventCardId, EventTargetSpec, MapMode, TerritoryId } from '../types';
import type { EventCardContext } from '../engine';

export type ActiveModal =
  | 'COMBAT'
  | 'EVENT_CARD'
  | 'CARD_HAND'
  | 'VICTORY'
  | 'FACTION_ABILITY'
  | null;

/** Scelta del bersaglio di una carta evento in corso (condivisa da mappa 2D e 3D). */
export interface EventTargeting {
  readonly cardId: string;
  readonly eventId: EventCardId;
  readonly spec: EventTargetSpec;
  /** Indice del passo corrente in spec.steps. */
  readonly step: number;
  /** Scelte fatte finora (il giocatore viene aggiunto alla risoluzione). */
  readonly ctx: Omit<EventCardContext, 'playerId'>;
}

export type SidebarTab = 'CHRONICLE' | 'CARDS' | 'LOG' | 'GUIDE';

interface UIStore {
  // Map interaction
  selectedTerritoryId: TerritoryId | null;
  hoveredTerritoryId: TerritoryId | null;
  attackFromId: TerritoryId | null;    // first click in attack mode
  moveFromId: TerritoryId | null;      // first click in movement mode

  selectTerritory: (id: TerritoryId | null) => void;
  hoverTerritory:  (id: TerritoryId | null) => void;
  setAttackFrom:   (id: TerritoryId | null) => void;
  setMoveFrom:     (id: TerritoryId | null) => void;

  // Modals
  activeModal: ActiveModal;
  openModal:  (modal: ActiveModal) => void;
  closeModal: () => void;

  // Reinforcement placement: troops being "dragged" / in staging
  stagingTroops: number;
  setStagingTroops: (n: number) => void;

  // Notification / toast
  notification: string | null;
  showNotification: (msg: string, durationMs?: number) => void;
  clearNotification: () => void;

  // Sidebar panel
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;

  // Vista mappa (2D SVG / 3D diorama) — preferenza per-utente in localStorage
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;

  // Fase della sequenza di combattimento a schermo (null = nessuno scontro).
  // La CPU la legge per proseguire solo a esito mostrato.
  combatStage: CombatStage | null;
  setCombatStage: (stage: CombatStage | null) => void;

  // Turno CPU leggibile: camera, scie e riepilogo
  cameraFocus: CameraFocus | null;
  setCameraFocus: (focus: CameraFocus | null) => void;
  traces: readonly ActionTrace[];
  addTrace: (trace: Omit<ActionTrace, 'id'>, ttlMs?: number) => void;
  turnRecap: TurnRecap | null;
  setTurnRecap: (recap: TurnRecap | null) => void;

  // Carta evento con bersaglio in corso
  eventTargeting: EventTargeting | null;
  beginEventTargeting: (t: Pick<EventTargeting, 'cardId' | 'eventId' | 'spec'>) => void;
  patchEventTargeting: (ctx: Partial<EventTargeting['ctx']>, advance?: boolean) => void;
  cancelEventTargeting: () => void;

  // Attacco: bersaglio in attesa di conferma e preferenze persistite
  attackToId: TerritoryId | null;
  setAttackTo: (id: TerritoryId | null) => void;
  attackPrefs: AttackPreferences;
  setAttackPrefs: (patch: Partial<AttackPreferences>) => void;

  // Game log
  log: string[];
  addLog: (entry: string) => void;
}

const MAP_MODE_KEY = 'dominio.mapMode';

function readMapMode(): MapMode {
  try {
    const v = localStorage.getItem(MAP_MODE_KEY);
    return v === '2D' ? '2D' : '3D';
  } catch {
    return '3D';
  }
}

const ATTACK_PREFS_KEY = 'dominio.attack';
export const DEFAULT_ATTACK_PREFS: AttackPreferences = { dice: 'max', mode: 'single', stopAt: 2, confirmEachAttack: false };

function readAttackPrefs(): AttackPreferences {
  try {
    const raw = localStorage.getItem(ATTACK_PREFS_KEY);
    if (!raw) return DEFAULT_ATTACK_PREFS;
    const v = JSON.parse(raw) as Partial<AttackPreferences>;
    return {
      dice: v.dice === 1 || v.dice === 2 || v.dice === 3 ? v.dice : 'max',
      mode: v.mode === 'blitz' ? 'blitz' : 'single',
      stopAt: typeof v.stopAt === 'number' && v.stopAt >= 2 && v.stopAt <= 20 ? Math.floor(v.stopAt) : 2,
      confirmEachAttack: v.confirmEachAttack === true,
    };
  } catch {
    return DEFAULT_ATTACK_PREFS;
  }
}

let traceSerial = 0;
let notifTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIStore>((set, get) => ({
  selectedTerritoryId: null,
  hoveredTerritoryId:  null,
  attackFromId:        null,
  moveFromId:          null,

  selectTerritory: (id) => set({ selectedTerritoryId: id }),
  hoverTerritory:  (id) => set({ hoveredTerritoryId: id }),
  setAttackFrom:   (id) => set({ attackFromId: id }),
  setMoveFrom:     (id) => set({ moveFromId: id }),

  activeModal: null,
  openModal:  (modal) => set({ activeModal: modal }),
  closeModal: ()      => set({ activeModal: null }),

  stagingTroops: 1,
  setStagingTroops: (n) => set({ stagingTroops: n }),

  notification: null,
  showNotification: (msg, durationMs = 3000) => {
    if (notifTimer) clearTimeout(notifTimer);
    set({ notification: msg });
    notifTimer = setTimeout(() => set({ notification: null }), durationMs);
  },
  clearNotification: () => {
    if (notifTimer) clearTimeout(notifTimer);
    set({ notification: null });
  },

  sidebarTab: 'CHRONICLE',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  mapMode: readMapMode(),
  setMapMode: (mode) => {
    try { localStorage.setItem(MAP_MODE_KEY, mode); } catch { /* storage non disponibile */ }
    set({ mapMode: mode });
  },

  combatStage: null,
  setCombatStage: (stage) => set({ combatStage: stage }),

  cameraFocus: null,
  setCameraFocus: (focus) => set({ cameraFocus: focus }),
  traces: [],
  addTrace: (trace, ttlMs = 2800) => {
    const id = `t${++traceSerial}`;
    set(state => ({ traces: [...state.traces, { ...trace, id }].slice(-8) }));
    setTimeout(() => set(state => ({ traces: state.traces.filter(t => t.id !== id) })), ttlMs);
  },
  turnRecap: null,
  setTurnRecap: (recap) => set({ turnRecap: recap }),

  eventTargeting: null,
  beginEventTargeting: (t) => set({
    eventTargeting: { ...t, step: 0, ctx: {} },
    attackFromId: null, attackToId: null, moveFromId: null, selectedTerritoryId: null,
  }),
  patchEventTargeting: (ctx, advance = false) => set(state => state.eventTargeting ? {
    eventTargeting: {
      ...state.eventTargeting,
      ctx: { ...state.eventTargeting.ctx, ...ctx },
      step: advance ? state.eventTargeting.step + 1 : state.eventTargeting.step,
    },
  } : {}),
  cancelEventTargeting: () => set({ eventTargeting: null }),

  attackToId: null,
  setAttackTo: (id) => set({ attackToId: id }),
  attackPrefs: readAttackPrefs(),
  setAttackPrefs: (patch) => {
    const next = { ...get().attackPrefs, ...patch };
    try { localStorage.setItem(ATTACK_PREFS_KEY, JSON.stringify(next)); } catch { /* storage non disponibile */ }
    set({ attackPrefs: next });
  },

  log: [],
  addLog: (entry) =>
    set((state) => ({
      log: [entry, ...state.log].slice(0, 100),
    })),
}));
