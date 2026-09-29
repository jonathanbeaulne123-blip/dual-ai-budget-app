/** Corridor lamps as `WorldDefinition.lights` anchors (ROAD.md §6; LIGHT §3). Placeholder until the night track lands. */
import type { LightAnchor } from '../../world/definition.ts';
import type { Corridor } from './types.ts';

export function corridorLightAnchors(corridors: readonly Corridor[]): LightAnchor[] {
  return corridors.flatMap(c => c.lamps.map(l => ({ id: l.id, at: l.at, kind: l.kind, head: l.head, pool: l.pool, poolRadius: l.poolRadius, corridorId: c.id })));
}
