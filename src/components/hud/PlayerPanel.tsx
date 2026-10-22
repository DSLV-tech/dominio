// ─── PlayerPanel ──────────────────────────────────────────────────────────────
// Le fazioni in gara: leader, zone, truppe totali, quartieri interi, carte.
// Le statistiche sono calcolate una volta per stato (useMemo) e passate a
// righe memoizzate.

import { memo, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { FACTION_DEFINITIONS, FACTION_LORE, ZONE_DEFINITIONS } from '../../data';
import type { GameState, Player, PlayerId, TerritoryId } from '../../types';
import { cssVars } from '../common/cssVars';
import { FactionEmblem } from '../common/FactionEmblem';

interface PlayerStats {
  readonly territories: number;
  readonly troops: number;
  readonly zones: number;
  /** Etichette "Nome +N" delle zone intere. */
  readonly zoneLabels: readonly string[];
  readonly cards: number;
}

function computeStats(game: GameState): ReadonlyMap<PlayerId, PlayerStats> {
  const map = new Map<PlayerId, PlayerStats>();
  for (const p of game.players) {
    const owned = Object.values(game.territories).filter(t => t.ownerId === p.id);
    const owned_zones = Object.values(ZONE_DEFINITIONS).filter(z =>
      z.territories.every(tid => game.territories[tid as TerritoryId].ownerId === p.id),
    );
    const zones = owned_zones.length;
    const zoneLabels = owned_zones.map(z => (z.troopBonus > 0 ? `${z.name} +${z.troopBonus}` : z.name));
    map.set(p.id, {
      territories: owned.length,
      troops: owned.reduce((sum, t) => sum + t.troops, 0),
      zones,
      zoneLabels,
      cards: (game.hands[p.id] ?? []).length,
    });
  }
  return map;
}

interface PlayerRowProps {
  readonly player: Player;
  readonly stats: PlayerStats;
  readonly isCurrent: boolean;
  readonly share: number; // quota di territori 0..1
}

const PlayerRow = memo(function PlayerRow({ player, stats, isCurrent, share }: PlayerRowProps) {
  const faction = FACTION_DEFINITIONS[player.factionId];
  const lore = FACTION_LORE[player.factionId];
  return (
    <li
      className={`prow${isCurrent ? ' is-current' : ''}${player.isEliminated ? ' is-out' : ''}`}
      style={cssVars({ '--faction': faction.color, '--share': `${Math.round(share * 100)}%` })}
    >
      <div className="prow__head">
        <span className="prow__name">
          <FactionEmblem faction={player.factionId} size={22} className="prow__emblem" />
          {player.name}
          {player.isAI && <span className="tag">CPU</span>}
          {player.isEliminated && <span className="tag tag--danger">fuori</span>}
        </span>
        <span className="prow__faction">{lore.leader} · {faction.shortName}</span>
      </div>
      <dl className="prow__stats">
        <div><dt>zone</dt><dd>{stats.territories}</dd></div>
        <div><dt>truppe</dt><dd>{stats.troops}</dd></div>
        <div><dt>quartieri</dt><dd>{stats.zones}</dd></div>
        <div><dt>carte</dt><dd>{stats.cards}</dd></div>
      </dl>
      {stats.zoneLabels.length > 0 && <p className="prow__zones">{stats.zoneLabels.join(' · ')}</p>}
      <div className="prow__bar" aria-hidden="true"><span /></div>
    </li>
  );
});

export const PlayerPanel = memo(function PlayerPanel() {
  const game = useGameStore(s => s.game);
  const stats = useMemo(() => (game ? computeStats(game) : null), [game]);
  if (!game || !stats) return null;

  const total = Object.keys(game.territories).length;

  return (
    <section className="panel" aria-label="Fazioni">
      <h2 className="panel__title">Fazioni in strada</h2>
      <ul className="prow-list">
        {game.players.map((player, idx) => {
          const s = stats.get(player.id);
          if (!s) return null;
          return (
            <PlayerRow
              key={player.id}
              player={player}
              stats={s}
              isCurrent={idx === game.currentPlayerIndex}
              share={s.territories / total}
            />
          );
        })}
      </ul>
    </section>
  );
});
