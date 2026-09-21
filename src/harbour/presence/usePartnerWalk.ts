import { useEffect, useMemo, useRef, useState } from "react";
import type { Environment, LedgerView } from "../../core/types.ts";
import { localDeviceId } from "../../core/devices.ts";
import { ensureSupabaseSession, loadSupabaseSession } from "../../auth/supabaseSession.ts";
import { ledgerSyncEnabled, localLedgerIdentity } from "../../ledgerSync/mode.ts";
import { attachWorldPresence, type WorldPeer, type WorldPresenceHandle, type WorldPresenceState } from "../../ledgerSync/worldPresence.ts";
import { WORLD_STEP_MS, isWorldPlaceId, type WorldPlaceId } from "../../ledgerSync/worldPresenceWire.ts";
import { readWorldPresenceShare, worldPresenceGate, type WorldPresenceShare } from "../../softPresenceWorld.ts";
import type { SoftPresencePeer } from "../../softPresence.ts";
import type { PlaceWalkSource } from "../scene/place.ts";
import type { HarbourPlaceId } from "../flag.ts";

/**
 * The Court's end of the world-presence lane.
 *
 * Two jobs, and both of them are narrow on purpose:
 *
 *  - **Send.** Every 80 ms it reads where this person is standing out of the
 *    runtime's own camera pose and offers it to the lane. The lane's gate
 *    (`softPresenceWorld.ts`) is asked on every single offer, so turning
 *    position sharing off, switching to the personal view, or backgrounding
 *    the tab stops the very next frame — nothing is published, not even a
 *    keepalive.
 *  - **Receive.** It hands the Court a `PlaceWalkSource`: a stable object the
 *    scene polls once per animated frame. Samples arriving at 12.5 Hz never
 *    become React renders; only the *existence* of a partner does.
 *
 * It deliberately does not own the body. Where a person is standing comes
 * from the runtime, and what a body looks like comes from
 * `presence/walker.ts`'s factory — both seams the character lane can take over
 * without touching this file.
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
const MOVING_EPSILON = 0.012;

export type PartnerWalkInput = {
  environment: Environment;
  householdId: string;
  memberId: string | null;
  /** The household books are linked to a cloud identity; local dev auth bypasses it. */
  linked: boolean;
  view: LedgerView;
  placeId: HarbourPlaceId;
  /** The runtime's current camera pose, or null before the world stands. */
  pose: () => { target: readonly [number, number, number]; theta: number } | null;
  /** Today's soft-presence peer for the partner — the honest fallback the caller keeps. */
  softPeer?: SoftPresencePeer | null;
  /** The coarse opt-out (`softPresence.ts`). */
  softPresenceOptedOut: boolean;
  /** Test seams. */
  share?: WorldPresenceShare;
  enabled?: boolean;
};

export type PartnerWalkResult = {
  /** Handed to the Court through `reading.partner.walk`. Null when there is no live body. */
  walk: PlaceWalkSource | null;
  /** The live peer's member id — the server's word for who it is, never the client's. */
  memberId: string | null;
  state: WorldPresenceState;
};

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

export function usePartnerWalk(input: PartnerWalkInput): PartnerWalkResult {
  const { environment, householdId, memberId, linked, view, placeId, softPresenceOptedOut } = input;
  const [peers, setPeers] = useState<WorldPeer[]>([]);
  const [state, setState] = useState<WorldPresenceState>("offline");
  const handle = useRef<WorldPresenceHandle | null>(null);
  const poseRef = useRef(input.pose); poseRef.current = input.pose;

  const share = input.share ?? readWorldPresenceShare(environment);
  const enabled = input.enabled ?? ledgerSyncEnabled(environment);
  const place: WorldPlaceId | null = isWorldPlaceId(placeId) ? placeId : null;

  // The gate is kept in a ref so the lane can ask it on every offer without
  // the socket being torn down and rebuilt each time a dependency moves.
  const gate = useRef({ share, view, softPresenceOptedOut, memberId, environment });
  gate.current = { share, view, softPresenceOptedOut, memberId, environment };

  useEffect(() => {
    if (!enabled || !memberId || !place) { setPeers([]); setState("offline"); return; }
    const token = worldPresenceToken(environment, memberId, linked);
    if (!token) { setPeers([]); setState("offline"); return; }
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
      token, canPublish, onPeers: setPeers, onState: setState,
    });
    handle.current = lane;

    let last: { x: number; z: number } | null = null;
    const timer = window.setInterval(() => {
      const pose = poseRef.current();
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

  const walk: PlaceWalkSource | null = useMemo(() => {
    if (!peer) return null;
    // Stable for the life of the peer: the Court polls this every frame.
    return { pose: (nowMs: number) => peer.track.pose(nowMs) };
  }, [peer]);

  return { walk, memberId: peer?.memberId ?? null, state };
}
