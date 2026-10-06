/**
 * The `landing` neighbourhood (passes/03: the Landing & Long Sands, and the Reach): one module, two places of the story —
 * the Reach and the Greenway (STORY place 3, `reach.ts`) and Long Sands (STORY place 5, `sands.ts`). Each half is a pure
 * function of the bake-time world returning partial records; this module concatenates them (record ids never overlap:
 * the Reach's start `reach.` / `greenway.`, Long Sands' its own) and merges the protected-area allowances.
 */
import type { DressingContext, NeighbourhoodDressing, NeighbourhoodModule } from '../types.ts';
import { buildReach } from './reach.ts';
import { buildSands } from './sands.ts';

const LISTS = ['buildings', 'plants', 'props', 'ground', 'pools', 'life', 'lights', 'landmarks', 'lookouts'] as const;

export function composeLanding(parts: readonly NeighbourhoodDressing[]): NeighbourhoodDressing {
  const out: NeighbourhoodDressing = { id: 'landing', buildings: [], plants: [], props: [], ground: [], pools: [], life: [], lights: [], landmarks: [], lookouts: [] };
  const allow: string[] = [];
  for (const p of parts) {
    for (const key of LISTS) (out[key] as unknown[]).push(...(p[key] as unknown[]));
    allow.push(...(p.allowInProtected ?? []));
  }
  return allow.length ? { ...out, allowInProtected: allow } : out;
}

export const landing: NeighbourhoodModule = {
  id: 'landing',
  build: (ctx: DressingContext) => composeLanding([buildReach(ctx), buildSands(ctx)]),
};
