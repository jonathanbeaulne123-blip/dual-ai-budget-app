/**
 * Long Sands (STORY place 5: late afternoon → sunset; surf, the pier, the strand; the Ferris wheel), the PR 4 half of the
 * `landing` neighbourhood (passes/03: two sub-folders of one module; the Reach + the Greenway are `buildReach`, PR 3).
 * `buildSands` returns this half's records (id 'landing'); `landing/index.ts` composes both halves into the one module.
 * The solvers live in `landing/sands/` (site.ts: the shared numbers and clearings; frame.ts: the promenade frame; build.ts:
 * placement in STYLE §1.4.1 order). Docs: STYLE §2.5 (Direction B), docs/horizon/DECISIONS.md D-WW150…159.
 */
import { storyEye, storyLandmark } from '../../world/story.ts';
import type { DressingContext, Landmark, Lookout, NeighbourhoodDressing } from '../types.ts';
import { buildSandsParts } from './sands/build.ts';
import { SANDS } from './sands/site.ts';
import { q3v } from './sands/frame.ts';

export { SANDS } from './sands/site.ts';
export { NIGHT_ORDER, buildSandsParts } from './sands/build.ts';

/** The wheel (STORY landmark `wheel`, sixth in the evening relay) and the top of the wheel (the seated eye that sees the
 *  Flats' grain elevator across the Bight). Positions follow the built wheel (registry tolerance 3 eu plan, 1.5 eu height). */
export function sandsStory(): { landmarks: Landmark[]; lookouts: Lookout[] } {
  const reg = storyLandmark('wheel'), eye = storyEye('wheelTop'), [hx, hy, hz] = SANDS.wheel.hub;
  const top = hy + SANDS.wheel.r, target = storyLandmark(eye.targets[0]!);
  return {
    landmarks: [{ id: 'wheel', label: reg.label, neighbourhood: 'landing', at: q3v([hx, SANDS.pier.deck, hz]), top: q3v([hx, top, hz]), relayOrder: reg.relayOrder }],
    lookouts: [{ id: 'wheelTop', label: eye.label, eye: q3v([hx, eye.y ?? top - 1.6, hz]), facing: Math.round(Math.atan2(target.at[0] - hx, target.at[2] - hz) * 1000) / 1000,
      targets: [...eye.targets], viewer: 'seated', bestHour: 'sunset' }],
  };
}

export function buildSands(ctx: DressingContext): NeighbourhoodDressing {
  const p = buildSandsParts(ctx), story = sandsStory();
  return { id: 'landing', buildings: p.buildings, plants: p.plants, props: p.props, ground: p.ground, pools: [], life: p.life, lights: p.lights, landmarks: story.landmarks, lookouts: story.lookouts };
}
