/**
 * Walking together: the separate, explicit consent for *live position*.
 *
 * `softPresence.ts` has one boolean per environment, and it answers one
 * question: may this kitchen say I am in it? That is a coarse disclosure —
 * "Bianca is in the kitchen" — and it is the one the household already agreed
 * to when they set the app up together.
 *
 * Live position is not the same disclosure. "Bianca is standing next to you
 * looking at the Glasshouse, right now" is a continuous, second-by-second
 * account of where someone's attention is: which building they walked to,
 * how long they stood there, whether they turned away when you arrived. It
 * carries a shape of behaviour the coarse signal does not, so it gets its own
 * choice, it is **off until it is turned on**, and it can be turned off
 * without anyone disappearing from the kitchen.
 *
 * Three rules hold here:
 *
 *  1. **Default private.** No stored preference means `"off"`. Nothing is
 *     published on the world lane until someone says yes.
 *  2. **The coarse opt-out wins.** Someone who has hidden themselves entirely
 *     cannot be walking around in the Court: `softPresenceOptedOut` forces the
 *     gate shut whatever the finer setting says. A finer signal may never
 *     escape a coarser refusal.
 *  3. **Off degrades to today, not to nothing.** Turning walking off — or
 *     losing the feed — leaves the existing soft presence running, so the
 *     partner is still honestly "in the kitchen" / "was here recently". The
 *     feature can fail closed without the house going dark.
 *
 * And the exclusion the existing lane already makes (`softPresence.ts`
 * `peersFromDevices`, which only ever reads *shared* household devices in the
 * matching environment) is kept in its own terms here: the harbour is a
 * household-scope world (`harbour/flag.ts` `harbourOwnsRoute`), so position is
 * published **only** from the household view and only from a named shared
 * place. From a personal view nothing goes out at all — not a position, not a
 * place id — because the place id alone would say which private surface
 * someone is standing on.
 *
 * Like the opt-out it mirrors, the preference is per-environment localStorage.
 * It is never a synced field: presence is ephemeral, and a choice about being
 * watched should not be something the other person's device can read.
 */

import type { Environment, LedgerView } from "./core/types.ts";
import { isFreshPresence, type SoftPresencePeer } from "./softPresence.ts";
import { isWorldPlaceId, type WorldPlaceId } from "./ledgerSync/worldPresenceWire.ts";

const SHARE_KEY_PREFIX = "hearth.world-presence.share:";

/** `"off"` is the default and the more private option. */
export type WorldPresenceShare = "off" | "live";
export const WORLD_PRESENCE_SHARE_DEFAULT: WorldPresenceShare = "off";

function storageGet(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, value); } catch { /* quota */ }
}
function storageRemove(key: string): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function worldPresenceShareKey(environment: Environment): string {
  return `${SHARE_KEY_PREFIX}${environment}`;
}

export function readWorldPresenceShare(
  environment: Environment,
  store?: { getItem(key: string): string | null },
): WorldPresenceShare {
  const get = store?.getItem?.bind(store) ?? storageGet;
  // Only the exact opt-in reads as on. Anything else — missing, corrupt,
  // a value written by an older build — is the private default.
  return get(worldPresenceShareKey(environment)) === "live" ? "live" : WORLD_PRESENCE_SHARE_DEFAULT;
}

export function setWorldPresenceShare(
  environment: Environment,
  share: WorldPresenceShare,
  store?: { setItem(key: string, value: string): void; removeItem(key: string): void },
): void {
  const key = worldPresenceShareKey(environment);
  if (share === "live") {
    if (store) store.setItem(key, "live"); else storageSet(key, "live");
  } else if (store) {
    store.removeItem(key);
  } else {
    storageRemove(key);
  }
}

/** Why the world lane is or is not publishing. Every value is something the UI may say out loud. */
export type WorldPresenceGateReason =
  | "publishing"
  | "signed-out"
  | "soft-presence-off"
  | "share-off"
  | "personal-view"
  | "place-unknown"
  | "hidden";

export type WorldPresenceGate = { publish: boolean; reason: WorldPresenceGateReason };

export type WorldPresenceGateInput = {
  signedIn: boolean;
  memberId: string | null | undefined;
  environment: Environment;
  /** The harbour is household-scope only; a personal view never publishes. */
  view: LedgerView;
  /** The shared place the member is standing in, or null when they are not in the world. */
  placeId: WorldPlaceId | string | null | undefined;
  /** The tab is in front of the person. A backgrounded tab publishes nothing. */
  visible: boolean;
  /** The coarse opt-out (`softPresence.ts`). */
  softPresenceOptedOut: boolean;
  /** The finer, explicit choice. */
  share: WorldPresenceShare;
};

/**
 * The send-side gate. Called before every step; when it says no, nothing is
 * written to the socket at all — not a throttled frame, not a keepalive.
 */
export function worldPresenceGate(input: WorldPresenceGateInput): WorldPresenceGate {
  if (!input.signedIn || !input.memberId) return { publish: false, reason: "signed-out" };
  if (input.softPresenceOptedOut) return { publish: false, reason: "soft-presence-off" };
  if (input.share !== "live") return { publish: false, reason: "share-off" };
  if (input.view !== "household") return { publish: false, reason: "personal-view" };
  if (!isWorldPlaceId(input.placeId)) return { publish: false, reason: "place-unknown" };
  if (!input.visible) return { publish: false, reason: "hidden" };
  return { publish: true, reason: "publishing" };
}

export function canPublishWorldPresence(input: WorldPresenceGateInput): boolean {
  return worldPresenceGate(input).publish;
}

/**
 * What the Court is allowed to show for the partner. The rule the whole lane
 * turns on: **a body drawn walking must be live**. Anything less than live
 * degrades to the treatment the app already had.
 */
export type WorldPartnerTreatment =
  | { kind: "walking"; name: string; placeId: string }
  | { kind: "parked"; name: string; placeId: string; opacity: number }
  | { kind: "recent"; name: string }
  | { kind: "none" };

export type WorldPartnerInput = {
  /** The live peer, if the world lane has one for this place. */
  walk: { name: string; placeId: string; state: "walking" | "parked" | "gone"; opacity: number } | null;
  /** Today's soft presence for the same person, which is the fallback. */
  soft: SoftPresencePeer | null;
  /** The place the viewer is standing in; a peer somewhere else is not in this scene. */
  here: string | null | undefined;
  nowMs: number;
};

export function worldPartnerTreatment(input: WorldPartnerInput): WorldPartnerTreatment {
  const walk = input.walk;
  if (walk && walk.placeId === input.here && walk.state !== "gone" && walk.opacity > 0) {
    return walk.state === "walking"
      ? { kind: "walking", name: walk.name, placeId: walk.placeId }
      : { kind: "parked", name: walk.name, placeId: walk.placeId, opacity: walk.opacity };
  }
  if (input.soft && isFreshPresence(input.soft.seenAt, input.nowMs)) {
    return { kind: "recent", name: input.soft.name };
  }
  return { kind: "none" };
}

/** The words for a treatment. Never a word the data does not support. */
export function worldPartnerLine(treatment: WorldPartnerTreatment, placeName: string): string | null {
  switch (treatment.kind) {
    case "walking": return `${treatment.name} is here in ${placeName}`;
    case "parked": return `${treatment.name} was here a moment ago`;
    case "recent": return `${treatment.name} was here recently`;
    default: return null;
  }
}
