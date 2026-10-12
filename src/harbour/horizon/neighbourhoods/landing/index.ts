/**
 * The `landing` neighbourhood (passes/03): one module, two places of the story in two sub-folders — the Reach and the
 * Greenway (STORY place 3: `reach.ts` + `reach/`, PR 3) and Long Sands (STORY place 5: `sands.ts` + `sands/`, PR 4, built on
 * its own branch). In this branch only the Reach is built; the integrator's index composes `buildReach` and `buildSands`
 * (records concatenated — ids never overlap: the Reach's start `reach.` / `greenway.` — and `allowInProtected` merged).
 */
import type { NeighbourhoodModule } from '../types.ts';
import { buildReach } from './reach.ts';

export const landing: NeighbourhoodModule = { id: 'landing', build: ctx => buildReach(ctx) };
