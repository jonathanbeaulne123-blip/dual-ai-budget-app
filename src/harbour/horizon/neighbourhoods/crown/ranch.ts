/**
 * High Shieling Ranch (protos/highlands §2.4): a working hill farm on the east valley's bench (61.5) at the foot of Stair
 * Falls — a stone longhouse with its byre end, a timber-roofed barn, post-and-rail paddocks with the flock, hay by the barn.
 * The household may re-plot it later (the brief); today it is simply built. Sites by the module's solver beside the Shieling
 * lane, off the place pad, the beck, the pool and the mere.
 */
import type { Point2 } from '../../world/definition.ts';
import type { LightAnchor } from '../../world/definition.ts';
import type { BuildingRecord, LifeSpawn, PropRecord } from '../types.ts';
import { V3_PLACES } from '../../land/mountainV3/landform.ts';
import { findSite, freeRuns, linear, local, P3, type Rect, type Site } from './site.ts';

const LANES = ['walk ranchLane'] as const;

export function ranch(site: Site): { buildings: BuildingRecord[]; props: PropRecord[]; lights: LightAnchor[]; life: LifeSpawn[] } {
  const { h, ctx } = site, rnd = ctx.rng('crown.ranch'), centre = V3_PLACES.highShieling;
  const buildings: BuildingRecord[] = [], props: PropRecord[] = [], lights: LightAnchor[] = [], life: LifeSpawn[] = [];
  const pad: Rect = { x: centre[0], z: centre[1], hx: 4, hz: 4, yaw: 0 };
  site.claim(pad, 'clearing');
  const longhouse = findSite(site, { around: [1440, 684], radius: 16, w: 15, d: 6.5, lanes: LANES, front: [2.5, 9], maxSpan: 1.6, margin: 1, avoid: [pad], gap: 3 });
  if (longhouse) {
    const r = longhouse.rect;
    buildings.push({ id: 'ranch.longhouse', districtId: '', kind: 'longhouse', style: 'crown.croft', at: P3(r.x, longhouse.floor, r.z), yaw: r.yaw,
      size: { w: 15, d: 6.5, h: 2.8 }, roof: { form: 'gable', pitch: 36, overhang: .4, material: 'thatch' }, door: { face: 'front', u: -2.5 }, paint: 1, collide: true });
    site.claim(r, 'building');
    const [ax, az] = local(r.x, r.z, r.yaw, -2.5, r.hz + 2); site.claim({ x: ax, z: az, hx: 1.8, hz: 2, yaw: r.yaw }, 'clearing');
    // Night order 4 of 4: the ranch window.
    const [lx, lz] = local(r.x, r.z, r.yaw, 2, r.hz + 1.2);
    lights.push({ id: 'crown.ranch.window', kind: 'window', at: P3(lx, h(lx, lz) + .8, lz), pool: P3(lx, h(lx, lz), lz), poolRadius: 3, line: 'crown.night', order: 3, bestHour: 'night' });
    const [bx, bz] = local(r.x, r.z, r.yaw, 1.5, r.hz + .9);
    if (site.free(bx - .9, bz, .3) && site.free(bx + .9, bz, .3)) props.push({ id: 'ranch.bench', kind: 'bench', at: P3(bx, h(bx, bz), bz), yaw: r.yaw, collide: true });
  }
  const avoid = [pad, ...(longhouse ? [longhouse.rect] : [])];
  const barn = findSite(site, { around: [1463, 674], radius: 12, w: 9, d: 7, lanes: LANES, front: [2.5, 26], maxSpan: 1.6, margin: 1, avoid, gap: 4 });
  if (barn) {
    const r = barn.rect;
    buildings.push({ id: 'ranch.barn', districtId: '', kind: 'barn', style: 'crown.croft', at: P3(r.x, barn.floor, r.z), yaw: r.yaw,
      size: { w: 9, d: 7, h: 3.4 }, roof: { form: 'gable', pitch: 38, overhang: .35, material: 'timber' }, door: { face: 'front', u: 0 }, collide: true });
    site.claim(r, 'building'); avoid.push(r);
    const [ax, az] = local(r.x, r.z, r.yaw, 0, r.hz + 2.5); site.claim({ x: ax, z: az, hx: 2.2, hz: 2.5, yaw: r.yaw }, 'clearing');
    // Hay by the barn's gable.
    for (let k = 0; k < 3; k++) {
      const [x, z] = local(r.x, r.z, r.yaw, r.hx + 1.4, -r.hz + 1.2 + k * 1.7);
      if (site.free(x, z, .4)) props.push({ id: `ranch.hay.${k}`, kind: 'hayBale', at: P3(x, h(x, z), z), yaw: r.yaw + Math.PI / 2 + (rnd() - .5) * .3, collide: true });
    }
  }
  // Paddocks: the largest free post-and-rail fields beside the lane (a gate where the fence meets the lane side).
  const paddocks: Rect[] = [];
  for (const [around, w, d] of [[[1425, 708] as Point2, 20, 7], [[1471, 707] as Point2, 12, 7]] as const) {
    const p = findSite(site, { around, radius: 8, step: 1, w, d, lanes: LANES, front: [.8, 8], maxSpan: 3, margin: .3, avoid: [...avoid, ...paddocks], gap: 3 });
    if (!p) continue;
    const r = p.rect, R = (u: number, v: number) => local(r.x, r.z, r.yaw, u * r.hx, v * r.hz);
    // Open ring from beside the gate (front, toward the lane) round to the gate's other post.
    const gate = 1.6 / r.hx;
    const runs = freeRuns(site, [R(-gate, 1), R(-1, 1), R(-1, -1), R(1, -1), R(1, 1), R(gate, 1)], { margin: .5, minRun: 2, step: .8 });
    props.push(...linear('fence', `ranch.paddock.${paddocks.length + 1}`, runs));
    paddocks.push(r); site.claim(r, 'clearing');
  }
  if (paddocks[0]) life.push({ kind: 'sheep', at: P3(paddocks[0].x, h(paddocks[0].x, paddocks[0].z), paddocks[0].z), radius: Math.min(paddocks[0].hx, paddocks[0].hz) - 1, count: 6 });
  return { buildings, props, lights, life };
}
