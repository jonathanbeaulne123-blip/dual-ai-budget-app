import { COURT_BOUNDS } from "./poses.ts";

/**
 * Hearth Mountain v2 (C5) · the way out to the Journey is one more pull past
 * the overview, and only *at* the limit.
 *
 * The overview (`mountainPoses.overviewPose`) stands inside the Look camera's
 * far limit (`COURT_BOUNDS.maxR`). Zooming out first carries the camera to
 * that limit; only attempts made **at** it count. The first one arms the
 * edge — the shell shows "Pull once more to open the Journey" — and only a
 * later, separate pull (after `wait` ms, so one long flick of a wheel can
 * never do both) opens it. Any zoom in, or a pull made short of the limit,
 * disarms it; an armed edge left alone for `expire` ms lets go by itself.
 *
 * Pure: the caller passes the clock.
 */
export const ZOOM_EXIT = Object.freeze({
  /** The far limit the edge is measured at, derived from the Look camera's own bounds. */
  limit: COURT_BOUNDS.maxR,
  /** A radius within this share of the limit is "at" it. */
  at: 0.985,
  /** Log-radius of outward pull, at the limit, that arms the edge… */
  arm: 0.12,
  /** …and the further pull, after it is shown, that opens the Journey. */
  confirm: 0.14,
  /** The affordance is on screen at least this long before a pull can open the Journey. */
  wait: 450,
  /** An armed edge nobody pulls again lets go after this long. */
  expire: 4000,
});

export type ZoomEdge = { overscroll: number; armedAt: number | null; exit: boolean };
export const ZOOM_REST: ZoomEdge = Object.freeze({ overscroll: 0, armedAt: null, exit: false });

/** Is this radius at the Look camera's far limit? */
export const atZoomLimit = (radius: number): boolean => Number.isFinite(radius) && radius >= ZOOM_EXIT.limit * ZOOM_EXIT.at;

/** One zoom attempt at `radius` (before it is applied), `delta` in log-radius (positive = out), at time `now` (ms). */
export function harbourZoomExit(radius: number, delta: number, state: ZoomEdge, now: number): ZoomEdge {
  if (!Number.isFinite(delta) || delta <= 0 || !atZoomLimit(radius)) return ZOOM_REST;
  const pull = Math.min(0.5, delta);
  if (state.armedAt === null || now - state.armedAt > ZOOM_EXIT.expire) {
    const overscroll = (state.armedAt === null ? state.overscroll : 0) + pull;
    return overscroll >= ZOOM_EXIT.arm ? { overscroll: 0, armedAt: now, exit: false } : { overscroll, armedAt: null, exit: false };
  }
  // Armed: the same flick that armed it cannot open it.
  if (now - state.armedAt < ZOOM_EXIT.wait) return { ...state, exit: false };
  const overscroll = state.overscroll + pull;
  return { overscroll, armedAt: state.armedAt, exit: overscroll >= ZOOM_EXIT.confirm };
}
/** Is the "pull once more" affordance showing? */
export const zoomEdgeArmed = (state: ZoomEdge, now: number): boolean => state.armedAt !== null && !state.exit && now - state.armedAt <= ZOOM_EXIT.expire;
