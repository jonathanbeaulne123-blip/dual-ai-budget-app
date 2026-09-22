/**
 * The world-presence wire (the "walking partner" lane).
 *
 * This module is the **only** place the shape of a live position message is
 * written down, and both sides import it: the browser in
 * `ledgerSync/worldPresence.ts` and the Durable Object in
 * `workers/ledgerRoom.ts`. It is deliberately a near-copy of
 * `hearthside/creativePresence.ts`'s contract — the same `?lane=presence`
 * socket, the same ticket auth, the same "join a target, then stream" shape —
 * with a body's position where that lane carries stroke geometry.
 *
 * Two laws hold here and are enforced by `decodeWorldPresence`:
 *
 *  1. **No money, ever.** The only numbers on this lane are metres and radians.
 *     There is no field a cent could travel in, and a message carrying an
 *     unknown key is rejected rather than forwarded.
 *  2. **Never trust a coordinate.** A client may be wrong, old, or hostile.
 *     Absurd values (not finite, or beyond `WORLD_ABSURD`) are *rejected* — the
 *     message does not get broadcast at all. Merely out-of-bounds values are
 *     clamped to the island, so a stale client cannot park a body on the
 *     horizon.
 *
 * Identity is never read from the payload. The server re-derives `memberId`
 * from the authenticated scope, exactly as the soft-presence and creative
 * lanes do.
 */

/**
 * The places the harbour can stand in, mirrored from `harbour/flag.ts`'s
 * `HarbourPlaceId`. It is copied rather than imported because the worker must
 * not pull in a module that reads `import.meta.env`;
 * `test/world-presence.test.ts` fences the two lists together so they cannot
 * drift.
 */
export const WORLD_PLACE_IDS = [
  "court", "tower", "cellar", "glasshouse", "kitchen",
  "boathouse", "library", "cottage", "kiln", "campfire", "atlas",
] as const;
export type WorldPlaceId = (typeof WORLD_PLACE_IDS)[number];

/** Half-width of the island, in metres. A body outside this is clamped back onto it. */
export const WORLD_BOUND = 64;
/** Beyond this a coordinate is not a mistake, it is a lie: the message is rejected. */
export const WORLD_ABSURD = 1e4;
/** Coordinates are rounded to the millimetre before they go on the wire. */
export const WORLD_PRECISION = 3;

/** The browser sends a step this often while walking (12.5 Hz). */
export const WORLD_STEP_MS = 80;
/** ...and at least this often while standing still, so a peer knows the body is still there. */
export const WORLD_IDLE_MS = 1000;
/** The server's throttle floor: a step closer than this to the last one is dropped (≤ 20 Hz). */
export const WORLD_MIN_GAP_MS = 50;
/** The browser re-joins this often, which is also what keeps its target alive server-side. */
export const WORLD_JOIN_MS = 4000;
/** A joined target older than this is not a participant any more (server side). */
export const WORLD_TARGET_MS = 12000;

export type WorldTarget = { placeId: WorldPlaceId; deviceId: string };

export type WorldStep = {
  /** Metres east of the island's origin. */
  x: number;
  /** Metres south. */
  z: number;
  /** Heading in radians, wrapped to (-π, π]. */
  yaw: number;
  /** Whether the body was walking when the sample was taken (drives the stride, never the position). */
  moving: boolean;
};

export type WorldPresenceMessage =
  | { type: "world-join"; version: 1; target: WorldTarget }
  | ({ type: "world-step"; version: 1 } & WorldStep)
  | { type: "world-leave"; version: 1 };

/** What a peer receives. `memberId` and `deviceId` are the server's words, not the sender's. */
export type WorldPeerMessage = {
  type: "world-peer";
  memberId: string;
  deviceId: string;
  placeId: WorldPlaceId;
  seenAt: number;
} & Partial<WorldStep>;

export type WorldLeftMessage = { type: "world-left"; deviceId: string };

export class WorldPresenceError extends Error {}

const KNOWN_KEYS: Readonly<Record<string, readonly string[]>> = {
  "world-join": ["type", "version", "target"],
  "world-step": ["type", "version", "x", "z", "yaw", "moving"],
  "world-leave": ["type", "version"],
};

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorldPresenceError("WORLD_PRESENCE_SHAPE");
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new WorldPresenceError("WORLD_PRESENCE_KEY");
  return value as Record<string, unknown>;
}

/** Ids are opaque, short and printable — never a path, never a sentence. */
export function worldId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{1,64}$/.test(value)) throw new WorldPresenceError("WORLD_PRESENCE_ID");
  return value;
}

export function isWorldPlaceId(value: unknown): value is WorldPlaceId {
  return typeof value === "string" && (WORLD_PLACE_IDS as readonly string[]).includes(value);
}

/**
 * A coordinate the island will accept. Absurd input throws; merely
 * out-of-range input is pulled back to the edge rather than broadcast.
 */
export function worldCoordinate(value: unknown, bound = WORLD_BOUND): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new WorldPresenceError("WORLD_PRESENCE_COORDINATE");
  if (Math.abs(value) > WORLD_ABSURD) throw new WorldPresenceError("WORLD_PRESENCE_ABSURD");
  const clamped = Math.max(-bound, Math.min(bound, value));
  return Number(clamped.toFixed(WORLD_PRECISION));
}

/** Headings wrap; anything else about them is a lie. */
export function worldYaw(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new WorldPresenceError("WORLD_PRESENCE_YAW");
  if (Math.abs(value) > WORLD_ABSURD) throw new WorldPresenceError("WORLD_PRESENCE_ABSURD");
  const TAU = Math.PI * 2;
  let yaw = value % TAU;
  if (yaw <= -Math.PI) yaw += TAU;
  if (yaw > Math.PI) yaw -= TAU;
  return Number(yaw.toFixed(WORLD_PRECISION));
}

/**
 * Narrows an untrusted value to a world-presence message, clamping what can be
 * clamped and throwing on anything else. Both the browser (before it sends)
 * and the Durable Object (before it forwards) run this, so a bad frame never
 * leaves one and never leaves the other.
 */
export function decodeWorldPresence(value: unknown): WorldPresenceMessage {
  if (!value || typeof value !== "object") throw new WorldPresenceError("WORLD_PRESENCE_SHAPE");
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string" || !(type in KNOWN_KEYS)) throw new WorldPresenceError("WORLD_PRESENCE_KIND");
  const row = record(value, KNOWN_KEYS[type]!);
  if (row.version !== 1) throw new WorldPresenceError("WORLD_PRESENCE_VERSION");
  if (type === "world-leave") return { type: "world-leave", version: 1 };
  if (type === "world-join") {
    const target = record(row.target, ["placeId", "deviceId"]);
    if (!isWorldPlaceId(target.placeId)) throw new WorldPresenceError("WORLD_PRESENCE_PLACE");
    return { type: "world-join", version: 1, target: { placeId: target.placeId, deviceId: worldId(target.deviceId) } };
  }
  if (typeof row.moving !== "boolean") throw new WorldPresenceError("WORLD_PRESENCE_MOVING");
  return {
    type: "world-step",
    version: 1,
    x: worldCoordinate(row.x),
    z: worldCoordinate(row.z),
    yaw: worldYaw(row.yaw),
    moving: row.moving,
  };
}

/** The peer key the server stamps on every frame: the authenticated member plus their device. */
export function worldPeerKey(memberId: string, deviceId: string): string {
  return `${memberId}:${deviceId}`;
}
