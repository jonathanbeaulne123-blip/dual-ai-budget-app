// STUB — replaced by E2/E3 at integration
/**
 * Temporary stand-in for the building grammar (E2, `kit/buildings/**`) so the dressing engine (E1) compiles and its tests
 * run. Integration takes E2's real file. Only the signatures are load-bearing: a plain box with a gable or flat roof, one
 * window band in the card kit's `glow` bucket, one box collider, and a rectangle for the Journey map.
 */
import type {CardBuilder} from '../../../art/cardScene.ts';
import {rgb, shade} from '../../../art/cardScene.ts';
import type {StructureSolid} from '../../land/interfaces.ts';
import type {BuildingRecord, DressingTheme} from '../../neighbourhoods/types.ts';

export type CollisionPart =
  | { kind: 'box'; centre: [number, number]; size: [number, number]; yaw: number; bottom: number; top: number; role: StructureSolid['role']; walkable: boolean; surface: string }
  | { kind: 'prism'; corners: [number, number, number][]; bottom: number; role: StructureSolid['role']; walkable: boolean; surface: string };

const WALL: Record<DressingTheme, string> = { classic: '#e3d6bd', taylor: '#f0e2c8', newfoundland: '#c9d4d2' };
const ROOF: Record<DressingTheme, string> = { classic: '#9a5b45', taylor: '#b8735a', newfoundland: '#5d6a70' };

function lowest(rec: BuildingRecord, ground: (x: number, z: number) => number): number {
  const c = Math.cos(rec.yaw), s = Math.sin(rec.yaw), hx = rec.size.w / 2, hz = rec.size.d / 2;
  let low = rec.at[1];
  for (const [lx, lz] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz], [0, 0]] as const) low = Math.min(low, ground(rec.at[0] + lx * c + lz * s, rec.at[2] + lz * c - lx * s));
  return low;
}
function roofRise(rec: BuildingRecord): number {
  if (rec.roof.form === 'flat' || rec.roof.form === 'none') return 0;
  return Math.tan(rec.roof.pitch * Math.PI / 180) * Math.min(rec.size.w, rec.size.d) / 2;
}

export function drawBuilding(b: CardBuilder, rec: BuildingRecord, theme: DressingTheme, ground: (x: number, z: number) => number, tier: 'full' | 'lite'): void {
  const [x, y, z] = rec.at, hx = rec.size.w / 2, hz = rec.size.d / 2, top = y + rec.size.h, wall = rgb(WALL[theme]), roof = rgb(ROOF[theme]);
  b.box(x, z, rec.yaw, hx, hz, lowest(rec, ground) - 0.2, top, shade(wall, 1.02), wall);
  const rise = roofRise(rec);
  if (rise > 0) b.gable(x, z, rec.yaw, hx, hz, top, rise, roof, wall, tier === 'full' ? 0.35 : 0.2);
  // One lit window band on the front face (local +z), a hair in front of the wall.
  const c = Math.cos(rec.yaw), s = Math.sin(rec.yaw), W = (lx: number, lz: number, h: number): [number, number, number] => [x + lx * c + lz * s, h, z + lz * c - lx * s];
  const wy0 = y + Math.min(1, rec.size.h * 0.3), wy1 = y + Math.min(2.2, rec.size.h * 0.7), f = hz + 0.03, w = hx * 0.5;
  b.glow(W(-w, f, wy0), W(w, f, wy0), W(w, f, wy1), W(-w, f, wy1), rgb('#ffd98e'));
}

export function buildingCollision(rec: BuildingRecord, ground: (x: number, z: number) => number): CollisionPart[] {
  return [{ kind: 'box', centre: [rec.at[0], rec.at[2]], size: [rec.size.w, rec.size.d], yaw: rec.yaw, bottom: lowest(rec, ground) - 0.2, top: rec.at[1] + rec.size.h + roofRise(rec), role: 'wall', walkable: false, surface: 'stucco' }];
}

export function buildingJourneyShape(rec: BuildingRecord): { footprint: [number, number][]; height: number; roofHeight: number } {
  const c = Math.cos(rec.yaw), s = Math.sin(rec.yaw), hx = rec.size.w / 2, hz = rec.size.d / 2;
  const footprint = ([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const).map(([lx, lz]) => [rec.at[0] + lx * c + lz * s, rec.at[2] + lz * c - lx * s] as [number, number]);
  return { footprint, height: rec.size.h, roofHeight: roofRise(rec) };
}
