// ─── Combat Presentation Types ────────────────────────────────────────────────
// Tipi della messa in scena dello scontro (arena 3D / dadi 2D di riserva).
// Le regole restano in engine/combat.ts: qui solo ciò che serve a mostrarle.

import type { FactionId } from './player';
import type { TerritoryId } from './map';

/** Fasi della sequenza animata, in ordine. */
export type CombatStage = 'intro' | 'roll' | 'compare' | 'clash' | 'result';

export type CombatSide = 'attacker' | 'defender';

/** Esito di un singolo dado: true vinto, false perso, null non confrontato. */
export type DieVerdict = boolean | null;

export interface CombatSideView {
  readonly side: CombatSide;
  readonly faction: FactionId | null;   // null = territorio neutrale
  readonly name: string;
  readonly dice: readonly number[];
  readonly verdicts: readonly DieVerdict[];
  /** Figure in campo (= dadi lanciati). */
  readonly figures: number;
  /** Per ogni figura: cade nello scontro? (stesso indice dei dadi) */
  readonly fallen: readonly boolean[];
}

/** Tutto ciò che serve per mettere in scena un attacco già risolto. */
export interface CombatView {
  readonly attacker: CombatSideView;
  readonly defender: CombatSideView;
  readonly conquered: boolean;
  /** Moltiplicatore di velocità (CPU e "riduci movimento" vanno più veloci). */
  readonly speed: number;
}

// ─── Ordine di attacco, blitz, occupazione ────────────────────────────────────

export type AttackMode = 'single' | 'blitz';

/** Ordine di attacco deciso dal giocatore (o dalla CPU). */
export interface AttackOrder {
  readonly fromId: TerritoryId;
  readonly toId: TerritoryId;
  /** 1..maxAttackDice (Colletti Bianchi fino a 4). */
  readonly dice: number;
  readonly mode: AttackMode;
  /** Solo blitz: si ferma quando la fonte scende a questo numero di truppe (minimo 2). */
  readonly stopAt: number;
}

/** Un singolo lancio dentro un attacco (anche automatico). */
export interface CombatRoundLog {
  readonly attacker: readonly number[];
  readonly defender: readonly number[];
  readonly attackerLosses: number;
  readonly defenderLosses: number;
}

/** Preferenze persistite (localStorage 'dominio.attack'). */
export interface AttackPreferences {
  /** 'max' = sempre il massimo consentito. */
  readonly dice: 'max' | 1 | 2 | 3;
  readonly mode: AttackMode;
  readonly stopAt: number;
  /** false = il secondo click attacca subito con queste preferenze. */
  readonly confirmEachAttack: boolean;
}

/** Occupazione dopo una conquista: quante truppe entrano nel territorio preso. */
export interface PendingOccupation {
  readonly fromId: TerritoryId;
  readonly toId: TerritoryId;
  readonly min: number;   // truppe già entrate (dadi sopravvissuti dell'ultimo lancio)
  readonly max: number;   // massimo totale spostabile = truppe della fonte - 1 + min
}
