/**
 * Hearth Mountain v2 · the race's two authored shots (camera point 10).
 *
 * - **Start** — for the first 1.5 s of the countdown the camera stands above
 *   and behind the start gate and looks down the first bends of the course;
 *   over the next 0.8 s it hands over to the chase camera, so "Go" is already
 *   behind the rider.
 * - **Finish** — when the Summit-to-sea run is finished the camera eases to a
 *   shot of the quay's run-out with the Fund bank's door beyond it (the
 *   "Open the Fund" moment) and holds while the rider stands there.
 *
 * Both are read from the camera adapter (the race line, the quay, the Fund
 * door), and both blend with the chase frame by a weight, never cut —
 * except under reduced motion, where the weight is a step.
 * Pure: no three.js, no DOM, no clock of its own.
 */
import { FUND_DOOR, QUAY, RACE_LINE, cameraGround, type V3 } from "../../camera/worldAdapter.ts";
import type { SkateCameraFrame } from "./skateCamera.ts";
import { portraitFov } from "../../camera/mountainPoses.ts";

export const RACE_SHOT = Object.freeze({
  /** The countdown is 3 s: the start shot holds until 1.5 s remain, then hands over by 0.7. */
  startHold: 1.5, startHandover: 0.7,
  /** The finish shot eases in over this long after the finish, and out when the run is put away. */
  finishIn: 1.1, finishOut: 0.8,
  /** How far down the course the start shot looks (units along the line). */
  startLook: 70,
  finishFov: 50, startFov: 56,
});

const along = (line: readonly V3[], distance: number): V3 => {
  let left = distance;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, b = line[i]!, l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (left <= l && l > 0) { const t = left / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    left -= l;
  }
  return line[line.length - 1] ?? [0, 0, 0];
};

/** The start shot: above and behind the gate, looking down the first bends. */
export function raceStartShot(line: readonly V3[] = RACE_LINE, aspect = 1.6): { eye: V3; look: V3; fov: number } {
  const start = line[0] ?? [0, 0, 0], near = along(line, 12), far = along(line, RACE_SHOT.startLook);
  let dx = near[0] - start[0], dz = near[2] - start[2];
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const ex = start[0] - dx * 7 + dz * 2.5, ez = start[2] - dz * 7 - dx * 2.5;
  const eye: V3 = [ex, Math.max(start[1] + 5.5, cameraGround(ex, ez) + 3), ez];
  const look: V3 = [(near[0] + far[0] * 2) / 3, (near[1] + far[1] * 2) / 3, (near[2] + far[2] * 2) / 3];
  return { eye, look, fov: portraitFov(aspect, RACE_SHOT.startFov) };
}

/** The finish shot: the quay's run-out in the foreground, the Fund bank's door beyond it. */
export function raceFinishShot(aspect = 1.6): { eye: V3; look: V3; fov: number } {
  let dx = FUND_DOOR[0] - QUAY[0], dz = FUND_DOOR[2] - QUAY[2];
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  // Out over the water behind the quay, a touch to the side and up, looking up the town toward the door.
  const ex = QUAY[0] - dx * 22 + dz * 2, ez = QUAY[2] - dz * 22 - dx * 2;
  const eye: V3 = [ex, Math.max(QUAY[1] + 9, cameraGround(ex, ez) + 3), ez];
  const look: V3 = [QUAY[0] + dx * l * 0.4, 1.4, QUAY[2] + dz * l * 0.4];
  return { eye, look, fov: portraitFov(aspect, RACE_SHOT.finishFov) };
}

const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** How much of the start shot shows with `countdown` seconds left (1 = all of it, 0 = the chase camera). */
export function startShotWeight(countdown: number, reduced = false): number {
  if (!(countdown > 0)) return 0;
  if (reduced) return countdown > RACE_SHOT.startHold ? 1 : 0;
  return smooth(RACE_SHOT.startHold - RACE_SHOT.startHandover, RACE_SHOT.startHold, countdown);
}

/** An authored shot laid over a chase frame by `w` (a new frame; the chase camera's own is left alone). */
export function blendShot(frame: SkateCameraFrame, shot: { eye: V3; look: V3; fov: number }, w: number): SkateCameraFrame {
  if (!(w > 0)) return frame;
  const k = Math.min(1, w);
  const mix = (a: readonly number[], b: V3): [number, number, number] => [a[0]! + (b[0] - a[0]!) * k, a[1]! + (b[1] - a[1]!) * k, a[2]! + (b[2] - a[2]!) * k];
  return { position: mix(frame.position, shot.eye), target: mix(frame.target, shot.look), fov: frame.fov + (shot.fov - frame.fov) * k, roll: frame.roll * (1 - k) };
}

/**
 * The finish shot's weight over time: eases in after the finish, holds while
 * the run stays finished, eases out when it is put away. Call once per frame.
 */
export function createFinishShot() {
  let w = 0;
  return {
    update(finished: boolean, dt: number, reduced: boolean): number {
      if (reduced) { w = finished ? 1 : 0; return w; }
      const step = Math.max(0, Math.min(dt, 0.1));
      w = finished ? Math.min(1, w + step / RACE_SHOT.finishIn) : Math.max(0, w - step / RACE_SHOT.finishOut);
      return w * w * (3 - 2 * w);
    },
    value: () => w,
  };
}
