/**
 * Corridor lamps as `WorldDefinition.lights` anchors (ROAD.md §6; LIGHT §3; STYLE §1.11). Pure and deterministic.
 *
 * Each LampSpot becomes one anchor: `at` the base, `head` the lamp head, `pool` where its light lands, `poolRadius`, the
 * corridor id, and its switching run: `line` = `<corridor>:<reach>` and `order` = its rank along that run by arc length
 * (increasing `s`, the corridor's point order), so a run comes on in sequence (runtime/roadLights.ts) and never all at once.
 * A reach that wraps a closed corridor's seam (from > to) orders across the seam.
 */
import type { LightAnchor, Point2, Point3 } from '../../world/definition.ts';
import type { Corridor, CorridorStation, LampSpot } from './types.ts';

/** Arc length of the station nearest (x, z), projected onto the segment to its neighbour; stations are in `s` order. */
export function stationS(stations: readonly CorridorStation[], x: number, z: number): number {
  if (!stations.length) return 0;
  let best = Infinity, s = 0;
  for (let i = 0; i < stations.length; i++) {
    const a = stations[i]!, b = stations[i + 1];
    if (!b) { const d = Math.hypot(x - a.at[0], z - a.at[2]); if (d < best) { best = d; s = a.s; } continue; }
    const dx = b.at[0] - a.at[0], dz = b.at[2] - a.at[2], l = dx * dx + dz * dz;
    const t = l > 0 ? Math.max(0, Math.min(1, ((x - a.at[0]) * dx + (z - a.at[2]) * dz) / l)) : 0;
    const d = Math.hypot(x - a.at[0] - dx * t, z - a.at[2] - dz * t);
    if (d < best) { best = d; s = a.s + (b.s - a.s) * t; }
  }
  return s;
}

export function corridorLightAnchors(corridors: readonly Corridor[]): LightAnchor[] {
  const out: LightAnchor[] = [];
  for (const c of corridors) {
    const last = c.stations.at(-1), length = last ? last.s + (c.closed ? c.step : 0) : 0;
    const rows = c.lamps.map((l, index) => {
      let s = stationS(c.stations, l.pool[0], l.pool[2]);
      const reach = c.reaches.find(r => r.id === l.reachId);
      if (c.closed && reach && reach.from > reach.to && s < reach.from) s += length;
      return { l, s, index, line: `${c.id}:${l.reachId}` };
    });
    rows.sort((a, b) => a.line < b.line ? -1 : a.line > b.line ? 1 : a.s - b.s || a.index - b.index);
    let line = '', order = 0;
    for (const row of rows) {
      if (row.line !== line) { line = row.line; order = 0; }
      const l = row.l;
      out.push({ id: l.id, at: copy(l.at), kind: l.kind, head: copy(l.head), pool: copy(l.pool), poolRadius: l.poolRadius, corridorId: c.id, line, order: order++ });
    }
  }
  return out;
}
const copy = (p: Point3): Point3 => [p[0], p[1], p[2]];

/** Static tier selection: bridge/tunnel lamps stay; a greedy cover retains a small set of
 * available road lamps needed by the named safety targets. Fixed stop fixtures may
 * cover a target too; an unlit full-tier target is an error, never a wider radius. */
export function selectLiteLamps(lamps:readonly LampSpot[],targets:readonly Point2[],fixed:readonly Pick<LampSpot,'pool'|'poolRadius'>[]=[]):string[]{
  const covers=targets.filter(p=>!fixed.some(l=>Math.hypot(p[0]-l.pool[0],p[1]-l.pool[2])<=l.poolRadius)).map(p=>{
    const distances=lamps.map(l=>Math.hypot(p[0]-l.pool[0],p[1]-l.pool[2]));
    return lamps.flatMap((l,i)=>distances[i]!<=l.poolRadius?[i]:[]);
  });
  const selected=new Set(lamps.flatMap((l,i)=>l.kind==='roadLantern'?[]:[i]));
  for(;;){
    const pending=covers.filter(c=>!c.some(i=>selected.has(i)));if(!pending.length)break;
    let best=-1,score=0;
    for(let i=0;i<lamps.length;i++){const n=pending.filter(c=>c.includes(i)).length;if(n>score){best=i;score=n;}}
    if(best<0)throw new Error('A required lamp target has no full-tier pool coverage');
    selected.add(best);
  }
  // Greedy cover can make an earlier choice redundant. Remove only road lamps;
  // bridge/tunnel fixtures and every still-needed pool stay in both tiers.
  for(const i of [...selected].reverse()){
    if(lamps[i]!.kind!=='roadLantern')continue;
    selected.delete(i);if(covers.some(c=>!c.some(j=>selected.has(j))))selected.add(i);
  }
  return lamps.filter((_,i)=>selected.has(i)).map(l=>l.id);
}
export function lampsForTier(c:Pick<Corridor,'lamps'|'liteLampIds'>,tier:'full'|'lite'):readonly LampSpot[]{
  if(tier==='full'||!c.liteLampIds)return c.lamps;
  const kept=new Set(c.liteLampIds);return c.lamps.filter(l=>kept.has(l.id));
}
