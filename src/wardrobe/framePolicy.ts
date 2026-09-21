import type { RenderTier } from "../harbour/scene/quality.ts";

/**
 * Pure frame policy for the dressing room, in the grammar the harbour and the
 * house already speak (`harbour/scene/framePolicy.ts`).
 *
 * The room is a still life with one thing alive in it: Hercules breathing and
 * blinking. A camera that is travelling to a zone, or a toy mid-performance,
 * is worth thirty frames a second; his breath is worth twenty, which is what
 * the Queen's is worth; and a room with nothing moving in it — paused, under
 * reduced motion, off the screen, behind a hidden tab — is worth none at all.
 * Before this, it ran flat out for as long as it was visible.
 *
 * The mirror is the one thing decided here rather than drawn here. A
 * `Reflector` draws the whole room a second time from behind the glass, so on
 * a `lite` tier it is not redrawn for the breath alone: it keeps the last
 * reflection it took, which still reads as a mirror because the room it shows
 * has not moved. Anything the reader does — turning him, changing a piece,
 * posing him, travelling — moves the room, and the mirror is redrawn for it.
 */
export type WardrobeFrameActivity = {
  /** The reader paused the room, or reduced motion did. */
  paused: boolean;
  /** The tab is hidden or the room is off the screen. */
  hidden: boolean;
  /** The camera has not reached the zone it was sent to (the play room). */
  moving: boolean;
  /** A toy is mid-performance (the play room). */
  performing: boolean;
  /** A clip is running on him: his breath, a blink, a reaction. */
  breathing: boolean;
  tier: RenderTier;
};

export type WardrobeFramePolicy = { render: boolean; schedule: boolean; mirror: boolean; intervalMs: number };

export const WARDROBE_CAMERA_INTERVAL_MS = 1000 / 30;
export const WARDROBE_BREATH_INTERVAL_MS = 1000 / 20;

export function wardrobeFramePolicy(activity: WardrobeFrameActivity): WardrobeFramePolicy {
  if (activity.hidden || activity.paused) return { render: false, schedule: false, mirror: false, intervalMs: 0 };
  if (activity.moving || activity.performing) return { render: true, schedule: true, mirror: true, intervalMs: WARDROBE_CAMERA_INTERVAL_MS };
  if (activity.breathing) return { render: true, schedule: true, mirror: activity.tier !== "lite", intervalMs: WARDROBE_BREATH_INTERVAL_MS };
  return { render: false, schedule: false, mirror: false, intervalMs: 0 };
}
