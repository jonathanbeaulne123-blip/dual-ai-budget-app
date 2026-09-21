// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  WORLD_ABSURD,
  WORLD_BOUND,
  WORLD_IDLE_MS,
  WORLD_PLACE_IDS,
  WORLD_STEP_MS,
  decodeWorldPresence,
  isWorldPlaceId,
  worldCoordinate,
  worldId,
  worldPeerKey,
  worldYaw,
  WorldPresenceError,
} from "../src/ledgerSync/worldPresenceWire.ts";
import {
  WORLD_EXPIRE_MS,
  WORLD_FADE_MS,
  WORLD_LIVE_MS,
  WORLD_RECKON_MS,
  WORLD_RENDER_DELAY_MS,
  createWorldTrack,
  yawDelta,
} from "../src/ledgerSync/worldMotion.ts";
import { createStepThrottle } from "../src/ledgerSync/worldPresence.ts";
import {
  WORLD_PRESENCE_SHARE_DEFAULT,
  readWorldPresenceShare,
  setWorldPresenceShare,
  worldPartnerLine,
  worldPartnerTreatment,
  worldPresenceGate,
  worldPresenceShareKey,
} from "../src/softPresenceWorld.ts";
import { HARBOUR_PLACE_NAMES } from "../src/harbour/flag.ts";
import { createPlaceholderWalker, createWalker, useWalkerFactory, walkerFactoryIsPlaceholder, type Walker } from "../src/harbour/presence/walker.ts";
import { localBodyFromPose } from "../src/harbour/presence/usePartnerWalk.ts";
import * as courtScene from "../src/harbour/court/CourtScene.ts";
import { readCourtReading } from "../src/harbour/court/CourtScene.ts";
import { COURT_DRESSING } from "../src/harbour/court/dressing.ts";
import type { SoftPresencePeer } from "../src/softPresence.ts";

function memoryStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    all: () => Object.fromEntries(map),
  };
}

const join = { type: "world-join", version: 1, target: { placeId: "court", deviceId: "DEV-a" } };
const step = (over: Record<string, unknown> = {}) => ({ type: "world-step", version: 1, x: 1, z: 2, yaw: 0.5, moving: true, ...over });

describe("the world-presence wire", () => {
  it("names exactly the harbour's places, so the worker's copy cannot drift from the app's", () => {
    expect([...WORLD_PLACE_IDS].sort()).toEqual(Object.keys(HARBOUR_PLACE_NAMES).sort());
    expect(isWorldPlaceId("court")).toBe(true);
    expect(isWorldPlaceId("bedroom")).toBe(false);
  });

  it("accepts a join and a step, and rebuilds them to the shape both sides agree on", () => {
    expect(decodeWorldPresence(join)).toEqual({ type: "world-join", version: 1, target: { placeId: "court", deviceId: "DEV-a" } });
    expect(decodeWorldPresence(step())).toEqual({ type: "world-step", version: 1, x: 1, z: 2, yaw: 0.5, moving: true });
    expect(decodeWorldPresence({ type: "world-leave", version: 1 })).toEqual({ type: "world-leave", version: 1 });
  });

  it("rejects anything that is not a position: money, identity, extra keys, wrong versions", () => {
    // The law of the lane: there is no field a cent could travel in.
    expect(() => decodeWorldPresence({ ...step(), cents: 1200 })).toThrow(WorldPresenceError);
    // Identity is the server's to decide; a claimed one is a rejection, not an override.
    expect(() => decodeWorldPresence({ ...step(), memberId: "MEM-999" })).toThrow(WorldPresenceError);
    expect(() => decodeWorldPresence({ ...join, target: { placeId: "court", deviceId: "DEV-a", memberId: "MEM-999" } })).toThrow(WorldPresenceError);
    expect(() => decodeWorldPresence({ ...step(), version: 2 })).toThrow(WorldPresenceError);
    expect(() => decodeWorldPresence({ type: "world-step", version: 1, x: 1, z: 2, yaw: 0 })).toThrow(WorldPresenceError);
    expect(() => decodeWorldPresence({ type: "presence", deviceId: "DEV-a" })).toThrow(WorldPresenceError);
    expect(() => decodeWorldPresence(null)).toThrow(WorldPresenceError);
  });

  it("rejects a place it does not know and an id that is not one", () => {
    expect(() => decodeWorldPresence({ ...join, target: { placeId: "kitchen-drawer", deviceId: "DEV-a" } })).toThrow(/PLACE/);
    expect(() => decodeWorldPresence({ ...join, target: { placeId: "court", deviceId: "../../etc" } })).toThrow(/ID/);
    expect(() => decodeWorldPresence({ ...join, target: { placeId: "court", deviceId: "x".repeat(65) } })).toThrow(/ID/);
    expect(worldId("DEV-a.1:2")).toBe("DEV-a.1:2");
  });

  it("clamps an out-of-range coordinate onto the island and rejects an absurd one outright", () => {
    expect(worldCoordinate(3.14159)).toBe(3.142);
    expect(worldCoordinate(WORLD_BOUND + 500)).toBe(WORLD_BOUND);
    expect(worldCoordinate(-(WORLD_BOUND + 500))).toBe(-WORLD_BOUND);
    // Past absurd it is not a mistake, it is a lie: nothing gets broadcast.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, WORLD_ABSURD + 1, -(WORLD_ABSURD + 1), "3" as unknown, null as unknown]) {
      expect(() => worldCoordinate(bad)).toThrow(WorldPresenceError);
    }
    const decoded = decodeWorldPresence(step({ x: 1e3, z: -1e3 }));
    expect(decoded).toMatchObject({ x: WORLD_BOUND, z: -WORLD_BOUND });
    expect(() => decodeWorldPresence(step({ x: 1e9 }))).toThrow(/ABSURD/);
  });

  it("wraps a heading rather than trusting it", () => {
    expect(worldYaw(Math.PI * 3)).toBeCloseTo(Math.PI, 3);
    expect(worldYaw(-Math.PI * 3)).toBeCloseTo(Math.PI, 3);
    expect(Math.abs(worldYaw(7.5))).toBeLessThanOrEqual(Math.PI);
    expect(() => worldYaw(Number.NaN)).toThrow(WorldPresenceError);
  });

  it("keys a peer by the authenticated member and their device", () => {
    expect(worldPeerKey("MEM-001", "DEV-a")).toBe("MEM-001:DEV-a");
  });
});

describe("the send throttle", () => {
  it("holds a step to 12.5 Hz and only sends when the body actually moved", () => {
    const throttle = createStepThrottle();
    expect(throttle.offer({ x: 0, z: 0, yaw: 0, moving: false }, 0)).not.toBeNull();
    // Inside the window: nothing, however much it moved.
    expect(throttle.offer({ x: 5, z: 5, yaw: 1, moving: true }, WORLD_STEP_MS - 1)).toBeNull();
    expect(throttle.offer({ x: 5, z: 5, yaw: 1, moving: true }, WORLD_STEP_MS)).toEqual({ x: 5, z: 5, yaw: 1, moving: true });
    // Standing still: quiet until the idle keepalive is due.
    expect(throttle.offer({ x: 5, z: 5, yaw: 1, moving: true }, WORLD_STEP_MS * 2)).toBeNull();
    expect(throttle.offer({ x: 5, z: 5, yaw: 1, moving: true }, WORLD_STEP_MS + WORLD_IDLE_MS)).not.toBeNull();
  });

  it("sends roughly 12 frames a second while walking, not 60", () => {
    const throttle = createStepThrottle();
    let sent = 0;
    for (let ms = 0; ms <= 1000; ms += 16) if (throttle.offer({ x: ms / 100, z: 0, yaw: 0, moving: true }, ms)) sent++;
    expect(sent).toBeGreaterThanOrEqual(10);
    expect(sent).toBeLessThanOrEqual(14);
  });
});

describe("smoothing 12.5 Hz into motion", () => {
  const walk = (track: ReturnType<typeof createWorldTrack>, count: number, from = 0) => {
    for (let i = 0; i < count; i++) track.push({ x: i * 0.5, z: 0, yaw: 0, moving: true, at: from + i * WORLD_STEP_MS });
  };

  it("interpolates between the two samples around the render time", () => {
    const track = createWorldTrack();
    track.push({ x: 0, z: 0, yaw: 0, moving: true, at: 1000 });
    track.push({ x: 1, z: 0, yaw: 0, moving: true, at: 1100 });
    // Render 140 ms in the past: at now = 1190 the render time is 1050, half way.
    const pose = track.pose(1100 + WORLD_RENDER_DELAY_MS - 50)!;
    expect(pose.state).toBe("walking");
    expect(pose.x).toBeCloseTo(0.5, 3);
    expect(pose.moving).toBe(true);
  });

  it("takes the short way round the circle rather than spinning the body", () => {
    expect(yawDelta(3.0, -3.0)).toBeCloseTo(Math.PI * 2 - 6, 3);
    const track = createWorldTrack();
    track.push({ x: 0, z: 0, yaw: 3.0, moving: true, at: 1000 });
    track.push({ x: 0, z: 0, yaw: -3.0, moving: true, at: 1100 });
    const pose = track.pose(1100 + WORLD_RENDER_DELAY_MS - 50)!;
    expect(Math.abs(pose.yaw)).toBeGreaterThan(3.0);
  });

  it("dead-reckons briefly when a packet is late, then stops guessing", () => {
    const track = createWorldTrack();
    walk(track, 4, 1000);           // newest at 1240, x = 1.5, 5 m/s east
    const newest = 1240;
    // 200 ms past the newest sample: still guessing, and ahead of it.
    const guessed = track.pose(newest + WORLD_RENDER_DELAY_MS + 200)!;
    expect(guessed.x).toBeGreaterThan(1.5);
    expect(guessed.moving).toBe(true);
    // Past the reckoning budget: the guess stops growing and the stride stops.
    // 0.5 m every 80 ms is 6.25 m/s, which is faster than the walk cap, so the
    // guess advances at 6 m/s and stops dead at the end of the budget.
    const capped = track.pose(newest + WORLD_RENDER_DELAY_MS + WORLD_RECKON_MS + 400)!;
    expect(capped.x).toBeCloseTo(1.5 + (6 * WORLD_RECKON_MS) / 1000, 3);
    expect(track.pose(newest + WORLD_RENDER_DELAY_MS + WORLD_RECKON_MS + 900)!.x).toBeCloseTo(capped.x, 3);
    expect(capped.moving).toBe(false);
  });

  it("never guesses faster than a walk, whatever two samples claim", () => {
    const track = createWorldTrack();
    track.push({ x: 0, z: 0, yaw: 0, moving: true, at: 1000 });
    track.push({ x: 40, z: 0, yaw: 0, moving: true, at: 1010 });   // 4000 m/s
    const pose = track.pose(1010 + WORLD_RENDER_DELAY_MS + WORLD_RECKON_MS)!;
    expect(pose.x - 40).toBeLessThanOrEqual((6 * WORLD_RECKON_MS) / 1000 + 1e-6);
  });

  it("parks where the peer was last actually seen, never where it was guessed to be", () => {
    const track = createWorldTrack();
    walk(track, 4, 1000);
    const parked = track.pose(1240 + WORLD_LIVE_MS + 1)!;
    expect(parked.state).toBe("parked");
    expect(parked.moving).toBe(false);
    expect(parked.x).toBe(1.5);
    expect(parked.opacity).toBeLessThan(1);
  });

  it("fades out rather than freezing mid-stride, and is gone before it expires", () => {
    const track = createWorldTrack();
    walk(track, 4, 1000);
    expect(track.pose(1240 + WORLD_LIVE_MS + WORLD_FADE_MS / 2)!.opacity).toBeCloseTo(0.5, 1);
    const gone = track.pose(1240 + WORLD_LIVE_MS + WORLD_FADE_MS + 1)!;
    expect(gone.state).toBe("gone");
    expect(gone.opacity).toBe(0);
    expect(WORLD_LIVE_MS + WORLD_FADE_MS).toBeLessThan(WORLD_EXPIRE_MS);
    // Expiry is seconds, not the fifteen minutes the soft lane uses.
    expect(WORLD_EXPIRE_MS).toBeLessThan(15 * 1000);
  });

  it("ignores a sample that arrives out of order rather than teleporting backwards", () => {
    const track = createWorldTrack();
    track.push({ x: 0, z: 0, yaw: 0, moving: true, at: 1000 });
    track.push({ x: 5, z: 0, yaw: 0, moving: true, at: 1100 });
    track.push({ x: -99, z: 0, yaw: 0, moving: true, at: 1050 });
    expect(track.samples().map((s) => s.x)).toEqual([0, 5]);
  });

  it("has nothing to say before the first sample", () => {
    expect(createWorldTrack().pose(1)).toBeNull();
  });
});

describe("the consent for live position", () => {
  it("defaults to the more private option, and only an exact opt-in reads as on", () => {
    const store = memoryStore();
    expect(WORLD_PRESENCE_SHARE_DEFAULT).toBe("off");
    expect(readWorldPresenceShare("development", store)).toBe("off");
    expect(readWorldPresenceShare("development", memoryStore({ [worldPresenceShareKey("development")]: "yes" }))).toBe("off");
    setWorldPresenceShare("development", "live", store);
    expect(readWorldPresenceShare("development", store)).toBe("live");
    setWorldPresenceShare("development", "off", store);
    expect(store.all()).toEqual({});
  });

  it("is per environment, exactly as the opt-out it sits beside is", () => {
    const store = memoryStore();
    setWorldPresenceShare("development", "live", store);
    expect(readWorldPresenceShare("development", store)).toBe("live");
    expect(readWorldPresenceShare("production", store)).toBe("off");
  });

  const base = {
    signedIn: true, memberId: "MEM-001", environment: "development" as const,
    view: "household" as const, placeId: "court", visible: true,
    softPresenceOptedOut: false, share: "live" as const,
  };

  it("publishes only when every condition holds", () => {
    expect(worldPresenceGate(base)).toEqual({ publish: true, reason: "publishing" });
  });

  it("publishes nothing when position sharing is off — the default", () => {
    expect(worldPresenceGate({ ...base, share: "off" })).toEqual({ publish: false, reason: "share-off" });
  });

  it("lets the coarse opt-out win: a hidden person is never walking around", () => {
    expect(worldPresenceGate({ ...base, softPresenceOptedOut: true })).toEqual({ publish: false, reason: "soft-presence-off" });
  });

  it("never publishes from a personal view, where the place id alone would name a private surface", () => {
    expect(worldPresenceGate({ ...base, view: "personal" })).toEqual({ publish: false, reason: "personal-view" });
    expect(worldPresenceGate({ ...base, placeId: null })).toEqual({ publish: false, reason: "place-unknown" });
    expect(worldPresenceGate({ ...base, placeId: "some-private-sheet" })).toEqual({ publish: false, reason: "place-unknown" });
  });

  it("publishes nothing from a backgrounded tab or a signed-out browser", () => {
    expect(worldPresenceGate({ ...base, visible: false }).publish).toBe(false);
    expect(worldPresenceGate({ ...base, signedIn: false }).publish).toBe(false);
    expect(worldPresenceGate({ ...base, memberId: null }).publish).toBe(false);
  });
});

describe("the honest fallback", () => {
  const soft: SoftPresencePeer = { memberId: "MEM-002", name: "Bianca", source: "live", seenAt: new Date(1_000_000).toISOString() };
  const now = 1_000_000 + 60_000;

  it("shows a walking body only while the feed is live", () => {
    const treatment = worldPartnerTreatment({ walk: { name: "Bianca", placeId: "court", state: "walking", opacity: 1 }, soft, here: "court", nowMs: now });
    expect(treatment).toEqual({ kind: "walking", name: "Bianca", placeId: "court" });
    expect(worldPartnerLine(treatment, "the Court")).toBe("Bianca is here in the Court");
  });

  it("stops claiming 'now' the moment the feed parks, and says so", () => {
    const treatment = worldPartnerTreatment({ walk: { name: "Bianca", placeId: "court", state: "parked", opacity: 0.4 }, soft, here: "court", nowMs: now });
    expect(treatment.kind).toBe("parked");
    expect(worldPartnerLine(treatment, "the Court")).toBe("Bianca was here a moment ago");
  });

  it("falls back to today's soft presence — not to nothing — when the feed is gone or off", () => {
    for (const walk of [null, { name: "Bianca", placeId: "court" as const, state: "gone" as const, opacity: 0 }]) {
      const treatment = worldPartnerTreatment({ walk, soft, here: "court", nowMs: now });
      expect(treatment).toEqual({ kind: "recent", name: "Bianca" });
      expect(worldPartnerLine(treatment, "the Court")).toBe("Bianca was here recently");
    }
  });

  it("does not draw a body standing somewhere else into this scene", () => {
    expect(worldPartnerTreatment({ walk: { name: "Bianca", placeId: "kitchen", state: "walking", opacity: 1 }, soft: null, here: "court", nowMs: now }).kind).toBe("none");
  });

  it("says nothing at all when the soft signal is stale too", () => {
    const stale: SoftPresencePeer = { ...soft, seenAt: new Date(0).toISOString() };
    expect(worldPartnerTreatment({ walk: null, soft: stale, here: "court", nowMs: 60 * 60 * 1000 })).toEqual({ kind: "none" });
  });
});

describe("the walker and its seam", () => {
  it("stands on the ground, faces a heading, and only bobs while it is moving", () => {
    const walker = createPlaceholderWalker({ tint: "#aa4444", skin: "#eeddcc", groundHeightAt: () => 0.25 });
    walker.setOpacity(1);
    walker.setPose(3, -4, 1.2);
    expect(walker.group.position.toArray()).toEqual([3, 0.25, -4]);
    expect(walker.group.rotation.y).toBeCloseTo(1.2, 5);
    const pivot = walker.group.children[0] as THREE.Object3D;
    walker.animate(0, 0.05);
    expect(pivot.position.y).toBe(0);           // not moving: no bob
    walker.setMoving(true);
    walker.animate(0, 0.08);
    expect(pivot.position.y).toBeGreaterThan(0);
    walker.setMoving(false);
    expect(pivot.position.y).toBe(0);
    walker.dispose();
  });

  it("hides itself when it has faded to nothing", () => {
    const walker = createPlaceholderWalker({ tint: "#aa4444", skin: "#eeddcc" });
    walker.setOpacity(0.5);
    expect(walker.group.visible).toBe(true);
    walker.setOpacity(0);
    expect(walker.group.visible).toBe(false);
    walker.dispose();
  });

  it("is a one-line swap for the real character", () => {
    expect(walkerFactoryIsPlaceholder()).toBe(true);
    const made: Walker[] = [];
    const restore = useWalkerFactory((options) => { const w = createPlaceholderWalker({ ...options, height: 9 }); made.push(w); return w; });
    const swapped = createWalker({ tint: "#000", skin: "#fff" });
    expect(made).toEqual([swapped]);
    expect(walkerFactoryIsPlaceholder()).toBe(false);
    restore();
    expect(walkerFactoryIsPlaceholder()).toBe(true);
    swapped.dispose();
  });

  it("puts the body where the camera stands, facing the way the person looks", () => {
    expect(localBodyFromPose({ target: [2, 0.4, -3], theta: 0 })).toMatchObject({ x: 2, z: -3 });
    expect(localBodyFromPose({ target: [0, 0, 0], theta: 0 }).yaw).toBeCloseTo(Math.PI, 5);
    expect(Math.abs(localBodyFromPose({ target: [0, 0, 0], theta: Math.PI + 0.3 }).yaw)).toBeLessThanOrEqual(Math.PI);
  });
});

describe("the Court's reading", () => {
  it("carries a live feed through only when it answers `pose`", () => {
    const source = { pose: () => ({ x: 1, z: 2, yaw: 0, moving: true, opacity: 1 }) };
    expect(readCourtReading({ partner: { fresh: true, name: "Bianca", walk: source } }).partner?.walk).toBe(source);
    expect(readCourtReading({ partner: { fresh: true, name: "Bianca", walk: { pose: "yes" } } }).partner?.walk).toBeUndefined();
    expect(readCourtReading({ partner: { fresh: true, name: "Bianca" } }).partner?.walk).toBeUndefined();
    expect(readCourtReading({ partner: null }).partner).toBeNull();
  });
});

describe("the Court: a pin when they were here, a body when they are", () => {
  function build(reading: unknown) {
    const scene = new THREE.Scene();
    const handle = courtScene.createCourt(scene, {
      dressing: COURT_DRESSING.classic,
      reading: readCourtReading(reading),
      quality: "lite" as const,
      loadModels: false,
    });
    return { handle, scene };
  }
  const pinOf = (scene: THREE.Scene) => scene.getObjectByName("partner")!;
  const bodyOf = (scene: THREE.Scene) => scene.getObjectByName("walker")!;

  /** A feed the test drives by hand, standing in for `worldPresence.ts`. */
  const feed = (pose: { x: number; z: number; yaw: number; moving: boolean; opacity: number } | null) => ({ pose: () => pose });

  it("stands the pin, and only the pin, when all the app has is soft presence", () => {
    const { handle, scene } = build({ partner: { fresh: true, name: "Bianca" } });
    expect(pinOf(scene).visible).toBe(true);
    expect(bodyOf(scene).visible).toBe(false);
    handle.dispose();
  });

  it("replaces the pin with a body standing where the live feed says, facing where it says", () => {
    const { handle, scene } = build({ partner: { fresh: true, name: "Bianca", walk: feed({ x: 2.5, z: -3.5, yaw: 0.8, moving: true, opacity: 1 }) } });
    const body = bodyOf(scene);
    expect(pinOf(scene).visible).toBe(false);
    expect(body.visible).toBe(true);
    expect(body.position.x).toBeCloseTo(2.5, 5);
    expect(body.position.z).toBeCloseTo(-3.5, 5);
    expect(body.rotation.y).toBeCloseTo(0.8, 5);
    handle.dispose();
  });

  it("keeps asking for frames while a body is up, and stops when it goes", () => {
    const live = { x: 0, z: 0, yaw: 0, moving: true, opacity: 1 };
    let pose: typeof live | null = live;
    const { handle, scene } = build({ partner: { fresh: true, name: "Bianca", walk: { pose: () => pose } } });
    expect(handle.animate(1, 0.05)).toBe(true);
    pose = null;
    // One more frame to notice, then it settles back to the pin.
    expect(handle.animate(2, 0.05)).toBe(true);
    expect(bodyOf(scene).visible).toBe(false);
    expect(pinOf(scene).visible).toBe(true);
    handle.dispose();
  });

  it("falls back to the honest pin — not to nothing — when the feed parks and fades", () => {
    const { handle, scene } = build({ partner: { fresh: true, name: "Bianca", walk: feed({ x: 1, z: 1, yaw: 0, moving: false, opacity: 0 }) } });
    expect(bodyOf(scene).visible).toBe(false);
    expect(pinOf(scene).visible).toBe(true);
    handle.dispose();
  });

  it("shows nothing at all when the soft signal is stale too", () => {
    const { handle, scene } = build({ partner: { fresh: false, name: "Bianca", walk: feed({ x: 1, z: 1, yaw: 0, moving: false, opacity: 0 }) } });
    expect(bodyOf(scene).visible).toBe(false);
    expect(pinOf(scene).visible).toBe(false);
    handle.dispose();
  });
});
