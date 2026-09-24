/**
 * The flip between the two worlds (SIMPLE_VIEW_DESK "The concept"): the Desk
 * is the reading edition, the Harbour is the illustrated one, and the switch
 * is the same one the quick sheet's edition toggle writes — the
 * `hearth:motion` preference plus the `hearth:motion` event the harbour shell
 * already listens for to re-decide its tier.
 *
 * The Desk's header button always means "to the Harbour", so it writes the
 * illustrated edition rather than blindly toggling: a Desk shown because the
 * device has no WebGL must not be flipped *into* the reading edition by a
 * button that says Harbour.
 */
import { MOTION_KEY, type MotionEdition } from "../nav/QuickSheet.tsx";

export const MOTION_EVENT = "hearth:motion";

export function writeEdition(edition: MotionEdition, storage?: Pick<Storage, "setItem">): void {
  // The same values the quick sheet writes: "flat" for the reading edition, "" for illustrated.
  try { (storage ?? window.localStorage).setItem(MOTION_KEY, edition === "flat" ? "flat" : ""); } catch { /* A preference is a convenience; the flip still dispatches. */ }
  try { window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: edition })); } catch { /* jsdom without CustomEvent is still fine. */ }
}

/** Back to the Harbour: the illustrated edition. */
export function flipToHarbour(storage?: Pick<Storage, "setItem">): void {
  writeEdition("illustrated", storage);
}
