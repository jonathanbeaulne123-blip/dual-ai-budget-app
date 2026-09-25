import {isMountainWorld,isHorizonWorld,isPresenceWorld,HORIZON_WORLD_BOUNDS,type PresenceWorld} from '../worldGeography.ts';

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
  "court", "bank", "tower", "cellar", "glasshouse", "kitchen",
  "boathouse", "library", "cottage", "kiln", "campfire", "atlas",
] as const;
export type WorldPlaceId = (typeof WORLD_PLACE_IDS)[number];

/** Playable shore radius, mirrored without importing the rendering layer. */
export const WORLD_BOUND = 73.2;
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

/**
 * What a body can be *doing* beyond walking, mirrored from `harbour/body/
 * bodyModel.ts`'s `EmoteId` plus the two moves. Copied rather than imported
 * for the same reason the place ids are — the worker must not pull in a
 * harbour module — and fenced together by `test/world-presence.test.ts` so
 * the two lists cannot drift.
 *
 * It is a closed list of eight short words. There is no field here a cent
 * could travel in, and an act that is not one of these is a rejection rather
 * than a pass-through.
 */
export const WORLD_ACTS = ["jump", "slide", "wave", "dance", "sit", "cheer", "laugh", "point", "skate", "skate-ollie", "skate-kickflip", "skate-heelflip", "skate-shuvit", "skate-360-flip", "skate-grab", "skate-grind", "skate-manual", "skate-bail"] as const;
export type WorldAct = (typeof WORLD_ACTS)[number];
/** Optional, explicit character choice. It is sent only inside the opt-in live lane. */
export const WORLD_AVATARS = ["bianca", "jonathan"] as const;
export type WorldAvatar = (typeof WORLD_AVATARS)[number];

export type WorldTarget = { placeId: WorldPlaceId; deviceId: string };

export type WorldStep = {
  world?: PresenceWorld;
  /** Metres east of the island's origin. */
  x: number;
  /** Metres south. */
  z: number;
  /** Heading in radians, wrapped to (-π, π]. */
  yaw: number;
  /** Whether the body was walking when the sample was taken (drives the stride, never the position). */
  moving: boolean;
  /**
   * What the body is doing on top of walking — a jump, a slide, one of the
   * six emotes — or absent, which is the plain walk this lane has always
   * carried. **Ephemeral**: it is never stored, never rebuilt from a
   * record, and a peer that drops it simply sees the walk.
   */
  act?: WorldAct;
  /**
   * How far through that act, 0…1. The receiver replays the arc from this
   * rather than from a height on the wire, so twelve samples a second is
   * enough for a jump that lasts half of one.
   */
  p?: number;
  /** Optional board-foot altitude; bounded to -8..16 metres, ephemeral only. */
  y?: number;
  avatar?: WorldAvatar;
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
  "world-step": ["type", "version", "x", "z", "yaw", "moving", "act", "p", "y", "avatar", "world"],
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

/** Acts are an explicit allowlist, never a free string on the wire. */
export function worldAct(value: unknown): WorldAct {
  if (typeof value !== "string" || !(WORLD_ACTS as readonly string[]).includes(value)) throw new WorldPresenceError("WORLD_PRESENCE_ACT");
  return value as WorldAct;
}

export function worldAvatar(value: unknown): WorldAvatar {
  if (typeof value !== "string" || !(WORLD_AVATARS as readonly string[]).includes(value)) throw new WorldPresenceError("WORLD_PRESENCE_AVATAR");
  return value as WorldAvatar;
}

/** How far through an act: a finite number, pulled onto 0…1 and rounded like a coordinate. */
export function worldPhase(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new WorldPresenceError("WORLD_PRESENCE_PHASE");
  return Number(Math.max(0, Math.min(1, value)).toFixed(WORLD_PRECISION));
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
  // The act is optional, and its progress only means anything beside it: a
  // step that carries neither is exactly the step this lane always carried,
  // which is what keeps an older client walking rather than disconnected.
  const act = row.act === undefined || row.act === null ? null : worldAct(row.act);
  if(row.world!==undefined&&!isPresenceWorld(row.world))throw new WorldPresenceError("WORLD_PRESENCE_VERSION");
  const mountain=isMountainWorld(row.world);
  const horizon=isHorizonWorld(row.world), bounds=HORIZON_WORLD_BOUNDS;
  const point = horizon?{x:Math.max(bounds.minX,worldCoordinate(row.x,bounds.maxX)),z:Math.max(bounds.minZ,worldCoordinate(row.z,bounds.maxZ))}:mountain?{x:worldCoordinate(row.x,180),z:Math.max(-310,Math.min(84,worldCoordinate(row.z,310)))}:worldPoint(row.x, row.z);
  return {
    type: "world-step",
    version: 1,
    ...point,
    yaw: worldYaw(row.yaw),
    moving: row.moving,
    ...(row.avatar === undefined || row.avatar === null ? {} : { avatar: worldAvatar(row.avatar) }),
    ...(act ? { act, p: worldPhase(row.p ?? 0) } : {}),
    ...((mountain||horizon)?{world:row.world as PresenceWorld}:{}),
    ...((mountain||horizon||act?.startsWith('skate'))&&row.y!==undefined?{y:Math.max(horizon?bounds.minY:-8,worldCoordinate(row.y,horizon?bounds.maxY:mountain?150:16))}:{}),
  };
}

/** Clamp the complete point; square corners lie outside the circular island. */
export function worldPoint(x:unknown,z:unknown):{x:number;z:number} {
  const a=worldCoordinate(x),b=worldCoordinate(z),r=Math.hypot(a,b);
  const scale=r>WORLD_BOUND?(WORLD_BOUND-.001)/r:1;
  return {x:Number((a*scale).toFixed(WORLD_PRECISION)),z:Number((b*scale).toFixed(WORLD_PRECISION))};
}

/** The peer key the server stamps on every frame: the authenticated member plus their device. */
export function worldPeerKey(memberId: string, deviceId: string): string {
  return `${memberId}:${deviceId}`;
}
