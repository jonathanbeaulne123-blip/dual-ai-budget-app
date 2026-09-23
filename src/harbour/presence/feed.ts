import type { Environment, LedgerView } from "../../core/types.ts";
import type { WorldPresenceShare } from "../../softPresenceWorld.ts";
import type { PlaceWalkSource } from "../scene/place.ts";
import type { HarbourPlaceId } from "../flag.ts";

/**
 * How a live partner reaches the harbour without the harbour reaching the
 * network.
 *
 * `test/harbour-source-fences.test.ts` holds a real law: nothing under
 * `src/harbour/**` may import the ledger, storage, continuity, Supabase or
 * `ledgerSync/`. The harbour is a *view*. Everything it knows arrives as data,
 * which is why the soft-presence display is a prop rather than a subscription.
 *
 * Live position is the same kind of thing, but it cannot be a plain prop
 * without an edit to the App shell, so the dependency is inverted instead: the
 * harbour declares the shape it wants and asks for it, and the module that
 * actually owns a socket (`ledgerSync/worldPresenceMount.tsx`) installs itself
 * here at import time from the app's entry. Nothing in this file imports
 * anything the fence forbids, and with no provider installed the harbour
 * simply never sees a live body and keeps the pin it always had.
 *
 * **The provider is a hook.** It must be installed once, at module-load time,
 * before the first render — never swapped while the tree is mounted.
 */

export type WorldFeedRequest = {
  environment: Environment;
  householdId: string;
  memberId: string | null;
  /** The household books are linked to a cloud identity. */
  linked: boolean;
  view: LedgerView;
  placeId: HarbourPlaceId;
  /** The coarse presence opt-out. */
  softPresenceOptedOut: boolean;
  /** The explicit, default-off consent for live position. */
  share: WorldPresenceShare;
};

export type WorldFeed = {
  /** The partner's live position, polled per frame by the place. Null when there is none. */
  walk: PlaceWalkSource | null;
  /** The live peer's member id — the server's word for who it is. */
  memberId: string | null;
};

export type WorldFeedProvider = (request: WorldFeedRequest) => WorldFeed;

const QUIET: WorldFeed = { walk: null, memberId: null };
const quiet: WorldFeedProvider = () => QUIET;
let provider: WorldFeedProvider = quiet;

/** Installed once at import time by whatever owns the socket. Returns the way back, for tests. */
export function useWorldFeedProvider(next: WorldFeedProvider): () => void {
  const previous = provider;
  provider = next;
  return () => { provider = previous; };
}

/** True while the harbour is on its own: no live lane, and the honest pin only. */
export const worldFeedIsQuiet = (): boolean => provider === quiet;

/** A React hook: whatever the installed provider is, or nothing at all. */
export function useWorldFeed(request: WorldFeedRequest): WorldFeed {
  return provider(request);
}

/**
 * Where the local body is standing, for the send side.
 *
 * The world runtime owns the camera and the harbour owns the world, so the
 * harbour publishes a reader here and the lane pulls from it. Same inversion
 * as the provider above and for the same reason: the harbour never reaches
 * out, it only puts things on the shelf.
 */
/**
 * Where this person is, for whoever owns a socket.
 *
 * `target`/`theta` are the camera, which is what the lane had to read from
 * before a character existed. `body` is the character itself when one is
 * standing — its feet and its facing, in the body model's own convention
 * (yaw 0 looks along +z). A reader prefers `body` and falls back to the
 * camera, so a place with no walker (an interior) still publishes a position.
 */
export type LocalPose = {
  target: readonly [number, number, number];
  theta: number;
  /**
   * The body, when one is standing. `act` and `p` are what it is doing beyond
   * walking and how far through it — the two the lane puts on the wire so a
   * partner sees a jump, a slide or an emote rather than a body that
   * teleported half a metre up and back.
   */
  body?: { x: number; z: number; yaw: number; act?: string | null; p?: number } | null;
};
export type LocalPoseReader = () => LocalPose | null;

let localPose: LocalPoseReader = () => null;

/** The harbour calls this while a world stands, and the returned function when it comes down. */
export function publishLocalPose(reader: LocalPoseReader): () => void {
  const previous = localPose;
  localPose = reader;
  return () => { localPose = previous; };
}

export function readLocalPose(): LocalPose | null {
  return localPose();
}
