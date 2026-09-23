import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  COURT_ANCHORS,
  COURT_ANCHOR_IDS,
  COURT_BOUNDS,
  COURT_FOV,
  FLAGSTONE,
  TERRACE_RADIUS,
  clampCourtPose,
  courtPose,
  holdPoseInRoom,
  flagstoneVisible,
  CLOSE_HOLDS,
  CLOSE_PLACES,
  closePose,
  poseEye,
  projectPoint,
  samePose,
  type CourtAnchor,
  type CourtMode,
  type CourtPose,
} from "../src/harbour/camera/poses.ts";
import { EASE, ROAM_COURT_BOUNDS, clampPose, createCourtCamera } from "../src/harbour/camera/courtCamera.ts";
import { PLACE_HOLDS } from "../src/harbour/scene/place.ts";
import { HARBOUR_PLACE_NAMES } from "../src/harbour/flag.ts";
import { towerPoses } from "../src/harbour/tower/TowerScene.ts";
import { cellarPoses } from "../src/harbour/cellar/CellarScene.ts";
import { clampRoamCam } from "../src/path/world/roamCamera.ts";

const PHONE_ASPECTS = [320 / 568, 390 / 844, 430 / 932];
const DESKTOP_ASPECTS = [1100 / 700, 1440 / 900];

const everyPose = (composition: "phone" | "desktop", aspect: number): { name: string; pose: CourtPose }[] => [
  { name: "sky", pose: courtPose("sky", undefined, composition, aspect) },
  { name: "court", pose: courtPose("court", undefined, composition, aspect) },
  ...COURT_ANCHOR_IDS.map((anchor) => ({ name: `object:${anchor}`, pose: courtPose("object", anchor, composition, aspect) })),
];

describe("Little Harbour · the Court's poses (BUILD_PLAN #18)", () => {
  it("lays the Court out around the Queen inside the terrace, the gate side toward +z", () => {
    expect(COURT_ANCHORS.queen).toEqual([0, 0, 0]);
    expect(COURT_ANCHORS.rook).toEqual([4.2, 0, -3.0]);
    expect(COURT_ANCHORS.knight).toEqual([-4.2, 0, -3.0]);
    expect(COURT_ANCHORS.bishop).toEqual([0, 0, 4.6]);
    expect(COURT_ANCHORS.sundial).toEqual([4.0, 0, 3.2]);
    expect(COURT_ANCHORS.mailbox).toEqual([-1.2, 0, 5.4]);
    expect(COURT_ANCHORS.gate).toEqual([0, 0, 6.2]);
    expect(FLAGSTONE).toEqual({ x: 0, z: 1.6, size: 0.9 });
    for (const id of COURT_ANCHOR_IDS) {
      const [x, y, z] = COURT_ANCHORS[id];
      expect(y, id).toBe(0);
      expect(Math.hypot(x, z), `${id} on the terrace`).toBeLessThanOrEqual(TERRACE_RADIUS + 0.2);
    }
    expect(COURT_ANCHORS.gate[2]).toBeGreaterThan(COURT_ANCHORS.bishop[2]);
  });

  it("keeps the Everyday flagstone inside the frame in every phone pose, at every phone width", () => {
    for (const aspect of PHONE_ASPECTS) {
      for (const { name, pose } of everyPose("phone", aspect)) {
        expect(flagstoneVisible(pose, aspect), `${name} @ ${aspect.toFixed(3)}`).toBe(true);
      }
    }
  });

  it("keeps the flagstone in the diorama, the sky and the Queen's portrait on desktop too", () => {
    for (const aspect of DESKTOP_ASPECTS) {
      for (const { name, pose } of everyPose("desktop", aspect)) {
        if (name === "sky" || name === "court" || name === "object:queen") expect(flagstoneVisible(pose, aspect), `${name} @ ${aspect.toFixed(2)}`).toBe(true);
      }
    }
  });

  it("orders the radii: sky beyond the court, the court beyond any object", () => {
    for (const composition of ["phone", "desktop"] as const) {
      for (const aspect of composition === "phone" ? PHONE_ASPECTS : DESKTOP_ASPECTS) {
        const sky = courtPose("sky", undefined, composition, aspect), court = courtPose("court", undefined, composition, aspect);
        expect(sky.r, `${composition} sky > court`).toBeGreaterThan(court.r);
        for (const anchor of COURT_ANCHOR_IDS) {
          const object = courtPose("object", anchor, composition, aspect);
          expect(court.r, `${composition} court > ${anchor}`).toBeGreaterThan(object.r);
          expect(object.r, `${composition} ${anchor} close`).toBeLessThanOrEqual(5.4);
        }
        // Pieces and props are framed at 3.2; only the Queen's portrait stands back for her height.
        for (const anchor of ["rook", "bishop", "knight", "sundial", "mailbox"] as const) expect(courtPose("object", anchor, composition, aspect).r).toBeCloseTo(3.2, 6);
        expect(sky.r).toBeCloseTo(160, 6);
      }
    }
  });

  it("is a three-quarter diorama: tilted from vertical, swung a little from the gate, the Queen in the upper half", () => {
    const desktop = courtPose("court", undefined, "desktop", 1440 / 900), phone = courtPose("court", undefined, "phone", 390 / 844);
    expect(desktop.phi).toBeCloseTo(1.04, 6);
    expect(phone.phi).toBeCloseTo(0.9, 6);
    // A phone swings only a little (its frame is a narrow column); the desktop takes a real three-quarter view.
    expect(phone.theta).toBeGreaterThan(0);
    expect(phone.theta).toBeLessThan(0.3);
    expect(desktop.theta).toBeGreaterThan(0.3);
    expect(desktop.theta).toBeLessThan(0.7);
    // On a phone the Queen stands above the flagstone: her crown high, the stone in the lower third.
    const crown = projectPoint(phone, [0, 2.05, 0], 390 / 844), stone = projectPoint(phone, [FLAGSTONE.x, 0, FLAGSTONE.z], 390 / 844);
    expect(crown.y).toBeGreaterThan(0.3);
    expect(stone.y).toBeLessThan(0);
    expect(stone.y).toBeGreaterThan(-0.67);
  });

  it("frames each object at its anchor: the target stands on the anchor, at about its mid-height", () => {
    for (const composition of ["phone", "desktop"] as const) {
      for (const anchor of COURT_ANCHOR_IDS) {
        const pose = courtPose("object", anchor, composition, composition === "phone" ? 390 / 844 : 1440 / 900);
        const [ax, , az] = COURT_ANCHORS[anchor];
        if (anchor !== "queen") {
          expect(pose.target[0], `${anchor} x`).toBeCloseTo(ax, 6);
          expect(pose.target[2], `${anchor} z`).toBeCloseTo(az, 6);
        }
        expect(pose.target[1]).toBeGreaterThan(0.4);
        expect(pose.target[1]).toBeLessThan(1.3);
        // The anchor itself is dead centre of the frame.
        const centre = projectPoint(pose, pose.target, 1);
        expect(Math.abs(centre.x)).toBeLessThan(1e-6);
        expect(Math.abs(centre.y)).toBeLessThan(1e-6);
      }
    }
    // The Queen's portrait looks at her from the gate side (her face), never her back.
    for (const composition of ["phone", "desktop"] as const) {
      const eye = poseEye(courtPose("object", "queen", composition, 1));
      expect(eye[2]).toBeGreaterThan(2);
    }
  });

  it("defaults the object pose to the Queen and survives a bad aspect", () => {
    expect(courtPose("object", undefined, "phone", 390 / 844)).toEqual(courtPose("object", "queen", "phone", 390 / 844));
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const pose = courtPose("court", undefined, "desktop", bad);
      expect(Number.isFinite(pose.r)).toBe(true);
      expect(pose.r).toBeGreaterThanOrEqual(COURT_BOUNDS.minR);
      expect(pose.r).toBeLessThanOrEqual(COURT_BOUNDS.maxR);
    }
  });

  it("names poses that already sit inside the clamp bounds, and clamps the rest", () => {
    for (const composition of ["phone", "desktop"] as const) {
      for (const aspect of composition === "phone" ? PHONE_ASPECTS : DESKTOP_ASPECTS) {
        for (const { name, pose } of everyPose(composition, aspect)) {
          expect(samePose(clampCourtPose(pose), pose, 1e-9), `${name} legal`).toBe(true);
          expect(samePose(clampPose(pose), pose, 1e-9), `${name} legal by the island's clamp`).toBe(true);
        }
      }
    }
    expect(COURT_BOUNDS).toEqual({ minR: 2, maxR: 160, minPhi: 0.25, maxPhi: 1.38, targetRadius: 76 });
    const wild: CourtPose = { target: [300, 0.5, -400], r: 800, theta: 9, phi: -2 };
    const held = clampCourtPose(wild);
    expect(held.r).toBe(160);
    expect(held.phi).toBe(0.25);
    expect(Math.abs(held.theta)).toBeLessThanOrEqual(Math.PI);
    expect(Math.hypot(held.target[0], held.target[2])).toBeCloseTo(76, 9);
    expect(held.target[1]).toBe(0.5);
    expect(clampCourtPose({ ...wild, r: 0.1, phi: 5 })).toMatchObject({ r: COURT_BOUNDS.minR, phi: COURT_BOUNDS.maxPhi });
    // clampPose is the island's clampRoamCam with the Court's bounds: same answer on every axis it knows.
    const roam = clampRoamCam({ tx: 300, tz: -400, r: 800, theta: 9, phi: -2 }, ROAM_COURT_BOUNDS);
    expect(clampPose(wild)).toEqual({ target: [roam.tx, 0.5, roam.tz], r: roam.r, theta: roam.theta, phi: roam.phi });
  });

  it("projects with the camera's own field: a point straight ahead is centred, the edges are ±1", () => {
    const pose: CourtPose = { target: [0, 1, 0], r: 10, theta: 0, phi: Math.PI / 2 };
    // The eye at (0, 1, 10) looks down -z; a point 1 unit right at the target's depth sits at x = 1 / (10·tan(fov/2)·aspect).
    const tanV = Math.tan((COURT_FOV * Math.PI) / 360);
    expect(projectPoint(pose, [1, 1, 0], 2).x).toBeCloseTo(1 / (10 * tanV * 2), 9);
    expect(projectPoint(pose, [0, 1 + 10 * tanV, 0], 2).y).toBeCloseTo(1, 9);
    expect(projectPoint(pose, [0, 1, 20], 2).depth).toBeLessThan(0);
    expect(flagstoneVisible({ target: [0, 0, 1.6], r: 6, theta: 0, phi: 0.6 }, 0.46)).toBe(true);
    // Looking away from the gate with the stone behind the eye: not visible.
    expect(flagstoneVisible({ target: [0, 0, -6], r: 3, theta: 0, phi: 1.1 }, 0.46)).toBe(false);
    // Looking at the Queen from the gate but from very close: the stone is under the eye, clipped.
    expect(flagstoneVisible({ target: [0, 1.4, 0], r: 3, theta: 0, phi: 0.9 }, 0.46)).toBe(false);
  });
});

describe("Little Harbour · the Court's camera (BUILD_PLAN #19)", () => {
  const make = (over: Partial<{ composition: "phone" | "desktop"; reduced: boolean; aspect: number }> = {}) => {
    const camera = new THREE.PerspectiveCamera(COURT_FOV, 1, 0.1, 100);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: false, aspect: 1440 / 900, ...over });
    return { camera, court };
  };
  const settle = (court: ReturnType<typeof createCourtCamera>, dt = 1 / 60, limit = 2000) => {
    let ticks = 0;
    while (court.tick(dt) && ticks < limit) ticks += 1;
    return ticks;
  };

  it("starts in the diorama and writes the camera there at once", () => {
    const { camera, court } = make();
    expect(court.mode()).toBe("court");
    expect(court.anchor()).toBeUndefined();
    const pose = court.pose();
    expect(samePose(pose, courtPose("court", undefined, "desktop", 1440 / 900), 1e-9)).toBe(true);
    const [x, y, z] = poseEye(pose);
    expect(camera.position.toArray()).toEqual([x, y, z]);
    expect(court.tick(1 / 60)).toBe(false);
  });

  it("flies to a pose with the house's easing and settles at the goal", () => {
    const { camera, court } = make();
    court.go("object", "rook");
    expect(court.mode()).toBe("object");
    expect(court.anchor()).toBe("rook");
    const goal = court.goal();
    expect(samePose(goal, courtPose("object", "rook", "desktop", 1440 / 900), 1e-9)).toBe(true);
    const before = court.pose();
    expect(court.tick(1 / 60)).toBe(true);
    const after = court.pose();
    // One frame closes exactly 1 − e^(−7·dt) of the gap on every key.
    const k = 1 - Math.exp(-EASE / 60);
    expect(after.r).toBeCloseTo(before.r + (goal.r - before.r) * k, 9);
    expect(after.phi).toBeCloseTo(before.phi + (goal.phi - before.phi) * k, 9);
    expect(after.target[0]).toBeCloseTo(before.target[0] + (goal.target[0] - before.target[0]) * k, 9);
    const ticks = settle(court);
    expect(ticks).toBeGreaterThan(10);
    expect(ticks).toBeLessThan(400);
    expect(court.pose()).toBe(goal);
    const [x, y, z] = poseEye(goal);
    expect(camera.position.x).toBeCloseTo(x, 9);
    expect(camera.position.y).toBeCloseTo(y, 9);
    expect(camera.position.z).toBeCloseTo(z, 9);
  });

  it("is frame-rate independent enough: 30 fps and 120 fps land within a hair after one second", () => {
    const a = make(), b = make();
    a.court.go("sky"); b.court.go("sky");
    for (let i = 0; i < 30; i += 1) a.court.tick(1 / 30);
    for (let i = 0; i < 120; i += 1) b.court.tick(1 / 120);
    expect(a.court.pose().r).toBeCloseTo(b.court.pose().r, 2);
    expect(a.court.pose().phi).toBeCloseTo(b.court.pose().phi, 3);
  });

  it("arrives in one tick under reduced motion, and cuts on every later move", () => {
    const { camera, court } = make({ reduced: true, composition: "phone", aspect: 390 / 844 });
    court.go("object", "knight");
    const goal = courtPose("object", "knight", "phone", 390 / 844);
    // The cut already happened inside go(); a tick has nothing left to do.
    expect(samePose(court.pose(), goal, 1e-9)).toBe(true);
    expect(court.tick(1 / 60)).toBe(false);
    const [x, y, z] = poseEye(goal);
    expect(camera.position.toArray().map((n) => Number(n.toFixed(9)))).toEqual([x, y, z].map((n) => Number(n.toFixed(9))));
    court.go("sky");
    expect(court.tick(1 / 60)).toBe(false);
    expect(samePose(court.pose(), courtPose("sky", undefined, "phone", 390 / 844), 1e-9)).toBe(true);
    // Turning reduced motion on mid-flight finishes the flight now.
    const live = make();
    live.court.go("sky");
    live.court.tick(1 / 60);
    expect(live.court.tick(1 / 60)).toBe(true);
    live.court.setReduced(true);
    expect(live.court.tick(1 / 60)).toBe(false);
    expect(live.court.pose()).toBe(live.court.goal());
  });

  it("orbits on drag — the same on desktop and phone — and never leaves the tilt band", () => {
    for (const composition of ["desktop", "phone"] as const) {
      const { court } = make({ composition, aspect: composition === "phone" ? 390 / 844 : 1440 / 900 });
      const start = court.pose();
      court.drag(100, 0);
      expect(court.pose().theta).toBeLessThan(start.theta);
      expect(court.pose().phi).toBeCloseTo(start.phi, 9);
      expect(court.pose().r).toBeCloseTo(start.r, 9);
      court.drag(0, 60);
      expect(court.pose().phi).toBeLessThan(start.phi);
      // A drag is direct: nothing eases back afterwards.
      expect(court.tick(1 / 60)).toBe(false);
      court.drag(0, -5000);
      expect(court.pose().phi).toBe(COURT_BOUNDS.maxPhi);
      court.drag(0, 5000);
      expect(court.pose().phi).toBe(COURT_BOUNDS.minPhi);
      court.drag(100000, 0);
      expect(Math.abs(court.pose().theta)).toBeLessThanOrEqual(Math.PI);
    }
    const a = make({ composition: "desktop" }), b = make({ composition: "phone", aspect: 390 / 844 });
    a.court.drag(80, 30); b.court.drag(80, 30);
    expect(a.court.pose().theta - courtPose("court", undefined, "desktop", 1440 / 900).theta)
      .toBeCloseTo(b.court.pose().theta - courtPose("court", undefined, "phone", 390 / 844).theta, 9);
  });

  it("zooms in log-radius and stops at the Court's near and far limits", () => {
    const { court } = make();
    const r0 = court.pose().r;
    court.zoom(0.5);
    expect(court.pose().r).toBeCloseTo(r0 * Math.exp(0.5), 9);
    court.zoom(-0.5);
    expect(court.pose().r).toBeCloseTo(r0, 9);
    court.zoom(10);
    expect(court.pose().r).toBe(COURT_BOUNDS.maxR);
    court.zoom(-10);
    expect(court.pose().r).toBe(COURT_BOUNDS.minR);
    court.zoom(Number.NaN);
    expect(court.pose().r).toBe(COURT_BOUNDS.minR);
    expect(court.tick(1 / 60)).toBe(false);
  });

  it("pans the target over the ground and keeps it within 9 of the Queen", () => {
    const { court } = make();
    const start = court.pose();
    court.pan(200, 0);
    expect(court.pose().target[0]).not.toBeCloseTo(start.target[0], 3);
    expect(court.pose().target[1]).toBe(start.target[1]);
    for (let i = 0; i < 40; i += 1) court.pan(400, 400);
    const [x, , z] = court.pose().target;
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(COURT_BOUNDS.targetRadius + 1e-9);
  });

  it("re-poses for a new composition or aspect, and after a swipe go() takes the camera back", () => {
    const { court } = make();
    court.setComposition("phone");
    expect(samePose(court.goal(), courtPose("court", undefined, "phone", 1440 / 900), 1e-9)).toBe(true);
    court.setAspect(390 / 844);
    expect(samePose(court.goal(), courtPose("court", undefined, "phone", 390 / 844), 1e-9)).toBe(true);
    settle(court);
    court.drag(300, 100);
    court.zoom(0.3);
    expect(samePose(court.pose(), courtPose("court", undefined, "phone", 390 / 844), 1e-3)).toBe(false);
    court.go("court");
    settle(court);
    expect(samePose(court.pose(), courtPose("court", undefined, "phone", 390 / 844), 1e-9)).toBe(true);
    expect(flagstoneVisible(court.pose(), 390 / 844)).toBe(true);
  });

  it("covers every mode and anchor without a bad pose", () => {
    const { court } = make({ composition: "phone", aspect: 390 / 844 });
    const modes: [CourtMode, CourtAnchor | undefined][] = [["sky", undefined], ["court", undefined], ...COURT_ANCHOR_IDS.map((a): [CourtMode, CourtAnchor] => ["object", a])];
    for (const [mode, anchor] of modes) {
      court.go(mode, anchor);
      settle(court);
      const pose = court.pose();
      expect([pose.r, pose.theta, pose.phi, ...pose.target].every(Number.isFinite), `${mode} ${anchor ?? ""}`).toBe(true);
      expect(flagstoneVisible(pose, 390 / 844), `${mode} ${anchor ?? ""}`).toBe(true);
    }
  });
});

describe("a room's hold on the camera (holdPoseInRoom)", () => {
  it("returns a legal pose untouched, holds a wild one, and is total", () => {
    const tower = PLACE_HOLDS.tower!;
    const standing: CourtPose = { target: [0, 0.5, 0.25], r: 3.25, theta: 0.1, phi: 1.375 };
    expect(samePose(holdPoseInRoom(standing, tower), standing, 1e-9)).toBe(true);
    expect(holdPoseInRoom(standing, null)).toBe(standing);
    // The Court's diorama pose, restored by a stale return slot, is pulled inside the tower.
    const fromTheLawn: CourtPose = { target: [0, 2.1, 0], r: 11, theta: 0.34, phi: 1.34 };
    const heldPose = holdPoseInRoom(fromTheLawn, tower);
    expect(heldPose.r).toBeLessThanOrEqual(tower.maxR);
    const eye = poseEye(heldPose);
    expect(eye[0]).toBeGreaterThanOrEqual(tower.eye.min[0] - 1e-6);
    expect(eye[0]).toBeLessThanOrEqual(tower.eye.max[0] + 1e-6);
    expect(eye[1]).toBeLessThanOrEqual(tower.eye.max[1] + 1e-6);
    expect(eye[2]).toBeLessThanOrEqual(tower.eye.max[2] + 1e-6);
    // Total: rubbish in, a legal pose out.
    const rubbish = holdPoseInRoom({ target: [Number.NaN, 99, -99], r: Number.NaN, theta: Number.NaN, phi: Number.NaN }, tower);
    expect(Number.isFinite(rubbish.r)).toBe(true);
    expect(rubbish.phi).toBeGreaterThanOrEqual(tower.minPhi);
    expect(rubbish.phi).toBeLessThanOrEqual(tower.maxPhi);
  });

  it("keeps every named pose of the tower and the cellar legal in its own room", () => {
    for (const [id, poses] of [["tower", towerPoses([])], ["cellar", cellarPoses([])]] as const) {
      const roomHold = PLACE_HOLDS[id]!;
      for (const [key, pose] of Object.entries(poses)) {
        // The sky poses are establishing shots and are deliberately held (they framed the room from the lawn).
        const heldPose = holdPoseInRoom(pose, roomHold);
        const eye = poseEye(heldPose);
        for (let axis = 0; axis < 3; axis++) {
          expect(eye[axis]!, `${id} ${key} eye[${axis}]`).toBeGreaterThanOrEqual(roomHold.eye.min[axis]! - 1e-6);
          expect(eye[axis]!, `${id} ${key} eye[${axis}]`).toBeLessThanOrEqual(roomHold.eye.max[axis]! + 1e-6);
        }
        // The room's own pose (the one you stand in) must come through unshortened.
        // (`samePose`, not deep equality: the wrap of theta re-derives it through atan2.)
        if (key.startsWith(`${id}:`)) expect(samePose(heldPose, pose, 1e-9), `${id} ${key} untouched`).toBe(true);
      }
    }
  });
});

describe("the close hold — the third camera hold (W7 a)", () => {
  it("is only where a place has earned it: the Court, the lectern, the wheel", () => {
    expect([...CLOSE_PLACES].sort()).toEqual(["court", "kiln", "library"]);
    expect(CLOSE_HOLDS.court!.anchor).toBe("queen");
    expect(CLOSE_HOLDS.library!.anchor).toBe("book");
    expect(CLOSE_HOLDS.kiln!.anchor).toBe("wheel");
    for (const place of Object.keys(HARBOUR_PLACE_NAMES)) {
      if (CLOSE_PLACES.includes(place)) continue;
      expect(closePose(place, "phone"), place).toBeNull();
    }
  });

  it("stands inside its own room, on a phone and on a desktop both", () => {
    for (const place of CLOSE_PLACES) {
      for (const composition of ["phone", "desktop"] as const) {
        const pose = closePose(place, composition)!;
        expect(pose, `${place} ${composition}`).not.toBeNull();
        const hold = PLACE_HOLDS[place as keyof typeof PLACE_HOLDS];
        if (!hold) continue; // The Court is open sky and has no hold.
        // Held means unchanged: a close pose the room had to pull back is a
        // close pose that was outside the room, which is the bug this catches.
        expect(samePose(holdPoseInRoom(pose, hold), pose, 1e-9), `${place} ${composition} is outside its room`).toBe(true);
        const eye = poseEye(pose);
        for (let axis = 0; axis < 3; axis++) {
          expect(eye[axis]!, `${place} ${composition} eye axis ${axis}`).toBeGreaterThanOrEqual(hold.eye.min[axis]!);
          expect(eye[axis]!, `${place} ${composition} eye axis ${axis}`).toBeLessThanOrEqual(hold.eye.max[axis]!);
        }
        expect(pose.r).toBeGreaterThanOrEqual(hold.minR);
        expect(pose.r).toBeLessThanOrEqual(hold.maxR);
        expect(pose.phi).toBeGreaterThanOrEqual(hold.minPhi);
        expect(pose.phi).toBeLessThanOrEqual(hold.maxPhi);
      }
    }
  });

  it("comes nearer than the room's own establishing pose, or it is not close at all", () => {
    for (const place of CLOSE_PLACES) {
      const pose = closePose(place, "phone")!;
      const open = place === "court" ? courtPose("court", undefined, "phone", 390 / 844) : null;
      if (open) expect(pose.r).toBeLessThan(open.r);
      else expect(pose.r).toBeLessThan(3);
    }
  });

  it("holds, and lets go back to exactly where the camera stood", () => {
    const camera = new THREE.PerspectiveCamera(COURT_FOV, 390 / 844, 0.1, 200);
    const court = createCourtCamera({ camera, composition: "phone", reduced: true, aspect: 390 / 844 });
    court.go("sky");
    const before = court.pose();
    expect(court.closed()).toBe(false);

    court.close(closePose("court", "phone"));
    expect(court.closed()).toBe(true);
    expect(samePose(court.pose(), closePose("court", "phone")!, 1e-6)).toBe(true);

    // Re-aiming the hold while it is on does not lose where we came from.
    court.close(closePose("library", "phone"));
    court.close(null);
    expect(court.closed()).toBe(false);
    expect(samePose(court.pose(), before, 1e-6)).toBe(true);

    // And a camera a hand has moved — a drag, a zoom, a restored return record
    // — has no named mode to go back to, so the pose itself is what is kept.
    court.drag(60, -20);
    court.zoom(-0.3);
    const byHand = court.pose();
    expect(samePose(byHand, before, 1e-6)).toBe(false);
    court.close(closePose("court", "phone"));
    court.close(null);
    expect(samePose(court.pose(), byHand, 1e-6), "a hand-held view was thrown away by the close hold").toBe(true);
  });

  it("is dropped by any plain ask to be somewhere else", () => {
    const camera = new THREE.PerspectiveCamera(COURT_FOV, 1.6, 0.1, 200);
    const court = createCourtCamera({ camera, composition: "desktop", reduced: true, aspect: 1.6 });
    for (const escape of [() => court.go("court"), () => court.goTo({ target: [0, 1, 0] }), () => court.restore([2, 2, 2])]) {
      court.close(closePose("court", "desktop"));
      expect(court.closed()).toBe(true);
      escape();
      expect(court.closed()).toBe(false);
    }
  });

  it("is a cut under reduced motion, and one easing otherwise", () => {
    const camera = new THREE.PerspectiveCamera(COURT_FOV, 1.6, 0.1, 200);
    const cut = createCourtCamera({ camera, composition: "desktop", reduced: true, aspect: 1.6 });
    cut.close(closePose("court", "desktop"));
    expect(cut.tick(1 / 60)).toBe(false);
    expect(samePose(cut.pose(), cut.goal(), 1e-9)).toBe(true);

    const eased = createCourtCamera({ camera, composition: "desktop", reduced: false, aspect: 1.6 });
    eased.close(closePose("court", "desktop"));
    expect(eased.tick(1 / 60)).toBe(true);
    for (let i = 0; i < 400 && eased.tick(1 / 60); i += 1) { /* fly in */ }
    expect(samePose(eased.pose(), eased.goal(), 1e-6)).toBe(true);
  });
});
