/**
 * The flip between the two worlds (SIMPLE_VIEW_DESK "The concept"): the Desk
 * is the reading edition, the Harbour is the illustrated one, and the switch
 * is the same one the quick sheet's edition toggle writes — the
 * `hearth:motion` preference plus the `hearth:motion` event the harbour shell
 * already listens for to re-decide its tier.
 *
 * One writer for the whole app: `chooseMotionEdition` (the sheet's switch, the
 * bar's Simple-view flip, the backtick key and the Desk's Harbour button all
 * come through it, so they can never disagree about what "flat" is written as).
 *
 * The Desk's header button always means "to the Harbour", so it writes the
 * illustrated edition rather than blindly toggling: a Desk shown because the
 * device has no WebGL must not be flipped *into* the reading edition by a
 * button that says Harbour.
 */
import { MOTION_KEY, chooseMotionEdition, type MotionEdition } from "../nav/motionEdition.ts";

export const MOTION_EVENT: typeof MOTION_KEY = MOTION_KEY;

export function writeEdition(edition: MotionEdition, storage?: Pick<Storage, "setItem">): void {
  chooseMotionEdition(edition, storage);
}

/** Back to the Harbour: the illustrated edition. */
export function flipToHarbour(storage?: Pick<Storage, "setItem">): void {
  writeEdition("illustrated", storage);
}
