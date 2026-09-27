/**
 * The sun's shadow frustum at scale 1.0 (R1-99). One directional shadow map, re-rendered only on a
 * sun step (LIGHT §6), framed on what the camera looks at rather than on the body:
 *
 * - Look (a Sketchbook page): centred `SHADOW_LOOK_AHEAD` eu ahead of the eye along the view's heading,
 *   half-size `SHADOW_LOOK_HALF`. The ortho box sits in light space, so its ground footprint always
 *   contains the disc of radius `half` round the centre: from page A that disc holds the eye, the High
 *   Span (184 eu from the centre), the dam (≈ 40 eu) and the Crown's summit (≈ 500 eu).
 * - Walk: a box of ±250 eu round the body — STYLE §1.2.6 eases cast shadows to 60 % at 250 eu.
 *
 * Map texel = 2·half / mapSize: look full 2048 → 0.51 eu, lite 1024 → 1.02 eu; walk full 0.24 eu
 * (a painted card shadow, not a contact shadow; contact darkening is the card shade layer).
 */
export interface ShadowFrame { centre: readonly [number, number, number]; half: number; mapSize: number; sunDistance: number; far: number }
export const SHADOW_WALK_HALF = 250;
export const SHADOW_LOOK_HALF = 520, SHADOW_LOOK_AHEAD = 400;
export function shadowFrame(options: { tier: 'full' | 'lite'; mode: 'walk' | 'look' | 'journey'; eye: readonly [number, number, number]; heading: number; groundY?: number }): ShadowFrame {
  const mapSize = options.tier === 'full' ? 2048 : 1024, y = options.groundY ?? options.eye[1];
  if (options.mode === 'look') {
    const centre = [options.eye[0] + Math.sin(options.heading) * SHADOW_LOOK_AHEAD, y, options.eye[2] + Math.cos(options.heading) * SHADOW_LOOK_AHEAD] as const;
    return { centre, half: SHADOW_LOOK_HALF, mapSize, sunDistance: 1200, far: 2600 };
  }
  return { centre: [options.eye[0], y, options.eye[2]], half: SHADOW_WALK_HALF, mapSize, sunDistance: 900, far: 2000 };
}
