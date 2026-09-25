/** The harbour island's own ground: a level terrace, a lawn hump and a sandy fall to the sea.
 * Pure and dependency-free so the mountain definition can drape town lanes on it
 * without importing the renderer's ground module. */
export const ISLAND_RADIUS = 84;
export const ISLAND_LAWN = 58;
export const ISLAND_TERRACE = 10.4;
export const SEA_LEVEL = -0.45;
export const TERRACE_LEVEL = -0.05;

export function islandHeight(x:number,z:number):number {
  const r = Math.hypot(x, z);
  if (r <= ISLAND_TERRACE) return TERRACE_LEVEL;
  if (r <= ISLAND_LAWN) {
    const t = (r - ISLAND_TERRACE) / (ISLAND_LAWN - ISLAND_TERRACE);
    // A gentle hump peaking mid-lawn, back to the terrace level at the shore's edge.
    return TERRACE_LEVEL + Math.sin(t * Math.PI) * (1.25 + .35*Math.sin(x*.065)*Math.cos(z*.075));
  }
  if (r <= ISLAND_RADIUS) {
    const t = (r - ISLAND_LAWN) / (ISLAND_RADIUS - ISLAND_LAWN);
    return TERRACE_LEVEL - t * t * 1.1;
  }
  return SEA_LEVEL - 0.3;
}
