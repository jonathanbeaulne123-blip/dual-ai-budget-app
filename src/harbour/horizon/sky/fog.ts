import { blendColor, skyGradient } from './gradient';

/**
 * Fog distances at scale 1.0 (engine units = metres). Three draws linear fog as
 * smoothstep(near, far, viewDepth); `fogFactor` below is that same curve.
 *
 * Derivation (STYLE §1.8 "the Crown's summit from the square sits at ~50 % fog: a silhouette,
 * not a void"; the review's P30 accepts 40–60 %): the summit [1310,158,470] is 758 eu from the
 * square's eye (P30), 1.6 eu over the ground, so near/far grow by +1.44 / +2.16. STYLE's 0.6-scale
 * pair (150 / 700 eu = 250 / 1170 m) is kept in METRES and re-read at 1.0, with the far edge moved
 * 100 m out so the summit sits in the middle of the band:
 *   full  250 / 1270 → t = (758 − 251.4) / (1272.2 − 251.4) = 0.496 → smoothstep 49.4 %
 *   lite  180 / 1230 → t = (758 − 181.4) / (1232.2 − 181.4) = 0.549 → smoothstep 57.3 %
 *         (inside the band; lite keeps ≤ 3 districts resident and lets fog take distance sooner —
 *         the design lead confirms the lite pair)
 *   fog day 40 / 220 is a local bank (§2 sheets), not a distance rule: unchanged.
 * Before (0.6 numbers at 1.0): full 150 / 700 and lite 110 / 520 put the summit at 100 %.
 */
export const HORIZON_FOG = {
  full: { near: 250, far: 1270 },
  lite: { near: 180, far: 1230 },
  fogDay: { near: 40, far: 220 },
  /** near/far grow with eye height above the ground (STYLE §1.8). */
  nearPerEyeHeight: 0.9,
  farPerEyeHeight: 1.35,
  /** Horizon cards are fogged but never beyond this (STYLE §1.8). */
  horizonMaxOpacity: 0.7,
} as const;
export const FOG_SUMMIT_CHECK = { distanceEu: 758, eyeAboveGround: 1.6, band: [0.4, 0.6] as const };

export interface HorizonFog { near: number; far: number; color: string; horizonMaxOpacity: number }
export function horizonFog(options: { tier: 'full' | 'lite'; eyeAboveGround: number; elevation: number; sunAzimuth: number; heading: number; fogDay?: boolean }): HorizonFog {
  const { tier, fogDay, elevation, sunAzimuth, heading } = options;
  const h = Math.max(0, options.eyeAboveGround), colors = skyGradient(elevation);
  const towardSun = (1 + Math.cos((heading - sunAzimuth) * Math.PI / 180)) / 2;
  const base = fogDay ? HORIZON_FOG.fogDay : HORIZON_FOG[tier];
  return { near: base.near + h * HORIZON_FOG.nearPerEyeHeight, far: base.far + h * HORIZON_FOG.farPerEyeHeight, color: blendColor(colors.horizonAway, colors.horizonSun, towardSun), horizonMaxOpacity: HORIZON_FOG.horizonMaxOpacity };
}
/** Three's fog factor at a view depth (smoothstep between near and far); `cap` limits it (horizon cards: 0.7). */
export function fogFactor(fog: Pick<HorizonFog, 'near' | 'far'>, depth: number, cap = 1): number {
  const t = Math.max(0, Math.min(1, (depth - fog.near) / Math.max(1e-6, fog.far - fog.near)));
  return Math.min(cap, t * t * (3 - 2 * t));
}
