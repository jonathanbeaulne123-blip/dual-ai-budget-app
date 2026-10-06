/**
 * Little Harbour's pastimes as data (SPEC §11; passes/04): what PR 5 plays and where. The fixtures that stand in the
 * world as props carry `fixture` ids in the dressing (`bocce`, `sundial`, `harbourBell`, `giroDelPorto.B0…B5`); the ones
 * that cannot stand as props are data here:
 *  - the Lantern Hunt's six spots (MANIFEST pastimeData.lanternQuotas.harbour = 6): PR 5 hangs and lights them. L1 and L4
 *    are derived from the built town — L1 on the vicolo front nearest the prototype's, 0.7 eu out at the bracket height
 *    (floor + 4.4), L4 on the first quayfront altana's pergola (eave + 1.75);
 *  - the fishing spot at the ferry pier's end: the pier is a deck over the sea, where the bake's prop rule (4) allows
 *    only water props, so the rod and the two cats' seats are data (the cats are life spawns in the dressing).
 * Pure data and derivation; no randomness.
 */
import type { Point3 } from '../../world/definition.ts';
import type { BuildingRecord } from '../types.ts';
import { FISHING, LANTERN_FIXED, type LanternSpotData } from './plan.ts';
import { frontOf } from './town.ts';

const L1_NEAR: [number, number] = [1406.0, 1236.3];

export function lanternHunt(buildings: readonly BuildingRecord[]): LanternSpotData[] {
  const rows = buildings.filter(b => b.kind === 'rowHouse');
  const near = [...rows].sort((a, b) => { const fa = frontOf(a).at, fb = frontOf(b).at; return Math.hypot(fa[0] - L1_NEAR[0], fa[1] - L1_NEAR[1]) - Math.hypot(fb[0] - L1_NEAR[0], fb[1] - L1_NEAR[1]) || (a.id < b.id ? -1 : 1); })[0];
  const out: LanternSpotData[] = [];
  if (near) { const f = frontOf(near); out.push({ id: 'L1', at: [f.at[0] + f.n[0] * 0.7, near.at[1] + 4.4, f.at[1] + f.n[1] * 0.7], reach: 'foot', where: 'a vicolo wall bracket' }); }
  out.push(LANTERN_FIXED.L2, LANTERN_FIXED.L3);
  const altana = rows.find(b => b.params?.altana === true && b.params?.tier === 4) ?? rows.find(b => b.params?.altana === true);
  if (altana) out.push({ id: 'L4', at: [altana.at[0], altana.at[1] + altana.size.h + 1.75, altana.at[2]] as Point3, reach: 'air', where: 'an altana pergola' });
  out.push(LANTERN_FIXED.L5, LANTERN_FIXED.L6);
  return out;
}
export const FISHING_SPOT = { id: 'fishing', rod: FISHING.rod, seats: FISHING.cats, note: 'the ferry pier end; nothing is caught but time' } as const;
