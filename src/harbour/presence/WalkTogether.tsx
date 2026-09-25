import { useEffect, useState, type CSSProperties } from "react";
import type { Environment } from "../../core/types.ts";
import type { SoftPresencePeer } from "../../softPresence.ts";
import {
  setWorldPresenceShare,
  worldPartnerLine,
  worldPartnerTreatment,
  type WorldPresenceShare,
} from "../../softPresenceWorld.ts";
import type { PlaceWalkSource } from "../scene/place.ts";
import type { HarbourPlaceId } from "../flag.ts";

/**
 * "Walk together": the one place a person says yes or no to being followed
 * around the island, and the one place the app says what is actually true
 * about the other person right now.
 *
 * The two halves are deliberately in the same object. A consent control that
 * does not show you what it is disclosing is not really a consent control, and
 * a status line that does not let you stop it is a notification. Here the line
 * under the switch is the *data* outcome — what the Court is drawing this
 * second — not the connection outcome: "is here" only while a body is being
 * drawn from a live sample, "was here a moment ago" the instant it parks, and
 * "was here recently" when all that is left is the soft presence the app has
 * always had.
 *
 * When the coarse presence opt-out is on, this is not a choice at all: the
 * switch is disabled and says so, because a finer signal may never escape a
 * coarser refusal.
 */

export type WalkTogetherProps = {
  environment: Environment;
  share: WorldPresenceShare;
  onShare: (share: WorldPresenceShare) => void;
  /** The same live feed the Court is drawing from, polled here once a second for the words. */
  walk: PlaceWalkSource | null;
  /** The live peer's name, from the household — never a name that travelled on the lane. */
  walkName: string | null;
  worldUnavailable?: boolean;
  /** Today's soft presence for the same person: the honest fallback. */
  soft: SoftPresencePeer | null;
  here: HarbourPlaceId;
  placeName: string;
  /** The coarse opt-out from `softPresence.ts`. */
  softPresenceOptedOut: boolean;
  /**
   * Undo that coarse opt-out from here. Being hidden is a choice a person made
   * in another room of the app, and the honest thing is to say so — but a
   * sentence that names a setting and does not offer it is a dead end, and
   * this switch is exactly where somebody finds out they are hidden.
   */
  onUnhide?: () => void;
  /** There is somebody to walk with. */
  hasPartner: boolean;
};

/**
 * Where this stands is in `harbour.css`, not here: it is the top of the
 * stage's own left-hand column (the sync words, her line, the walking
 * invitation, then this), and that column's offsets differ between a phone,
 * where the compass is a bar along the whole bottom edge, and a desktop,
 * where it is a pill in the corner. An inline style cannot ask which.
 */
const wrap: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 2,
  padding: "7px 11px", borderRadius: 12,
  background: "color-mix(in srgb, var(--surface, #fffaf0) 86%, transparent)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.16)", font: "12px/1.35 system-ui, sans-serif",
  maxWidth: 240, pointerEvents: "auto",
};
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 7, cursor: "pointer" };
const unhide: CSSProperties = {
  marginTop: 4, alignSelf: "flex-start", cursor: "pointer",
  font: "inherit", fontWeight: 600, padding: "4px 10px", borderRadius: 8,
  border: "1px solid color-mix(in srgb, currentColor 28%, transparent)",
  background: "transparent", color: "inherit",
};
const note: CSSProperties = { opacity: 0.72 };

export function WalkTogether(props: WalkTogetherProps) {
  const { environment, share, onShare, walk, walkName, soft, here, placeName, softPresenceOptedOut, hasPartner } = props;
  // A second is the right grain for words: the body moves at frame rate, but
  // "is here" becoming "was here a moment ago" is a sentence, not an animation.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!walk) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [walk]);
  void tick;
  if (!hasPartner) return null;
  const on = share === "live" && !softPresenceOptedOut;
  const nowMs = Date.now();
  const pose = walk?.pose(nowMs) ?? null;
  const treatment = worldPartnerTreatment({
    walk: pose && walkName
      ? { name: walkName, placeId: here, state: pose.opacity <= 0 ? "gone" : pose.opacity < 1 ? "parked" : "walking", opacity: pose.opacity }
      : null,
    soft,
    here,
    nowMs,
  });
  const line = worldPartnerLine(treatment, placeName);
  const toggle = (next: boolean) => {
    const value: WorldPresenceShare = next ? "live" : "off";
    setWorldPresenceShare(environment, value);
    onShare(value);
  };
  return <div className="harbour-walk-together" data-walk-together={on ? "live" : "off"} style={wrap}>
    <label style={row}>
      <input
        type="checkbox"
        checked={on}
        disabled={softPresenceOptedOut}
        onChange={(event) => toggle(event.currentTarget.checked)}
      />
      <span>Walk together</span>
    </label>
    <span style={note}>
      {softPresenceOptedOut
        ? "You are hidden in this house, so nothing is shared."
        : on
          ? "Your place on the island is shared while this world is open."
          : "Your place on the island stays yours."}
    </span>
    {softPresenceOptedOut && props.onUnhide && (
      <button type="button" style={unhide} onClick={() => props.onUnhide?.()}>
        Stop hiding
      </button>
    )}
    {props.worldUnavailable && <span data-world-unavailable="" role="status" style={note}>Your partner's live position is unavailable in this geography.</span>}
    {line && <span data-walk-together-line="" style={note}>{line}</span>}
  </div>;
}
