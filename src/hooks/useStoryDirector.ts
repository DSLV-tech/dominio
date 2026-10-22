// ─── useStoryDirector ─────────────────────────────────────────────────────────
// "Regista" della narrazione: ascolta ogni cambio di stato del gameStore,
// chiede al motore narrativo cosa è successo e pubblica gli articoli.
// Usa subscribe (fuori dal ciclo di render) → zero re-render di App.
//
// Il callback di subscribe gira in modo sincrono dentro set(): l'interludio
// è già aperto quando useAIPlayer reagisce al nuovo turno, così la CPU aspetta.

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useStoryStore } from '../store/storyStore';
import { detectStoryBeats, filterNewsworthy, beatToDispatch } from '../engine';
import type { Dispatch } from '../types';

let serial = 0;

export function useStoryDirector(): void {
  useEffect(() => {
    // memoria anti-ripetizione, azzerata a ogni nuova partita
    let seen: ReadonlySet<string> = new Set<string>();
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      const next = state.game;
      const prev = prevState.game;
      if (next === prev) return;

      const story = useStoryStore.getState();
      if (!next) { story.reset(); seen = new Set<string>(); return; }
      if (!prev || prev.id !== next.id) { story.reset(); seen = new Set<string>(); }

      const selection = filterNewsworthy(detectStoryBeats(prev, next), seen, next.round);
      seen = selection.seen;
      if (selection.beats.length === 0) return;

      const dispatches: Dispatch[] = [];
      for (const beat of selection.beats) {
        dispatches.push(beatToDispatch(beat, next.round, serial++));
        if (beat.kind === 'ACT') story.openInterlude(beat.act);
      }
      story.publish(dispatches);
    });
    return unsubscribe;
  }, []);
}
