/**
 * The Rim Lookout (protos/highlands §2.6; STYLE §2.7 "the lookout wall", §1.9 "ravens on the Crown's lookout wall"): where
 * the east rim walk meets the Rim Steps down to the Rim Bridge, the land's place pad at 104 (1512–1520 × 544–552) stands on
 * the rim's lip with the ground falling east to Horizon Drive. This dresses its edge: a dry-stone lookout wall along the
 * lip east of the pad (from 6 m south of it to where the Rim Steps leave), a standing viewer (the free lever) in the wall's lee looking east,
 * a low lantern at the wall's north end (last in the Highlands' night order), and the ravens that sit on the wall.
 * Colliding props stand off the pad (bake rule 4).
 */
import type { LightAnchor } from '../../world/definition.ts';
import type { LifeSpawn, PropRecord } from '../types.ts';
import { V3_PLACES } from '../../land/mountainV3/landform.ts';
import { freeRuns, linear, P3, type Site } from './site.ts';

/** The wall's line: 2.6 m east of the pad's east edge, from 6 m south of the pad to the Rim Steps (which cut it). */
export const RIM = { pad: { x0: 1512, x1: 1520, z0: 544, z1: 552 }, wallX: 1522.6, viewer: [1521.4, 546.2] as const, lamp: [1521.5, 542.4] as const } as const;

export function rimLookout(site: Site): { props: PropRecord[]; lights: LightAnchor[]; life: LifeSpawn[] } {
  const { h } = site, props: PropRecord[] = [], lights: LightAnchor[] = [], life: LifeSpawn[] = [];
  site.claim({ x: V3_PLACES.rimLookout[0], z: V3_PLACES.rimLookout[1], hx: 4.6, hz: 4.6, yaw: 0 }, 'clearing');
  const runs = freeRuns(site, [[RIM.wallX - .4, RIM.pad.z0 - 6], [RIM.wallX, RIM.pad.z0], [RIM.wallX + .3, 548], [RIM.wallX, RIM.pad.z1 + 1.5]], { margin: .7, minRun: 3, step: .6 });
  props.push(...linear('drystoneWall', 'rimLookout.wall', runs));
  const at = (x: number, z: number) => P3(x, h(x, z), z);
  const [vx, vz] = RIM.viewer;
  if (site.free(vx, vz, .35)) props.push({ id: 'rimLookout.viewer', kind: 'viewer', at: at(vx, vz), yaw: 1.85, collide: true });
  const [lx, lz] = RIM.lamp;
  if (site.free(lx, lz, .3)) {
    props.push({ id: 'rimLookout.lamp', kind: 'lanternLow', at: at(lx, lz), yaw: 0, collide: true });
    lights.push({ id: 'crown.rimLookout.lamp', kind: 'lantern', at: P3(lx, h(lx, lz) + .9, lz), pool: at(lx, lz), poolRadius: 2.4, line: 'crown.night', order: 4, bestHour: 'dusk' });
  }
  life.push({ kind: 'raven', at: P3(RIM.wallX, h(RIM.wallX, 548) + 1.4, 548), radius: 8, count: 2, hours: [5, 20] });
  return { props, lights, life };
}
