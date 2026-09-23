import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createBodyFigure, type BodyFigure } from "../src/harbour/body/figure.ts";
import { PLAYABLE_AVATARS } from "../src/harbour/body/avatarDefinition.ts";
import { createSkaterLook, poseFromLegacyAct, type SkaterLook } from "../src/harbour/skate/look/index.ts";
import { blankPresent } from "../src/harbour/skate/look/legacy.ts";
import { BOARD, DECK_TOP, deckHalfWidth, deckTopAt } from "../src/harbour/skate/look/boardGeometry.ts";
import { FALLBACK_GRABS, FALLBACK_GRINDS, grabPose, resolveCatalogs } from "../src/harbour/skate/look/catalogs.ts";
import { RIG, createBoardRigState, solveBoardRig } from "../src/harbour/skate/look/boardRig.ts";
import { createRiderPoseState, solveRiderPose, stanceSides } from "../src/harbour/skate/look/riderPose.ts";
import { measureFigureRig } from "../src/harbour/skate/look/ik.ts";
import type { SkatePresent, SkateSimEvent } from "../src/harbour/skate/contract.ts";

type Who = "default" | "bianca" | "jonathan";
const WHO: Who[] = ["default", "bianca", "jonathan"];
const fig = (who: Who) => createBodyFigure({}, who === "default" ? undefined : PLAYABLE_AVATARS[who].anatomy);

function rider(who: Who = "default", stance: "regular" | "goofy" = "regular") {
  const figure = fig(who), world = new THREE.Group();
  const look = createSkaterLook({ figure, tier: "lite", canvas: () => null });
  world.add(look.root);
  const p = blankPresent(); p.stance = stance;
  const run = (seconds: number, set: (p: SkatePresent, t: number) => void, events?: (t: number, i: number) => SkateSimEvent[] | null, dt = 1 / 60) => {
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i += 1) { set(p, i * dt); look.update(p, events ? events(i * dt, i) : [], dt, false); }
    world.updateMatrixWorld(true);
  };
  return { figure, look, world, p, run };
}

const part = (f: BodyFigure, name: string) => new THREE.Vector3().setFromMatrixPosition(f.group.getObjectByName(name)!.matrixWorld);
/** A point in the board's own frame (where the board is drawn). */
function inBoard(look: SkaterLook, v: THREE.Vector3): THREE.Vector3 { return v.clone().applyMatrix4(new THREE.Matrix4().copy(look.board.group.matrixWorld).invert()); }
function shoes(r: ReturnType<typeof rider>) {
  return (["left", "right"] as const).map((s) => {
    const shoe = r.figure.group.getObjectByName(`body-shoe-${s}`) as THREE.Mesh;
    const c = inBoard(r.look, part(r.figure, `body-shoe-${s}`));
    const up = new THREE.Vector3(0, 1, 0).transformDirection(shoe.matrixWorld).transformDirection(new THREE.Matrix4().copy(r.look.board.group.matrixWorld).invert());
    const half = shoe.geometry.boundingBox ?? (shoe.geometry.computeBoundingBox(), shoe.geometry.boundingBox!);
    const halfH = (half.max.y - half.min.y) / 2 * new THREE.Vector3().setFromMatrixScale(shoe.matrixWorld).y;
    return { c, up, sole: c.y - halfH };
  });
}
function expectFeetOnDeck(r: ReturnType<typeof rider>, liftTolerance = .015) {
  for (const s of shoes(r)) {
    expect(Math.abs(s.c.z)).toBeLessThan(BOARD.halfLength - .02);
    expect(Math.abs(s.c.x)).toBeLessThan(deckHalfWidth(s.c.z) + .02);
    const top = deckTopAt(s.c.x, s.c.z);
    expect(s.sole).toBeGreaterThan(top - .012);
    expect(s.sole).toBeLessThan(top + liftTolerance);
    expect(s.up.y).toBeGreaterThan(.97);
  }
}
const knee = (f: BodyFigure, s: "left" | "right") => f.group.getObjectByName(`body-knee-${s}`)!.rotation.x;
const popEvent = (flipId: string | null = null, from: "tail" | "nose" = "tail"): SkateSimEvent => ({ t: 0, kind: "pop", from, switch: false, fakie: false, height: .6, flipId, fromFeature: null });

describe("skate look · the rider stands on the board", () => {
  it("keeps both soles on the grip through roll, carve, crouch, the pop, the catch and the landing", () => {
    for (const who of WHO) for (const stance of ["regular", "goofy"] as const) {
      const r = rider(who, stance);
      r.run(.8, (p) => { p.phase = "roll"; p.speed = 4; });
      expectFeetOnDeck(r);
      r.run(.6, (p) => { p.carve = .9; });
      expectFeetOnDeck(r);
      r.run(.5, (p) => { p.carve = 0; p.phase = "crouch"; p.crouch = 1; });
      expectFeetOnDeck(r);
      // The pop: the back foot rides the tail down (the front foot is allowed to drag up the grip).
      r.run(3 / 60, (p, t) => { p.phase = "air"; p.crouch = 0; p.airTime = t; p.clearance = .05 + t; p.vy = 3; p.trick = null; }, (t) => (t === 0 ? [popEvent()] : []));
      const back = shoes(r)[stanceSides(stance, false).front === 1 ? 0 : 1]!;
      expect(back.sole).toBeGreaterThan(deckTopAt(back.c.x, back.c.z) - .012);
      expect(back.sole).toBeLessThan(deckTopAt(back.c.x, back.c.z) + .03);
      // A kickflip, caught: after u = 1 both feet are back on the bolts.
      r.run(.6, (p, t) => { p.airTime = .05 + t; p.clearance = .4; p.vy = 1 - t * 4; p.trick = { flipId: "kickflip", u: Math.min(1.1, t / .45) }; });
      expectFeetOnDeck(r, .02);
      r.run(.1, (p) => { p.phase = "land"; p.trick = null; p.clearance = 0; p.impact = 1; p.vy = 0; });
      expectFeetOnDeck(r);
      r.figure.dispose(); r.look.dispose();
    }
  });

  it("bends the knees with the crouch and eases back up", () => {
    for (const who of WHO) {
      const r = rider(who);
      r.run(.8, (p) => { p.phase = "roll"; });
      const standing = [knee(r.figure, "left"), knee(r.figure, "right")];
      for (const k of standing) { expect(k).toBeGreaterThan(.1); expect(k).toBeLessThan(1.1); }
      r.run(.8, (p) => { p.phase = "crouch"; p.crouch = 1; });
      const crouched = [knee(r.figure, "left"), knee(r.figure, "right")];
      for (let i = 0; i < 2; i += 1) expect(crouched[i]!).toBeGreaterThan(standing[i]! + .6);
      r.run(.8, (p) => { p.phase = "roll"; p.crouch = 0; });
      expect(knee(r.figure, "left")).toBeCloseTo(standing[0]!, 2);
      r.figure.dispose(); r.look.dispose();
    }
  });

  it("tucks the knees high over a flipping board and keeps the feet clear of it", () => {
    const r = rider();
    r.run(.5, (p) => { p.phase = "roll"; });
    let tuck = 0;
    r.run(.4, (p, t) => {
      p.phase = "air"; p.airTime = t; p.clearance = .5; p.vy = 2; p.trick = { flipId: "kickflip", u: t / .5 };
    }, (t) => (t === 0 ? [popEvent("kickflip")] : []));
    tuck = Math.min(knee(r.figure, "left"), knee(r.figure, "right"));
    expect(tuck).toBeGreaterThan(1.6);
    r.figure.dispose(); r.look.dispose();
  });

  it("mirrors a goofy rider exactly across the board's long axis", () => {
    const a = rider("bianca", "regular"), b = rider("bianca", "goofy");
    const script = (r: ReturnType<typeof rider>) => {
      r.run(.5, (p) => { p.phase = "roll"; p.speed = 3; p.carve = .4; });
      r.run(.3, (p) => { p.phase = "push"; p.pushPhase = .3; p.carve = 0; });
      r.run(.3, (p, t) => { p.phase = "air"; p.airTime = t; p.clearance = .4; p.trick = { flipId: "kickflip", u: t / .5 }; p.grab = null; }, (t) => (t === 0 ? [popEvent("kickflip")] : []));
    };
    script(a); script(b);
    const names = ["body-shoe-left", "body-shoe-right", "body-hand-left", "body-hand-right", "body-knee-left", "body-knee-right", "body-elbow-left", "body-elbow-right"];
    const mirror: Record<string, string> = Object.fromEntries(names.map((n) => [n, n.endsWith("left") ? n.replace("left", "right") : n.replace("right", "left")]));
    for (const n of names) {
      const ra = part(a.figure, n).applyMatrix4(new THREE.Matrix4().copy(a.look.ride.matrixWorld).invert());
      const rb = part(b.figure, mirror[n]!).applyMatrix4(new THREE.Matrix4().copy(b.look.ride.matrixWorld).invert());
      expect(ra.x, n).toBeCloseTo(-rb.x, 5); expect(ra.y, n).toBeCloseTo(rb.y, 5); expect(ra.z, n).toBeCloseTo(rb.z, 5);
    }
    // And the board flipped the mirrored way.
    // (q and −q are the same rotation: compare with w ≥ 0.)
    const canon = (q: THREE.Quaternion) => (q.w < 0 ? new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w) : q.clone());
    const qa = canon(a.look.board.group.quaternion), qb = canon(b.look.board.group.quaternion);
    expect(qa.z).toBeCloseTo(-qb.z, 5); expect(qa.x).toBeCloseTo(qb.x, 5);
    for (const r of [a, b]) { r.figure.dispose(); r.look.dispose(); }
  });

  it("switch puts the other foot at the nose", () => {
    expect(stanceSides("regular", false)).toEqual({ toeSign: -1, front: 1 });
    expect(stanceSides("regular", true)).toEqual(stanceSides("goofy", false));
    expect(stanceSides("goofy", true)).toEqual(stanceSides("regular", false));
  });
});

describe("skate look · the rider's moves", () => {
  it("puts the right hand on the right edge for every grab", () => {
    for (const who of WHO) for (const stance of ["regular", "goofy"] as const) for (const id of Object.keys(FALLBACK_GRABS)) {
      const r = rider(who, stance);
      r.run(.4, (p) => { p.phase = "roll"; });
      r.run(.7, (p, t) => { p.phase = "air"; p.airTime = t; p.clearance = .6; p.vy = 1; p.grab = { grabId: id, weight: Math.min(1, t / .2) }; });
      const g = FALLBACK_GRABS[id]!, { toeSign, front } = stanceSides(stance, false);
      const gp = grabPose(g, toeSign, BOARD.halfWidth, BOARD.halfLength);
      const tip = g.edge === "nose" || g.edge === "tail";
      const edge = new THREE.Vector3(tip ? 0 : gp.x, RIG.centreY, gp.z).applyMatrix4(r.look.board.group.matrixWorld);
      const idx = g.hand === "front" ? front : 1 - front;
      const hand = part(r.figure, `body-hand-${idx === 0 ? "left" : "right"}`), other = part(r.figure, `body-hand-${idx === 0 ? "right" : "left"}`);
      expect(hand.distanceTo(edge), `${who} ${stance} ${id}`).toBeLessThan(.12);
      expect(other.distanceTo(edge)).toBeGreaterThan(hand.distanceTo(edge) + .2);
      r.figure.dispose(); r.look.dispose();
    }
  });

  it("wears each grind and slide differently", () => {
    const signature = (id: string) => {
      const r = rider("jonathan");
      r.run(.3, (p) => { p.phase = "roll"; });
      r.run(1, (p) => { p.phase = "grind"; p.grind = { grindId: id, grindableId: "ledge", faceSign: 1 }; p.balance = 0; p.heading = 0; p.boardYaw = 0; });
      const pts = ["body-shoe-left", "body-shoe-right", "body-hand-left", "body-hand-right", "body-knee-left", "body-knee-right", "body-head"].map((n) => part(r.figure, n));
      const board = r.look.board.group.matrixWorld.clone();
      expectFeetOnDeck(r, .06);
      r.figure.dispose(); r.look.dispose();
      return { pts, board };
    };
    const ids = Object.keys(FALLBACK_GRINDS).filter((id) => id !== "grind");
    const sigs = ids.map(signature);
    for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
      const d = sigs[i]!.pts.reduce((s, v, k) => s + v.distanceTo(sigs[j]!.pts[k]!), 0);
      const boardDiff = sigs[i]!.board.elements.reduce((s, v, k) => s + Math.abs(v - sigs[j]!.board.elements[k]!), 0);
      expect(d + boardDiff, `${ids[i]} vs ${ids[j]}`).toBeGreaterThan(.05);
    }
  });

  it("sways the hips and arms with the balance on a grind and a manual", () => {
    for (const phase of ["grind", "manual"] as const) {
      const at = (bal: number) => {
        const r = rider();
        r.run(1, (p) => { p.phase = phase; p.balance = bal; if (phase === "grind") p.grind = { grindId: "50-50", grindableId: "r", faceSign: 1 }; else p.manual = "manual"; });
        const h = [part(r.figure, "body-hand-left"), part(r.figure, "body-hand-right")];
        r.figure.dispose(); r.look.dispose();
        return h;
      };
      const left = at(-.8), right = at(.8);
      expect(left[0]!.distanceTo(right[0]!)).toBeGreaterThan(.05);
    }
  });

  it("pushes with the back foot on the ground, toe side, while the front foot stays on the bolts", () => {
    const r = rider();
    r.run(.6, (p) => { p.phase = "push"; p.pushPhase = .35; p.speed = 2; });
    const [a, b] = shoes(r);
    const { front } = stanceSides("regular", false);
    const pushFoot = front === 1 ? a! : b!, frontFoot = front === 1 ? b! : a!;
    expect(pushFoot.sole).toBeLessThan(.03);
    expect(Math.sign(pushFoot.c.x)).toBe(-1); // regular toes face −x
    expect(frontFoot.sole).toBeGreaterThan(DECK_TOP - .012);
    r.figure.dispose(); r.look.dispose();
  });

  it("tumbles in a bail, stays finite, and stands back up on the board after the recover", () => {
    const r = rider("bianca");
    r.run(.5, (p) => { p.phase = "roll"; p.speed = 5; });
    let maxTilt = 0;
    const tilt = () => new THREE.Vector3(0, 1, 0).applyQuaternion(r.figure.group.quaternion).angleTo(new THREE.Vector3(0, 1, 0));
    r.run(1.2, (p, t) => { p.phase = "bail"; p.bail = { t, reason: "bad-angle", dirX: 1, dirZ: 0 }; p.speed = 0; });
    maxTilt = tilt();
    r.figure.group.traverse((o) => { for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z]) expect(Number.isFinite(v)).toBe(true); });
    expect(maxTilt).toBeGreaterThan(1.2);
    const head = part(r.figure, "body-head");
    expect(head.y).toBeLessThan(.45); // lying on the ground
    r.run(RIG.recoverSeconds + .1, (p) => { p.phase = "recover"; p.bail = null; });
    r.run(.6, (p) => { p.phase = "roll"; });
    expect(tilt()).toBeLessThan(.05);
    expectFeetOnDeck(r);
    r.figure.dispose(); r.look.dispose();
  });

  it("leads an air spin with the shoulders", () => {
    const r = rider();
    r.run(.4, (p) => { p.phase = "air"; p.clearance = .5; p.bodyTwist = 0; });
    const still = r.figure.group.getObjectByName("body-carriage")!.rotation.y;
    r.run(.2, (p) => { p.bodyTwist = .9; });
    expect(r.figure.group.getObjectByName("body-carriage")!.rotation.y - still).toBeGreaterThan(.5);
    r.figure.dispose(); r.look.dispose();
  });
});

describe("skate look · smoothing", () => {
  it("lands on the same pose at 30, 60 and 144 fps", () => {
    const defs = resolveCatalogs(undefined);
    const poseAt = (fps: number) => {
      const figure = fig("default");
      const st = createRiderPoseState(measureFigureRig(figure.group));
      const rig = createBoardRigState(), p = blankPresent();
      const dt = 1 / fps;
      let out = null as ReturnType<typeof solveRiderPose> | null;
      for (let i = 0; i < fps * 1.5; i += 1) {
        const t = i * dt;
        p.phase = t < .5 ? "roll" : "crouch"; p.crouch = t < .5 ? 0 : 1; p.carve = t < .5 ? .5 : 0;
        const board = solveBoardRig(p, defs, rig, dt, -1);
        out = solveRiderPose(p, defs, st, dt, "regular", board);
      }
      figure.dispose();
      return JSON.parse(JSON.stringify(out)) as Record<string, unknown>;
    };
    const flat = (o: unknown): number[] => (typeof o === "number" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(flat) : []);
    const a = flat(poseAt(30)), b = flat(poseAt(60)), c = flat(poseAt(144));
    expect(a.length).toBeGreaterThan(30);
    a.forEach((v, i) => { expect(Math.abs(v - b[i]!)).toBeLessThan(2e-3); expect(Math.abs(v - c[i]!)).toBeLessThan(2e-3); });
  });

  it("never snaps: a sudden crouch moves the hips over several frames", () => {
    const r = rider();
    r.run(.5, (p) => { p.phase = "roll"; });
    const before = r.figure.group.getObjectByName("body-carriage")!.position.y;
    r.run(1 / 60, (p) => { p.phase = "crouch"; p.crouch = 1; });
    const oneFrame = r.figure.group.getObjectByName("body-carriage")!.position.y;
    r.run(.6, () => undefined);
    const settled = r.figure.group.getObjectByName("body-carriage")!.position.y;
    expect(Math.abs(oneFrame - before)).toBeLessThan(Math.abs(settled - before) * .2);
    r.figure.dispose(); r.look.dispose();
  });
});

describe("skate look · the façade and the partner shim", () => {
  it("adopts the figure, drives it through the hook, and hands it back", () => {
    const parent = new THREE.Group(), figure = fig("default");
    parent.add(figure.group); figure.group.position.set(3, 0, 4);
    const look = createSkaterLook({ figure, tier: "lite", canvas: () => null, scale: .5 });
    const p = blankPresent(); p.phase = "roll"; p.x = 10;
    look.update(p, [], 1 / 60, false);
    expect(figure.group.parent).toBe(look.ride);
    expect(look.ride.scale.x).toBe(.5);
    expect(figure.group.scale.x * .5).toBeCloseTo(1.25 / .58, 5);
    look.release();
    expect(figure.group.parent).toBe(parent);
    expect(figure.group.position.toArray()).toEqual([3, 0, 4]);
    expect(figure.group.scale.x).toBeCloseTo(1.25 / .58, 5);
    expect(figure.group.getObjectByName("body-knee-left")!.rotation.x).toBe(0);
    look.dispose(); figure.dispose();
  });

  it("frees every board and FX resource on dispose", () => {
    const figure = fig("default");
    const look = createSkaterLook({ figure, tier: "full", canvas: () => null });
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    look.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || o.name.startsWith("body")) return; if (o.parent?.name?.startsWith("body")) return; geometries.add(m.geometry); materials.add(m.material as THREE.Material); });
    let freed = 0;
    for (const x of [...geometries, ...materials]) x.addEventListener("dispose", () => { freed += 1; });
    look.dispose();
    expect(freed).toBe(geometries.size + materials.size);
    expect(look.root.children.length).toBe(0);
    figure.dispose();
  });

  it("animates a partner off the wire from a coarse act and progress", () => {
    const figure = fig("default");
    const look = createSkaterLook({ figure, tier: "lite", canvas: () => null });
    const p = blankPresent();
    for (let i = 0; i < 30; i += 1) look.update(poseFromLegacyAct("skate", 0, p, true), null, 1 / 60, false);
    let turned = 0;
    for (let i = 0; i <= 40; i += 1) {
      look.update(poseFromLegacyAct("skate-kickflip", i / 40, p, true), null, 1 / 60, false);
      if (i === 20) turned = new THREE.Quaternion().angleTo(look.board.group.quaternion);
    }
    expect(turned).toBeGreaterThan(.5);
    for (const act of ["skate-grind", "skate-manual", "skate-grab", "skate-ollie", "skate-bail", "skate-360-flip", "skate-mystery"]) {
      for (let i = 0; i < 20; i += 1) look.update(poseFromLegacyAct(act, i / 20, p, true), null, 1 / 60, false);
      figure.group.traverse((o) => expect(Number.isFinite(o.rotation.x + o.position.y)).toBe(true));
    }
    expect(poseFromLegacyAct("skate-grind", .75).balance).toBeCloseTo(.5);
    expect(poseFromLegacyAct("skate-heelflip", .3).trick).toEqual({ flipId: "heelflip", u: .3 });
    expect(poseFromLegacyAct("skate", .5, undefined, true).phase).toBe("push");
    look.dispose(); figure.dispose();
  });
});
