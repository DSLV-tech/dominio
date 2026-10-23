// ─── App ──────────────────────────────────────────────────────────────────────
// Instradamento: Prologo → Lobby → Partita (→ Epilogo nel VictoryModal).
// Online: invito (JoinScreen) → sala d'attesa (RoomScreen) → Partita.
// Layout partita: barra superiore, barra del turno, mappa a tutto spazio,
// sidebar a schede. Su desktop occupa esattamente il viewport (niente scroll
// di pagina); sotto i 1024px le sezioni si impilano.

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { useUIStore } from './store/uiStore';
import { useStoryStore } from './store/storyStore';
import { SetupScreen } from './components/setup/SetupScreen';
import { RoomScreen } from './components/online/RoomScreen';
import { JoinScreen } from './components/online/JoinScreen';
import { useOnlineStore } from './online/onlineStore';
import { GameMap } from './components/map/GameMap';
import { PhaseBar } from './components/hud/PhaseBar';
import { Sidebar } from './components/hud/Sidebar';
import { CombatModal } from './components/modals/CombatModal';
import { OccupyDialog } from './components/modals/OccupyDialog';
import { AttackPanel } from './components/hud/AttackPanel';
import { EventTargetBar } from './components/cards/EventTargetBar';
import { TurnRecap } from './components/hud/TurnRecap';
import { CoachMark } from './components/hud/CoachMark';
import { MapDock } from './components/hud/MapDock';
import { VictoryModal } from './components/modals/VictoryModal';
import { PrologueScreen } from './components/story/PrologueScreen';
import { ActInterlude } from './components/story/ActInterlude';
import { TerritoryInfoCard } from './components/story/TerritoryInfoCard';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SegmentedControl, type SegmentOption } from './components/common/SegmentedControl';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { useAIPlayer } from './hooks/useAIPlayer';
import { useStoryDirector } from './hooks/useStoryDirector';
import { useAudioUnlock, useGameAudio } from './hooks/useGameAudio';
import { AudioControls } from './components/hud/AudioControls';
import { useIsNarrow } from './hooks/useIsNarrow';
import type { MapMode } from './types';
import './styles/ui.css';
import './styles/story.css';
import './styles/combat.css';
import './styles/attack.css';
import './styles/map2d.css';
import './styles/online.css';
import './styles/mobile.css';

// three.js (~700 KB) viene scaricato solo quando serve la vista 3D
const loadBoard3D = () =>
  import('./components/board3d/GameBoard3D').then(m => ({ default: m.GameBoard3D }));
const GameBoard3D = lazy(loadBoard3D);

const MAP_MODES: ReadonlyArray<SegmentOption<MapMode>> = [
  { value: '3D', label: 'Città 3D' },
  { value: '2D', label: 'Mappa 2D' },
];
// sui telefoni la barra superiore è stretta: etichette brevi
const MAP_MODES_SHORT: ReadonlyArray<SegmentOption<MapMode>> = [
  { value: '3D', label: <><span aria-hidden="true">3D</span><span className="sr-only">Città 3D</span></> },
  { value: '2D', label: <><span aria-hidden="true">2D</span><span className="sr-only">Mappa 2D</span></> },
];

function StageFallback() {
  return (
    <div className="stage__loading" role="status">
      <span className="spinner" aria-hidden="true" />
      Novarata si accende…
    </div>
  );
}

function AppCrash({ error, reset }: { error: Error; reset: () => void }) {
  const resetGame = useGameStore(s => s.resetGame);
  return (
    <main className="crash" role="alert">
      <h1>La città è andata in blackout</h1>
      <p>{error.message}</p>
      <div className="crash__actions">
        <button type="button" className="btn btn--ghost" onClick={reset}>Riprova</button>
        <button type="button" className="btn btn--sodium" onClick={() => { resetGame(); reset(); }}>Torna alla lobby</button>
      </div>
    </main>
  );
}

function GameScreen() {
  const notification = useUIStore(s => s.notification);
  const mapMode      = useUIStore(s => s.mapMode);
  const setMapMode   = useUIStore(s => s.setMapMode);
  const resetGame    = useGameStore(s => s.resetGame);
  const round        = useGameStore(s => s.game?.round ?? 1);
  const online       = useOnlineStore(s => s.room !== null);
  const roomCode     = useOnlineStore(s => s.room?.code ?? '');
  const leaveRoom    = useOnlineStore(s => s.leave);
  const narrow       = useIsNarrow();
  // "Lobby" non azzera più al primo click: chiede conferma
  const [confirmLeave, setConfirmLeave] = useState(false);
  const askLeave   = useCallback(() => setConfirmLeave(true), []);
  const cancelLeave = useCallback(() => setConfirmLeave(false), []);
  const leave      = useCallback(() => { setConfirmLeave(false); if (online) leaveRoom(); else resetGame(); }, [online, leaveRoom, resetGame]);

  return (
    <div className="game">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">DOMINIO</span>
          <span className="brand-sub">La Notte Lunga di Novarata</span>
        </div>
        <div className="topbar__actions">
          <AudioControls />
          <SegmentedControl options={narrow ? MAP_MODES_SHORT : MAP_MODES} value={mapMode} onChange={setMapMode} ariaLabel="Vista mappa" size="sm" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={askLeave} title={online ? 'Esci dalla partita online' : 'Abbandona e torna alla lobby'} aria-haspopup="dialog">
            {online ? 'Esci' : 'Lobby'}
          </button>
        </div>
      </header>

      <PhaseBar />

      <div className="game__main">
        <section className="stage" aria-label="Mappa di Novarata">
          {mapMode === '3D' ? (
            <Suspense fallback={<StageFallback />}>
              <GameBoard3D />
            </Suspense>
          ) : (
            <GameMap />
          )}
          {/* sui telefoni questi riquadri stanno nella fascia sotto la mappa (MapDock) */}
          {!narrow && (
            <>
              <TerritoryInfoCard />
              <AttackPanel />
              <EventTargetBar />
              <TurnRecap />
              <CoachMark />
            </>
          )}
        </section>
        {narrow && <MapDock />}
        <Sidebar />
      </div>

      {notification && <div className="toast" role="status">{notification}</div>}

      <CombatModal />
      <OccupyDialog />
      <ActInterlude />
      <VictoryModal />

      {confirmLeave && (online ? (
        <ConfirmDialog title="Uscire dalla partita online?" confirmLabel="Esci" cancelLabel="Continua a giocare" onConfirm={leave} onCancel={cancelLeave}>
          <p>La partita resta nella stanza {roomCode}: per rientrare riapri il link d'invito. Finché sei fuori il tuo turno resta in attesa.</p>
        </ConfirmDialog>
      ) : (
        <ConfirmDialog title="Abbandonare la partita?" confirmLabel="Abbandona" cancelLabel="Continua a giocare" onConfirm={leave} onCancel={cancelLeave}>
          <p>Torni alla lobby e la partita in corso (notte {round}) va persa. Non si può annullare.</p>
        </ConfirmDialog>
      ))}
    </div>
  );
}

export default function App() {
  const hasGame      = useGameStore(s => s.game !== null);
  const prologueDone = useStoryStore(s => s.prologueDone);
  const inRoom       = useOnlineStore(s => s.room !== null || s.resuming);
  const invited      = useOnlineStore(s => s.inviteCode !== null);

  // Il costo del chunk 3D si paga mentre si legge il prologo o si prepara la lobby
  useEffect(() => {
    if (!hasGame) void loadBoard3D().catch(() => undefined);
  }, [hasGame]);

  // Hook "di sistema": sempre montati, indipendenti dalla schermata
  useAIPlayer();
  useStoryDirector();
  useAudioUnlock();
  useGameAudio();

  return (
    <ErrorBoundary fallback={(error, reset) => <AppCrash error={error} reset={reset} />}>
      {hasGame ? <GameScreen />
        : inRoom ? <RoomScreen />
        : invited ? <JoinScreen />
        : prologueDone ? <SetupScreen /> : <PrologueScreen />}
    </ErrorBoundary>
  );
}
