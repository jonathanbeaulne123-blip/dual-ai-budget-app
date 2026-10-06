/**
 * Little Harbour, "cobblestone Italy" (STYLE §2.1 as amended, D-303; story place 4, afternoon → golden hour; the river
 * meets the sea; landmark: the campanile). The neighbourhood module (`neighbourhoods/types.ts`): a pure, deterministic
 * function of the bake-time world.
 *
 *  1. clearings: page A's dam corridor (the solver keeps every footprint out of it), the square, the quay, the pads and
 *     the beds (nothing is placed on them but paint and pad-safe props), the Kitty plaza and the homestead sites (pads);
 *  2. buildings: the campanile, the Fund bank (palazzo) and Our home (villa) on their baked shells, ~100 row houses solved
 *     onto every real frontage (solver.ts, the prototype's `place.py`);
 *  3. planting: the hillside's olive terraces, stone pines and cypress; bougainvillea and lemon pots at the houses;
 *  4. ground paint on the pads; props, pastime fixtures, the belfry lookout, the night order and the life (places.ts).
 *
 * Classic, Taylor's Scrapbook and Newfoundland skin this one massing (kit/buildings `harbour.ligurian`).
 */
import type { NeighbourhoodDressing, NeighbourhoodModule } from '../types.ts';
import { buildTown } from './town.ts';
import { buildPlaces } from './places.ts';
import { plantHillside } from './planting.ts';
import { paintGround } from './ground.ts';

export function buildHarbour(ctx: Parameters<NeighbourhoodModule['build']>[0]): NeighbourhoodDressing {
  const town = buildTown(ctx);
  const places = buildPlaces(ctx, town.buildings);
  const hill = plantHillside(ctx, town.buildings);
  return {
    id: 'harbour',
    buildings: town.buildings,
    plants: [...town.plants, ...hill.plants],
    props: [...places.props, ...town.props, ...hill.props],
    ground: paintGround(ctx),
    pools: [],
    life: places.life,
    lights: places.lights,
    landmarks: places.landmarks,
    lookouts: places.lookouts,
  };
}

export const harbour: NeighbourhoodModule = { id: 'harbour', build: buildHarbour };
export { HERCULES_SPOTS } from './plan.ts';
export { lanternHunt, FISHING_SPOT } from './fixtures.ts';
