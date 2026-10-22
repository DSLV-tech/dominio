// ─── traffic ──────────────────────────────────────────────────────────────────
// Genera src/data/traffic.json: i tracciati delle strade su cui circolano le
// auto animate della plancia 3D + la posizione della lanterna del faro.
//
// Le strade sono "cotte" in citta.glb, quindi qui:
//  1. ricostruiamo il percorso di ogni strada con lo stesso algoritmo di
//     blender/build_dominio.py (route: deviazioni attorno ai territori);
//  2. campioniamo il tracciato ogni STEP unità;
//  3. leggiamo la quota di ogni campione con un raycast dall'alto sulla mesh
//     della città (BVH), così le auto seguono colline e superstrada.
//
// Da rilanciare solo se cambia la mappa in Blender:  npm run traffic

import { readFileSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Ray, Raycaster, Vector2, Vector3 } from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { TERRITORY_DEFINITIONS } from '../src/data/territories';
import type { TerritoryId } from '../src/types';

Mesh.prototype.raycast = acceleratedRaycast;

const STEP = 0.25;
const CLEARANCE = 1.2;     // come in build_dominio.py
const DETOUR = 1.45;
const TRIM = 0.95;         // la strada parte/finisce fuori dall'esagono
const ELEVATED: readonly [TerritoryId, TerritoryId] = ['PN4', 'SE4'];
/** Faro in build_dominio.py: (-13.5, -11.6) Blender → (x, z = -y) three. */
const LIGHTHOUSE_XZ = [-13.5, 11.6] as const;
/** La lanterna sta sotto la cupola rossa (cupola alta 0.14 + metà lanterna). */
const LANTERN_BELOW_TOP = 0.2;

interface Anchor { x: number; y: number; z: number }

const board = JSON.parse(readFileSync('src/data/board3d.json', 'utf8')) as { territories: Record<TerritoryId, Anchor> };
const ids = Object.keys(TERRITORY_DEFINITIONS) as TerritoryId[];
const TPOS = new Map<TerritoryId, Vector2>(ids.map(id => [id, new Vector2(board.territories[id].x, board.territories[id].z)]));

// ── 1. Percorsi (porting di route() da build_dominio.py) ─────────────────────
function route(a: Vector2, b: Vector2, excl: ReadonlySet<TerritoryId>): Vector2[] {
  const pts = [a.clone(), b.clone()];
  for (let iter = 0; iter < 5; iter++) {
    let changed = false;
    for (let i = 0; i < pts.length - 1 && !changed; i++) {
      const p = pts[i]!, q = pts[i + 1]!;
      const d = q.clone().sub(p); const L2 = d.lengthSq();
      for (const [tid, c] of TPOS) {
        if (excl.has(tid)) continue;
        const t = Math.max(0, Math.min(1, c.clone().sub(p).dot(d) / L2));
        const cl = p.clone().add(d.clone().multiplyScalar(t));
        if (cl.distanceTo(c) < CLEARANCE && t > 0.02 && t < 0.98) {
          let nrm = cl.clone().sub(c);
          if (nrm.length() < 1e-4) nrm = new Vector2(-d.y, d.x);
          nrm.normalize();
          pts.splice(i + 1, 0, c.clone().add(nrm.multiplyScalar(DETOUR)));
          changed = true; break;
        }
      }
    }
    if (!changed) break;
  }
  const n = pts.length;
  pts[0] = pts[0]!.clone().add(pts[1]!.clone().sub(pts[0]!).normalize().multiplyScalar(TRIM));
  pts[n - 1] = pts[n - 1]!.clone().add(pts[n - 2]!.clone().sub(pts[n - 1]!).normalize().multiplyScalar(TRIM));
  return pts;
}

function sample(pts: readonly Vector2[], step: number): Vector2[] {
  const out: Vector2[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!, q = pts[i + 1]!;
    const n = Math.max(1, Math.floor(p.distanceTo(q) / step));
    for (let k = 0; k < n; k++) out.push(p.clone().lerp(q, k / n));
  }
  out.push(pts[pts.length - 1]!.clone());
  return out;
}

// ── 2. Mesh della città con BVH ──────────────────────────────────────────────
const io = new NodeIO()
  .registerExtensions(KHRONOS_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read('public/models/citta.glb');
const meshes: Mesh[] = [];
for (const node of doc.getRoot().listNodes()) {
  if (node.getName() !== 'Citta') continue;
  for (const prim of node.getMesh()?.listPrimitives() ?? []) {
    const pos = prim.getAttribute('POSITION'); const idx = prim.getIndices();
    if (!pos) continue;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos.getArray() as Float32Array, 3));
    if (idx) g.setIndex(new BufferAttribute(idx.getArray() as Uint32Array, 1));
    g.boundsTree = new MeshBVH(g);
    meshes.push(new Mesh(g, new MeshBasicMaterial({ side: DoubleSide })));
  }
}
if (meshes.length === 0) throw new Error('citta.glb: nodo "Citta" non trovato');

const caster = new Raycaster();
caster.firstHitOnly = true;
/** Quota da cui parte il raggio per le strade a terra: sotto il viadotto
 *  della superstrada (~1.1), sopra la collina più alta attraversata da strade. */
const GROUND_PROBE = 0.9;
function heightAt(x: number, z: number, from = 20): number | null {
  caster.ray = new Ray(new Vector3(x, from, z), new Vector3(0, -1, 0));
  const hit = caster.intersectObjects(meshes, false)[0];
  return hit ? hit.point.y : null;
}

// ── 3. Strade campionate ──────────────────────────────────────────────────────
interface RoadOut { from: TerritoryId; to: TerritoryId; elevated: boolean; points: number[] }
const roads: RoadOut[] = [];
const seen = new Set<string>();
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

for (const a of ids) {
  for (const b of TERRITORY_DEFINITIONS[a].connections) {
    const key = [a, b].sort().join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    const elevated = (a === ELEVATED[0] && b === ELEVATED[1]) || (a === ELEVATED[1] && b === ELEVATED[0]);
    const pts = route(TPOS.get(a)!, TPOS.get(b)!, elevated ? new Set(ids) : new Set([a, b]));
    const flat: number[] = [];
    for (const p of sample(pts, STEP)) {
      const y = heightAt(p.x, p.y, elevated ? 20 : GROUND_PROBE);
      if (y === null) throw new Error(`Nessuna superficie sotto la strada ${key} in (${p.x}, ${p.y})`);
      flat.push(r3(p.x), r3(y), r3(p.y));
    }
    roads.push({ from: a, to: b, elevated, points: flat });
  }
}

const top = heightAt(LIGHTHOUSE_XZ[0], LIGHTHOUSE_XZ[1]);
if (top === null) throw new Error('Faro non trovato');

writeFileSync('src/data/traffic.json', JSON.stringify({
  step: STEP,
  lighthouse: { x: LIGHTHOUSE_XZ[0], y: r3(top - LANTERN_BELOW_TOP), z: LIGHTHOUSE_XZ[1] },
  roads,
}) + '\n');

const total = roads.reduce((s, r) => s + r.points.length / 3, 0);
console.log(`traffic.json: ${roads.length} strade, ${total} campioni, faro a y=${r3(top)}`);
