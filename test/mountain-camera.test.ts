// @vitest-environment jsdom
/**
 * Hearth Mountain v2 · the camera track (T4). One camera system — Look, Walk,
 * Close, Ride, Skate — with explicit hand-offs and authored moments. Every
 * test here exercises the shipped poses, options and runtime paths (the
 * dissection's C1–C10 and its minor list), not a convenient variant.
 */
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COURT_BOUNDS, poseEye, realizePose, type CourtPose, type Vec3 } from "../src/harbour/camera/poses.ts";
import { createCourtCamera } from "../src/harbour/camera/courtCamera.ts";
import { createFollowCamera, FOLLOW_DISTANCE, FOLLOW_LOOK_HEIGHT, FOLLOW_PHI, followInRoom, SEED_REACH } from "../src/harbour/camera/followCamera.ts";
import {
  CLOSE_LANDMARKS, DESKTOP_ASPECT, OVERVIEW_POINTS, PHONE_ASPECT, arrivalAt, arrivalPose, closeLandmark, damViewPose, doorExitPose, momentPose,
  openWorldFov, overviewPose, poseSees, projectView, summitViewPose, townArrivalPose,
} from "../src/harbour/camera/mountainPoses.ts";
import {
  CAMERA_DISTRICTS, CAMERA_DOORS, CAMERA_MOMENTS, CAMERA_SOLIDS, DAM_CREST, DISTRICT_DOOR, FUND_DOOR, QUAY, RACE_LINE, SUMMIT_TELESCOPE, TOWN_SQUARE,
  cameraBlocked, cameraGround, rideFrame, stopAt,
} from "../src/harbour/camera/worldAdapter.ts";
import { FLIGHT_SPEED, flightAt, planFlight } from "../src/harbour/camera/flight.ts";
import { createRideCamera, revealWeight, rideExitHeading } from "../src/harbour/camera/rideCamera.ts";
import { JOURNEY_ZOOM_LIMIT, entersJourneyFromZoom } from "../src/harbour/camera/worldZoom.ts";
import { clearFraction, createPullIn } from "../src/harbour/camera/obstruction.ts";
import { handToLook } from "../src/harbour/camera/director.ts";
import { MOUNTAIN_TOUR, tourPose } from "../src/harbour/mountain/tour.ts";
import { TRANSPORT_STOPS, type TransportKind } from "../src/harbour/mountain/transport.ts";
import {DAM_PARTS} from "../src/harbour/mountain/damParts.ts";
import { SKATE_CAM, createSkateCamera, projectToView } from "../src/harbour/skate/camera/skateCamera.ts";
import { raceFinishShot, raceStartShot, startShotWeight } from "../src/harbour/skate/camera/raceShots.ts";
import { mountHarbourWorld, type HarbourRuntime } from "../src/harbour/scene/runtime.ts";
import { PLACES, SCENE_DRESSING, placementOf } from "../src/harbour/scene/place.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import "../src/harbour/village/VillageCourt.ts";
import "../src/harbour/library/LibraryScene.ts";
import { prepareVillageInterior } from "../src/harbour/village/interior.ts";

const COMPOSITIONS = [
  { composition: "desktop" as const, aspect: DESKTOP_ASPECT },
  { composition: "desktop" as const, aspect: 1100 / 700 },
  { composition: "phone" as const, aspect: PHONE_ASPECT },
];
const DEG = 180 / Math.PI;
const unit = (x: number, z: number) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l] as const; };
/** The horizontal direction a drawn pose looks along. */
const forwardOf = (pose: CourtPose) => { const d = realizePose(pose, cameraGround, 0.6); return unit(d.look[0] - d.eye[0], d.look[2] - d.eye[2]); };

describe("the signature view (C1)", () => {
  for (const { composition, aspect } of COMPOSITIONS) {
    it(`frames the town square in the foreground and the dam crest above it (${composition} ${aspect.toFixed(2)})`, () => {
      const fov = openWorldFov(composition, aspect), pose = townArrivalPose(composition, aspect, fov);
      expect(poseSees(pose, DAM_CREST, aspect, fov), "dam crest in frame").toBe(true);
      expect(poseSees(pose, TOWN_SQUARE, aspect, fov), "town square in frame").toBe(true);
      const drawn = realizePose(pose, cameraGround, 0.6);
      const dam = projectView(drawn.eye, drawn.look, DAM_CREST, aspect, fov), square = projectView(drawn.eye, drawn.look, TOWN_SQUARE, aspect, fov);
      // The slope and the dam in the upper two thirds, the square below them.
      expect(dam.y).toBeGreaterThan(0.33);
      expect(square.y).toBeLessThan(dam.y - 0.5);
      // It looks *up*: the view passes the horizon, which the old 1.38 clamp forbade.
      expect(pose.phi).toBeGreaterThan(1.38);
      expect(pose.phi).toBeLessThanOrEqual(COURT_BOUNDS.maxPhi);
      // The eye stands over the land, in town.
      expect(drawn.lifted).toBe(0);
      expect(drawn.eye[1]).toBeGreaterThan(cameraGround(drawn.eye[0], drawn.eye[2]) + 1.5);
    });
  }
  it("is derived from the dam's position, not written down: it aims along the square→dam line", () => {
    for (const composition of ["desktop", "phone"] as const) {
      const [fx, fz] = forwardOf(townArrivalPose(composition)), [dx, dz] = unit(DAM_CREST[0] - TOWN_SQUARE[0], DAM_CREST[2] - TOWN_SQUARE[2]);
      expect(fx * dx + fz * dz).toBeGreaterThan(0.999);
    }
  });
  it("is the Court's first frame (the place's own `court` pose), on a phone and a desktop", async () => {
    const handle = PLACES.court!.build(new THREE.Scene(), SCENE_DRESSING.classic, null, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => undefined });
    const poses = handle.poses();
    expect(poses.court).toEqual(townArrivalPose("desktop"));
    expect(poses["court:phone"]).toEqual(townArrivalPose("phone"));
    expect(poses["sky:phone"]).toEqual(overviewPose("phone"));
    handle.dispose();
  });
});

describe("the overview, the dam and the summit (C5, C12)", () => {
  for (const { composition, aspect } of COMPOSITIONS) {
    it(`holds all six districts, the town, the dam and the summit (${composition} ${aspect.toFixed(2)})`, () => {
      const fov = openWorldFov(composition, aspect), pose = overviewPose(composition, aspect, fov);
      for (const point of OVERVIEW_POINTS) expect(poseSees(pose, point, aspect, fov), JSON.stringify(point)).toBe(true);
      expect(CAMERA_DISTRICTS).toHaveLength(6);
      // Inside the Look camera's far limit, so a zoom out first reaches the limit.
      expect(pose.r).toBeLessThan(JOURNEY_ZOOM_LIMIT * 0.985);
    });
    it(`frames the dam and the view from the summit (${composition} ${aspect.toFixed(2)})`, () => {
      const fov = openWorldFov(composition, aspect);
      const dam = damViewPose(composition, aspect, fov);
      expect(poseSees(dam, DAM_CREST, aspect, fov)).toBe(true);
      expect(poseSees(dam, [DAM_CREST[0], DAM_CREST[1] - 14, DAM_CREST[2]], aspect, fov), "the dam's foot").toBe(true);
      const summit = summitViewPose(composition);
      expect(poseSees(summit, TOWN_SQUARE, aspect, fov), "the town from the summit").toBe(true);
      expect(poseSees(summit, CAMERA_DISTRICTS[0]!.at, aspect, fov), "the lowest terrace from the summit").toBe(true);
      const eye = poseEye(summit);
      expect(eye[1]).toBeGreaterThan(cameraGround(eye[0], eye[2]) + 1);
    });
  }
  it("gives a portrait phone at least 40° across (C12)", () => {
    for (const aspect of [320 / 568, PHONE_ASPECT, 430 / 932]) {
      const fov = openWorldFov("phone", aspect);
      const across = 2 * Math.atan(Math.tan(fov / 2 / DEG) * aspect) * DEG;
      expect(across).toBeGreaterThanOrEqual(40 - 1e-6);
    }
  });
});

describe("the walking camera (C2, C12)", () => {
  it("walks the open world at 10–14° down, 4.5 behind (4.0 on a phone), looking 1.2 above the feet", () => {
    const pitch = (Math.PI / 2 - FOLLOW_PHI) * DEG;
    expect(pitch).toBeGreaterThanOrEqual(10);
    expect(pitch).toBeLessThanOrEqual(14);
    expect(FOLLOW_DISTANCE).toEqual({ desktop: 4.5, phone: 4.0 });
    expect(FOLLOW_LOOK_HEIGHT).toBeCloseTo(1.2, 9);
    // With the lens it walks on, the top of the frame is well above the horizon in both compositions.
    for (const { composition, aspect } of COMPOSITIONS) expect(openWorldFov(composition, aspect) / 2 - pitch).toBeGreaterThan(6);
  });
  it("keeps the close, higher pitch inside rooms", () => {
    for (const composition of ["desktop", "phone"] as const) {
      const room = followInRoom(3, composition);
      expect(room.phi).toBeCloseTo(0.92, 9);
      expect((Math.PI / 2 - room.phi) * DEG).toBeGreaterThan(30);
      expect(room.r).toBeLessThanOrEqual(3.4);
    }
  });
  it("never stands the eye under the terrain, and pulls in fast and gives back slowly", () => {
    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 400);
    const follow = createFollowCamera({ camera, composition: "desktop", reduced: false, groundHeightAt: cameraGround, blocked: (x, y, z) => cameraBlocked(x, y, z) });
    // On the mountain road, tilted to look up at the dam.
    const at = { x: 60, z: -150 }, y = cameraGround(at.x, at.z);
    follow.setSubject({ x: at.x, y: y + FOLLOW_LOOK_HEIGHT, z: at.z, yaw: Math.PI, speed: 0 });
    follow.snap();
    for (let heading = 0; heading < 72; heading++) {
      follow.drag(Math.PI * 2 / 72 / 0.0052, heading % 2 ? -400 : 400);
      follow.tick(1 / 60);
      const eye = follow.eye();
      expect(eye[1], `heading ${heading}`).toBeGreaterThan(cameraGround(eye[0], eye[2]));
    }
    const pull = createPullIn();
    expect(pull.update(0.3, 1 / 60)).toBeCloseTo(0.3, 9);
    const out = pull.update(1, 1 / 60);
    expect(out).toBeGreaterThan(0.3);
    expect(out).toBeLessThan(0.35);
  });
  it("counts terrain and every camera solid on the line (C11): storefronts, abutments, the dam glass, pillars", () => {
    const ids = CAMERA_SOLIDS.map((s) => s.id).join(" ");
    for (const kind of ["storefront:outfitters", "storefront:potters-supply", "dam:abutment", "gondola:pillar", "funicular:pillar"]) expect(ids).toContain(kind);
    expect(DAM_CREST).toEqual(DAM_PARTS.arc[Math.floor(DAM_PARTS.arc.length/2)]);
    for(const a of DAM_PARTS.abutments)expect(cameraBlocked(a.at[0],DAM_PARTS.foot+1,a.at[2])).toBe(true);
    const store = CAMERA_SOLIDS.find((s) => s.id === "storefront:outfitters")!;
    const mid: Vec3 = [(store.min[0] + store.max[0]) / 2, (store.min[1] + store.max[1]) / 2, (store.min[2] + store.max[2]) / 2];
    expect(cameraBlocked(...mid)).toBe(true);
    expect(clearFraction([mid[0], mid[1], mid[2] + 12], [mid[0], mid[1], mid[2] - 12], (x, y, z) => cameraBlocked(x, y, z))).toBeLessThan(0.5);
    expect(cameraBlocked(DAM_CREST[0], DAM_CREST[1] - 4, DAM_CREST[2])).toBe(true);
    expect(cameraBlocked(DAM_CREST[0], DAM_CREST[1] - 4, DAM_CREST[2] + 4)).toBe(false);
  });
  it("ignores a Look target far from the body when Walk takes over (C3)", () => {
    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 400);
    const follow = createFollowCamera({ camera, composition: "desktop", reduced: false });
    follow.setSubject({ x: 99, y: 52.2, z: -168, yaw: 0, speed: 0 });
    follow.snap();
    follow.seed(townArrivalPose("desktop"));
    expect(Math.hypot(follow.pose().target[0] - 99, follow.pose().target[2] + 168)).toBeLessThan(1e-6);
    expect(Math.hypot(poseEye(follow.pose())[0] - 99, poseEye(follow.pose())[2] + 168)).toBeLessThan(SEED_REACH);
  });
});

describe("Look is safe and flies at a walking pace (C8, C9)", () => {
  it("keeps the eye over the land at every heading round the dam", () => {
    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 1100);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: true, aspect: 1.6, terrain: { ground: cameraGround, blocked: (x, y, z) => cameraBlocked(x, y, z, 0.15) } });
    court.hold(damViewPose("desktop"));
    for (let i = 0; i < 72; i++) {
      court.drag(Math.PI * 2 / 72 / 0.0052, i % 3 === 0 ? -200 : 60);
      expect(camera.position.y, `heading ${i}`).toBeGreaterThan(cameraGround(camera.position.x, camera.position.z) + 0.25);
    }
  });
  it("flies every tour hop at no more than 120 u/s and starts gently", () => {
    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 1100);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: false, aspect: 1.6, terrain: { ground: cameraGround } });
    court.hold(townArrivalPose("desktop"));
    const dt = 1 / 60;
    for (const stop of MOUNTAIN_TOUR) {
      court.goTo(tourPose(stop.id, "desktop")!);
      let last = camera.position.clone(), first = true, frames = 0;
      while (court.tick(dt) && frames < 4000) {
        const speed = camera.position.distanceTo(last) / dt;
        expect(speed, `${stop.id} frame ${frames}`).toBeLessThanOrEqual(120);
        if (first) { expect(speed, `${stop.id} first frame`).toBeLessThan(20); first = false; }
        last = camera.position.clone(); frames++;
      }
      expect(frames, stop.id).toBeLessThan(4000);
    }
  });
  it("arcs a flight over the terrain and scales its duration with the distance", () => {
    const from = townArrivalPose("desktop"), to = summitViewPose("desktop");
    const plan = planFlight(from, to, cameraGround);
    expect(plan.duration).toBeGreaterThan(plan.length / FLIGHT_SPEED);
    for (let t = 0; t <= plan.duration; t += plan.duration / 50) {
      const eye = flightAt(plan, t).eye;
      expect(eye[1]).toBeGreaterThan(cameraGround(eye[0], eye[2]));
    }
    const near = planFlight(from, { ...from, target: [from.target[0] + 30, from.target[1], from.target[2]] }, cameraGround);
    expect(near.duration).toBeLessThan(plan.duration);
  });
  it("cuts instead of flying under reduced motion", () => {
    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 1100);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: true, aspect: 1.6, terrain: { ground: cameraGround } });
    court.goTo(summitViewPose("desktop"));
    expect(court.flying()).toBe(false);
    expect(court.tick(1 / 60)).toBe(false);
  });
});

describe("zooming out to the Journey (C5)", () => {
  it("fires only on pulls made at the far limit, and only after the affordance has shown", () => {
    for (const composition of ["desktop", "phone"] as const) {
      const overview = overviewPose(composition);
      // A continuous pull from the overview can cross the far edge in one gesture.
      expect(entersJourneyFromZoom(overview.r, Math.log(JOURNEY_ZOOM_LIMIT * 1.03 / overview.r))).toBe(true);
    }
    expect(JOURNEY_ZOOM_LIMIT).toBe(COURT_BOUNDS.maxR);
    expect(entersJourneyFromZoom(COURT_BOUNDS.maxR, 0.2)).toBe(true);
    expect(entersJourneyFromZoom(COURT_BOUNDS.maxR, -0.2)).toBe(false);
    expect(entersJourneyFromZoom(COURT_BOUNDS.maxR, Number.NaN)).toBe(false);
  });
});

describe("arrivals, exits and small moments (C3, C7)", () => {
  it("faces every Visit arrival at its building's door (dot > 0.7), and the walking camera looks there too", () => {
    for (const [district, place] of Object.entries(DISTRICT_DOOR)) {
      const arrival = arrivalPose(district)!, door = CAMERA_DOORS[place]!.at;
      const [dx, dz] = unit(door[0] - arrival.at[0], door[2] - arrival.at[2]);
      expect(Math.sin(arrival.yaw) * dx + Math.cos(arrival.yaw) * dz, district).toBeGreaterThan(0.7);
      const [fx, fz] = forwardOf(arrival.pose);
      expect(fx * dx + fz * dz, `${district} camera`).toBeGreaterThan(0.7);
    }
    const dam = arrivalPose("reservoir")!, [x, z] = unit(DAM_CREST[0] - dam.at[0], DAM_CREST[2] - dam.at[2]);
    expect(Math.sin(dam.yaw) * x + Math.cos(dam.yaw) * z).toBeGreaterThan(0.7);
    // The guide's own "Visit" points resolve to these arrivals, and a moved one still faces the door.
    for (const [district, place] of Object.entries(DISTRICT_DOOR)) {
      const exact = arrivalPose(district)!;
      expect(arrivalAt(exact.at)!.yaw).toBeCloseTo(exact.yaw, 9);
      const moved = arrivalAt([exact.at[0] + 3, exact.at[1], exact.at[2] - 4])!, door = CAMERA_DOORS[place]!.at;
      const [dx, dz] = unit(door[0] - moved.at[0], door[2] - moved.at[2]);
      expect(Math.sin(moved.yaw) * dx + Math.cos(moved.yaw) * dz, `${district} moved`).toBeGreaterThan(0.99);
    }
  });
  it("faces away from the door on the way out", () => {
    const door = CAMERA_DOORS.library!, landing = { x: door.at[0] + door.out[0] * 2.2, y: door.at[1], z: door.at[2] + door.out[1] * 2.2, yaw: 0 };
    const [fx, fz] = forwardOf(doorExitPose("library", landing, "desktop"));
    expect(fx * door.out[0] + fz * door.out[1]).toBeGreaterThan(0.95);
  });
  it("gives every small moment its own θ and φ, and every overlook and bench looks at the town (or the dam)", () => {
    const seen = new Set<string>();
    for (const moment of CAMERA_MOMENTS) {
      const pose = momentPose(moment.id)!;
      expect(pose, moment.id).not.toBeNull();
      seen.add(`${pose.theta.toFixed(3)}:${pose.phi.toFixed(3)}`);
      if (moment.kind === "overlook" || moment.kind === "bench") {
        const [fx, fz] = forwardOf(pose), [dx, dz] = unit(moment.look[0] - moment.at[0], moment.look[2] - moment.at[2]);
        expect(fx * dx + fz * dz, moment.id).toBeGreaterThan(0.9);
        expect(poseSees(pose, moment.look, DESKTOP_ASPECT, 42), `${moment.id} sees what it overlooks`).toBe(true);
      }
    }
    expect(seen.size).toBe(CAMERA_MOMENTS.length);
  });
});

describe("Close frames the nearest landmark (point 9)", () => {
  it("never flies to the fountain from the mountain", () => {
    expect(closeLandmark([SUMMIT_TELESCOPE[0], SUMMIT_TELESCOPE[1], SUMMIT_TELESCOPE[2] + 6], "desktop")!.id).toBe("summit-telescope");
    expect(closeLandmark([DAM_CREST[0], DAM_CREST[1], DAM_CREST[2] + 8], "phone")!.id).toBe("dam-crest");
    expect(closeLandmark([0.95, 0, 5.1], "desktop")!.id).toBe("fountain");
    expect(closeLandmark([FUND_DOOR[0], FUND_DOOR[1], FUND_DOOR[2] + 2], "desktop")!.id).toBe("door:bank");
    // Out in the middle of nowhere there is nothing close to hold.
    expect(closeLandmark([-160, 40, -40], "desktop")).toBeNull();
    for (const landmark of CLOSE_LANDMARKS) {
      const pose = landmark.pose("phone"), eye = realizePose(pose, cameraGround, 0.6).eye;
      expect(eye[1], landmark.id).toBeGreaterThan(cameraGround(eye[0], eye[2]));
      expect(poseSees(pose, landmark.at, PHONE_ASPECT, openWorldFov("phone", PHONE_ASPECT)), landmark.id).toBe(true);
    }
  });
});

describe("the ride camera (C4)", () => {
  const rides: { kind: TransportKind; from: number; to: number }[] = [
    { kind: "gondola", from: 0, to: 1 }, { kind: "gondola", from: 1, to: 0 },
    { kind: "funicular", from: 0, to: 3 }, { kind: "funicular", from: 3, to: 1 },
  ];
  for (const { composition, aspect } of [COMPOSITIONS[0]!, COMPOSITIONS[2]!]) {
    for (const ride of rides) {
      it(`keeps the rider in frame every frame: ${ride.kind} ${ride.from}→${ride.to} (${composition})`, () => {
        const camera = createRideCamera({ ground: cameraGround, blocked: (x, y, z) => cameraBlocked(x, y, z) });
        const a = TRANSPORT_STOPS[ride.kind][ride.from]!.at, b = TRANSPORT_STOPS[ride.kind][ride.to]!.at;
        const duration = Math.max(8, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 14), dt = 1 / 60;
        const fov = openWorldFov(composition, aspect);
        let shotAtReveal: { eye: Vec3; look: Vec3 } | null = null;
        for (let t = 0; t <= duration; t += dt) {
          const u = t / duration, frame = rideFrame(ride.kind, ride.from, ride.to, u);
          const rider: Vec3 = [frame.at[0], frame.at[1] + 1.1, frame.at[2]];
          const input = { kind: ride.kind, u, cabin: frame.at, dir: frame.dir, rider, aspect, fov };
          const shot = t === 0 ? camera.start(input) : camera.update(input, dt, false);
          const p = projectView(shot.eye, shot.look, rider, aspect, shot.fov);
          expect(p.depth, `u=${u.toFixed(3)}`).toBeGreaterThan(0);
          expect(Math.abs(p.x), `u=${u.toFixed(3)}`).toBeLessThanOrEqual(0.95);
          expect(Math.abs(p.y), `u=${u.toFixed(3)}`).toBeLessThanOrEqual(0.95);
          expect(shot.eye[1], `u=${u.toFixed(3)} over the land`).toBeGreaterThan(cameraGround(shot.eye[0], shot.eye[2]));
          if (Math.abs(u - 0.55) < dt / duration) shotAtReveal = shot;
        }
        if (ride.kind === "gondola") {
          expect(revealWeight("gondola", 0.55)).toBeGreaterThan(0.95);
          // The reveal looks out toward the town, the cabin in the foreground.
          const [fx, fz] = unit(shotAtReveal!.look[0] - shotAtReveal!.eye[0], shotAtReveal!.look[2] - shotAtReveal!.eye[2]);
          const mid = rideFrame(ride.kind, ride.from, ride.to, 0.55).at, [tx, tz] = unit(TOWN_SQUARE[0] - mid[0], TOWN_SQUARE[2] - mid[2]);
          expect(fx * tx + fz * tz).toBeGreaterThan(0.5);
        } else expect(revealWeight("funicular", 0.55)).toBe(0);
      });
    }
  }
  it("faces along the travel while it rides", () => {
    const camera = createRideCamera({ ground: cameraGround });
    const f = rideFrame("funicular", 0, 1, 0.5);
    const shot = camera.start({ kind: "funicular", u: 0.5, cabin: f.at, dir: f.dir, rider: [f.at[0], f.at[1] + 1.1, f.at[2]], aspect: 1.6, fov: 42 });
    const [lx, lz] = unit(shot.look[0] - shot.eye[0], shot.look[2] - shot.eye[2]), [dx, dz] = unit(f.dir[0], f.dir[2]);
    expect(lx * dx + lz * dz).toBeGreaterThan(0.7);
  });
  it("hands back at the station facing away from the platform, toward where you walk next", () => {
    for (const kind of ["funicular", "gondola"] as const) {
      for (let i = 0; i < TRANSPORT_STOPS[kind].length; i++) {
        const heading = rideExitHeading(kind, i), stop = stopAt(kind, i);
        const next = [...CAMERA_DISTRICTS.map((d) => d.at), TOWN_SQUARE].sort((p, q) => Math.hypot(p[0] - stop[0], p[2] - stop[2]) - Math.hypot(q[0] - stop[0], q[2] - stop[2]))[0]!;
        const [dx, dz] = unit(next[0] - stop[0], next[2] - stop[2]);
        expect(Math.sin(heading) * dx + Math.cos(heading) * dz, `${kind} ${i}`).toBeGreaterThan(0.99);
      }
    }
  });
});

describe("the skate camera on the mountain (minor)", () => {
  it("keeps the lens breathing across a race and blends into a mode change", () => {
    expect(SKATE_CAM.raceFastSpeed).toBeGreaterThanOrEqual(15);
    const cam = createSkateCamera({ fastSpeed: SKATE_CAM.raceFastSpeed });
    const present = (speed: number) => ({ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: -speed, speed, heading: Math.PI, phase: "roll", clearance: 0, carve: 0, grind: null } as never);
    cam.lensFrom(42);
    const first = cam.update(present(12), [], 1 / 60, { aspect: 1.6 });
    expect(first.fov).toBeCloseTo(42, 1);
    let f = first;
    for (let i = 0; i < 240; i++) f = cam.update(present(12), [], 1 / 60, { aspect: 1.6 });
    // At an average race speed the lens is open but not pinned at its widest: it still breathes with speed.
    const cruising = f.fov; // (the frame object is reused: keep the number)
    expect(cruising).toBeGreaterThan(SKATE_CAM.fovRest + 4);
    expect(cruising).toBeLessThan(SKATE_CAM.fovFast - 1);
    let g = f;
    for (let i = 0; i < 240; i++) g = cam.update(present(14.5), [], 1 / 60, { aspect: 1.6 });
    expect(g.fov).toBeGreaterThan(cruising + 1);
  });
  it("opens the race on an authored start shot down the first bends, then hands over", () => {
    expect(startShotWeight(3)).toBe(1);
    expect(startShotWeight(1.6)).toBe(1);
    expect(startShotWeight(0.5)).toBe(0);
    expect(startShotWeight(1.1)).toBeGreaterThan(0);
    expect(startShotWeight(1.1)).toBeLessThan(1);
    const shot = raceStartShot();
    const ahead = RACE_LINE[Math.min(RACE_LINE.length - 1, 12)]!, start = RACE_LINE[0]!;
    const [fx, fz] = unit(shot.look[0] - shot.eye[0], shot.look[2] - shot.eye[2]), [dx, dz] = unit(ahead[0] - start[0], ahead[2] - start[2]);
    expect(fx * dx + fz * dz).toBeGreaterThan(0.6);
    const frame = { position: [...shot.eye] as [number, number, number], target: [...shot.look] as [number, number, number], fov: shot.fov, roll: 0 };
    const p = projectToView(frame, [start[0], start[1] + 0.6, start[2]], 1.6);
    expect(p).not.toBeNull();
  });
  it("finishes on the quay with the Fund bank's door in the frame", () => {
    for (const aspect of [1.6, PHONE_ASPECT]) {
      const shot = raceFinishShot(aspect);
      const frame = { position: [...shot.eye] as [number, number, number], target: [...shot.look] as [number, number, number], fov: shot.fov, roll: 0 };
      for (const point of [QUAY, [FUND_DOOR[0], FUND_DOOR[1] + 1.2, FUND_DOOR[2]] as Vec3]) {
        const p = projectToView(frame, point, aspect)!;
        expect(p, JSON.stringify(point)).not.toBeNull();
        expect(p[0]).toBeGreaterThan(0); expect(p[0]).toBeLessThan(1);
        expect(p[1]).toBeGreaterThan(0); expect(p[1]).toBeLessThan(1);
      }
    }
  });
});

describe("the hand-off is the view on screen (C3, pure)", () => {
  it("leaves Look exactly where Walk was: the next frame does not move", () => {
    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 1100);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: false, aspect: 1.6, terrain: { ground: cameraGround } });
    court.hold(townArrivalPose("desktop"));
    const follow = createFollowCamera({ camera, composition: "desktop", reduced: false, groundHeightAt: cameraGround });
    const y = cameraGround(99, -160);
    follow.setSubject({ x: 99, y: y + 1.2, z: -160, yaw: 1, speed: 0 }); follow.snap();
    for (let i = 0; i < 30; i++) follow.tick(1 / 60);
    const before = camera.position.clone();
    handToLook(court, follow.shown());
    court.tick(1 / 60);
    expect(camera.position.distanceTo(before) * 60).toBeLessThan(120);
    expect(camera.position.distanceTo(before)).toBeLessThan(0.05);
  });
});

/* ── The shipped runtime ──────────────────────────────────────────────── */
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: () => null });
vi.mock("../src/house/world/rendererOwner.ts", () => ({ acquireWorldRenderer: () => ({ active: true, renderer: { render: vi.fn(), setSize: vi.fn(), info: { render: { calls: 0 }, memory: { geometries: 0, textures: 0 } } }, requestFrame: (cb: FrameRequestCallback) => requestAnimationFrame(cb), cancelFrame: (id: number) => cancelAnimationFrame(id), listenCanvas: () => () => undefined, release: vi.fn() }) }));
const household = seedDemoHousehold({ today: "2026-09-20" }), reading = buildHarbourReading(household, household.members[0]!.id, "2026-09-20", "current");

describe("the runtime's camera (C1, C3, C10)", () => {
  let host: HTMLDivElement, world: HarbourRuntime | undefined, frames = new Map<number, FrameRequestCallback>(), serial = 0, clock = 1000;
  const STEP = 34;
  const run = (n: number) => { for (let i = 0; i < n; i += 1) { const work = [...frames.values()]; frames.clear(); clock += STEP; work.forEach((cb) => cb(clock)); } };
  const size = { width: 1440, height: 900 };
  beforeEach(() => {
    world = undefined; frames.clear(); serial = 0; clock = 1000;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.set(++serial, cb); return serial; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    host = document.createElement("div");
    host.getBoundingClientRect = () => ({ width: size.width, height: size.height, left: 0, top: 0, right: size.width, bottom: size.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.append(host);
  });
  afterEach(() => { world?.dispose(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); size.width = 1440; size.height = 900; });
  prepareVillageInterior("library");
  const mount = () => (world = mountHarbourWorld(host, "classic", "lite", { onReady: vi.fn(), onFailure: vi.fn(), place: PLACES.court, reading, dressing: SCENE_DRESSING.classic }));

  it('keeps Run across place changes and clears interrupted ride camera state',()=>{
    const stage=mount();run(2);stage.body()!.runLock(true);
    const stop=TRANSPORT_STOPS.funicular[0]!.at;
    stage.mountainTravel(stop,{kind:'funicular',from:0,to:3});run(12);
    stage.enter('library',{reduced:true});run(8);
    expect(stage.placeId()).toBe('library');expect(stage.body()!.runLock()).toBe(true);
    const body=stage.body()!.at(),eye=stage.camera();expect(Math.hypot(eye[0]-body.x,eye[2]-body.z)).toBeLessThan(30);
  });
  it('releases moving transport before an explicit view or downhill race',()=>{
    const stage=mount();run(2);
    stage.monorailBoard(0,false);stage.monorailSelect(3);run(90);
    expect(stage.shot('view:world')).toBe(true);run(90);
    const at=stage.body()!.at();run(10);const held=stage.body()!.at();
    expect(Math.hypot(at.x-held.x,at.z-held.z)).toBeLessThan(.05);expect(stage.pose().r).toBeGreaterThan(120);
    stage.monorailBoard(0,false);stage.monorailSelect(3);run(90);
    expect(stage.body()!.skate.enable(true)).toBe(true);stage.body()!.skate.route('mountain-descent');run(20);
    expect(stage.body()!.skate.active()).toBe(true);
  });
  it('app reduced motion loads opaque district detail and hides flying wildlife after cuts',async()=>{
    const stage=mount();run(3);
    document.documentElement.dataset.motion='reduced';await Promise.resolve();
    try{stage.shot('view:world');run(20);
      let birds=0,hidden=0;stage.place().group.traverse(o=>{if(o.name==='Flying bird'){birds++;if(!o.visible)hidden++;}});
      expect(birds).toBeGreaterThan(0);expect(hidden).toBe(birds);
      const materials:THREE.Material[]=[];stage.place().group.traverse(o=>{const m=(o as THREE.Mesh).material;if(m&&o.name.includes("close detail"))materials.push(...(Array.isArray(m)?m:[m]));});
      expect(materials.length).toBeGreaterThan(0);expect(materials.some(m=>m.opacity===0)).toBe(false);
    }finally{delete document.documentElement.dataset.motion;}
  });
  it("opens on the signature shot: the square below, the dam crest above", () => {
    for (const [w, h, composition] of [[1440, 900, "desktop"], [390, 844, "phone"]] as const) {
      size.width = w; size.height = h;
      const stage = mount(); run(2);
      const aspect = w / h, fov = openWorldFov(composition, aspect);
      const arrival = townArrivalPose(composition);
      expect(stage.pose().r).toBeCloseTo(arrival.r, 6); expect(stage.pose().theta).toBeCloseTo(arrival.theta, 6); expect(stage.pose().phi).toBeCloseTo(arrival.phi, 6);
      stage.pose().target.forEach((v, i) => expect(v).toBeCloseTo(arrival.target[i]!, 6));
      const eye = stage.camera() as Vec3, look = realizePose(stage.pose(), cameraGround, 0.9).look;
      for (const point of [DAM_CREST, TOWN_SQUARE]) {
        const p = projectView(eye, look, point, aspect, fov);
        expect(Math.abs(p.x), `${composition} ${JSON.stringify(point)}`).toBeLessThan(1);
        expect(Math.abs(p.y), `${composition} ${JSON.stringify(point)}`).toBeLessThan(1);
      }
      stage.dispose(); world = undefined;
    }
  });

  it("walks the open world on the open-world pitch, and hands off to Look on a tool without a jump", () => {
    const stage = mount(); run(2);
    const body = stage.body()!;
    // Up on the mountain, well away from the Look camera's stale town goal.
    body.place(92, -168, 0, cameraGround(92, -168));
    body.input({ forward: 1, strafe: 0 }); run(40); body.input({ forward: 0, strafe: 0 }); run(60);
    expect(body.following()).toBe(true);
    const at = body.at(), eye = stage.camera();
    const down = Math.atan2(at.y + FOLLOW_LOOK_HEIGHT - eye[1], Math.hypot(eye[0] - at.x, eye[2] - at.z)) * DEG;
    expect(-down).toBeGreaterThan(8);
    expect(-down).toBeLessThan(16);
    expect(Math.hypot(eye[0] - at.x, eye[1] - at.y - FOLLOW_LOOK_HEIGHT, eye[2] - at.z)).toBeLessThan(FOLLOW_DISTANCE.desktop + 0.3);
    // A tool opens: Look takes the view as it is. The next frames move nothing like a whip.
    const before = stage.camera();
    stage.setToolOpen(true); run(1);
    const after = stage.camera();
    expect(Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]) / (STEP / 1000)).toBeLessThan(120);
    run(10);
    const later = stage.camera();
    expect(Math.hypot(later[0] - before[0], later[1] - before[1], later[2] - before[2])).toBeLessThan(1);
    // …and back: the first key walks from where the view is, never from the town.
    stage.setToolOpen(false);
    body.input({ forward: 1, strafe: 0 }); run(1);
    const walking = stage.camera();
    expect(Math.hypot(walking[0] - later[0], walking[1] - later[1], walking[2] - later[2]) / (STEP / 1000)).toBeLessThan(120);
    expect(Math.hypot(walking[0] - body.at().x, walking[2] - body.at().z)).toBeLessThan(10);
  });

  it("comes out of the Library behind the body, facing away from its door (the dissection's 211-unit case)", () => {
    const stage = mount(); run(2);
    stage.enter("library", { reduced: true }); run(4);
    expect(stage.placeId()).toBe("library");
    stage.enter("court", { reduced: true }); run(4);
    const body = stage.body()!, at = body.at(), eye = stage.camera();
    expect(Math.hypot(eye[0] - at.x, eye[1] - at.y, eye[2] - at.z)).toBeLessThan(8);
    const door = CAMERA_DOORS.library!, [fx, fz] = unit(at.x - eye[0], at.z - eye[2]);
    expect(fx * door.out[0] + fz * door.out[1]).toBeGreaterThan(0.7);
    // The first W walks out into the world, not back through the door.
    const from = Math.hypot(at.x - door.at[0], at.z - door.at[2]);
    body.input({ forward: 1, strafe: 0 }); run(20); body.input({ forward: 0, strafe: 0 });
    expect(stage.placeId()).toBe("court");
    expect(Math.hypot(body.at().x - door.at[0], body.at().z - door.at[2])).toBeGreaterThan(from);
    expect(placementOf("library")).not.toBeNull();
  });

  it("Escape's way back (body.follow) never flies to town, and Close holds the nearest landmark", () => {
    const stage = mount(); run(2);
    const body = stage.body()!;
    body.place(SUMMIT_TELESCOPE[0] + 4, SUMMIT_TELESCOPE[2] + 6, 0, cameraGround(SUMMIT_TELESCOPE[0] + 4, SUMMIT_TELESCOPE[2] + 6));
    body.input({ forward: 1, strafe: 0 }); run(10); body.input({ forward: 0, strafe: 0 }); run(30);
    expect(stage.toggleClose(true)).toBe(true);
    expect(body.following()).toBe(false);
    run(200);
    const held = stage.camera();
    expect(Math.hypot(held[0] - SUMMIT_TELESCOPE[0], held[2] - SUMMIT_TELESCOPE[2])).toBeLessThan(12);
    // Out of Close is back to Walk at the body.
    stage.toggleClose(false); run(60);
    expect(body.following()).toBe(true);
    // Look, then Escape's way back to Walk: nowhere near the town.
    body.follow(false); run(5);
    body.follow(true); run(40);
    const eye = stage.camera(), at = body.at();
    expect(Math.hypot(eye[0] - at.x, eye[2] - at.z)).toBeLessThan(8);
    expect(Math.hypot(eye[0], eye[2])).toBeGreaterThan(200);
  });

  it("pins distant detail only for overview; tools retain the walking radius", () => {
    const stage = mount(); run(2);
    const handle = stage.place() as unknown as { streamDetails: (x: number, z: number, pinned: boolean) => boolean };
    const calls: [number, number, boolean][] = [];
    const original = handle.streamDetails.bind(handle);
    handle.streamDetails = (x, z, pinned) => { calls.push([x, z, pinned]); return original(x, z, pinned); };
    expect(stage.shot("view:world")).toBe(true); run(3);
    // A near camera does not build the whole mountain at the beginning of the flight.
    expect(calls.at(-1)![2]).toBe(stage.pose().r>120);
    run(260);
    const look = calls.at(-1)!;
    expect(look[2]).toBe(true);
    expect(Math.hypot(look[0] - stage.pose().target[0], look[1] - stage.pose().target[2])).toBeLessThan(1e-6);
    const body = stage.body()!;
    body.input({ forward: 1, strafe: 0 }); run(20); body.input({ forward: 0, strafe: 0 }); run(2);
    const walk = calls.at(-1)!;
    expect(walk[2]).toBe(false);
    stage.setToolOpen(true);run(3);expect(calls.at(-1)![2]).toBe(false);
    expect(Math.hypot(walk[0] - body.at().x, walk[1] - body.at().z)).toBeLessThan(1e-6);
  });
});
