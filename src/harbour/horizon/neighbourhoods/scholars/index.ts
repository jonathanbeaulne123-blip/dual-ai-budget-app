/**
 * Scholars' Edge (The Water's Way, story place 7: night → before dawn; layout B; docs/horizon/STYLE.md §2.3, STORY.md).
 * A pure, deterministic dressing module (`ctx.rng` only): the Library re-dressed on its baked shell, courtyard B on the
 * south-west gable terrace in the sun window, the densest woods on the island (60–70 % canopy, real trees in the front
 * rows, woodland cards behind), the woodland floor, the Bight lookout's Lookout kit, knee-height bollards, racks, the
 * night order, chickadees and moths. Parts: frame.ts (the one frame), woods.ts, understorey.ts, place.ts, measure.ts
 * (the measurements the tests prove with the same functions).
 */
import type { NeighbourhoodDressing, NeighbourhoodModule } from '../types.ts';
import { courtyardFlags, courtyardProps, courtyardWalls, library, life, lookoutSet, mossPaint, nightLights, thresholdRacks, walkBollards } from './place.ts';
import { plantUnderstorey } from './understorey.ts';
import { plantWoods } from './woods.ts';

export function buildScholars(ctx: Parameters<NeighbourhoodModule['build']>[0]): NeighbourhoodDressing {
  const lib = library(ctx), look = lookoutSet(), woods = plantWoods(ctx);
  const props = [...courtyardProps(), ...look.props, ...walkBollards(ctx), ...thresholdRacks(ctx)];
  return {
    id: 'scholars',
    buildings: [lib.building, ...courtyardWalls(ctx)],
    plants: [...woods.trees, ...plantUnderstorey(ctx)],
    props,
    ground: [...courtyardFlags(), ...mossPaint(ctx)],
    pools: [],
    life: life(),
    lights: nightLights(props),
    landmarks: [lib.landmark],
    lookouts: [look.lookout],
  };
}

export const scholars: NeighbourhoodModule = { id: 'scholars', build: buildScholars };
