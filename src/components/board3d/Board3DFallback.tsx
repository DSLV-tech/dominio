// ─── Board3DFallback ──────────────────────────────────────────────────────────
// Se la 3D non è disponibile (WebGL assente, modello mancante, errore) il gioco
// continua sulla mappa 2D, con un avviso e la possibilità di ritentare.

import { memo } from 'react';
import { GameMap } from '../map/GameMap';

interface Board3DFallbackProps {
  readonly reason: string;
  readonly onRetry?: () => void;
}

export const Board3DFallback = memo(function Board3DFallback({ reason, onRetry }: Board3DFallbackProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="b3d-error" role="alert">
        <span>Vista 3D non disponibile ({reason}). Si gioca sulla mappa 2D.</span>
        {onRetry && <button type="button" onClick={onRetry}>Riprova</button>}
      </div>
      <GameMap />
    </div>
  );
});
