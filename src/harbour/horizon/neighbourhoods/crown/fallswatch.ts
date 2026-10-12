/**
 * Fallswatch (protos/highlands §2.3; MOUNTAIN_V3 §7; D-WW54): the timber deck on the west buttress's cover ridge over the
 * Stillwater tunnel, the 10 × 5 place pad at [1082,692.5] the land built. The story's first lookout: its eye at the deck's
 * south-east corner (STORY_EYES `fallswatch`, deck + 1.6) sees the Veil's lip, the Old Oak and the Lamp. The Lookout kit
 * (STORY): viewers with the free lever, a bench, a panel, open rails; the deck lamp lights second in the evening relay.
 *
 * The ridge is narrow (the trench falls away north, the amphitheatre south): the deck carries open timber rails on both
 * long sides; the lane arrives along the ridge from the east, so the east end stays open. Colliding props stand off the pad
 * (bake rule 4); every one of them is placed clear of the three binocular lines.
 */
import type { Point3 } from '../../world/definition.ts';
import type { LightAnchor } from '../../world/definition.ts';
import type { BuildingRecord, Landmark, Lookout, PropRecord } from '../types.ts';
import { aimPoint, storyEye, storyLandmark } from '../../world/story.ts';
import { V3_PLACES } from '../../land/mountainV3/landform.ts';
import { P3, round, type Rect, type Site } from './site.ts';

export const DECK = { at: V3_PLACES.fallswatch, w: 10, d: 5, lift: .05 } as const;

export function fallswatch(site: Site): { buildings: BuildingRecord[]; props: PropRecord[]; lights: LightAnchor[]; landmarks: Landmark[]; lookouts: Lookout[] } {
  const { h } = site, [x, z] = DECK.at, floor = h(x, z) + DECK.lift;
  const eyeDef = storyEye('fallswatch'), eye: Point3 = [eyeDef.at[0], floor + (eyeDef.lift ?? 1.6), eyeDef.at[1]];
  // The binocular lines are kept clear by everything the module places (trees, walls, posts).
  for (const t of eyeDef.targets) site.sights.push({ from: eye, to: aimPoint(storyLandmark(t)), half: 2.5, margin: .8 });
  const deck: BuildingRecord = {
    id: 'fallswatch.deck', districtId: '', kind: 'deck', style: 'crown.croft', at: P3(x, floor, z), yaw: 0,
    size: { w: DECK.w, d: DECK.d, h: 1.05 }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'timber' },
    params: { rails: 'front,back' }, collide: true,
  };
  const deckRect: Rect = { x, z, hx: DECK.w / 2, hz: DECK.d / 2, yaw: 0 };
  site.claim(deckRect, 'building');
  const buildings: BuildingRecord[] = [deck], props: PropRecord[] = [];
  const at = (px: number, pz: number) => P3(px, h(px, pz), pz);
  const facing = (to: string, px: number, pz: number) => { const a = aimPoint(storyLandmark(to)); return round(Math.atan2(a[0] - px, a[2] - pz), 1000); };
  // The Lookout kit, off the pad on the ridge east of the deck (where the lane arrives): the Veil viewer (standing), the
  // seated/child viewer toward the oak, the panel, and the deck lamp on its island-lantern post.
  const veil = [1088.1, 693.9] as const, oak = [1076.0, 694.1] as const;
  props.push({ id: 'fallswatch.viewer.veil', kind: 'viewer', at: at(veil[0], veil[1]), yaw: facing('veilLip', veil[0], veil[1]), collide: true });
  props.push({ id: 'fallswatch.viewer.oak', kind: 'viewerSeated', at: at(oak[0], oak[1]), yaw: facing('oak', oak[0], oak[1]), collide: true });
  props.push({ id: 'fallswatch.panel', kind: 'panel', at: at(1090.6, 693.2), yaw: facing('veilLip', 1090.6, 693.2), collide: true });
  const lamp = [1088.3, 693.0] as const, lampTop = h(lamp[0], lamp[1]) + 2.6;
  props.push({ id: 'fallswatch.lamp', kind: 'lantern', at: at(lamp[0], lamp[1]), yaw: 0, collide: true });
  // A bench on the ridge west of the deck, facing the amphitheatre (south).
  for (const bx of [1075.9, 1075.4, 1076.0]) if ([-1, 0, 1].every(k => site.free(bx + k * .95, 691.3, .15) && !site.claimed(bx + k * .95, 691.3, .1))) { props.push({ id: 'fallswatch.bench', kind: 'bench', at: at(bx, 691.3), yaw: 0, collide: true }); break; }
  const lights: LightAnchor[] = [{ id: 'crown.fallswatch.lamp', kind: 'lantern', at: P3(lamp[0], h(lamp[0], lamp[1]) + .8, lamp[1]), pool: at(lamp[0], lamp[1]), poolRadius: 3, line: 'crown.night', order: 2, bestHour: 'dusk' }];
  const landmark: Landmark = { id: 'fallswatch', label: 'Fallswatch', neighbourhood: 'crown', at: P3(eye[0], floor, eye[2]), top: P3(lamp[0], lampTop, lamp[1]), relayOrder: 2 };
  const lookout: Lookout = { id: 'fallswatch', label: 'Fallswatch', eye: P3(eye[0], eye[1], eye[2]), facing: facing('veilLip', eye[0], eye[2]), targets: [...eyeDef.targets], viewer: 'both', bestHour: 'dawn' };
  return { buildings, props, lights, landmarks: [landmark], lookouts: [lookout] };
}
