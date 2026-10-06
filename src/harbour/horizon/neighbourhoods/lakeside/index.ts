/**
 * The Green — STORY place 2, morning → noon (module `lakeside`; districts green, lakeside and notch; the Reach module owns
 * the Notch's lookouts). The Old Oak and what it carries, the Oak Clock, the turf labyrinth, the apiary, the kites, the
 * desire lines, the Lantern Ring and the rim fixtures (`green.ts`); Stillwater's shore and the Glasshouse surroundings
 * (`shore.ts`). One pure, deterministic function of the bake-time world (`ctx.rng` only). D-WW110…119.
 *
 * Night order (STYLE §2.6 as amended): the Glasshouse's terrace lanterns first (`lakeside.glasshouse`), then the Lantern
 * Ring outward from the oak and the Meadow Pavilion's lantern (`green.lanternRing`, the oak's relay light), then the moon
 * path on Stillwater (the runtime's, unchanged).
 */
import type { NeighbourhoodDressing, NeighbourhoodModule } from '../types.ts';
import { buildGreen } from './green.ts';
import { buildShore } from './shore.ts';

export const lakeside: NeighbourhoodModule = {
  id: 'lakeside',
  build(ctx): NeighbourhoodDressing {
    const green = buildGreen(ctx), shore = buildShore(ctx);
    return {
      id: 'lakeside',
      buildings: green.buildings,
      plants: [...green.plants, ...shore.plants],
      props: [...shore.props, ...green.props],
      ground: green.ground,
      pools: [],
      life: [...green.life, ...shore.life],
      lights: [...shore.lights, ...green.lights],
      landmarks: green.landmarks,
      lookouts: [],
      allowInProtected: green.allow,
    };
  },
};
