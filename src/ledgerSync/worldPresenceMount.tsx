import { useEffect, useMemo, useRef, useState } from "react";
import { localDeviceId } from "../core/devices.ts";
import { ensureSupabaseSession, loadSupabaseSession } from "../auth/supabaseSession.ts";
import { ledgerSyncEnabled, localLedgerIdentity } from "./mode.ts";
import { attachWorldPresence, type WorldPeer, type WorldPresenceHandle } from "./worldPresence.ts";
import { WORLD_STEP_MS, isWorldPlaceId, type WorldPlaceId } from "./worldPresenceWire.ts";
import { worldPresenceGate } from "../softPresenceWorld.ts";
import { readLocalPose, useWorldFeedProvider, type WorldFeed, type WorldFeedRequest } from "../harbour/presence/feed.ts";
import type { PlaceWalkSource } from "../harbour/scene/place.ts";
import type { Environment } from "../core/types.ts";

/**
 * The socket end of the walking partner, kept outside `src/harbour/**` because
 * the harbour is not allowed to touch the network
 * (`test/harbour-source-fences.test.ts`). It installs itself into the
 * harbour's feed seam (`harbour/presence/feed.ts`) from the app's entry
 * module; until it does, the harbour has no live lane and shows the pin it
 * always had.
 *
 * Two jobs, both narrow:
 *
 *  - **Send.** Every 80 ms it reads where this person is standing out of the
 *    world's own camera pose and offers it. The privacy gate
 *    (`softPresenceWorld.ts`) is asked on every offer, so turning position
 *    sharing off, switching to the personal view, or backgrounding the tab
 *    stops on the very next frame — nothing is published, not even a keepalive.
 *  - **Receive.** It hands back a stable `PlaceWalkSource` the scene polls once
 *    per animated frame, so 12.5 samples a second never become 12.5 React
 *    renders. Only the *existence* of a partner re-renders anything.
 *
 * It deliberately does not own the body: where a person is standing comes from
 * the world runtime, and what a body looks like comes from
 * `harbour/presence/walker.ts`'s factory. Both are seams the character lane
 * takes over without touching this file.
 */

/**
 * Where the body is, read off the camera. Today the camera *is* the player:
 * the runtime's pose target is the spot on the ground the person is at, and
 * `theta` is the heading the eye orbits from — so the body faces `theta + π`,
 * which is the direction the person is looking. When the character lane lands,
 * this is the one function that changes.
 */
export function localBodyFromPose(pose: { target: readonly [number, number, number]; theta: number }): { x: number; z: number; yaw: number } {
  const TAU = Math.PI * 2;
  let yaw = (pose.theta + Math.PI) % TAU;
  if (yaw > Math.PI) yaw -= TAU;
  if (yaw <= -Math.PI) yaw += TAU;
  return { x: pose.target[0], z: pose.target[2], yaw };
}

/** Enough movement between two ticks to call it walking rather than standing. */
export const MOVING_EPSILON = 0.012;

/** The token the lane authenticates with, or null when this browser has no standing to open it. */
export function worldPresenceToken(environment: Environment, memberId: string, linked: boolean): (() => Promise<string>) | null {
  const local = localLedgerIdentity(memberId);
  const auth = loadSupabaseSession(environment);
  if (!local && (!auth || !linked)) return null;
  return async () => {
    if (local) return local;
    const fresh = await ensureSupabaseSession(environment);
    if (!fresh || fresh.userId !== auth!.userId) throw new Error("UNAUTHENTICATED");
    return fresh.accessToken;
  };
}

export function useWorldPresenceFeed(request: WorldFeedRequest): WorldFeed {
  const { environment, householdId, memberId, linked, view, placeId, softPresenceOptedOut, share } = request;
  const [peers, setPeers] = useState<WorldPeer[]>([]);
  const handle = useRef<WorldPresenceHandle | null>(null);
  const enabled = ledgerSyncEnabled(environment);
  const place: WorldPlaceId | null = isWorldPlaceId(placeId) ? placeId : null;

  // The gate is kept in a ref so the lane can ask it on every offer without
  // the socket being torn down and rebuilt each time a dependency moves.
  const gate = useRef({ share, view, softPresenceOptedOut, memberId, environment });
  gate.current = { share, view, softPresenceOptedOut, memberId, environment };

  useEffect(() => {
    if (!enabled || !memberId || !place) { setPeers([]); return; }
    const token = worldPresenceToken(environment, memberId, linked);
    if (!token) { setPeers([]); return; }
    const canPublish = () => {
      const g = gate.current;
      return worldPresenceGate({
        signedIn: Boolean(g.memberId),
        memberId: g.memberId,
        environment: g.environment,
        view: g.view,
        placeId: place,
        visible: typeof document === "undefined" || document.visibilityState === "visible",
        softPresenceOptedOut: g.softPresenceOptedOut,
        share: g.share,
      }).publish;
    };
    const lane = attachWorldPresence({
      environment, householdId, placeId: place, deviceId: localDeviceId(),
      token, canPublish, onPeers: setPeers,
    });
    handle.current = lane;

    let last: { x: number; z: number } | null = null;
    const timer = window.setInterval(() => {
      const pose = readLocalPose();
      if (!pose) return;
      const body = localBodyFromPose(pose);
      const moving = last !== null && Math.hypot(body.x - last.x, body.z - last.z) > MOVING_EPSILON;
      last = { x: body.x, z: body.z };
      lane.step({ ...body, moving });
    }, WORLD_STEP_MS);

    const onVisibility = () => lane.refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
      lane.close();
      handle.current = null;
    };
  }, [enabled, environment, householdId, memberId, linked, place]);

  // A setting flipped mid-walk: tell the lane at once rather than on its heartbeat.
  useEffect(() => { handle.current?.refresh(); }, [share, view, softPresenceOptedOut]);

  const peer = useMemo(() => peers.find((row) => row.memberId !== memberId && row.placeId === place) ?? null, [peers, memberId, place]);

  const walk: PlaceWalkSource | null = useMemo(
    // Stable for the life of the peer: the place polls this every frame.
    () => (peer ? { pose: (nowMs: number) => peer.track.pose(nowMs) } : null),
    [peer],
  );

  return { walk, memberId: peer?.memberId ?? null };
}

/**
 * The whole installation. Called once from the app's entry module, before the
 * first render, because the provider is a hook.
 */
export function installWorldPresence(): () => void {
  return useWorldFeedProvider(useWorldPresenceFeed);
}
