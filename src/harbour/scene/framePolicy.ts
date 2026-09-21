/**
 * Pure frame policy (BUILD_PLAN §2 #6). The Court is an invalidation-driven
 * scene: the camera eases at 30 fps, the Queen breathes at 20 fps, a touch
 * keeps frames flowing while a pointer is down, a body walking the island
 * keeps them flowing at the camera's rate, and a settled court draws nothing
 * until data, size or controls invalidate it.
 */
export type HarbourFrameActivity = {
  reduced: boolean;
  /** The camera has not reached its destination. */
  moving: boolean;
  /** The place wants its idle animation (the Queen's breath, Hercules's tail). */
  breathing: boolean;
  /** A pointer is down on the stage. */
  touched: boolean;
  /** The twins' projected rects would change. */
  projectionChanged: boolean;
  /** The page or the stage is not visible. */
  hidden: boolean;
  /** A tool is open in front of the court: the stage is a door strip. */
  toolOpen: boolean;
  /**
   * A body is walking the island (`body/walker.ts`). A walking character
   * inverts this scene's premise — render-on-demand assumes nothing moves
   * unless it was asked to — so it is said out loud here rather than worked
   * around: while it is true the world runs at the camera's rate, and the
   * moment it goes false the policy falls straight back through its own
   * branches to rest. **Unlike `breathing`, reduced motion does not stop it**:
   * the character still walks, because walking is the app. What reduced motion
   * stops is the swinging camera and the ambient idles, and `animate` below
   * stays false for those exactly as it always did.
   */
  walking?: boolean;
};

export type HarbourFramePolicy = { animate: boolean; render: boolean; schedule: boolean; intervalMs: number };

export const CAMERA_INTERVAL_MS = 1000 / 30;
export const BREATH_INTERVAL_MS = 1000 / 20;

export function harbourFramePolicy(activity: HarbourFrameActivity): HarbourFramePolicy {
  if (activity.hidden) return { animate: false, render: false, schedule: false, intervalMs: 0 };
  const easing = activity.moving || activity.touched || activity.walking === true;
  if (easing) return { animate: !activity.reduced && !activity.toolOpen, render: true, schedule: true, intervalMs: CAMERA_INTERVAL_MS };
  const breathes = activity.breathing && !activity.reduced && !activity.toolOpen;
  if (breathes) return { animate: true, render: true, schedule: true, intervalMs: BREATH_INTERVAL_MS };
  if (activity.projectionChanged) return { animate: false, render: true, schedule: false, intervalMs: 0 };
  return { animate: false, render: false, schedule: false, intervalMs: 0 };
}
