/**
 * The app's comfort choices as the Horizon applies them (CONTRACT §2.10, STYLE §1.13).
 * `calm` is the app's calm view (`Comfort.quiet`); `reducedMotion` is the app setting
 * (`Comfort.motion === 'reduced'`, published as `html[data-motion="reduced"]`) or the OS query.
 *
 * - calm: the sun is frozen at the frozen 15:30 (never night) and nothing moves on its own.
 * - reduced motion: the sun is frozen too (LIGHT §5), and every camera or district change is a
 *   cut: no Walk↔Look tween, no district fade.
 */
export interface HorizonComfort { calm: boolean; reducedMotion: boolean }
export interface HorizonMotion {
  /** Walk↔Look / Island camera move; 0 is a cut. */
  transitionMs: number;
  /** A district streams in from the fog colour over this time (STYLE §1.13.2); 0 is a cut. */
  districtFadeMs: number;
  /** The sun follows the real clock; false = the frozen 15:30. */
  sunFollowsClock: boolean;
  /** Idle animation of figures and anything else that moves on its own. */
  ambientMotion: boolean;
}
export const HORIZON_TRANSITION_MS = 1100;
export const HORIZON_DISTRICT_FADE_MS = 800;
export function horizonMotion(comfort: HorizonComfort): HorizonMotion {
  const still = comfort.calm || comfort.reducedMotion;
  return { transitionMs: comfort.reducedMotion ? 0 : HORIZON_TRANSITION_MS, districtFadeMs: comfort.reducedMotion ? 0 : HORIZON_DISTRICT_FADE_MS, sunFollowsClock: !still, ambientMotion: !still };
}
/** The app setting as the Mountain runtime reads it, plus the OS query. */
export function appReducedMotion(): boolean {
  const app = typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduced';
  const os = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return app || os;
}
/** The app's calm view as published by `applyComfort` (`html[data-quiet="true"]`). */
export function appCalm(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.quiet === 'true';
}
