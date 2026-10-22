// ─── Territory3D ──────────────────────────────────────────────────────────────
// Un territorio sulla plancia: basamento, monumento (da Blender), pedine,
// bandiera, anello di stato ed etichetta. Gestisce hover e click.
// Animazioni: il territorio si solleva su hover/selezione e, quando cambia
// proprietario, emette un'onda di conquista (ConquestPulse).

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { Group, Object3D } from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { FACTION_DEFINITIONS } from '../../data';
import type { FactionId, TerritoryAnchor, TerritoryId, TerritoryVariant } from '../../types';
import { damp, prefersReducedMotion } from '../common/motion';
import { HexBase } from './HexBase';
import { OwnershipDecal } from './OwnershipDecal';
import { VariantRing } from './VariantRing';
import { TroopFigures } from './TroopFigures';
import { TerritoryBadge } from './TerritoryBadge';
import { ConquestPulse } from './ConquestPulse';
import { HEX_RADIUS, NEUTRAL_COLOR, VARIANT_RING } from './constants';

/** Spostamento massimo del puntatore (px) perché un rilascio valga come click e non come drag. */
const CLICK_TOLERANCE = 6;
/** Sollevamento (unità scena) del territorio sotto il puntatore o selezionato. */
const HOVER_LIFT = 0.16;
const LIFT_LAMBDA = 10;

/** Fase deterministica per id: sfasa il "respiro" fra territori vicini. */
function phaseOf(id: TerritoryId): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h / 997) * Math.PI * 2;
}

export interface Territory3DProps {
  readonly id: TerritoryId;
  readonly name: string;
  readonly anchor: TerritoryAnchor;
  readonly troops: number;
  readonly ownerFaction: FactionId | null;
  readonly variant: TerritoryVariant;
  readonly isHovered: boolean;
  readonly isBottleneck: boolean;
  readonly interactive: boolean;
  readonly landmark: Object3D | undefined;
  readonly troopTemplate: Object3D | undefined;
  readonly flagTemplate: Object3D | undefined;
  readonly troopScale: number;
  readonly onSelect: (id: TerritoryId) => void;
  readonly onHover: (id: TerritoryId | null) => void;
}

export const Territory3D = memo(function Territory3D(props: Territory3DProps) {
  const {
    id, name, anchor, troops, ownerFaction, variant, isHovered, isBottleneck, interactive,
    landmark, troopTemplate, flagTemplate, troopScale, onSelect, onHover,
  } = props;

  const color = ownerFaction ? FACTION_DEFINITIONS[ownerFaction].color : NEUTRAL_COLOR;
  const landmarkClone = useMemo(() => landmark?.clone(), [landmark]);
  const ringColor = VARIANT_RING[variant] ?? (isHovered && interactive ? '#f0f6fc' : null);
  const isSelected = variant === 'selected';
  const glow = isSelected || isHovered ? 0.8 : 0.35;
  const phase = useMemo(() => phaseOf(id), [id]);

  // Cambio di proprietario → nuova onda di conquista (stato derivato in render,
  // niente setState negli effect). Il primo proprietario non genera l'effetto.
  const [prevOwner, setPrevOwner] = useState(ownerFaction);
  const [conquests, setConquests] = useState(0);
  if (prevOwner !== ownerFaction) {
    setPrevOwner(ownerFaction);
    if (ownerFaction) setConquests(n => n + 1);
  }

  // Sollevamento morbido su hover/selezione
  const liftRef = useRef<Group>(null);
  const still = prefersReducedMotion();
  const lifted = (isHovered && interactive) || isSelected;
  useFrame((_, dt) => {
    const g = liftRef.current;
    if (!g) return;
    const target = lifted ? HOVER_LIFT : 0;
    g.position.y = still ? target : damp(g.position.y, target, LIFT_LAMBDA, dt);
  });

  const handleOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(id);
    document.body.style.cursor = interactive ? 'pointer' : 'default';
  }, [id, interactive, onHover]);

  const handleOut = useCallback(() => {
    onHover(null);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_TOLERANCE) return;
    onSelect(id);
  }, [id, onSelect]);

  return (
    <group
      position={[anchor.x, anchor.y, anchor.z]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {/* Area di hover fissa (non segue il sollevamento): evita lo sfarfallio over/out ai bordi dell'esagono */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[HEX_RADIUS, HEX_RADIUS, 1.4, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <OwnershipDecal lift={anchor.y - anchor.base} color={ownerFaction ? color : null} />
      <group ref={liftRef}>
        <HexBase lift={anchor.y - anchor.base} color={color} glow={glow} phase={phase} />
        {ringColor && <VariantRing color={ringColor} pulse={isSelected || variant === 'attackable' || variant === 'targetable'} />}
        {landmarkClone && <primitive object={landmarkClone} />}
        {ownerFaction && troopTemplate && troops > 0 && (
          <TroopFigures template={troopTemplate} flag={flagTemplate} troops={troops} scale={troopScale} />
        )}
        {conquests > 0 && !still && <ConquestPulse key={conquests} color={color} />}
        <TerritoryBadge
          id={id}
          troops={troops}
          color={color}
          name={name}
          showName={isHovered || isSelected}
          isBottleneck={isBottleneck}
          interactive={interactive}
          onSelect={onSelect}
          onHover={onHover}
        />
      </group>
    </group>
  );
});
