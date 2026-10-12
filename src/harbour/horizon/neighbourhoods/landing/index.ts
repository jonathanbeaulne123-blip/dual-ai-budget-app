/**
 * The `landing` neighbourhood (passes/03): one module, two places of the story in two sub-folders — the Reach and the
 * Greenway (STORY place 3: `reach.ts` + `reach/`, PR 3) and Long Sands (STORY place 5: `sands.ts` + `sands/`, PR 4). Each
 * was built on its own branch; this index composes `buildReach` and `buildSands` (records concatenated — ids never overlap:
 * the Reach's start `reach.` / `greenway.`, Long Sands' `sands.` — and `allowInProtected` merged).
 */
import type { NeighbourhoodDressing, NeighbourhoodModule } from '../types.ts';
import { buildReach } from './reach.ts';
import { buildSands } from './sands.ts';

const LISTS = ['buildings', 'plants', 'props', 'ground', 'pools', 'life', 'lights', 'landmarks', 'lookouts'] as const;

/** Concatenate two halves of one module's dressing (same id; every record list joined in order, Reach first). */
export function composeLanding(a: NeighbourhoodDressing, b: NeighbourhoodDressing): NeighbourhoodDressing {
  const out = { id: a.id } as NeighbourhoodDressing;
  for (const k of LISTS) (out[k] as unknown[]) = [...a[k], ...b[k]];
  const allow = [...(a.allowInProtected ?? []), ...(b.allowInProtected ?? [])];
  if (allow.length) out.allowInProtected = allow;
  return out;
}

export const landing: NeighbourhoodModule = { id: 'landing', build: ctx => composeLanding(buildReach(ctx), buildSands(ctx)) };
