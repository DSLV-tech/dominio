// ─── GameBoard3D ──────────────────────────────────────────────────────────────
// Plancia 3D giocabile (diorama esportato da Blender).
//  - Suspense: i modelli si caricano in background, overlay con percentuale
//  - ErrorBoundary: qualsiasi errore 3D ripiega sulla mappa 2D
//  - Esc annulla la selezione corrente

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useSettingsStore } from '../../store/settingsStore';
import { useGraphicsBudget } from './graphics';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { hasWebGL } from '../common/webgl';
import { useTerritoryInteraction } from '../../hooks/useTerritoryInteraction';
import { BoardScene } from './BoardScene';
import { HtmlPortalContext } from './htmlPortal';
import { BoardLoadingOverlay } from './BoardLoadingOverlay';
import { Board3DFallback } from './Board3DFallback';
import { CAMERA_OFFSET, CAMERA_TARGET } from './constants';
import './board3d.css';


export function GameBoard3D() {
  const supported = useMemo(() => hasWebGL(), []);
  const { clearSelection } = useTerritoryInteraction();
  const budget = useGraphicsBudget();
  const setDegraded = useSettingsStore(s => s.setDegraded);
  // contenitore fisso delle etichette HTML (vedi StableHtml)
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  if (!supported) return <Board3DFallback reason="WebGL non supportato" />;

  return (
    <ErrorBoundary fallback={(error, reset) => <Board3DFallback reason={error.message} onRetry={reset} />}>
      <div className="b3d-root" ref={rootRef}>
        <HtmlPortalContext.Provider value={rootRef}>
          <Canvas
            shadows={budget.shadows}
            dpr={[budget.dpr[0], budget.dpr[1]]}
            camera={{ position: [CAMERA_TARGET[0] + CAMERA_OFFSET[0], CAMERA_OFFSET[1], CAMERA_TARGET[2] + CAMERA_OFFSET[2]], fov: 40, near: 0.5, far: 200 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <PerformanceMonitor onDecline={() => setDegraded(true)} />
            <Suspense fallback={null}>
              <BoardScene />
            </Suspense>
          </Canvas>
        </HtmlPortalContext.Provider>
        <BoardLoadingOverlay />
        <div className="b3d-hint">Trascina per ruotare · rotella o pizzico per lo zoom · Esc annulla</div>
      </div>
    </ErrorBoundary>
  );
}
