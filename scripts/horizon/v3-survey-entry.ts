// Mountain V3 site survey (dev tool, bundled by scripts/horizon/v3-survey.mjs). Classifies Horizon points by ground owner
// (D-M1/D-M2 rule), reports the Horizon base height, v2's own height, and every bed / water / solid within a radius.
import { mountainV2Rule } from '../../src/harbour/horizon/land/mountainV2/ground';
import { baseHeight } from '../../src/harbour/horizon/land/terrain/index';
import { HORIZON_MANIFEST as M } from '../../src/harbour/horizon/world/manifest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

export function survey(points: [number, number][], radius = 25) {
  const world = JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.json.gz')).toString()) as {
    beds: { id: string; kind: string; width: number; points: number[][] }[];
    water: { id: string; kind: string; level?: number; outline?: number[][] }[];
    geometry: { solids: { id: string; kind: string; positions: number[]; walkable: boolean }[] };
  };
  const near = (pts: number[][], x: number, z: number) => { let d = Infinity, y = 0; for (const p of pts) { const e = Math.hypot(p[0]! - x, p[2]! - z); if (e < d) { d = e; y = p[1]!; } } return { d, y }; };
  const rows = points.map(([x, z]) => {
    const rule = mountainV2Rule(x, z), h = baseHeight(x, z);
    const beds = world.beds.map(b => ({ id: b.id, kind: b.kind, w: b.width, ...near(b.points, x, z) })).filter(b => b.d < radius).sort((a, b) => a.d - b.d).slice(0, 6);
    const solids = world.geometry.solids.map(s => { let d = Infinity, y = 0; for (let i = 0; i < s.positions.length; i += 3) { const e = Math.hypot(s.positions[i]! - x, s.positions[i + 2]! - z); if (e < d) { d = e; y = s.positions[i + 1]!; } } return { id: s.id, kind: s.kind, d, y }; }).filter(s => s.d < radius).sort((a, b) => a.d - b.d).slice(0, 6);
    return { x, z, owner: rule.kind, north: rule.north, v2: rule.v2 === null ? null : +rule.v2.toFixed(1), horizon: +h.toFixed(1), beds: beds.map(b => `${b.id}(${b.kind} w${b.w} d${b.d.toFixed(0)} y${b.y.toFixed(0)})`), solids: solids.map(s => `${s.id}(${s.kind} d${s.d.toFixed(0)} y${s.y.toFixed(0)})`) };
  });
  return rows;
}
export const landforms = M.landforms.map(f => ({ id: f.id, h: f.h, poly: f.poly, summit: f.summit, summitH: f.summitH }));
/** A base-height grid (before beds) over a crop, for quick landform iteration (scripts/horizon/v3-survey.mjs --grid). */
export function grid(x0: number, x1: number, z0: number, z1: number, step: number) {
  const cols = Math.round((x1 - x0) / step) + 1, rows = Math.round((z1 - z0) / step) + 1, out = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out[j * cols + i] = baseHeight(x0 + i * step, z0 + j * step);
  return { x0, z0, step, cols, rows, heights: Array.from(out) };
}
