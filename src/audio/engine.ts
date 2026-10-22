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
//
// iPhone/iPad (Safari, PWA):
//  - l'audio si sblocca solo su touchend/click, non su pointerdown/touchstart
//  - con il tasto laterale su "silenzioso" Web Audio tace: si instrada l'audio
//    sul canale "media" (navigator.audioSession, oppure un <audio> muto in loop)
//  - dopo blocco schermo / telefonata il contesto passa a 'interrupted':
//    va ripreso alla prima occasione, non solo da 'suspended'

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

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

/** Safari/iOS aggiunge lo stato 'interrupted', assente dai tipi DOM. */
const isRunning = (ctx: AudioContext): boolean => (ctx.state as string) === 'running';

type NavigatorWithSession = Navigator & { audioSession?: { type: string } };

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** 1 s di silenzio PCM 8 bit: tiene aperto il canale "media" su iOS < 16.4. */
function makeSilentWavUrl(): string {
  const rate = 8000;
  const buf = new ArrayBuffer(44 + rate);
  const v = new DataView(buf);
  const tag = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + rate, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  tag(36, 'data'); v.setUint32(40, rate, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

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

  /** <audio> muto in loop (solo iOS senza audioSession). */
  private keepAliveEl: HTMLAudioElement | null = null;
  private sessionRouted = false;

  get unlocked(): boolean { return this.graph !== null && isRunning(this.graph.ctx); }

  unlock(): void {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    if (!this.graph) {
      try {
        const ctx = new Ctor({ latencyHint: 'interactive' });
        this.graph = this.build(ctx);
        // dopo un'interruzione (blocco schermo, telefonata) riparte la musica
        ctx.onstatechange = () => { if (isRunning(ctx)) this.syncMusic(); };
      } catch (err) {
        console.warn('[audio] Web Audio non disponibile', err);
        return;
      }
    }
    this.routeToMediaChannel();
    const { ctx } = this.graph;
    if (isRunning(ctx)) { this.syncMusic(); return; }
    this.primeOutput(ctx);
    ctx.resume().then(() => this.syncMusic(), () => { /* serve un altro gesto */ });
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
    if (!g || !isRunning(g.ctx) || this.settings.muted || this.settings.sfx <= 0) return;
    const now = performance.now();
    const minGap = name === 'diceHit' ? 25 : 60;
    if (now - (this.lastPlayed.get(name) ?? -1e9) < minGap) return;
    this.lastPlayed.set(name, now);

    let out: AudioNode = g.sfx;
    if (opts.pan && typeof g.ctx.createStereoPanner === 'function') {
      const p = g.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      p.connect(g.sfx);
      out = p;
    }
    playSfx({ ...g.sfxCtx, out }, name, g.ctx.currentTime + (opts.delay ?? 0), opts.intensity ?? 1);
  }

  /** Mette in pausa il contesto (scheda nascosta): risparmia CPU e batteria. */
  suspend(): void {
    this.keepAliveEl?.pause();
    this.graph?.ctx.suspend().catch(() => undefined);
  }

  /** Riprende da 'suspended' e da 'interrupted' (iOS). Se il browser rifiuta, ci pensa il prossimo tocco. */
  resume(): void {
    const g = this.graph;
    if (!g) return;
    this.keepAliveEl?.play().catch(() => undefined);
    if (!isRunning(g.ctx)) g.ctx.resume().then(() => this.syncMusic(), () => undefined);
  }

  /** Su iOS l'audio Web Audio tace col tasto "silenzioso": lo si porta sul canale media. */
  private routeToMediaChannel(): void {
    if (this.sessionRouted) return;
    const nav = navigator as NavigatorWithSession;
    if (nav.audioSession) {
      try { nav.audioSession.type = 'playback'; this.sessionRouted = true; return; } catch { /* ripiego sotto */ }
    }
    if (!isIOS()) { this.sessionRouted = true; return; }
    try {
      if (!this.keepAliveEl) {
        const el = new Audio(makeSilentWavUrl());
        el.loop = true;
        el.setAttribute('playsinline', '');
        this.keepAliveEl = el;
      }
      this.keepAliveEl.play().then(() => { this.sessionRouted = true; }, () => { /* riprova al prossimo gesto */ });
    } catch { /* niente audio HTML: pazienza */ }
  }

  /** Buffer di un campione muto dentro il gesto: sveglia l'uscita audio di iOS. */
  private primeOutput(ctx: AudioContext): void {
    try {
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    } catch { /* ignora */ }
  }

  private syncMusic(): void {
    const g = this.graph;
    if (!g) return;
    const wantMusic = !this.settings.muted && this.settings.music > 0 && isRunning(g.ctx);
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
