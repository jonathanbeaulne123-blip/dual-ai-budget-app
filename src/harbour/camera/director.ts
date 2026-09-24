/**
 * Hearth Mountain v2 · one camera system, explicit hand-offs (C3).
 *
 * The harbour has one camera and five ways of driving it. Three are the
 * modes a person chooses (DIRECTION.md): **Look** (the bird's-eye diorama,
 * `courtCamera.ts`), **Walk** (behind the body, `followCamera.ts`) and
 * **Close** (the nearest landmark's authored hold). Two are taken for them:
 * **Ride** (`rideCamera.ts`, on the funicular and the gondola) and **Skate**
 * (the chase camera). The runtime (`scene/runtime.ts`) holds which one is
 * driving; every change of driver goes through one of the hand-offs below,
 * so no change of mode is ever a whip or a flight to somewhere stale:
 *
 * - `handToLook` — a tool opens, the guide opens, the game pauses: Look takes
 *   the view *exactly as it is shown* (r, θ, φ and the target at the body),
 *   so the next frame moves nothing.
 * - `handToWalk` — a key is pressed: Walk starts from Look's view if Look is
 *   looking at the body, and from behind the body on Look's heading if it is
 *   looking at somewhere else entirely (`SEED_REACH`); the lens blends.
 * - `walkFrom` — arriving somewhere (out of a door, off a ride, a "Visit"):
 *   Walk stands behind the body on an authored heading at once.
 *
 * Pure glue: it only calls the cameras' own methods.
 */
import type { CourtCamera } from "./courtCamera.ts";
import type { FollowCamera } from "./followCamera.ts";
import type { CourtPose } from "./poses.ts";

export type CameraMode = "look" | "walk" | "close" | "ride" | "skate";

/** Give the view to Look exactly as another camera is showing it. */
export function handToLook(court: CourtCamera, shown: CourtPose): void {
  court.hold(shown);
}

/** Give the view to Walk from where Look stands (or from behind the body when Look is looking elsewhere). */
export function handToWalk(follow: FollowCamera, look: CourtPose, lens: number): void {
  follow.lensFrom(lens);
  follow.seed(look);
}

/** Stand Walk behind the body at once, looking along `heading` (the eye's own heading is its opposite). */
export function walkFrom(follow: FollowCamera, heading: number): void {
  follow.snap(Math.atan2(-Math.sin(heading), -Math.cos(heading)));
}
