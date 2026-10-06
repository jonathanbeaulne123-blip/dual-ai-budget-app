/**
 * The neighbourhood modules' light anchors (pure; world/build.ts and the bake both read it). A module's anchor is an
 * emissive light card only: the bake gives it the kind `dressing:<kind>`, which is never a road-lamp kind, so
 * runtime/roadLights.ts draws its pool and bead cards and never puts it in the fixed 6 / 2 point-light pool (D-R3).
 */
import type { LightAnchor } from '../world/definition.ts';

export const DRESSING_LIGHT_PREFIX = 'dressing:';
export const isDressingLightKind = (kind: string) => kind.startsWith(DRESSING_LIGHT_PREFIX);

/** The world's lights and the modules' anchors in one list; an id the world already uses is refused. */
export function mergeDressingLights(world: readonly LightAnchor[], dressing: readonly LightAnchor[]): LightAnchor[] {
  if (!dressing.length) return [...world];
  const ids = new Set(world.map(l => l.id)), clash = dressing.filter(l => ids.has(l.id)).map(l => l.id);
  if (clash.length) throw new Error(`Neighbourhood light anchor ids already used by the world: ${clash.slice(0, 12).join(', ')}`);
  return [...world, ...dressing];
}
