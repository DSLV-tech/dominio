// ─── Sidebar ──────────────────────────────────────────────────────────────────
// Fazioni sempre visibili + schede: Gazzetta (storia), Carte, Registro, Guida.
// Le schede evitano la colonna infinita su mobile e tengono la mappa grande.

import { memo } from 'react';
import { useUIStore, type SidebarTab } from '../../store/uiStore';
import { useStoryStore } from '../../store/storyStore';
import { useGameStore } from '../../store/gameStore';
import { SegmentedControl, type SegmentOption } from '../common/SegmentedControl';
import { useIsNarrow } from '../../hooks/useIsNarrow';
import { BottomSheet } from './BottomSheet';
import { PlayerPanel } from './PlayerPanel';
import { GuidePanel } from './GuidePanel';
import { CardHandPanel } from '../cards/CardHandPanel';
import { ChroniclePanel } from '../story/ChroniclePanel';

const LogPanel = memo(function LogPanel() {
  const log = useUIStore(s => s.log);
  if (log.length === 0) return <p className="empty">Nessuna mossa registrata.</p>;
  return (
    <ol className="log">
      {log.map((entry, i) => <li key={`${i}-${entry}`}>{entry}</li>)}
    </ol>
  );
});

export const Sidebar = memo(function Sidebar() {
  const narrow = useIsNarrow();
  const tab    = useUIStore(s => s.sidebarTab);
  const setTab = useUIStore(s => s.setSidebarTab);
  const unread = useStoryStore(s => s.unread);
  const cards  = useGameStore(s => (s.game ? (s.game.hands[s.game.players[s.game.currentPlayerIndex]?.id ?? ''] ?? []).length : 0));

  const options: ReadonlyArray<SegmentOption<SidebarTab>> = [
    { value: 'CHRONICLE', label: 'Gazzetta', badge: tab === 'CHRONICLE' ? 0 : unread },
    { value: 'CARDS',     label: 'Carte', badge: cards },
    { value: 'LOG',       label: 'Registro' },
    { value: 'GUIDE',     label: 'Guida' },
  ];

  const content = (
    <aside className="sidebar">
      <PlayerPanel />
      <div className="panel panel--tabs">
        <SegmentedControl options={options} value={tab} onChange={setTab} ariaLabel="Sezioni" size="sm" stretch />
        <div className="sidebar__body">
          {tab === 'CHRONICLE' && <ChroniclePanel />}
          {tab === 'CARDS' && <CardHandPanel />}
          {tab === 'LOG' && <LogPanel />}
          {tab === 'GUIDE' && <GuidePanel />}
        </div>
      </div>
    </aside>
  );

  return narrow ? <BottomSheet>{content}</BottomSheet> : content;
});
