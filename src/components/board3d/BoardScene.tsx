// ─── BoardScene ───────────────────────────────────────────────────────────────
// Contenuto della <Canvas>: città, territori, archi, camera.
// Legge lo stato dai due store Zustand; nessuno stato locale di gioco.

import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { TERRITORY_DEFINITIONS, ZONE_DEFINITIONS, getBoardMeta } from '../../data';
import { useTerritoryInteraction } from '../../hooks/useTerritoryInteraction';
import type { FactionId, PlayerId, TerritoryId, TerritoryPair, ZoneId } from '../../types';
import { useBoardModels } from './useBoardModels';
import { BoardEnvironment } from './BoardEnvironment';
import { CameraRig } from './CameraRig';
import { ConnectionArcs } from './ConnectionArcs';
import { Territory3D } from './Territory3D';
import { ZoneLabel, ZoneOutline } from './ZoneOutline';
import { controlledZones } from '../../engine';
import { FACTION_DEFINITIONS } from '../../data';
import { CityLife } from './ambient/CityLife';

const TERRITORY_IDS = Object.keys(TERRITORY_DEFINITIONS) as TerritoryId[];
const ZONE_IDS = Object.keys(ZONE_DEFINITIONS) as ZoneId[];

export function BoardScene() {
  const game      = useGameStore(s => s.game);
  const hoveredId = useUIStore(s => s.hoveredTerritoryId);
  const { isHumanTurn, highlightPairs, getVariant, handleClick, handleHover } = useTerritoryInteraction();
  const models = useBoardModels();
  const meta   = useMemo(() => getBoardMeta(), []);

  const players = game?.players;
  const factionOf = useMemo(() => {
    const m = new Map<PlayerId, FactionId>();
    for (const p of players ?? []) m.set(p.id, p.factionId);
    return m;
  }, [players]);

  const territoriesState = game?.territories;
  const zones = useMemo(
    () => (territoriesState ? [...controlledZones({ territories: territoriesState })] : []),
    [territoriesState],
  );

  const zoneOwners = useMemo(() => new Map(zones), [zones]);

  const traces = useUIStore(s => s.traces);
  const traceGroups = useMemo(() => ({
    attack: traces.filter(t => t.kind === 'attack' && t.from).map(t => [t.from!, t.to] as const),
    move: traces.filter(t => t.kind === 'move' && t.from).map(t => [t.from!, t.to] as const),
  }), [traces]);

  const pending = game?.pendingAttack ?? null;
  const combatPair = useMemo<TerritoryPair[]>(
    () => (pending ? [[pending.fromId, pending.toId] as const] : []),
    [pending],
  );

  if (!game) return null;

  return (
    <>
      <BoardEnvironment />
      <primitive object={models.city} />
      <CityLife waterLevel={meta.waterLevel} />

      {TERRITORY_IDS.map(id => {
        const def = TERRITORY_DEFINITIONS[id];
        const state = game.territories[id];
        const faction = state.ownerId ? factionOf.get(state.ownerId) ?? null : null;
        return (
          <Territory3D
            key={id}
            id={id}
            name={def.name}
            anchor={meta.territories[id]}
            troops={state.troops}
            ownerFaction={faction}
            variant={getVariant(id)}
            isHovered={hoveredId === id}
            isBottleneck={def.isBottleneck}
            interactive={isHumanTurn}
            landmark={models.landmarks[id]}
            troopTemplate={faction ? models.troops[faction] : undefined}
            flagTemplate={faction ? models.flags[faction] : undefined}
            troopScale={meta.troopScale}
            onSelect={handleClick}
            onHover={handleHover}
          />
        );
      })}

      {zones.map(([zoneId, playerId]) => {
        const faction = factionOf.get(playerId);
        return faction ? <ZoneOutline key={zoneId} zoneId={zoneId} color={FACTION_DEFINITIONS[faction].color} meta={meta} /> : null;
      })}

      {/* nomi di tutti i quartieri, sempre visibili */}
      {ZONE_IDS.map(zoneId => {
        const owner = zoneOwners.get(zoneId);
        const faction = owner ? factionOf.get(owner) : undefined;
        return <ZoneLabel key={zoneId} zoneId={zoneId} ownerColor={faction ? FACTION_DEFINITIONS[faction].color : null} meta={meta} />;
      })}

      <ConnectionArcs
        pairs={highlightPairs}
        anchors={meta.territories}
        color={game.phase === 'ATTACK' ? '#ff5a4f' : '#3fdc6a'}
      />
      <ConnectionArcs pairs={traceGroups.attack} anchors={meta.territories} color="#ff8a4f" lineWidth={4} />
      <ConnectionArcs pairs={traceGroups.move} anchors={meta.territories} color="#5ea8ff" lineWidth={4} />
      <ConnectionArcs pairs={combatPair} anchors={meta.territories} color="#ffb020" lineWidth={5} />

      <CameraRig />
    </>
  );
}
