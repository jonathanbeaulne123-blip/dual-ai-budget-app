/**
 * PLACEHOLDER (the Reach builder, PR 3): Long Sands' half of the shared `landing` module. The Long Sands builder overwrites this
 * file with the real `buildSands(ctx)`; until then it dresses nothing, so `landing/index.ts` composes the Reach alone.
 */
import type { DressingContext, NeighbourhoodDressing } from '../types.ts';

export function buildSands(_ctx: DressingContext): NeighbourhoodDressing {
  return { id: 'landing', buildings: [], plants: [], props: [], ground: [], pools: [], life: [], lights: [], landmarks: [], lookouts: [] };
}
