// ─── ZoneOutline / ZoneLabel ──────────────────────────────────────────────────
// ZoneOutline: contorno di una zona interamente controllata, nel colore della
// fazione. ZoneLabel: targhetta col nome del quartiere e il bonus ("+N"),
// sempre visibile per tutte le zone (nel colore del proprietario se la zona è
// controllata, altrimenti in quello del quartiere, più tenue).
// Il rettangolo deriva da ZONE_DEFINITIONS[z].svgBounds, convertito con
// unitPerSvgPx e svgOrigin.

import { memo, useMemo } from 'react';
import { Line } from '@react-three/drei';
import { StableHtml } from './StableHtml';
import { ZONE_DEFINITIONS } from '../../data';
import type { BoardMeta, TerritoryId, ZoneId } from '../../types';

interface ZoneOutlineProps {
  readonly zoneId: ZoneId;
  readonly color: string;
  readonly meta: BoardMeta;
}

const CORNER = 0.7;
const ARC_STEPS = 6;
const LIFT = 0.08;

/** Rettangolo arrotondato come anello di punti sul piano XZ. */
function roundedRect(cx: number, cz: number, w: number, d: number, r: number, y: number): [number, number, number][] {
  const hw = w / 2;
  const hd = d / 2;
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [cx + hw - r, cz - hd + r, -Math.PI / 2],
    [cx + hw - r, cz + hd - r, 0],
    [cx - hw + r, cz + hd - r, Math.PI / 2],
    [cx - hw + r, cz - hd + r, Math.PI],
  ];
  const pts: [number, number, number][] = [];
  for (const [ox, oz, start] of corners) {
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = start + (i / ARC_STEPS) * (Math.PI / 2);
      pts.push([ox + Math.cos(a) * r, y, oz + Math.sin(a) * r]);
    }
  }
  const first = pts[0];
  if (first) pts.push([first[0], first[1], first[2]]);
  return pts;
}

interface ZoneGeometry {
  readonly points: [number, number, number][];
  readonly label: readonly [number, number, number];
}

function useZoneGeometry(zoneId: ZoneId, meta: BoardMeta): ZoneGeometry | null {
  const zone = ZONE_DEFINITIONS[zoneId];
  return useMemo(() => {
    if (!zone) return null;
    const { x, y, width, height } = zone.svgBounds;
    const u = meta.unitPerSvgPx;
    const cx = (x + width / 2 - meta.svgOrigin[0]) * u;
    const cz = (y + height / 2 - meta.svgOrigin[1]) * u;
    const ground = Math.max(...zone.territories.map(t => meta.territories[t as TerritoryId].y));
    const yy = ground + LIFT;
    return { points: roundedRect(cx, cz, width * u, height * u, CORNER, yy), label: [cx, yy, cz - (height * u) / 2] as const };
  }, [zone, meta]);
}

export const ZoneOutline = memo(function ZoneOutline({ zoneId, color, meta }: ZoneOutlineProps) {
  const geometry = useZoneGeometry(zoneId, meta);
  if (!geometry) return null;
  return <Line points={geometry.points} color={color} lineWidth={3} transparent opacity={0.9} depthTest={false} renderOrder={5} />;
});

interface ZoneLabelProps {
  readonly zoneId: ZoneId;
  /** Colore del proprietario; null se la zona non è controllata da nessuno. */
  readonly ownerColor: string | null;
  readonly meta: BoardMeta;
}

const LABEL_Z: [number, number] = [6, 1];

export const ZoneLabel = memo(function ZoneLabel({ zoneId, ownerColor, meta }: ZoneLabelProps) {
  const zone = ZONE_DEFINITIONS[zoneId];
  const geometry = useZoneGeometry(zoneId, meta);
  if (!zone || !geometry) return null;
  const color = ownerColor ?? zone.color;
  return (
    <StableHtml position={[geometry.label[0], geometry.label[1], geometry.label[2]]} center zIndexRange={LABEL_Z} style={{ pointerEvents: 'none' }}>
      <span className={ownerColor ? 'zonetag is-owned' : 'zonetag'} style={{ borderColor: color, color }}>
        {zone.name}
        {zone.troopBonus > 0 && <span className="zonetag__bonus"> · +{zone.troopBonus}</span>}
      </span>
    </StableHtml>
  );
});
