/**
 * Westwatch Chapel (protos/highlands §2.2; STYLE §2.7 as amended): a small chapel on its knoll at the west end of the crest,
 * its bell cote on the north gable "to the sea" in the Library's verdigris, cote top ≥ 96 (the story's first landmark, the
 * first light of the evening relay and the first noon bell). A dry-stone churchyard wall round it, gated where the lanes
 * leave. The chapel stands on its own place pad (the knoll top is its floor): `allowOnBed` with the module's own check that
 * no corner touches a bed or water.
 */
import type { BuildingRecord, Landmark, LifeSpawn, PropRecord } from '../types.ts';
import type { LightAnchor } from '../../world/definition.ts';
import { storyLandmark } from '../../world/story.ts';
import { freeRuns, linear, local, P3, type Rect, type Site } from './site.ts';

/** The nave: 6 × 11 at yaw −0.4 on the knoll, door gable to the lane (south-south-west), cote on the north gable. */
export const CHAPEL = { at: [1036, 318] as const, yaw: -.4, w: 6, d: 11, wallH: 4.2, pitch: 47, floorLift: .15 } as const;
/** The cote's top (the sighted landmark top) is the registry's (≥ 96; Bight lookout → Westwatch). */
export const COTE_TOP = storyLandmark('westwatch').top[1];

export function chapel(site: Site): { buildings: BuildingRecord[]; props: PropRecord[]; lights: LightAnchor[]; landmarks: Landmark[]; life: LifeSpawn[] } {
  const { h } = site, [x, z] = CHAPEL.at, floor = h(x, z) + CHAPEL.floorLift, coteTop = COTE_TOP - floor;
  const rect: Rect = { x, z, hx: CHAPEL.w / 2, hz: CHAPEL.d / 2, yaw: CHAPEL.yaw };
  const rec: BuildingRecord = {
    id: 'westwatch.chapel', districtId: '', kind: 'chapel', style: 'crown.croft', at: P3(x, floor, z), yaw: CHAPEL.yaw,
    size: { w: CHAPEL.w, d: CHAPEL.d, h: CHAPEL.wallH }, roof: { form: 'gable', pitch: CHAPEL.pitch, overhang: .35, material: 'slate' },
    door: { face: 'front', u: 0 }, params: { coteTop: Math.round(coteTop * 1000) / 1000, allowOnBed: true }, collide: true, landmarkId: 'westwatch',
  };
  site.claim(rect, 'building');
  // The door's apron (the lane's end) stays clear.
  const [ax, az] = local(x, z, CHAPEL.yaw, 0, CHAPEL.d / 2 + 2.5);
  site.claim({ x: ax, z: az, hx: 2.5, hz: 2.5, yaw: CHAPEL.yaw }, 'clearing');
  // The cote stands on the back (north) gable: the plan's own cote centre (kit/buildings/crown.ts: z = −d/2 + 0.5).
  const [cx, cz] = local(x, z, CHAPEL.yaw, 0, -CHAPEL.d / 2 + .5);
  const landmark: Landmark = { id: 'westwatch', label: 'Westwatch Chapel', neighbourhood: 'crown', at: P3(x, h(x, z), z), top: P3(cx, COTE_TOP, cz), relayOrder: 1, bell: 'westwatch' };
  // The churchyard: a dry-stone wall 4 m round the nave, cut where a lane or the pad's edge passes (the gates).
  const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => local(x, z, CHAPEL.yaw, u! * (CHAPEL.w / 2 + 4), v! * (CHAPEL.d / 2 + 3.5)));
  const wall = linear('drystoneWall', 'westwatch.churchyard', freeRuns(site, ring, { closed: true, margin: .9, minRun: 2.5 }));
  // A bench by the door, facing the lane and the sea beyond it.
  const [bx, bz] = local(x, z, CHAPEL.yaw, 2.6, CHAPEL.d / 2 + 1.6);
  const props: PropRecord[] = [...wall];
  if (site.free(bx, bz, .6)) props.push({ id: 'westwatch.bench', kind: 'bench', at: P3(bx, h(bx, bz), bz), yaw: CHAPEL.yaw, collide: true });
  // Night order 1 of 4: the chapel lantern by the door (the kit draws the lantern; the anchor is its pool on the step).
  const [lx, lz] = local(x, z, CHAPEL.yaw, 1.2, CHAPEL.d / 2 + .9);
  const lights: LightAnchor[] = [{ id: 'crown.westwatch.lantern', kind: 'lantern', at: P3(lx, h(lx, lz) + .8, lz), pool: P3(lx, h(lx, lz), lz), poolRadius: 3.5, line: 'crown.night', order: 0, bestHour: 'dusk' }];
  const life: LifeSpawn[] = [{ kind: 'raven', at: P3(x, floor + 10, z), radius: 28, count: 2, hours: [5, 20] }];
  return { buildings: [rec], props, lights, landmarks: [landmark], life };
}
