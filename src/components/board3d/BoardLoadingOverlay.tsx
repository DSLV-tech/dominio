// ─── BoardLoadingOverlay ──────────────────────────────────────────────────────
// Stato di caricamento dei modelli 3D (fuori dalla Canvas).

import { memo } from 'react';
import { useProgress } from '@react-three/drei';

export const BoardLoadingOverlay = memo(function BoardLoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active && progress >= 100) return null;
  const pct = Math.round(progress);
  return (
    <div className="b3d-overlay" role="status" aria-live="polite">
      <div className="b3d-loader">
        <div className="b3d-loader-title">Costruzione di Novarata…</div>
        <div className="b3d-loader-bar"><div style={{ width: `${pct}%` }} /></div>
        <div className="b3d-loader-pct">{pct}%</div>
      </div>
    </div>
  );
});
