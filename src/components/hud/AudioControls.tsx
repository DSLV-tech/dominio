// ─── AudioControls ────────────────────────────────────────────────────────────
// Pulsante altoparlante nella barra superiore: clic = muto/attivo,
// freccia = pannello con i volumi di musica ed effetti.
// Il pannello si chiude con Esc o cliccando fuori.

import { memo, useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { audio } from '../../audio/engine';
import { useSettingsStore } from '../../store/settingsStore';
import { SegmentedControl, type SegmentOption } from '../common/SegmentedControl';
import type { CpuSpeed, GraphicsQuality } from '../../types';

const QUALITY_OPTIONS: ReadonlyArray<SegmentOption<GraphicsQuality>> = [
  { value: 'auto', label: 'Auto' },
  { value: 'high', label: 'Alta' },
  { value: 'low', label: 'Bassa' },
];

const SPEED_OPTIONS: ReadonlyArray<SegmentOption<CpuSpeed>> = [
  { value: 'cinematic', label: 'Lento' },
  { value: 'normal', label: 'Normale' },
  { value: 'fast', label: 'Veloce' },
];

interface VolumeSliderProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly onRelease?: () => void;
}

const VolumeSlider = memo(function VolumeSlider({ label, value, onChange, onRelease }: VolumeSliderProps) {
  const id = useId();
  const handle = useCallback((e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value) / 100), [onChange]);
  return (
    <div className="audio-pop__row">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={handle}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
      />
      <output htmlFor={id}>{Math.round(value * 100)}</output>
    </div>
  );
});

function SpeakerIcon({ muted }: { readonly muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
      {muted
        ? <path d="M17 9l5 6M22 9l-5 6" />
        : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>}
    </svg>
  );
}

export const AudioControls = memo(function AudioControls() {
  const muted = useAudioStore(s => s.muted);
  const music = useAudioStore(s => s.music);
  const sfx = useAudioStore(s => s.sfx);
  const toggleMuted = useAudioStore(s => s.toggleMuted);
  const setMusic = useAudioStore(s => s.setMusic);
  const setSfx = useAudioStore(s => s.setSfx);
  const cpuSpeed = useSettingsStore(s => s.cpuSpeed);
  const followCpu = useSettingsStore(s => s.followCpu);
  const setCpuSpeed = useSettingsStore(s => s.setCpuSpeed);
  const setFollowCpu = useSettingsStore(s => s.setFollowCpu);
  const quality = useSettingsStore(s => s.quality);
  const setQuality = useSettingsStore(s => s.setQuality);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const previewSfx = useCallback(() => audio.play('diceHit'), []);

  return (
    <div className="audio-ctl" ref={rootRef}>
      <button
        type="button"
        className={`btn btn--ghost btn--sm audio-ctl__mute${muted ? ' is-muted' : ''}`}
        onClick={toggleMuted}
        aria-pressed={!muted}
        title={muted ? 'Attiva audio' : 'Disattiva audio'}
      >
        <SpeakerIcon muted={muted} />
        <span className="sr-only">{muted ? 'Audio disattivato' : 'Audio attivo'}</span>
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm audio-ctl__more"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        title="Impostazioni"
      >
        <span aria-hidden="true">▾</span>
        <span className="sr-only">Apri le impostazioni</span>
      </button>
      {open && (
        <div className="audio-pop" id={panelId} role="dialog" aria-label="Impostazioni">
          <VolumeSlider label="Musica" value={music} onChange={setMusic} />
          <VolumeSlider label="Effetti" value={sfx} onChange={setSfx} onRelease={previewSfx} />
          <p className="audio-pop__note">Colonna sonora ed effetti generati in tempo reale.</p>
          <div className="settings-sec">
            <h3 className="settings-sec__title">Grafica 3D</h3>
            <SegmentedControl options={QUALITY_OPTIONS} value={quality} onChange={setQuality} ariaLabel="Qualità grafica" size="sm" stretch />
            <p className="audio-pop__note">Bassa: ombre leggere, meno traffico e particelle. Auto sceglie da sola.</p>
          </div>
          <div className="settings-sec">
            <h3 className="settings-sec__title">Turno della CPU</h3>
            <SegmentedControl options={SPEED_OPTIONS} value={cpuSpeed} onChange={setCpuSpeed} ariaLabel="Velocità della CPU" size="sm" stretch />
            <label className="settings-sec__check">
              <input type="checkbox" checked={followCpu} onChange={e => setFollowCpu(e.target.checked)} />
              La camera segue la CPU
            </label>
          </div>
        </div>
      )}
    </div>
  );
});
