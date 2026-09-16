/**
 * Plan Studio v3 (D-274): the rest screen, the tool drawer and the one check-in.
 * Opt-in — set `VITE_PLAN_STUDIO_V3=1` (or `true`). Anything else keeps today's
 * Plan Studio exactly as it is. It lives inside the Plan V2 room, so it cannot
 * outlive `VITE_PLAN_SYSTEM_V2`.
 */
export function planStudioV3Enabled(value: unknown = import.meta.env.VITE_PLAN_STUDIO_V3): boolean {
  return value === "1" || value === "true";
}
