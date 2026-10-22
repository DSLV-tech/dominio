// ─── AudioEngine ──────────────────────────────────────────────────────────────
// Singleton fuori da React: qualsiasi parte del gioco (hook, scena 3D, timer
// della CPU) può chiamare `audio.play('clash')` senza passare props.
//
// Grafo:  sfx ─┐                    ┌─ riverbero ─┐
//              ├─ (mandate) ────────┘             ├─ compressore ─ master ─ uscita
//         musica ──────────────────────────────────┘
//
// I browser bloccano l'audio finché l'utente non interagisce: `unlock()` va
// chiamato dentro un gesto (vedi useAudioUnlock). Prima di allora ogni play()
// è un no-op silenzioso. Se Web Audio non esiste, l'intero motore è inerte.

import type { AudioSettings, MusicMood, SfxName, SfxOptions } from '../types';
import { makeImpulse, makeNoiseBuffer, playSfx, type SfxContext } from './sfx';
import { MusicDirector } from './music';

interface Graph {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly music: GainNode;
  readonly sfx: GainNode;
  readonly sfxCtx: SfxContext;
  readonly director: MusicDirector;
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Curva percettiva: lo slider lineare 0..1 diventa un guadagno "naturale". */
const perceptual = (v: number): number => Math.max(0, Math.min(1, v)) ** 2;

class AudioEngine {
  private graph: Graph | null = null;
  private settings: AudioSettings = { muted: false, music: 0.6, sfx: 0.8 };
  private mood: MusicMood = 'calm';
  /** Anti-raffica: lo stesso effetto non riparte prima di N ms. */
  private readonly lastPlayed = new Map<SfxName, number>();

  get unlocked(): boolean { return this.graph !== null && this.graph.ctx.state === 'running'; }

  unlock(): void {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!this.graph) {
      try {
        this.graph = this.build(new Ctor());
      } catch (err) {
        console.warn('[audio] Web Audio non disponibile', err);
        return;
      }
    }
    const { ctx } = this.graph;
    if (ctx.state === 'suspended') void ctx.resume().then(() => this.syncMusic());
    else this.syncMusic();
  }

  configure(next: AudioSettings): void {
    this.settings = next;
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    g.master.gain.setTargetAtTime(next.muted ? 0 : 1, t, 0.05);
    g.music.gain.setTargetAtTime(perceptual(next.music) * 0.55, t, 0.1);
    g.sfx.gain.setTargetAtTime(perceptual(next.sfx), t, 0.05);
    this.syncMusic();
  }

  setMood(mood: MusicMood): void {
    this.mood = mood;
    this.graph?.director.setMood(mood);
  }

  play(name: SfxName, opts: SfxOptions = {}): void {
    const g = this.graph;
    if (!g || g.ctx.state !== 'running' || this.settings.muted || this.settings.sfx <= 0) return;
    const now = performance.now();
    const minGap = name === 'diceHit' ? 25 : 60;
    if (now - (this.lastPlayed.get(name) ?? -1e9) < minGap) return;
    this.lastPlayed.set(name, now);

    let out: AudioNode = g.sfx;
    if (opts.pan) {
      const p = g.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      p.connect(g.sfx);
      out = p;
    }
    playSfx({ ...g.sfxCtx, out }, name, g.ctx.currentTime + (opts.delay ?? 0), opts.intensity ?? 1);
  }

  /** Mette in pausa il contesto (scheda nascosta): risparmia CPU e batteria. */
  suspend(): void { void this.graph?.ctx.suspend(); }
  resume(): void { if (this.graph?.ctx.state === 'suspended') void this.graph.ctx.resume(); }

  private syncMusic(): void {
    const g = this.graph;
    if (!g) return;
    const wantMusic = !this.settings.muted && this.settings.music > 0 && g.ctx.state === 'running';
    if (wantMusic && !g.director.running) { g.director.setMood(this.mood); g.director.start(); }
    if (!wantMusic && g.director.running) g.director.stop();
  }

  private build(ctx: AudioContext): Graph {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    const master = ctx.createGain();
    comp.connect(master); master.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx);
    const reverbOut = ctx.createGain(); reverbOut.gain.value = 0.35;
    reverb.connect(reverbOut); reverbOut.connect(comp);

    const music = ctx.createGain(); music.connect(comp);
    const sfx = ctx.createGain(); sfx.connect(comp);
    const noise = makeNoiseBuffer(ctx);

    const graph: Graph = {
      ctx, master, music, sfx,
      sfxCtx: { ctx, out: sfx, send: reverb, noise },
      director: new MusicDirector(ctx, music, reverb, noise),
    };
    // applica subito le impostazioni correnti
    master.gain.value = this.settings.muted ? 0 : 1;
    music.gain.value = perceptual(this.settings.music) * 0.55;
    sfx.gain.value = perceptual(this.settings.sfx);
    return graph;
  }
}

export const audio = new AudioEngine();
