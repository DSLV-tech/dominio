// ─── TerritoryInfoCard ────────────────────────────────────────────────────────
// Scheda sovrapposta alla mappa: territorio sotto il cursore (o selezionato),
// con proprietario, truppe, quartiere e la riga di racconto del luogo.
// Sta in alto, sul lato della mappa opposto al puntatore.

import { memo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import {
  TERRITORY_DEFINITIONS, ZONE_DEFINITIONS, FACTION_DEFINITIONS, TERRITORY_LORE,
} from '../../data';
import { useStageCursorSide } from '../../hooks/useStageCursorSide';

export const TerritoryInfoCard = memo(function TerritoryInfoCard() {
  const hovered  = useUIStore(s => s.hoveredTerritoryId);
  const selected = useUIStore(s => s.selectedTerritoryId);
  const id = hovered ?? selected;
  // la scheda si apre dal lato opposto al puntatore: non copre il territorio
  const cursorSide = useStageCursorSide();

  // selettori stretti: la scheda si ridisegna solo se cambia QUEL territorio
  const ownerId = useGameStore(s => (id && s.game ? s.game.territories[id].ownerId : null));
  const troops  = useGameStore(s => (id && s.game ? s.game.territories[id].troops : 0));
  const owner   = useGameStore(s => (ownerId && s.game ? s.game.players.find(p => p.id === ownerId) ?? null : null));
  const barricade = !!(id && owner?.barricades[id]);

  if (!id) return null;

  const def = TERRITORY_DEFINITIONS[id];
  const zone = ZONE_DEFINITIONS[def.zone];
  const faction = owner ? FACTION_DEFINITIONS[owner.factionId] : null;

  return (
    <aside className={cursorSide === 'left' ? 'tinfo tinfo--right' : 'tinfo'} aria-live="polite" style={{ borderColor: faction?.color }}>
      <div className="tinfo__zone" style={{ color: zone?.color }}>
        {zone?.name}{def.isBottleneck && <span className="tinfo__star"> · ★ snodo</span>}
      </div>
      <div className="tinfo__name">{def.name}</div>
      <div className="tinfo__stats">
        <span style={{ color: faction?.color ?? 'var(--muted)' }}>{faction ? faction.shortName : 'Neutrale'}</span>
        <span className="tinfo__troops">{troops} truppe</span>
        {barricade && <span className="tinfo__barricade">barricata</span>}
      </div>
      <p className="tinfo__lore">{TERRITORY_LORE[id].line}</p>
    </aside>
  );
});
