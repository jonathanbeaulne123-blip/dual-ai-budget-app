import { COURT_BOUNDS } from "./poses.ts";

/** The Journey begins as the same outward gesture carries Look beyond its farthest view. */
export const JOURNEY_ZOOM_LIMIT = COURT_BOUNDS.maxR;

export function entersJourneyFromZoom(radius: number, delta: number): boolean {
  return Number.isFinite(radius) && Number.isFinite(delta) && delta > 0
    && radius * Math.exp(delta) >= JOURNEY_ZOOM_LIMIT * 1.025;
}
