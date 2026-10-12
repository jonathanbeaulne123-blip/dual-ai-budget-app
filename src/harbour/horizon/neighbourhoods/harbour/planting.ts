/**
 * Little Harbour's hillside (SPEC §9; STYLE §2.1 planting): dry-stone terrace walls along the contour with an olive
 * below most of them, stone pines on the ridges, cypress (two framing the campanile), and low Mediterranean drifts
 * (lavender rows) along the walls. Tree cover stays ≤ 5 % of the unbuilt ground; nothing
 * grows on a bed, pad, stair or skate line; nothing over 6 eu stands in page A's dam corridor.
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import type { BuildingRecord, DressingContext, DressingSpecies, PlantRecord, PropRecord } from '../types.ts';
import { pointInPolygon } from '../../world/geometry.ts';
import { SPECIES_HEIGHT } from '../bake.ts';
import { CAMPANILE, CYPRESSES, DAM_LINE, HILLSIDE, STONE_PINES, damAcross, untouched } from './plan.ts';

/** Crown radius at scale 1 (plan, eu) for the cover measure (the prototype's CR and canopy discs). */
export const CROWN: Partial<Record<DressingSpecies, number>> = { olive: 1.6, stonePine: 3.6, cypress: 1.2 };
export const TERRACES = { tries: 900, walls: 50, slope: [0.1, 0.75] as const, minGround: 3, bedClear: 6, houseClear: 4, campanileClear: 8, length: [6, 9] as const, oliveShare: 0.8, oliveDown: 2.2 } as const;

const slopeAt = (ctx: DressingContext, x: number, z: number) => { const gx = (ctx.heightAt(x + 1, z) - ctx.heightAt(x - 1, z)) / 2, gz = (ctx.heightAt(x, z + 1) - ctx.heightAt(x, z - 1)) / 2; return { s: Math.hypot(gx, gz), gx, gz }; };

export interface Hillside { plants: PlantRecord[]; props: PropRecord[] }
export function plantHillside(ctx: DressingContext, buildings: readonly BuildingRecord[]): Hillside {
  const plants: PlantRecord[] = [], props: PropRecord[] = [];
  const nearHouse = (x: number, z: number, m: number) => buildings.some(b => Math.hypot(b.at[0] - x, b.at[2] - z) < Math.max(b.size.w, b.size.d) / 2 + m);
  const tallOk = (sp: DressingSpecies, scale: number, x: number, z: number) => (SPECIES_HEIGHT[sp] ?? 10) * scale <= DAM_LINE.maxHeight || damAcross(x, z) > DAM_LINE.halfWidth + (CROWN[sp] ?? 1) * scale + 0.5;
  const plantOk = (x: number, z: number, m = 0.4) => !untouched(x, z, m, ctx.onPad) && !ctx.occupied(x, z, m) && ctx.bedClearance(x, z) > m && (ctx.onPad?.(x, z, m) ?? null) === null;

  // Olive terraces (SPEC §9): walls along the contour, an olive 2.2 eu downhill of four in five.
  const rnd = ctx.rng('harbour.terraces');
  let walls = 0;
  for (let i = 0; i < TERRACES.tries && walls < TERRACES.walls; i++) {
    const x = 1360 + rnd() * 200, z = 1035 + rnd() * 280;
    if (!pointInPolygon(x, z, HILLSIDE as Point2[])) continue;
    const { s, gx, gz } = slopeAt(ctx, x, z), g = ctx.heightAt(x, z);
    if (s < TERRACES.slope[0] || s > TERRACES.slope[1] || g < TERRACES.minGround || ctx.bedClearance(x, z) < TERRACES.bedClear || nearHouse(x, z, TERRACES.houseClear) || Math.hypot(x - CAMPANILE.at[0], z - CAMPANILE.at[1]) < TERRACES.campanileClear) continue;
    const L = Math.hypot(gx, gz) || 1, dir: Point2 = [-gz / L, gx / L], len = TERRACES.length[0] + rnd() * (TERRACES.length[1] - TERRACES.length[0]);
    const line: Point3[] = [-0.5, 0, 0.5].map(t => { const px = x + dir[0] * len * t, pz = z + dir[1] * len * t; return [px, ctx.heightAt(px, pz), pz]; });
    if (line.some(p => !plantOk(p[0], p[2], 0.6) || nearHouse(p[0], p[2], 1.5))) { rnd(); continue; }
    props.push({ id: `terrace.${walls}`, kind: 'drystoneWall', at: line[1]!, yaw: Math.atan2(-dir[1], dir[0]), line, collide: true });
    walls++;
    // An olive below four walls in five; the others carry a row of lavender along their foot (STYLE §1.4.1 rule 4: one
    // species per drift, never confetti).
    const olive = rnd() < TERRACES.oliveShare, sc = 0.9 + rnd() * 0.4;
    if (olive) {
      const ox = x - gx / L * TERRACES.oliveDown, oz = z - gz / L * TERRACES.oliveDown;
      if (plantOk(ox, oz) && tallOk('olive', sc, ox, oz) && !nearHouse(ox, oz, 1.5)) plants.push({ species: 'olive', at: [ox, ctx.heightAt(ox, oz), oz], scale: sc, yaw: (i * 2.39996) % 6.2832, tint: rnd() });
    }
    const sp: DressingSpecies | null = !olive ? 'heath' : null, n = 4;
    if (sp) for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5, px = x + dir[0] * len * t * 0.85 + gx / L * 0.9, pz = z + dir[1] * len * t * 0.85 + gz / L * 0.9;
      if (plantOk(px, pz)) plants.push({ species: sp, at: [px, ctx.heightAt(px, pz), pz], scale: sp === 'heath' ? 1.1 : 0.8, yaw: (k * 1.7 + walls) % 6.2832, tint: (k * 0.31 + walls * 0.17) % 1 });
    }
  }
  // Stone pines on the ridges (bed clearance > 7) and cypress (two framing the campanile).
  STONE_PINES.forEach(([x, z, sc]) => { if (ctx.bedClearance(x, z) > 7 && plantOk(x, z, 1) && tallOk('stonePine', sc, x, z) && !nearHouse(x, z, 2)) plants.push({ species: 'stonePine', at: [x, ctx.heightAt(x, z), z], scale: sc, yaw: x % 6.2832, keep: true }); });
  CYPRESSES.forEach(([x, z], i) => { if (ctx.bedClearance(x, z) > 4 && plantOk(x, z, 0.8) && tallOk('cypress', 1.05, x, z) && !nearHouse(x, z, 1.5)) plants.push({ species: 'cypress', at: [x, ctx.heightAt(x, z), z], scale: 1.05, yaw: i * 1.3, keep: i < 2 }); });
  // Two alders by the river link's foot (SPEC §9: birch at 0.62 stands in for alder).
  ([[1507, 1258], [1509, 1250]] as Point2[]).forEach(([x, z], i) => { if (plantOk(x, z, 0.8) && !nearHouse(x, z, 1.5)) plants.push({ species: 'birch', at: [x, ctx.heightAt(x, z), z], scale: 0.62, yaw: i * 2.1 + 0.4 }); });
  return { plants, props };
}
