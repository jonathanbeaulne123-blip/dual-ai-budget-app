/**
 * Turning 12.5 samples a second into a body that walks.
 *
 * A position arriving at ~12 Hz and drawn straight to a transform reads as a
 * stutter, so this module does what every netcode does and draws the *past*:
 * the renderer asks for the pose at `now - WORLD_RENDER_DELAY_MS`, which is
 * almost always a time the track already has two samples around, and the pose
 * is the interpolation between them. When a packet is late the track
 * extrapolates from the last two samples — but only briefly
 * (`WORLD_RECKON_MS`) and only at a walking speed, because a guess held too
 * long is a lie about where someone is.
 *
 * What happens when a peer goes quiet is a product decision, not a technical
 * one, and it is made here so it is testable:
 *
 *   `walking` → the newest sample is younger than `WORLD_LIVE_MS`. The body is
 *               drawn and may stride. This is the only state that claims
 *               "she is there, now".
 *   `parked`  → older than that. The stride stops *immediately*, the body
 *               stands where it was last actually seen (never where it was
 *               guessed to be), and it fades out over `WORLD_FADE_MS`. The
 *               Court falls back to the honest "was here recently" pin.
 *   `gone`    → faded. The walker is not drawn at all.
 *
 * A body therefore never freezes mid-stride forever, and a body that is drawn
 * walking is always drawn from a sample less than two and a half seconds old.
 */

/** Draw the peer this far in the past, so there is nearly always a sample on each side. */
export const WORLD_RENDER_DELAY_MS = 140;
/** How long the track may guess past its newest sample. */
export const WORLD_RECKON_MS = 320;
/** Nobody walks faster than this; a guess is never allowed to. */
export const WORLD_MAX_SPEED = 6;
/** A sample older than this stops claiming to be live. */
export const WORLD_LIVE_MS = 2500;
/** ...and the body fades away over this. */
export const WORLD_FADE_MS = 600;
/** Past this the peer is dropped entirely and the lane forgets them. */
export const WORLD_EXPIRE_MS = 8000;
/** How many samples a track keeps. Two would do; a few make late packets survivable. */
export const WORLD_TRACK_DEPTH = 8;

export type WorldSample = { x: number; z: number; yaw: number; moving: boolean; at: number };
export type WorldMotionState = "walking" | "parked" | "gone";
export type WorldPose = {
  x: number;
  z: number;
  yaw: number;
  /** True only while the track is drawing real or briefly-guessed motion. */
  moving: boolean;
  /** 1 while live, ramping to 0 across the fade, 0 once gone. */
  opacity: number;
  state: WorldMotionState;
  /** Age of the newest sample, in ms — what the honest UI reads. */
  ageMs: number;
};

export type WorldTrackOptions = {
  renderDelayMs?: number;
  reckonMs?: number;
  liveMs?: number;
  fadeMs?: number;
  maxSpeed?: number;
};

const TAU = Math.PI * 2;

/** Shortest way round the circle from `a` to `b`. */
export function yawDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function lerpYaw(a: number, b: number, k: number): number {
  return a + yawDelta(a, b) * k;
}

export type WorldTrack = {
  push(sample: WorldSample): void;
  /** The pose to draw at `nowMs`, or null when nothing has ever arrived. */
  pose(nowMs: number): WorldPose | null;
  /** Age of the newest sample, or Infinity. */
  ageMs(nowMs: number): number;
  samples(): readonly WorldSample[];
  clear(): void;
};

export function createWorldTrack(options: WorldTrackOptions = {}): WorldTrack {
  const renderDelayMs = options.renderDelayMs ?? WORLD_RENDER_DELAY_MS;
  const reckonMs = options.reckonMs ?? WORLD_RECKON_MS;
  const liveMs = options.liveMs ?? WORLD_LIVE_MS;
  const fadeMs = options.fadeMs ?? WORLD_FADE_MS;
  const maxSpeed = options.maxSpeed ?? WORLD_MAX_SPEED;
  let buffer: WorldSample[] = [];

  const push = (sample: WorldSample) => {
    // Out-of-order arrival is normal on a lossy link: drop anything older than
    // what we already hold rather than teleporting the body backwards.
    const newest = buffer.at(-1);
    if (newest && sample.at <= newest.at) return;
    buffer.push(sample);
    if (buffer.length > WORLD_TRACK_DEPTH) buffer = buffer.slice(-WORLD_TRACK_DEPTH);
  };

  const ageMs = (nowMs: number) => {
    const newest = buffer.at(-1);
    return newest ? nowMs - newest.at : Number.POSITIVE_INFINITY;
  };

  const pose = (nowMs: number): WorldPose | null => {
    const newest = buffer.at(-1);
    if (!newest) return null;
    const age = nowMs - newest.at;

    // Past live: stand at the last real sample, stop the stride, fade out.
    if (age > liveMs) {
      const faded = Math.max(0, 1 - (age - liveMs) / Math.max(1, fadeMs));
      return {
        x: newest.x, z: newest.z, yaw: newest.yaw,
        moving: false,
        opacity: faded,
        state: faded > 0 ? "parked" : "gone",
        ageMs: age,
      };
    }

    const renderAt = nowMs - renderDelayMs;
    const oldest = buffer[0]!;
    if (renderAt <= oldest.at) {
      return { x: oldest.x, z: oldest.z, yaw: oldest.yaw, moving: oldest.moving, opacity: 1, state: "walking", ageMs: age };
    }

    if (renderAt <= newest.at) {
      // Interpolate: find the pair that brackets the render time.
      let a = buffer[0]!, b = buffer[0]!;
      for (let i = 1; i < buffer.length; i++) {
        if (buffer[i]!.at >= renderAt) { a = buffer[i - 1]!; b = buffer[i]!; break; }
      }
      const span = Math.max(1, b.at - a.at);
      const k = Math.max(0, Math.min(1, (renderAt - a.at) / span));
      return {
        x: a.x + (b.x - a.x) * k,
        z: a.z + (b.z - a.z) * k,
        yaw: lerpYaw(a.yaw, b.yaw, k),
        moving: k < 0.5 ? a.moving : b.moving,
        opacity: 1,
        state: "walking",
        ageMs: age,
      };
    }

    // A packet is late. Guess forward from the last two samples, briefly.
    const previous = buffer.length >= 2 ? buffer[buffer.length - 2]! : null;
    const over = renderAt - newest.at;
    const reckon = Math.min(over, reckonMs);
    if (!previous || !newest.moving || reckon <= 0) {
      return { x: newest.x, z: newest.z, yaw: newest.yaw, moving: false, opacity: 1, state: "walking", ageMs: age };
    }
    const span = Math.max(1, newest.at - previous.at);
    let vx = (newest.x - previous.x) / span, vz = (newest.z - previous.z) / span;
    const speed = Math.hypot(vx, vz) * 1000;
    if (speed > maxSpeed) { const k = maxSpeed / speed; vx *= k; vz *= k; }
    return {
      x: newest.x + vx * reckon,
      z: newest.z + vz * reckon,
      yaw: newest.yaw,
      // The guess has run out: stand still rather than mime a walk on no data.
      moving: over <= reckonMs,
      opacity: 1,
      state: "walking",
      ageMs: age,
    };
  };

  return { push, pose, ageMs, samples: () => buffer, clear() { buffer = []; } };
}
