/**
 * The world-presence lane: a partner you can watch walk.
 *
 * Modelled directly on `hearthside/creativePresence.ts` — the same
 * `?lane=presence` socket so it never queues behind ledger frames, the same
 * POST-a-ticket authentication, the same re-auth every 40 s, the same
 * join-a-target-then-stream shape, the same fan-out to peers on the *same*
 * target only. Where that lane carries stroke geometry at ~25 Hz, this one
 * carries `{x, z, yaw, moving}` at 12.5 Hz.
 *
 * The send side is gated, every single frame, by `softPresenceWorld.ts`'s
 * `worldPresenceGate`. When the gate says no nothing is written to the socket
 * — the lane is not even joined — and the app is left with the soft presence
 * it always had.
 *
 * Nothing on this lane touches money, the ledger, or any personal surface.
 * The only things that travel are a place id, two metres and an angle.
 */

import {
  WORLD_IDLE_MS,
  WORLD_JOIN_MS,
  WORLD_STEP_MS,
  decodeWorldPresence,
  type WorldPlaceId,
  type WorldStep,
} from "./worldPresenceWire.ts";
import { WORLD_EXPIRE_MS, createWorldTrack, type WorldTrack } from "./worldMotion.ts";
import { retryDelay } from "./wire.ts";

export type WorldPresenceState = "joining" | "present" | "offline" | "withheld";

/** A peer the Court may draw: an identity the *server* stamped, plus their own smoothing track. */
export type WorldPeer = {
  memberId: string;
  deviceId: string;
  placeId: WorldPlaceId;
  /** Stable for the life of the peer, so the renderer can poll it every frame without re-rendering React. */
  track: WorldTrack;
  seenAt: number;
};

/** How different a pose has to be before it is worth a frame. */
export const WORLD_STEP_EPSILON = 0.005;
export const WORLD_YAW_EPSILON = 0.01;

export type StepThrottle = {
  /** The sample to send, or null to stay quiet. */
  offer(sample: WorldStep, nowMs: number): WorldStep | null;
  reset(): void;
};

/**
 * The send-side throttle, pure so it can be tested without a socket. A step
 * goes out at most every `WORLD_STEP_MS` (12.5 Hz) and only when the body
 * actually moved; a body standing still still says so every `WORLD_IDLE_MS`
 * so the peer knows it has not gone away.
 */
export function createStepThrottle(
  options: { stepMs?: number; idleMs?: number } = {},
): StepThrottle {
  const stepMs = options.stepMs ?? WORLD_STEP_MS;
  const idleMs = options.idleMs ?? WORLD_IDLE_MS;
  let last: WorldStep | null = null;
  let lastAt = 0;
  return {
    offer(sample, nowMs) {
      if (last && nowMs - lastAt < stepMs) return null;
      const changed = !last
        || Math.abs(sample.x - last.x) > WORLD_STEP_EPSILON
        || Math.abs(sample.z - last.z) > WORLD_STEP_EPSILON
        || Math.abs(sample.yaw - last.yaw) > WORLD_YAW_EPSILON
        || sample.moving !== last.moving;
      if (!changed && last && nowMs - lastAt < idleMs) return null;
      last = { ...sample };
      lastAt = nowMs;
      return last;
    },
    reset() { last = null; lastAt = 0; },
  };
}

export type WorldPresenceHandle = {
  /** Offer the local body's pose. Throttled, gated, and dropped when the tab is hidden. */
  step(sample: WorldStep): void;
  /** Walking into another place: re-join under the new target. */
  setPlace(placeId: WorldPlaceId): void;
  /** Re-read the privacy gate (e.g. the setting changed); leaves the lane when it has closed. */
  refresh(): void;
  peers(): WorldPeer[];
  state(): WorldPresenceState;
  close(): void;
};

export type WorldPresenceInput = {
  environment: string;
  householdId: string;
  placeId: WorldPlaceId;
  deviceId: string;
  token: () => Promise<string>;
  /**
   * The privacy gate, polled rather than captured: `worldPresenceGate(...).publish`.
   * False means publish nothing at all.
   */
  canPublish: () => boolean;
  onPeers: (peers: WorldPeer[]) => void;
  onState?: (state: WorldPresenceState) => void;
  /** Test seams. */
  now?: () => number;
  visible?: () => boolean;
  connect?: (url: string) => WebSocket;
  fetcher?: typeof fetch;
};

export function attachWorldPresence(input: WorldPresenceInput): WorldPresenceHandle {
  const now = input.now ?? (() => Date.now());
  const visible = input.visible ?? (() => typeof document === "undefined" || document.visibilityState === "visible");
  const fetcher = input.fetcher ?? fetch;
  const path = `/ledger-sync/v2/${input.environment}/${input.householdId}`;
  const peers = new Map<string, WorldPeer>();
  const throttle = createStepThrottle();

  let stopped = false;
  let placeId = input.placeId;
  let ws: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let renew: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let attempt = 0;
  let joined = false;
  let state: WorldPresenceState = "offline";

  const setState = (next: WorldPresenceState) => { if (state !== next) { state = next; input.onState?.(next); } };

  /** Sweeps expired peers (seconds, not minutes) and hands the survivors to the scene. */
  const publishPeers = () => {
    const at = now();
    for (const [key, peer] of peers) if (at - peer.seenAt > WORLD_EXPIRE_MS) peers.delete(key);
    input.onPeers([...peers.values()]);
  };

  const open = () => ws?.readyState === WebSocket.OPEN;

  const send = (value: unknown) => {
    if (stopped || !open()) return;
    try { ws!.send(JSON.stringify(decodeWorldPresence(value))); } catch { /* never send a frame we would reject */ }
  };

  const leave = () => {
    if (!joined) return;
    joined = false;
    throttle.reset();
    if (open()) { try { ws!.send(JSON.stringify({ type: "world-leave", version: 1 })); } catch { /* closing */ } }
  };

  /** The rejoin heartbeat, which is also what keeps the server-side target alive. */
  const pulse = () => {
    publishPeers();
    if (stopped) return;
    if (!input.canPublish() || !visible()) {
      leave();
      // "Withheld" is the honest word for it: the socket is fine, the person
      // has simply not agreed to be followed around.
      if (open()) setState("withheld");
      return;
    }
    if (!open()) return;
    joined = true;
    setState("present");
    send({ type: "world-join", version: 1, target: { placeId, deviceId: input.deviceId } });
  };

  async function ticket(): Promise<string> {
    const response = await fetcher(`${path}/ticket`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await input.token()}` },
    });
    if (!response.ok) throw new Error("WORLD_PRESENCE_AUTH");
    return ((await response.json()) as { ticket: string }).ticket;
  }

  function onMessage(event: MessageEvent) {
    if (typeof event.data !== "string") return;
    let value: Record<string, unknown>;
    try { value = JSON.parse(event.data) as Record<string, unknown>; } catch { return; }
    if (value.type === "authenticated") { attempt = 0; pulse(); return; }
    if (value.type === "world-left") {
      if (typeof value.deviceId === "string" && peers.delete(value.deviceId)) publishPeers();
      return;
    }
    if (value.type !== "world-peer") return;
    const deviceId = value.deviceId, memberId = value.memberId, peerPlace = value.placeId;
    if (typeof deviceId !== "string" || typeof memberId !== "string" || typeof peerPlace !== "string") return;
    const at = now();
    let peer = peers.get(deviceId);
    if (!peer || peer.placeId !== peerPlace) {
      peer = { memberId, deviceId, placeId: peerPlace as WorldPlaceId, track: createWorldTrack(), seenAt: at };
      peers.set(deviceId, peer);
      publishPeers();
    }
    peer.seenAt = at;
    if (typeof value.x === "number" && typeof value.z === "number" && typeof value.yaw === "number") {
      peer.track.push({ x: value.x, z: value.z, yaw: value.yaw, moving: value.moving === true, at });
    }
  }

  async function connect() {
    if (stopped) return;
    try {
      setState("joining");
      const key = await ticket();
      if (stopped) return;
      const url = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${path}/socket?lane=presence`;
      const socket = input.connect ? input.connect(url) : new WebSocket(url);
      ws = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: "auth", ticket: key }));
      socket.onmessage = onMessage as (event: MessageEvent) => void;
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        clearInterval(heartbeat);
        clearTimeout(renew);
        joined = false;
        peers.clear();
        publishPeers();
        setState("offline");
        if (!stopped) retry = setTimeout(() => { void connect(); }, retryDelay(attempt++));
      };
      heartbeat = setInterval(pulse, WORLD_JOIN_MS);
      const refresh = async () => {
        try {
          const next = await ticket();
          if (stopped || ws !== socket) return;
          socket.send(JSON.stringify({ type: "auth", ticket: next }));
          renew = setTimeout(() => { void refresh(); }, 40000);
        } catch { socket.close(); }
      };
      renew = setTimeout(() => { void refresh(); }, 40000);
    } catch {
      setState("offline");
      if (!stopped) retry = setTimeout(() => { void connect(); }, retryDelay(attempt++));
    }
  }

  void connect();

  return {
    step(sample) {
      if (stopped || !joined) return;
      // The gate is asked again here, not only on the heartbeat: a setting
      // turned off mid-walk stops the very next frame.
      if (!input.canPublish() || !visible()) { leave(); if (open()) setState("withheld"); return; }
      const next = throttle.offer(sample, now());
      if (!next) return;
      send({ type: "world-step", version: 1, ...next });
    },
    setPlace(next) {
      if (placeId === next) return;
      placeId = next;
      throttle.reset();
      if (joined) { joined = false; pulse(); }
    },
    refresh() { pulse(); },
    peers: () => [...peers.values()],
    state: () => state,
    close() {
      stopped = true;
      leave();
      clearTimeout(retry);
      clearTimeout(renew);
      clearInterval(heartbeat);
      ws?.close();
      peers.clear();
      input.onPeers([]);
      setState("offline");
    },
  };
}
