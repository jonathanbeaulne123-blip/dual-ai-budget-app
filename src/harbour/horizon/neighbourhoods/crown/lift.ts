/**
 * The Highlands drag lift (MANIFEST `structures.glacierLift`, D-WW56, RULINGS 5): structure now, the ride in PR 5. The land
 * built two level threshold pads on their walks (the foot on the Twin Tarns shelf, the head on the hamlet lane at Orchard
 * Bench) and fixed the two tower points; this dresses them — the towers (`liftTower`, crossarm across the line, sheaves at
 * the cable offset), a station hut at each end whose bull wheel stands on the line's axis (`liftStation`), and the haul rope
 * with its T-bars as two linear props (the prop kit's festoon, variant 1: a bare cable, the T-bars hanging from the up side).
 * Every piece is placed from the one definition (the manifest), on free ground off the pads and walks.
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import type { BuildingRecord, PropRecord } from '../types.ts';
import { HORIZON_MANIFEST } from '../../world/manifest.ts';
import { findSite, local, P3, round, type Rect, type Site } from './site.ts';

interface LiftDef { from: Point2; to: Point2; towers: Point2[]; towerHeight_m: number; cableOffset_m: number; stations: { bottom: { xy: Point2; on: string; hut_m: [number, number] }; top: { xy: Point2; on: string; hut_m: [number, number] } } }
export const LIFT = (HORIZON_MANIFEST as unknown as { structures: { glacierLift: LiftDef } }).structures.glacierLift;
/** The threshold pads are 6 × 5 (land), axis-aligned. */
const PAD = { hx: 3, hz: 2.5 } as const;

export function lift(site: Site): { buildings: BuildingRecord[]; props: PropRecord[] } {
  const { h } = site, [fx, fz] = LIFT.from, [tx, tz] = LIFT.to, len = Math.hypot(tx - fx, tz - fz), dir: Point2 = [(tx - fx) / len, (tz - fz) / len];
  const yaw = Math.atan2(dir[0], dir[1]), across: Point2 = [dir[1], -dir[0]];   // local +x of a record at `yaw`
  const buildings: BuildingRecord[] = [], props: PropRecord[] = [];
  // The lift corridor first: nothing within 4 m of the line (the T-bars and the riders pass under the rope).
  for (let s = 0; s <= len; s += 4) site.claim({ x: fx + dir[0] * s, z: fz + dir[1] * s, hx: 4, hz: 2.5, yaw }, 'clearing');
  for (const p of [LIFT.from, LIFT.to]) site.claim({ x: p[0], z: p[1], hx: PAD.hx, hz: PAD.hz, yaw: 0 }, 'clearing');
  // A station at each end: the hut on the axis beyond its pad, its line-side wall (+z) toward the pad, so its bull wheel (1.1 m
  // out from that wall, kit/buildings/crown.ts) is the rope's turn. If the axis is taken (a walk leaves the pad that way), the
  // hut stands beside the pad and a short wheel pylon carries the turn at the pad's back edge.
  const ends: Point3[] = [];
  for (const [k, end, sign] of [['foot', LIFT.from, -1], ['head', LIFT.to, 1]] as const) {
    const [w, d] = (k === 'foot' ? LIFT.stations.bottom : LIFT.stations.top).hut_m, hutYaw = sign < 0 ? yaw : yaw + Math.PI;
    let placed: { rect: Rect; floor: number } | null = null;
    for (let s = PAD.hz + d / 2 + 1.6; s <= PAD.hz + d / 2 + 6 && !placed; s += .5) {
      const x = end[0] + dir[0] * sign * s, z = end[1] + dir[1] * sign * s, rect: Rect = { x, z, hx: w / 2, hz: d / 2, yaw: hutYaw };
      const span = site.groundSpan(rect);
      if (span.max - span.min <= 1.6 && site.rectFree({ ...rect, hx: rect.hx + .6, hz: rect.hz + .6 }, .2)) placed = { rect, floor: span.max + .06 };
    }
    if (placed) {
      const r = placed.rect;
      buildings.push({ id: `lift.${k}.station`, districtId: '', kind: 'liftStation', style: 'crown.croft', at: P3(r.x, placed.floor, r.z), yaw: round(r.yaw, 1e4), size: { w, d, h: 2.6 }, roof: { form: 'gable', pitch: 30, overhang: .5, material: 'slate' }, collide: true });
      site.claim(r, 'building');
      const [wx, wz] = local(r.x, r.z, r.yaw, 0, r.hz + 1.1);
      ends.push([wx, placed.floor + 2.35, wz]);
      continue;
    }
    // Beside the pad: the best free, flat site within 12 m, facing its walk (the solver's rule); the wheel pylon carries the turn.
    const on = (k === 'foot' ? LIFT.stations.bottom : LIFT.stations.top).on;
    const beside = findSite(site, { around: end, radius: 12, w, d, lanes: [on], front: [.8, 6], maxSpan: 1.6, margin: .6, avoid: [{ x: end[0], z: end[1], hx: PAD.hx, hz: PAD.hz, yaw: 0 }], gap: 1.5 });
    if (beside) {
      const r = beside.rect;
      buildings.push({ id: `lift.${k}.station`, districtId: '', kind: 'liftStation', style: 'crown.croft', at: P3(r.x, beside.floor, r.z), yaw: round(r.yaw, 1e4), size: { w, d, h: 2.6 }, roof: { form: 'gable', pitch: 30, overhang: .5, material: 'slate' }, collide: true });
      site.claim(r, 'building');
    }
    const px = end[0] + dir[0] * sign * (PAD.hz - .5), pz = end[1] + dir[1] * sign * (PAD.hz - .5), g = h(px, pz);
    buildings.push({ id: `lift.${k}.wheel`, districtId: '', kind: 'liftTower', style: 'crown.croft', at: P3(px, g, pz), yaw: round(yaw, 1e4), size: { w: LIFT.cableOffset_m * 2 + .4, d: .8, h: 3.4 }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'steel' }, collide: true });
    ends.push([px, g + 3.4 - .35, pz]);
  }
  // The towers on the manifest's points: crossarm across the line, sheaves at the cable offset (arm = 2 × offset + 0.4).
  const tops: Point3[] = [];
  LIFT.towers.forEach(([x, z], i) => {
    const g = h(x, z);
    buildings.push({ id: `lift.tower.${i + 1}`, districtId: '', kind: 'liftTower', style: 'crown.croft', at: P3(x, g, z), yaw: round(yaw, 1e4), size: { w: LIFT.cableOffset_m * 2 + .4, d: .8, h: LIFT.towerHeight_m }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'steel' }, collide: true });
    site.claim({ x, z, hx: 1.2, hz: 1.2, yaw }, 'building');
    tops.push([x, g + LIFT.towerHeight_m - .35, z]);
  });
  // The rope: up side (+across, the T-bars) and down side, foot wheel → towers → head wheel.
  const path = [ends[0]!, ...tops, ends[1]!];
  for (const [side, name] of [[1, 'up'], [-1, 'down']] as const) {
    const line = path.map(p => P3(p[0] + across[0] * side * LIFT.cableOffset_m, p[1], p[2] + across[1] * side * LIFT.cableOffset_m));
    props.push({ id: `lift.rope.${name}`, kind: 'festoon', at: line[0]!, yaw: round(yaw, 1e4), line, variant: side > 0 ? 1 : 2, collide: false });
  }
  return { buildings, props };
}
