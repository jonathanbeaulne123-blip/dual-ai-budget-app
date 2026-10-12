/**
 * Little Harbour's built town (SPEC §2–§6, §8): the solved row houses with the prototype's massing rules, the two hosts
 * re-dressed on their baked shells (the Fund bank as the palazzo, Our home as the pink villa), the campanile, laundry
 * strung across the narrowest lanes, and the plants that belong to a house (bougainvillea up a corner, lemon pots by the
 * door). Deterministic: every per-house draw comes from `ctx.rng` streams named by the house id.
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import type { BuildingRecord, DressingContext, PlantRecord, PropRecord } from '../types.ts';
import { HORIZON_MANIFEST } from '../../world/manifest.ts';
import { CAMPANILE, WEST_FRAME } from './plan.ts';
import { corners, solveRowHouses, type Footprint, type Slot } from './solver.ts';

export const STYLE = 'harbour.ligurian';
/** The host roof slab's thickness in the bake (host.<id>.roof sits from the wall top to roofH_eu). */
export const HOST_ROOF_SLAB = 0.35;
/** SPEC §2: the ground floor 3.7, each upper storey 3.0, a little jitter. */
export const wallHeight = (storeys: number, r: number) => 3.7 + (storeys - 1) * 3 + r * 0.4;
/** A house's front-face centre on the ground line and its outward normal (local +z). */
export function frontOf(b: Pick<BuildingRecord, 'at' | 'yaw' | 'size'>): { at: Point2; n: Point2 } {
  const n: Point2 = [Math.sin(b.yaw), Math.cos(b.yaw)];
  return { at: [b.at[0] + n[0] * b.size.d / 2, b.at[2] + n[1] * b.size.d / 2], n };
}
/** Local (u along the front, v outward from the front face) → world plan. */
export function onFront(b: Pick<BuildingRecord, 'at' | 'yaw' | 'size'>, u: number, v: number): Point2 {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw), lz = b.size.d / 2 + v;
  return [b.at[0] + u * c + lz * s, b.at[2] + lz * c - u * s];
}

/** The campanile's footprint (reserved before the solver runs). */
export const campanileFootprint = (): Footprint => ({ cx: CAMPANILE.at[0], cz: CAMPANILE.at[1], w: CAMPANILE.side + 0.6, d: CAMPANILE.side + 0.6, yaw: 0 });

export interface Town { slots: Slot[]; buildings: BuildingRecord[]; plants: PlantRecord[]; props: PropRecord[] }

export function buildTown(ctx: DressingContext): Town {
  const buildings: BuildingRecord[] = [], plants: PlantRecord[] = [], props: PropRecord[] = [];
  const district = (x: number, z: number) => ctx.districtAt(x, z);

  // The campanile (SPEC §6; story registry): door to the square (east), shaft on a plinth to the lowest ground, apex 42.3.
  const shaft = CAMPANILE.apex - CAMPANILE.floor - (CAMPANILE.belfryH + 0.4 + CAMPANILE.capRise);
  buildings.push({ id: 'campanile', districtId: district(CAMPANILE.at[0], CAMPANILE.at[1]), kind: 'campanile', style: STYLE, at: [CAMPANILE.at[0], CAMPANILE.floor, CAMPANILE.at[1]], yaw: Math.PI / 2,
    size: { w: CAMPANILE.side, d: CAMPANILE.side, h: shaft }, roof: { form: 'pyramid', pitch: 45, overhang: 0.25, material: 'tile' }, door: { face: 'front', u: 0 },
    params: { belfryH: CAMPANILE.belfryH, capRise: CAMPANILE.capRise, archHalf: 1.1, belfryOpen: true }, collide: true, landmarkId: 'campanile' });

  // The two hosts on their baked shells (bake rule 3: footprint within 0.6, floor and eave within 0.35, no collider).
  for (const id of ['bank', 'home'] as const) {
    const shell = ctx.hosts.find(h => h.id === id);
    if (!shell?.footprint) continue;
    const xs = shell.footprint.map(p => p[0]), zs = shell.footprint.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const ex = Math.max(...xs) - Math.min(...xs), ez = Math.max(...zs) - Math.min(...zs), floor = shell.height ?? 0;
    const door = shell.door.xy ?? [cx, cz + ez / 2];
    // Face the door: the yaw whose local +z points from the centre to the door's wall.
    const dx = door[0] - cx, dz = door[1] - cz, yaw = Math.abs(dx) / ex > Math.abs(dz) / ez ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI);
    const across = Math.abs(Math.sin(yaw)) > 0.5, w = across ? ez : ex, d = across ? ex : ez;
    // The baked walls stop under the host's roof slab: eave = MANIFEST roofH_eu − the slab's 0.35 (world/build.ts host shells).
    const eave = (HORIZON_MANIFEST.hosts.find(h => h.id === id) as unknown as { roofH_eu: number }).roofH_eu - HOST_ROOF_SLAB;
    buildings.push(id === 'bank'
      ? { id: 'bank', districtId: district(cx, cz), kind: 'palazzo', style: STYLE, at: [cx, floor, cz], yaw, size: { w, d, h: eave }, roof: { form: 'hip', pitch: 18, overhang: 0.7, material: 'tile' }, storeys: 2, door: { face: 'front', u: 0 }, params: { arcades: 3 }, collide: false, hostId: 'bank' }
      : { id: 'home', districtId: district(cx, cz), kind: 'villa', style: STYLE, at: [cx, floor, cz], yaw, size: { w, d, h: eave }, roof: { form: 'hip', pitch: 22, overhang: 0.6, material: 'tile' }, storeys: 2, door: { face: 'front', u: 0 }, params: { kitchenFace: kitchenFace(yaw) }, collide: false, hostId: 'home' });
  }

  // The row houses (SPEC §1–§3).
  const slots = solveRowHouses(ctx, { reserved: [campanileFootprint()] });
  slots.forEach((s, i) => {
    const r = ctx.rng(`harbour.row.${s.id}`)(), k = i + 5;
    const west = s.cx >= WEST_FRAME.x0 && s.cx <= WEST_FRAME.x1 && s.cz >= WEST_FRAME.z0 && s.cz <= WEST_FRAME.z1;
    const storeys = Math.min(west ? WEST_FRAME.storeys : 5, s.tier === 4 ? (r < 0.5 ? 3 : 4) : r < 0.25 ? 4 : r < 0.85 ? 3 : 2);
    const altana = k % 6 === 4, shop = s.tier !== 4 ? r > 0.15 : r > 0.4;
    const b: BuildingRecord = { id: s.id, districtId: district(s.cx, s.cz), kind: 'rowHouse', style: STYLE, at: [s.cx, s.floor, s.cz], yaw: s.yaw,
      size: { w: s.w, d: s.d, h: wallHeight(storeys, r) }, roof: { form: altana ? 'flat' : 'gable', pitch: 22, overhang: 0.75, material: 'tile' }, storeys,
      door: { face: 'front', u: -s.w / 2 + 1.4 }, paint: (k * 7 + 2) % 12, params: { altana, shop, chimney: !altana && k % 2 === 0, tier: s.tier }, collide: true };
    buildings.push(b);
    // Bougainvillea up the right-hand front corner on one house in four (SPEC §3).
    if (k % 4 === 2) { const p = onFront(b, s.w / 2 - 0.45, 0.35); plants.push({ species: 'bougainvillea', at: [p[0], s.floor, p[1]], scale: 0.75 + 0.1 * (k % 3), yaw: s.yaw, tint: 0.3 }); }
    // A lemon pot by one shop door in three (SPEC §3 had 1–3 a house; the district's lite budget, D-WW134).
    if (shop && k % 3 === 0) { const q = onFront(b, s.w / 2 - 0.7, 0.5); plants.push({ species: 'lemonPot', at: [q[0], s.floor, q[1]], scale: 0.9 + 0.1 * (k % 3), yaw: (k * 1.7) % 6.283 }); }
  });

  props.push(...laundry(buildings.filter(b => b.kind === 'rowHouse'), ctx));
  return { slots, buildings, plants, props };
}

/** Our home's kitchen window faces the dam (north): the face whose outward normal points to −z. */
function kitchenFace(yaw: number): 'front' | 'back' | 'left' | 'right' {
  const c = Math.cos(yaw), s = Math.sin(yaw), faces = { front: [s, c], back: [-s, -c], right: [c, -s], left: [-c, s] } as const;
  return (Object.entries(faces) as [keyof typeof faces, readonly [number, number]][]).reduce((best, f) => (f[1][1] < best[1][1] ? f : best))[0];
}

/**
 * Laundry strung between facing fronts across the narrowest lanes (SPEC §8): fronts 5–11 eu apart and facing each other
 * (dot < −0.85), nearest first with a small jitter, each front used once, at most 20 lines, the line 2.6 below the lower
 * eave and never under the first floor's sill + 4.5.
 */
export function laundry(rows: readonly BuildingRecord[], ctx: DressingContext): PropRecord[] {
  const jitter = ctx.rng('harbour.laundry'), fronts = rows.map(b => ({ b, f: frontOf(b), top: b.at[1] + b.size.h, floor: b.at[1] }));
  const pairs: [number, number, number][] = [];
  for (let a = 0; a < fronts.length; a++) for (let c = a + 1; c < fronts.length; c++) {
    const A = fronts[a]!, B = fronts[c]!, d = Math.hypot(A.f.at[0] - B.f.at[0], A.f.at[1] - B.f.at[1]), facing = A.f.n[0] * B.f.n[0] + A.f.n[1] * B.f.n[1];
    if (d >= 5 && d <= 11 && facing < -0.85) pairs.push([d, a, c]);
  }
  pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const keyed = pairs.map(p => [p[0] + jitter() * 2, p[1], p[2]] as [number, number, number]).sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const used = new Set<number>(), out: PropRecord[] = [];
  for (const [, a, c] of keyed) {
    if (out.length >= 20 || used.has(a) || used.has(c)) continue;
    const A = fronts[a]!, B = fronts[c]!, y = Math.min(A.top, B.top) - 2.6;
    if (y < Math.max(A.floor, B.floor) + 4.5) continue;
    used.add(a); used.add(c);
    // Fix the line 0.1 off each wall (on the wall's face, not inside it).
    const pa: Point3 = [A.f.at[0] + A.f.n[0] * 0.1, y, A.f.at[1] + A.f.n[1] * 0.1], pb: Point3 = [B.f.at[0] + B.f.n[0] * 0.1, y, B.f.at[1] + B.f.n[1] * 0.1];
    out.push({ id: `laundry.${out.length}`, kind: 'laundryLine', at: [(pa[0] + pb[0]) / 2, y, (pa[2] + pb[2]) / 2], yaw: Math.atan2(-(pb[2] - pa[2]), pb[0] - pa[0]), line: [pa, pb], collide: false });
  }
  return out;
}

/** Every built footprint as a corner quad (for clearance tests and the planting). */
export const footprintQuads = (bs: readonly BuildingRecord[], grow = 0) => bs.map(b => corners({ cx: b.at[0], cz: b.at[2], w: b.size.w, d: b.size.d, yaw: b.yaw }, grow));
