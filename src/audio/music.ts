// ─── Colonna sonora generativa ────────────────────────────────────────────────
// Un piccolo "combo noir" sintetizzato: pad di accordi, contrabbasso pizzicato,
// spazzole, e — quando sale la tensione — timpani e un ostinato grave.
// Lo scheduler suona in anticipo di ~0.2 s (pattern "lookahead" di Chris Wilson)
// così il ritmo resta stabile anche se il thread principale è occupato.
//
// L'atmosfera (MusicMood) non cambia le note: dosa il volume di ogni strato con
// dissolvenze lente, quindi i passaggi calma → tensione → scontro sono fluidi.

import type { MusicMood } from '../types';

const BPM = 84;
const BEAT = 60 / BPM;
const LOOKAHEAD_S = 0.25;
const TICK_MS = 90;

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

/** Re minore noir: Dm9 · B♭maj7 · Gm9 · A7(♭9). Note MIDI del pad + fondamentale del basso. */
const PROGRESSION: ReadonlyArray<{ readonly pad: readonly number[]; readonly root: number; readonly walk: readonly number[] }> = [
  { pad: [53, 57, 60, 64], root: 38, walk: [38, 41, 45, 44] },
  { pad: [53, 57, 58, 62], root: 34, walk: [34, 38, 41, 42] },
  { pad: [53, 55, 58, 62], root: 31, walk: [31, 34, 38, 40] },
  { pad: [52, 55, 58, 61], root: 33, walk: [33, 37, 40, 37] },
];
const VICTORY_PAD: readonly number[] = [50, 54, 57, 62];

type Layer = 'pad' | 'bass' | 'brush' | 'drum' | 'ostinato';
const LAYERS: readonly Layer[] = ['pad', 'bass', 'brush', 'drum', 'ostinato'];

const MIX: Readonly<Record<MusicMood, Readonly<Record<Layer, number>>>> = {
  calm:    { pad: 0.55, bass: 0.4,  brush: 0.22, drum: 0,    ostinato: 0 },
  tension: { pad: 0.42, bass: 0.5,  brush: 0.32, drum: 0.18, ostinato: 0.22 },
  combat:  { pad: 0.3,  bass: 0.42, brush: 0.3,  drum: 0.6,  ostinato: 0.5 },
  victory: { pad: 0.7,  bass: 0.25, brush: 0.1,  drum: 0.1,  ostinato: 0 },
};

export class MusicDirector {
  private readonly bus: Record<Layer, GainNode>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private mood: MusicMood = 'calm';

  private readonly ctx: AudioContext;
  private readonly reverb: AudioNode;
  private readonly noise: AudioBuffer;

  constructor(ctx: AudioContext, out: AudioNode, reverb: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.reverb = reverb;
    this.noise = noise;
    const mk = (): GainNode => { const g = ctx.createGain(); g.gain.value = 0; g.connect(out); return g; };
    this.bus = { pad: mk(), bass: mk(), brush: mk(), drum: mk(), ostinato: mk() };
    // il pad vive soprattutto nel riverbero
    const padSend = ctx.createGain(); padSend.gain.value = 0.7;
    this.bus.pad.connect(padSend); padSend.connect(reverb);
  }

  get running(): boolean { return this.timer !== null; }

  start(): void {
    if (this.timer) return;
    this.nextBeatTime = this.ctx.currentTime + 0.1;
    this.beatIndex = 0;
    this.applyMix(1.5);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    for (const l of LAYERS) this.bus[l].gain.setTargetAtTime(0, t, 0.3);
  }

  setMood(mood: MusicMood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.applyMix(mood === 'combat' ? 0.35 : 1.2);
  }

  private applyMix(seconds: number): void {
    const t = this.ctx.currentTime;
    const mix = MIX[this.mood];
    for (const l of LAYERS) this.bus[l].gain.setTargetAtTime(mix[l], t, seconds / 3);
  }

  private schedule(): void {
    while (this.nextBeatTime < this.ctx.currentTime + LOOKAHEAD_S) {
      this.playBeat(this.beatIndex, this.nextBeatTime);
      this.nextBeatTime += BEAT;
      this.beatIndex++;
    }
  }

  private playBeat(i: number, t: number): void {
    const beatInBar = i % 4;
    const chord = PROGRESSION[Math.floor(i / 4) % PROGRESSION.length]!;
    const victory = this.mood === 'victory';

    if (beatInBar === 0) this.pad(victory ? VICTORY_PAD : chord.pad, t, BEAT * 4);
    // basso: fondamentale sui tempi forti, "walking" quando c'è tensione
    const walking = this.mood === 'tension' || this.mood === 'combat';
    if (walking || beatInBar % 2 === 0) this.pluck(walking ? chord.walk[beatInBar]! : chord.root, t);
    // spazzole: 2 e 4 (swing); crome con la tensione
    if (beatInBar % 2 === 1) this.brush(t, 0.5);
    this.brush(t + BEAT * 0.66, walking ? 0.35 : 0.18);
    // timpani e ostinato
    this.drum(t, beatInBar === 0 ? 1 : 0.55);
    if (beatInBar === 3) this.drum(t + BEAT * 0.5, 0.4);
    this.ostinato(chord.root + 12, t);
    this.ostinato(chord.root + 12, t + BEAT / 2);
  }

  private pad(notes: readonly number[], t: number, dur: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.9);
    g.gain.setValueAtTime(0.05, t + dur - 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.4;
    f.connect(g); g.connect(this.bus.pad);
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.5);
      }
    }
  }

  private pluck(note: number, t: number): void {
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(note);
    const s = this.ctx.createOscillator(); s.type = 'sine'; s.frequency.value = midi(note) / 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.95);
    o.connect(g); s.connect(g); g.connect(this.bus.bass);
    o.start(t); s.start(t); o.stop(t + BEAT); s.stop(t + BEAT);
  }

  private brush(t: number, k: number): void {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * k, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f); f.connect(g); g.connect(this.bus.brush);
    src.start(t, Math.random() * 0.8); src.stop(t + 0.16);
  }

  private drum(t: number, k: number): void {
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6 * k, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(this.bus.drum);
    const w = this.ctx.createGain(); w.gain.value = 0.25; g.connect(w); w.connect(this.reverb);
    o.start(t); o.stop(t + 0.55);
  }

  private ostinato(note: number, t: number): void {
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = midi(note);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.4);
    o.connect(f); f.connect(g); g.connect(this.bus.ostinato);
    o.start(t); o.stop(t + BEAT * 0.45);
  }
}
