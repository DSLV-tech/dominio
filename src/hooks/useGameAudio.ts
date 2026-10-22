// ─── useGameAudio ─────────────────────────────────────────────────────────────
// Collega il gioco al motore audio senza toccare la logica di gioco:
//  - useAudioUnlock: sblocca l'AudioContext al primo gesto e mette in pausa
//    l'audio quando la scheda è nascosta
//  - useGameAudio: osserva il gameStore (stato precedente → successivo) e
//    suona gli effetti di turno, fase, rinforzi, spostamenti, eventi, vittoria;
//    sceglie l'atmosfera della musica. Gli effetti dello scontro (dadi, urti)
//    li suona l'animazione del combattimento, sincronizzati con l'immagine.

import { useEffect } from 'react';
import { audio } from '../audio/engine';
import { useGameStore } from '../store/gameStore';
import { useStoryStore } from '../store/storyStore';
import type { GameState, MusicMood } from '../types';
import '../store/audioStore'; // applica le preferenze salvate al motore

const CLICKABLE = 'button, [role="button"], [role="radio"], [role="tab"], summary';

export function useAudioUnlock(): void {
  useEffect(() => {
    const unlock = (): void => audio.unlock();
    const onClick = (e: MouseEvent): void => {
      const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
      if (el && !(el instanceof HTMLButtonElement && el.disabled)) audio.play('click', { intensity: 0.7 });
    };
    const onVisibility = (): void => {
      if (document.hidden) audio.suspend(); else audio.resume();
    };
    // iOS sblocca l'audio solo su touchend/click (non su pointerdown/touchstart).
    // Gli ascoltatori restano attivi: se iOS interrompe l'audio (blocco schermo,
    // telefonata) il tocco successivo lo riprende.
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('pointerup', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('click', unlock, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('pageshow', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('pointerup', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('pageshow', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

function moodFor(game: GameState | null): MusicMood {
  if (!game) return 'calm';
  if (game.winner) return 'victory';
  if (game.pendingAttack) return 'combat';
  if (game.phase === 'ATTACK') return 'tension';
  return 'calm';
}

function totalTroops(game: GameState): number {
  let n = 0;
  for (const t of Object.values(game.territories)) n += t.troops;
  return n;
}

function eliminatedCount(game: GameState): number {
  return game.players.filter(p => p.isEliminated).length;
}

/** Decide gli effetti da suonare per una transizione di stato. Pura: testabile. */
export function sfxForTransition(prev: GameState | null, next: GameState | null): Array<'turn' | 'phase' | 'event' | 'reinforce' | 'move' | 'victory'> {
  if (!next) return [];
  if (!prev) return ['turn'];
  if (next.winner && !prev.winner) return ['victory'];
  const out: Array<'turn' | 'phase' | 'event' | 'reinforce' | 'move' | 'victory'> = [];
  const newTurn = prev.currentPlayerIndex !== next.currentPlayerIndex || prev.round !== next.round;
  if (newTurn) out.push('turn');
  else if (prev.phase !== next.phase) out.push(next.phase === 'EVENT_PHASE' ? 'event' : 'phase');
  if (next.activeEffects.length > prev.activeEffects.length) out.push('event');

  const sameTurn = !newTurn && prev.phase === next.phase;
  if (sameTurn && !next.pendingAttack && prev.territories !== next.territories) {
    const delta = totalTroops(next) - totalTroops(prev);
    if (next.phase === 'REINFORCEMENT' && delta > 0) out.push('reinforce');
    else if (next.phase === 'MOVEMENT' && delta === 0) out.push('move');
  }
  return out;
}

export function useGameAudio(): void {
  useEffect(() => {
    let pendingElimination = false;

    const unsubGame = useGameStore.subscribe((state, prevState) => {
      const next = state.game;
      const prev = prevState.game;
      if (next === prev) return;

      for (const name of sfxForTransition(prev, next)) audio.play(name);

      // L'eliminazione arriva insieme all'attacco: il gong suona a scontro chiuso
      if (prev && next && eliminatedCount(next) > eliminatedCount(prev)) pendingElimination = true;
      if (pendingElimination && next && !next.pendingAttack && !next.winner) {
        pendingElimination = false;
        audio.play('eliminated');
      }
      if (!next) pendingElimination = false;

      audio.setMood(moodFor(next));
    });

    // Interludi narrativi: fruscio di giornale
    const unsubStory = useStoryStore.subscribe((s, p) => {
      if (s.interlude && s.interlude !== p.interlude) audio.play('event');
    });

    audio.setMood(moodFor(useGameStore.getState().game));
    return () => { unsubGame(); unsubStory(); };
  }, []);
}
