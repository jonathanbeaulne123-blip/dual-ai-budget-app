/**
 * Corridor lamps as `WorldDefinition.lights` anchors (ROAD.md §6; LIGHT §3; STYLE §1.11). Pure and deterministic.
 *
 * Each LampSpot becomes one anchor: `at` the base, `head` the lamp head, `pool` where its light lands, `poolRadius`, the
 * corridor id, and its switching run: `line` = `<corridor>:<reach>` and `order` = its rank along that run by arc length
 * (increasing `s`, the corridor's point order), so a run comes on in sequence (runtime/roadLights.ts) and never all at once.
 * A reach that wraps a closed corridor's seam (from > to) orders across the seam.
 */
import type { LightAnchor, Point3 } from '../../world/definition.ts';
import type { Corridor, CorridorStation } from './types.ts';

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
