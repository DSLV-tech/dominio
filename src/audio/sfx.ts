// ─── Effetti sonori sintetizzati ──────────────────────────────────────────────
// Ogni effetto è una funzione pura (ctx, uscita, istante, intensità) che crea
// nodi Web Audio a vita breve: si scollegano da soli a fine suono.
// Palette: legno e metallo per i dadi e gli scontri, ottoni filtrati per le
// fanfare, campane morbide per l'interfaccia — coerente col noir del gioco.

import type { SfxName } from '../types';

export interface SfxContext {
  readonly ctx: AudioContext;
  readonly out: AudioNode;      // ingresso secco (bus effetti)
  readonly send: AudioNode;     // mandata al riverbero
  readonly noise: AudioBuffer;  // rumore bianco condiviso (1 s)
}

type SfxFn = (c: SfxContext, t: number, k: number) => void;

// ── Mattoncini ───────────────────────────────────────────────────────────────

interface ToneSpec {
  readonly type: OscillatorType;
  readonly freq: number;
  readonly to?: number;        // glissando verso questa frequenza
  readonly gain: number;
  readonly attack?: number;
  readonly decay: number;
  readonly detune?: number;
  readonly wet?: number;       // 0..1 quota al riverbero
}

function tone(c: SfxContext, t: number, s: ToneSpec): void {
  const o = c.ctx.createOscillator();
  const g = c.ctx.createGain();
  o.type = s.type;
  o.frequency.setValueAtTime(s.freq, t);
  if (s.to) o.frequency.exponentialRampToValueAtTime(s.to, t + s.decay);
  if (s.detune) o.detune.value = s.detune;
  const a = s.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(s.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + s.decay);
  o.connect(g);
  g.connect(c.out);
  if (s.wet) {
    const w = c.ctx.createGain(); w.gain.value = s.wet;
    g.connect(w); w.connect(c.send);
  }
  o.start(t);
  o.stop(t + a + s.decay + 0.05);
}

interface NoiseSpec {
  readonly filter: BiquadFilterType;
  readonly freq: number;
  readonly to?: number;
  readonly q?: number;
  readonly gain: number;
  readonly attack?: number;
  readonly decay: number;
  readonly wet?: number;
}

function noise(c: SfxContext, t: number, s: NoiseSpec): void {
  const src = c.ctx.createBufferSource();
  src.buffer = c.noise;
  const f = c.ctx.createBiquadFilter();
  f.type = s.filter;
  f.frequency.setValueAtTime(s.freq, t);
  if (s.to) f.frequency.exponentialRampToValueAtTime(s.to, t + s.decay);
  f.Q.value = s.q ?? 0.8;
  const g = c.ctx.createGain();
  const a = s.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(s.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + s.decay);
  src.connect(f); f.connect(g); g.connect(c.out);
  if (s.wet) {
    const w = c.ctx.createGain(); w.gain.value = s.wet;
    g.connect(w); w.connect(c.send);
  }
  src.start(t, Math.random() * 0.5);
  src.stop(t + a + s.decay + 0.05);
}

const midi = (n: number): number => 440 * 2 ** ((n - 69) / 12);

/** Nota "ottone" filtrato (sega + passa-basso che si apre). */
function brass(c: SfxContext, t: number, note: number, dur: number, gain: number): void {
  const o = c.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(note);
  const o2 = c.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = midi(note); o2.detune.value = 9;
  const f = c.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.06);
  f.frequency.exponentialRampToValueAtTime(900, t + dur);
  const g = c.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  g.gain.setValueAtTime(gain * 0.8, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(c.out);
  const w = c.ctx.createGain(); w.gain.value = 0.45; g.connect(w); w.connect(c.send);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

function bell(c: SfxContext, t: number, note: number, gain: number, decay = 1.1): void {
  const f = midi(note);
  tone(c, t, { type: 'sine', freq: f, gain, decay, wet: 0.5 });
  tone(c, t, { type: 'sine', freq: f * 2.76, gain: gain * 0.35, decay: decay * 0.5, wet: 0.5 });
  tone(c, t, { type: 'sine', freq: f * 5.4, gain: gain * 0.12, decay: decay * 0.25, wet: 0.5 });
}

// ── Catalogo ─────────────────────────────────────────────────────────────────

const SFX: Readonly<Record<SfxName, SfxFn>> = {
  click: (c, t, k) => {
    tone(c, t, { type: 'triangle', freq: 1500, to: 900, gain: 0.08 * k, decay: 0.05 });
  },

  diceShake: (c, t, k) => {
    // dadi agitati nel pugno: raffica di piccoli colpi di legno
    for (let i = 0; i < 9; i++) {
      const dt = i * 0.045 + Math.random() * 0.02;
      noise(c, t + dt, { filter: 'bandpass', freq: 2400 + Math.random() * 1600, q: 3, gain: 0.12 * k, decay: 0.03 });
    }
  },

  diceHit: (c, t, k) => {
    // dado che sbatte sul panno: tonfo legnoso + clic
    const f = 520 + Math.random() * 260;
    tone(c, t, { type: 'triangle', freq: f, to: f * 0.7, gain: 0.32 * k, decay: 0.07 });
    noise(c, t, { filter: 'bandpass', freq: 3200, q: 2.5, gain: 0.22 * k, decay: 0.04 });
    noise(c, t, { filter: 'lowpass', freq: 500, gain: 0.25 * k, decay: 0.06 });
  },

  clash: (c, t, k) => {
    // urto metallico: parziali inarmoniche + soffio
    for (const [f, g] of [[523, 0.16], [1288, 0.12], [2093, 0.09], [3410, 0.06], [4870, 0.04]] as const) {
      tone(c, t, { type: 'square', freq: f * (0.98 + Math.random() * 0.04), gain: g * k, decay: 0.35 + Math.random() * 0.2, wet: 0.4 });
    }
    noise(c, t, { filter: 'highpass', freq: 2500, gain: 0.35 * k, decay: 0.18, wet: 0.3 });
  },

  impact: (c, t, k) => {
    tone(c, t, { type: 'sine', freq: 130, to: 38, gain: 0.7 * k, decay: 0.45 });
    tone(c, t, { type: 'triangle', freq: 280, to: 90, gain: 0.3 * k, decay: 0.28 }); // corpo udibile sul telefono
    noise(c, t, { filter: 'lowpass', freq: 900, to: 120, gain: 0.45 * k, decay: 0.3, wet: 0.25 });
  },

  fall: (c, t, k) => {
    noise(c, t, { filter: 'bandpass', freq: 1400, to: 300, q: 1.2, gain: 0.18 * k, decay: 0.25 });
    tone(c, t + 0.22, { type: 'sine', freq: 90, to: 50, gain: 0.35 * k, decay: 0.2 });
  },

  conquest: (c, t, k) => {
    // fanfara in Re maggiore: Re-Fa#-La-Re
    const notes = [62, 66, 69, 74];
    notes.forEach((n, i) => brass(c, t + i * 0.11, n, i === notes.length - 1 ? 0.9 : 0.22, 0.13 * k));
    brass(c, t + 0.33, 57, 0.9, 0.08 * k);
    noise(c, t + 0.33, { filter: 'highpass', freq: 6000, gain: 0.08 * k, decay: 0.6, wet: 0.6 }); // piatto
  },

  repelled: (c, t, k) => {
    // la difesa regge: due note gravi in minore
    brass(c, t, 50, 0.3, 0.12 * k);
    brass(c, t + 0.22, 53, 0.7, 0.12 * k);
    tone(c, t + 0.22, { type: 'sine', freq: 73, to: 60, gain: 0.3 * k, decay: 0.5 });
  },

  reinforce: (c, t, k) => {
    [67, 71, 74].forEach((n, i) => tone(c, t + i * 0.05, { type: 'triangle', freq: midi(n), gain: 0.12 * k, decay: 0.16, wet: 0.3 }));
    noise(c, t, { filter: 'lowpass', freq: 700, gain: 0.12 * k, decay: 0.08 }); // pedina appoggiata
  },

  move: (c, t, k) => {
    noise(c, t, { filter: 'bandpass', freq: 400, to: 2200, q: 1.5, gain: 0.16 * k, attack: 0.08, decay: 0.35, wet: 0.3 });
  },

  phase: (c, t, k) => bell(c, t, 79, 0.09 * k, 0.9),

  turn: (c, t, k) => {
    bell(c, t, 76, 0.09 * k);
    bell(c, t + 0.16, 83, 0.08 * k);
  },

  event: (c, t, k) => {
    // la Gazzetta: fruscio di carta + campana bassa
    noise(c, t, { filter: 'highpass', freq: 3000, gain: 0.12 * k, attack: 0.03, decay: 0.25 });
    noise(c, t + 0.12, { filter: 'highpass', freq: 2500, gain: 0.1 * k, attack: 0.02, decay: 0.2 });
    bell(c, t + 0.1, 57, 0.14 * k, 1.6);
  },

  victory: (c, t, k) => {
    const seq: ReadonlyArray<readonly [number, number, number]> = [
      [62, 0, 0.2], [66, 0.18, 0.2], [69, 0.36, 0.2], [74, 0.54, 1.6], [66, 0.54, 1.6], [69, 0.54, 1.6], [50, 0.54, 1.8],
    ];
    for (const [n, dt, d] of seq) brass(c, t + dt, n, d, 0.11 * k);
    noise(c, t + 0.54, { filter: 'highpass', freq: 5000, gain: 0.12 * k, decay: 1.4, wet: 0.7 });
    tone(c, t + 0.54, { type: 'sine', freq: 70, to: 45, gain: 0.5 * k, decay: 0.8 });
  },

  eliminated: (c, t, k) => {
    // gong
    for (const [r, g] of [[1, 0.3], [1.48, 0.18], [2.3, 0.12], [3.1, 0.08], [4.2, 0.06], [5.6, 0.04]] as const) {
      tone(c, t, { type: 'sine', freq: 82 * r, gain: g * k, attack: 0.02, decay: 2.4, wet: 0.7 });
    }
  },
};

export function playSfx(c: SfxContext, name: SfxName, t: number, intensity: number): void {
  SFX[name](c, t, Math.max(0.05, Math.min(1.5, intensity)));
}

export function makeNoiseBuffer(ctx: AudioContext, seconds = 1): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Riverbero sintetico: risposta all'impulso = rumore con decadimento esponenziale. */
export function makeImpulse(ctx: AudioContext, seconds = 2.2, decay = 3.2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}
