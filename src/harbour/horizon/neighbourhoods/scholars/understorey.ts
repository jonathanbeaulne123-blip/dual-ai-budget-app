/**
 * Scholars' Edge: the woodland floor (protos/scholars SPEC "Understorey", thinned for the district budget). Ostrich fern
 * clumps in the damp hollows (fbm > −0.05) and in the glades; woodland drifts (the `woodland` flower set: white
 * trillium, wild columbine, foxglove — wild on the duff, never edged; D-WW171) scattered under the canopy and in the
 * glades; foxglove drifts along the garden walk, the cove walk and the lookout spur, 2–4 m off the tread. Moss and
 * needles are ground paint (index.ts) over the terrain's own duff; never turf. Logs, stumps and boulders are not in the
 * prop kit (owed); the prototype's mist and light-shaft cards are runtime effects (owed).
 */
import type { Point2 } from '../../world/definition.ts';
import { FLOWER_SET } from '../../kit/plants/sets.ts';
import type { DressingContext, PlantRecord } from '../types.ts';
import { LOOKOUT_EYE, SPUR_LINE, WOODS_C, GLADES, inLibrary, onTerrace } from './frame.ts';
import { DISTRICT } from './woods.ts';
import { fbm } from './noise.ts';

/** Drift caps per place (a woodland drift costs ~340 / 210 triangles full / lite, and lite keeps every drift). */
export const UNDERSTOREY = { scatter: 760, radius: 128, gladeTries: 16, walkStep: 9, drifts: { walk: 6, glade: 3, scatter: 3 } } as const;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function plantUnderstorey(ctx: DressingContext): PlantRecord[] {
  const rnd = ctx.rng('scholars.understorey'), out: PlantRecord[] = [];
  const drifts = { walk: 0, glade: 0, scatter: 0 };
  const ok = (x: number, z: number, clear: number) => ctx.districtAt(x, z) === DISTRICT && ctx.heightAt(x, z) > 30 && !ctx.occupied(x, z, clear)
    && !inLibrary(x, z, 1.5) && !onTerrace(x, z, 0.8) && Math.hypot(x - LOOKOUT_EYE[0], z - LOOKOUT_EYE[2]) > 7;
  const fern = (x: number, z: number, s: number) => out.push({ species: 'fern', at: [r3(x), r3(ctx.heightAt(x, z)), r3(z)], scale: r3(s), yaw: r3(rnd() * Math.PI * 2), tint: r3(rnd()) });
  const drift = (where: keyof typeof drifts, x: number, z: number, s: number, yaw: number) => { if (drifts[where] >= UNDERSTOREY.drifts[where]) return; drifts[where]++; out.push({ species: 'flowerBed', at: [r3(x), r3(ctx.heightAt(x, z)), r3(z)], scale: r3(s), yaw: r3(yaw), tint: r3(FLOWER_SET.woodland + 0.02 + rnd() * 0.96) }); };
  // Foxglove along the walks (June), the spur included.
  const walks: Point2[][] = ctx.beds.filter(b => b.id === 'walk garden' || b.id === 'walk coveWalk').map(b => b.points.map(p => [p[0], p[2]] as Point2));
  walks.push([...SPUR_LINE.slice(0, 4)]);
  for (const line of walks) {
    let acc = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!, b = line[i]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-6) continue;
      acc += len; if (acc < UNDERSTOREY.walkStep) continue; acc = 0;
      const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len, side = rnd() < 0.5 ? -1 : 1, off = 3 + rnd() * 1.8, x = b[0] + nx * off * side, z = b[1] + nz * off * side;
      if (Math.hypot(x - WOODS_C[0], z - WOODS_C[1]) > 150 || !ok(x, z, 0.9) || rnd() > 0.8) continue;
      drift('walk', x, z, 0.8, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    }
  }
  // The glades: ferns and a drift or two.
  for (const [gx, gz, r] of GLADES) for (let k = 0; k < UNDERSTOREY.gladeTries; k++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r * 1.15, x = gx + Math.cos(a) * rr, z = gz + Math.sin(a) * rr, t = rnd(), s = 0.8 + rnd() * 0.6;
    if (!ok(x, z, 1.5)) continue;
    if (t < 0.6) fern(x, z, s); else drift('glade', x, z, 0.7 + rnd() * 0.3, rnd() * Math.PI * 2);
  }
  // Under the canopy: fern clumps where damp, the odd drift where not.
  for (let k = 0; k < UNDERSTOREY.scatter; k++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * UNDERSTOREY.radius, x = WOODS_C[0] + Math.cos(a) * rr, z = WOODS_C[1] + Math.sin(a) * rr, t = rnd(), s = 0.7 + rnd() * 0.7;
    if (!ok(x, z, 2.2)) continue;
    const damp = fbm(x * 0.04, z * 0.04);
    if (damp > -0.05 && t < 0.5) { for (let q = 0; q < 3; q++) { const fx = x + (rnd() - 0.5) * 2.4, fz = z + (rnd() - 0.5) * 2.4; if (ok(fx, fz, 1.2)) fern(fx, fz, s * (0.8 + rnd() * 0.4)); } }
    else if (t < 0.6) drift('scatter', x, z, 0.75 + rnd() * 0.3, rnd() * Math.PI * 2);
  }
  return out;
}
