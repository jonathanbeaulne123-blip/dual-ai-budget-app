/**
 * The `landing` neighbourhood (passes/03: the Reach + the Greenway, PR 3, and Long Sands, PR 4: two sub-folders of one
 * module, merged by the integrator). In this branch only Long Sands is built; the integrator's index composes
 * `buildReach` and `buildSands` (records concatenated, ids namespaced `reach.*` / `sands.*`).
 */
import type { NeighbourhoodModule } from '../types.ts';
import { buildSands } from './sands.ts';

export const landing: NeighbourhoodModule = { id: 'landing', build: ctx => buildSands(ctx) };
