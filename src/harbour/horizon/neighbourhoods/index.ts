/**
 * The Water's Way (STORY.md): the neighbourhood registry. One module per neighbourhood, each in its own folder
 * `neighbourhoods/<id>/index.ts` exporting a `NeighbourhoodModule` (`{ id, build(ctx) }`, a pure function of the bake-time
 * world: see `types.ts`). The bake (`neighbourhoods/bake.ts`, wired in `scripts/horizon/bake-entry.ts`) runs every module
 * listed here once; PR 3/4 add them. Order does not matter (the bake sorts by id); an empty list bakes the world unchanged.
 */
import type { NeighbourhoodModule } from './types.ts';

export const NEIGHBOURHOOD_MODULES: NeighbourhoodModule[] = [];
