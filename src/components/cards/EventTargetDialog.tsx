// ─── EventTargetDialog ────────────────────────────────────────────────────────
// Piccolo pannello di scelta per i passi che non vivono sulla mappa:
// il giocatore bersaglio (stemmi) e le proprie carte da offrire.

import { memo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { FACTION_DEFINITIONS, FACTION_LORE, TERRITORY_DEFINITIONS } from '../../data';
import { FactionEmblem } from '../common/FactionEmblem';
import { SYMBOL_META } from './cardMeta';
import type { Card, PlayerId } from '../../types';

interface PlayerPickerProps {
  readonly players: readonly PlayerId[];
  readonly onPick: (id: PlayerId) => void;
}

export const PlayerPicker = memo(function PlayerPicker({ players, onPick }: PlayerPickerProps) {
  const all = useGameStore(s => s.game?.players ?? []);
  return (
    <ul className="etarget__players">
      {players.map(id => {
        const p = all.find(x => x.id === id);
        if (!p) return null;
        return (
          <li key={id}>
            <button type="button" className="etarget__player" onClick={() => onPick(id)}>
              <FactionEmblem faction={p.factionId} size={36} />
              <span className="etarget__player-text">
                <strong>{p.name}</strong>
                <small>{FACTION_DEFINITIONS[p.factionId].name} · {FACTION_LORE[p.factionId].leader}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

function cardLabel(card: Card): string {
  return card.kind === 'TERRITORY'
    ? `${TERRITORY_DEFINITIONS[card.territoryId].name} · ${SYMBOL_META[card.symbol].label}`
    : card.name;
}

interface CardPickerProps {
  readonly cards: readonly Card[];
  readonly max: number;
  readonly onConfirm: (ids: string[]) => void;
}

export const CardPicker = memo(function CardPicker({ cards, max, onConfirm }: CardPickerProps) {
  const [picked, setPicked] = useState<readonly string[]>([]);
  const toggle = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length < max ? [...prev, id] : prev));
  return (
    <div className="etarget__cards">
      <ul>
        {cards.map(c => (
          <li key={c.id}>
            <label className="etarget__card">
              <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
              {cardLabel(c)}
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--sodium btn--sm" disabled={picked.length === 0} onClick={() => onConfirm([...picked])}>
        Scambia {picked.length > 0 ? picked.length : ''} {picked.length === 1 ? 'carta' : 'carte'}
      </button>
    </div>
  );
});
