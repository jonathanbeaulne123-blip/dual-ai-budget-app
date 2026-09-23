import type { SkatePresent } from '../contract.ts';

/**
 * A partner off the wire only says a coarse act and a progress —
 * `'skate-kickflip'` at 0.4 — twelve times a second. This turns that into a
 * plausible `SkatePresent` so the same look animates a remote rider: a push
 * stroke, a pop and a flip over the progress, a grab easing in and out, a
 * grind or manual swaying with the balance the progress carries, a tumble.
 * Feed it to `look.update(present, null, dt, reduced)` (null events: the
 * rig infers the pop from the take-off).
 *
 * Position/heading are left for the caller (`x, y, z, heading, boardYaw`).
 */
export function poseFromLegacyAct(act: string | null | undefined, p: number, out: SkatePresent = blankPresent(), moving = true): SkatePresent {
  const k = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
  const kind = (act ?? 'skate').replace(/^skate-?/, '') || 'roll';
  out.phase = moving ? 'roll' : 'idle'; out.trick = null; out.grab = null; out.grind = null; out.manual = null; out.bail = null;
  out.crouch = 0; out.balance = 0; out.impact = 0; out.airTime = 0; out.clearance = 0; out.vy = 0; out.pushPhase = 0; out.bodyTwist = 0;
  out.speed = moving ? 3.2 : 0;
  const airArc = (dur: number) => { out.phase = 'air'; out.airTime = k * dur; out.clearance = 4 * k * (1 - k) * .55 + .01; out.vy = (1 - 2 * k) * 3.4; };
  switch (kind) {
    case 'roll': if (moving && k > 0) { out.phase = 'push'; out.pushPhase = k; } break;
    case 'ollie': airArc(.9); break;
    case 'grab': airArc(.9); out.grab = { grabId: 'melon', weight: Math.sin(Math.PI * k) }; break;
    case 'grind': out.phase = 'grind'; out.grind = { grindId: '50-50', grindableId: 'wire', faceSign: 1 }; out.balance = k * 2 - 1; out.surface = 'metal'; break;
    case 'manual': out.phase = 'manual'; out.manual = 'manual'; out.balance = k * 2 - 1; break;
    case 'bail': out.phase = 'bail'; out.bail = { t: k * .85, reason: 'wire', dirX: Math.sin(out.heading), dirZ: Math.cos(out.heading) }; out.speed = 0; break;
    default: airArc(.7); out.trick = { flipId: kind, u: k }; break;
  }
  return out;
}

export function blankPresent(): SkatePresent {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, heading: 0, boardYaw: 0, boardPitch: 0, boardRoll: 0, bodyTwist: 0,
    phase: 'idle', stance: 'regular', switch: false, fakie: false, crouch: 0, lean: 0, carve: 0, balance: 0, pushPhase: 0,
    airTime: 0, clearance: 0, trick: null, grab: null, grind: null, manual: null, bail: null, impact: 0, surface: 'concrete',
  };
}
