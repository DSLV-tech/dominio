// ─── TurnRecap ────────────────────────────────────────────────────────────────
// Scheda di fine turno CPU: "Durante la notte di …". Si chiude da sola
// (la durata segue la velocità scelta), con un clic o con Esc.

import { memo, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { CPU_DELAY_FACTOR, useSettingsStore } from '../../store/settingsStore';
import { FACTION_DEFINITIONS, FACTION_LORE, TERRITORY_DEFINITIONS } from '../../data';
import type { TurnRecap as TurnRecapData } from '../../types';

const HOLD_MS = 6000;

function lines(recap: TurnRecapData): string[] {
  const out: string[] = [];
  if (recap.reinforced > 0) out.push(`Rinforza con ${recap.reinforced} truppe.`);
  if (recap.event) out.push(`Gioca una carta evento.`);
  if (recap.conquered.length > 0) {
    out.push(`Prende ${recap.conquered.map(id => TERRITORY_DEFINITIONS[id].name).join(', ')}.`);
  }
  if (recap.lost.length > 0) {
    out.push(`Perde ${recap.lost.map(id => TERRITORY_DEFINITIONS[id].name).join(', ')}.`);
  }
  if (recap.cardsDrawn > 0) out.push(`Pesca ${recap.cardsDrawn === 1 ? 'una carta' : `${recap.cardsDrawn} carte`}.`);
  if (out.length === 0) out.push('Resta in difesa, senza mosse di rilievo.');
  return out;
}

export const TurnRecap = memo(function TurnRecap() {
  const recap  = useUIStore(s => s.turnRecap);
  const clear  = useUIStore(s => s.setTurnRecap);
  const speed  = useSettingsStore(s => s.cpuSpeed);
  const player = useGameStore(s => recap ? s.game?.players.find(p => p.id === recap.playerId) ?? null : null);

  useEffect(() => {
    if (!recap) return;
    const timer = setTimeout(() => clear(null), HOLD_MS * CPU_DELAY_FACTOR[speed]);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clear(null); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); };
  }, [recap, speed, clear]);

  if (!recap || !player) return null;
  const lore = FACTION_LORE[player.factionId];
  return (
    <aside className="recap" role="status" aria-live="polite" style={{ borderColor: FACTION_DEFINITIONS[player.factionId].color }}>
      <button type="button" className="recap__close" onClick={() => clear(null)} aria-label="Chiudi riepilogo">×</button>
      <h3 className="recap__title">Durante la notte di {lore.leader}…</h3>
      <ul className="recap__list">
        {lines(recap).map(l => <li key={l}>{l}</li>)}
      </ul>
    </aside>
  );
});
