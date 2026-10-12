/**
 * The `landing` neighbourhood (passes/03): one module, two places of the story in two sub-folders — the Reach and the
 * Greenway (STORY place 3: `reach.ts` + `reach/`, PR 3) and Long Sands (STORY place 5: `sands.ts` + `sands/`, PR 4). Each
 * was built on its own branch; this index composes `buildReach` and `buildSands` (records concatenated — ids never overlap:
 * the Reach's start `reach.` / `greenway.`, Long Sands' `sands.` — and `allowInProtected` merged).
 */
import type { DressingContext, LifeSpawn, NeighbourhoodDressing, NeighbourhoodModule, PlantRecord } from '../types.ts';
import { greenwayLine } from '../../land/structures/greenway.ts';
import { buildReach } from './reach.ts';
import { buildSands } from './sands.ts';
import { inPoly, polyDist, polyEdgeDist } from './reach/geom.ts';
import { REACH_POLY } from './reach/site.ts';

/**
 * Integration rules where the two halves meet (D-WW integration note, 2026-10-12):
 * - The Reach is a marsh: no palm of Long Sands' stands in the Reach (or within `reachMargin` of it) or within `greenwayMargin`
 *   of the Greenway (the Reach's own test, "no palm anywhere").
 * - One district holds at most `creatures` creatures in all (the Reach keeps its own share; Long Sands' spawns in a shared
 *   district are scaled down to fit what is left, never below one each, the largest trimmed first).
 */
export const LANDING_SEAM = { palms: ['palm', 'fanPalm', 'canaryPalm'] as readonly string[], reachMargin: 14, greenwayMargin: 60, creatures: 24 } as const;

function seamPlants(plants: PlantRecord[]): PlantRecord[] {
  const line = greenwayLine().full.map(p => [p[0], p[2]] as const);
  return plants.filter(p => !LANDING_SEAM.palms.includes(p.species) || !(inPoly(p.at[0], p.at[2], REACH_POLY) || polyEdgeDist(p.at[0], p.at[2], REACH_POLY) < LANDING_SEAM.reachMargin || polyDist(p.at[0], p.at[2], line).d < LANDING_SEAM.greenwayMargin));
}

function seamLife(reach: LifeSpawn[], sands: LifeSpawn[], districtAt: (x: number, z: number) => string): LifeSpawn[] {
  const used = new Map<string, number>(); for (const l of reach) { const d = districtAt(l.at[0], l.at[2]); used.set(d, (used.get(d) ?? 0) + l.count); }
  const mine = new Map<string, LifeSpawn[]>(); for (const l of sands) { const d = districtAt(l.at[0], l.at[2]); (mine.get(d) ?? mine.set(d, []).get(d)!).push({ ...l }); }
  for (const [d, list] of mine) {
    const room = Math.max(list.length, LANDING_SEAM.creatures - (used.get(d) ?? 0));
    let total = list.reduce((n, l) => n + l.count, 0);
    while (total > room) { const big = list.reduce((a, b) => (b.count > a.count ? b : a)); if (big.count <= 1) break; big.count--; total--; }
  }
  return [...mine.values()].flat();
}

const LISTS = ['buildings', 'plants', 'props', 'ground', 'pools', 'life', 'lights', 'landmarks', 'lookouts'] as const;

/** Concatenate two halves of one module's dressing (same id; every record list joined in order, Reach first). */
export function composeLanding(a: NeighbourhoodDressing, b: NeighbourhoodDressing): NeighbourhoodDressing {
  const out = { id: a.id } as NeighbourhoodDressing;
  for (const k of LISTS) (out[k] as unknown[]) = [...a[k], ...b[k]];
  const allow = [...(a.allowInProtected ?? []), ...(b.allowInProtected ?? [])];
  if (allow.length) out.allowInProtected = allow;
  return out;
}

function buildLanding(ctx: DressingContext): NeighbourhoodDressing {
  const reach = buildReach(ctx), sands = buildSands(ctx);
  return composeLanding(reach, { ...sands, plants: seamPlants(sands.plants), life: seamLife(reach.life, sands.life, ctx.districtAt) });
}

export const landing: NeighbourhoodModule = { id: 'landing', build: buildLanding };
