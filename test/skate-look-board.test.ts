import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createSkateboard } from "../src/harbour/skate/board.ts";
import { SKATE_DECKS } from "../src/harbour/skate/park.ts";
import { BOARD, DECK_TOP, deckHalfWidth, kickRise } from "../src/harbour/skate/look/boardGeometry.ts";
import { createBoardRigState, flipMatrix, noteRigEvents, solveBoardRig, RIG } from "../src/harbour/skate/look/boardRig.ts";
import { FALLBACK_FLIPS, FALLBACK_GRINDS, resolveCatalogs } from "../src/harbour/skate/look/catalogs.ts";
import { blankPresent } from "../src/harbour/skate/look/legacy.ts";
import type { CanvasLike } from "../src/harbour/skate/look/deckArt.ts";
import type { FlipTrickDef, SkatePresent } from "../src/harbour/skate/contract.ts";

/** A canvas with a 2D context that accepts every call — enough to paint in node. */
function fakeCanvas(w: number, h: number): CanvasLike {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key) => (key in target ? target[key as string] : () => undefined),
    set: (target, key, value) => { target[key as string] = value; return true; },
  });
  let calls = 0;
  return { width: w, height: h, getContext: () => { calls += 1; return ctx; }, get calls() { return calls; } } as CanvasLike;
}

const defs = resolveCatalogs(undefined);
const Y = new THREE.Vector3(0, 1, 0);

function orientation(m: THREE.Matrix4): THREE.Quaternion {
  const q = new THREE.Quaternion(); m.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q;
}
function isRest(m: THREE.Matrix4, allowHalfTurn: boolean): boolean {
  const q = orientation(m);
  const half = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI);
  const near = (a: THREE.Quaternion, b: THREE.Quaternion) => Math.abs(a.dot(b)) > 1 - 1e-9;
  return near(q, new THREE.Quaternion()) || (allowHalfTurn && near(q, half));
}

describe("skate look · the board", () => {
  it("keeps the v1 API (group, setDeck, pose, dispose) and the island footprint", () => {
    const board = createSkateboard("afterglow");
    expect(board.group.name).toBe("Harbour skateboard");
    for (const act of ["skate", "skate-ollie", "skate-kickflip", "skate-heelflip", "skate-shuvit", "skate-360-flip", "skate-grab", "skate-grind", "skate-manual", "skate-bail"]) {
      for (const p of [0, .3, .7, 1]) {
        board.pose(4, 1 / 60, act, p, .1, .4);
        expect(board.group.position.toArray().every(Number.isFinite)).toBe(true);
      }
    }
    board.pose(0, 0, "skate", 0, 0, 0);
    board.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(board.group, true);
    expect(box.max.z - box.min.z).toBeCloseTo(BOARD.halfLength * 2, 2);
    expect(box.max.x - box.min.x).toBeGreaterThan(.29); expect(box.max.x - box.min.x).toBeLessThan(.33);
    // The wheels sit on the ground.
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(DECK_TOP).toBeGreaterThan(.1); expect(DECK_TOP).toBeLessThan(.13);
    board.setDeck("northlight");
    expect(board.deckId).toBe("northlight");
    board.dispose();
  });

  it("has kicked ends, a rounded outline and a concave", () => {
    expect(kickRise(0)).toBe(0); expect(kickRise(BOARD.truckZ)).toBe(0);
    expect(kickRise(BOARD.halfLength)).toBeCloseTo(BOARD.kickRise);
    expect(deckHalfWidth(0)).toBe(BOARD.halfWidth);
    expect(deckHalfWidth(BOARD.halfLength - .02)).toBeLessThan(BOARD.halfWidth * .7);
    const board = createSkateboard("tideline", { tier: "full" });
    const grip = board.group.getObjectByName("skateboard-grip") as THREE.Mesh;
    const pos = grip.geometry.getAttribute("position");
    let centre = Infinity, edge = -Infinity;
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getZ(i)) > .05) continue;
      if (Math.abs(pos.getX(i)) < 1e-6) centre = Math.min(centre, pos.getY(i));
      if (Math.abs(Math.abs(pos.getX(i)) - BOARD.halfWidth) < 1e-6) edge = Math.max(edge, pos.getY(i));
    }
    expect(edge - centre).toBeCloseTo(BOARD.concave, 4);
    board.dispose();
  });

  it("builds a lighter lite tier", () => {
    const count = (tier: "full" | "lite") => {
      const board = createSkateboard("tideline", { tier, canvas: fakeCanvas });
      let verts = 0, textures = 0;
      board.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { verts += m.geometry.getAttribute("position").count; if ((m.material as THREE.MeshStandardMaterial).map) textures += 1; } });
      board.dispose();
      return { verts, textures };
    };
    const full = count("full"), lite = count("lite");
    expect(lite.verts).toBeLessThan(full.verts * .6);
    expect(full.textures).toBe(2); // grip + graphic
    expect(lite.textures).toBe(1); // graphic only
  });

  it("paints every deck without a DOM, and wears flat colours without a canvas", () => {
    for (const d of SKATE_DECKS) {
      const board = createSkateboard(d.id, { canvas: fakeCanvas });
      board.dispose();
    }
    const plain = createSkateboard("orchard", { canvas: () => null });
    const graphic = plain.group.getObjectByName("skateboard-graphic") as THREE.Mesh;
    expect((graphic.material as THREE.MeshStandardMaterial).map).toBeNull();
    expect((graphic.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("b5d576");
    plain.setDeck("islander");
    expect((graphic.material as THREE.MeshStandardMaterial).color.getHexString()).toBe("f1dfb4");
    plain.dispose();
  });

  it("leans the deck while the hangers stay level and steer the wheels", () => {
    const board = createSkateboard("tideline", { tier: "lite" });
    const wheels = () => { board.group.updateMatrixWorld(true); const out: THREE.Vector3[] = []; board.group.traverse((o) => { if (o.name === "skateboard-wheel") out.push(new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)); }); return out; };
    const rest = wheels();
    board.setCarve(.15, .2);
    const leaned = wheels();
    for (let i = 0; i < 4; i += 1) expect(leaned[i]!.y).toBeCloseTo(rest[i]!.y, 6);
    const deck = board.group.getObjectByName("skateboard-deck-pivot")!;
    expect(deck.rotation.z).toBeCloseTo(.15);
    const hangers: THREE.Object3D[] = []; board.group.traverse((o) => { if (o.name === "skateboard-hanger") hangers.push(o); });
    expect(hangers[0]!.rotation.y).toBeCloseTo(.2); expect(hangers[1]!.rotation.y).toBeCloseTo(-.2);
    board.setWheelAngle(1.3);
    board.group.traverse((o) => { if (o.name === "skateboard-wheel") expect(o.rotation.x).toBeCloseTo(1.3); });
    board.dispose();
  });

  it("disposes every geometry, material and texture it made", () => {
    const board = createSkateboard("saltwood", { tier: "full", canvas: fakeCanvas });
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    board.group.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      geometries.add(m.geometry);
      const mat = m.material as THREE.MeshStandardMaterial; materials.add(mat); if (mat.map) textures.add(mat.map);
    });
    let freed = 0;
    for (const x of [...geometries, ...materials, ...textures]) x.addEventListener("dispose", () => { freed += 1; });
    expect(geometries.size).toBeGreaterThan(8); expect(materials.size).toBeGreaterThan(6); expect(textures.size).toBe(2);
    board.dispose();
    expect(freed).toBe(geometries.size + materials.size + textures.size);
    expect(board.group.children.length).toBe(0);
  });
});

describe("skate look · the board rig", () => {
  const centre = new THREE.Vector3(0, RIG.centreY, 0);

  it("is back at rest at u = 0 and u = 1 of every flip", () => {
    const m = new THREE.Matrix4();
    for (const def of Object.values(FALLBACK_FLIPS)) for (const toe of [-1, 1]) {
      expect(isRest(flipMatrix(def, 0, toe, m), false)).toBe(true);
      const odd = Math.abs(def.yaw) % 2 === 1;
      expect(isRest(flipMatrix(def, 1, toe, m), odd)).toBe(true);
      // The board's centre ends where it started.
      expect(centre.clone().applyMatrix4(flipMatrix(def, 1, toe, m)).distanceTo(centre)).toBeLessThan(1e-6);
      // And it really turned in between.
      if (def.roll || def.yaw || def.pitch) expect(isRest(flipMatrix(def, .5, toe, m), false)).toBe(false);
    }
  });

  it("rolls the way the def's sign says: + dips the toe edge first (kickflip), − the heel edge (heelflip)", () => {
    const m = new THREE.Matrix4();
    for (const toe of [-1, 1]) {
      const toeEdge = new THREE.Vector3(toe * BOARD.halfWidth, RIG.centreY, 0), heelEdge = new THREE.Vector3(-toe * BOARD.halfWidth, RIG.centreY, 0);
      const kf = flipMatrix(FALLBACK_FLIPS.kickflip!, .05, toe, m);
      expect(toeEdge.clone().applyMatrix4(kf).y).toBeLessThan(toeEdge.y - .01);
      expect(heelEdge.clone().applyMatrix4(kf).y).toBeGreaterThan(heelEdge.y + .01);
      const hf = flipMatrix(FALLBACK_FLIPS.heelflip!, .05, toe, m);
      expect(toeEdge.clone().applyMatrix4(hf).y).toBeGreaterThan(toeEdge.y + .01);
      // A backside shove-it (+yaw) swings the tail to the heel side.
      const tail = new THREE.Vector3(0, RIG.centreY, -BOARD.halfLength);
      const sv = flipMatrix(FALLBACK_FLIPS.shuvit!, .2, toe, m);
      expect(Math.sign(tail.clone().applyMatrix4(sv).x)).toBe(-toe);
    }
  });

  function drive(frames: number, set: (p: SkatePresent, i: number) => void, toe = -1, state = createBoardRigState(), p = blankPresent()) {
    let pose = solveBoardRig(p, defs, state, 0, toe);
    for (let i = 0; i < frames; i += 1) { set(p, i); pose = solveBoardRig(p, defs, state, 1 / 60, toe, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); }
    return { pose, state, p };
  }

  it("snaps the tail on a pop and the nose on a nollie, then levels up to the feet", () => {
    for (const from of ["tail", "nose"] as const) {
      const state = createBoardRigState();
      noteRigEvents(state, [{ t: 0, kind: "pop", from, switch: false, fakie: false, height: .6, flipId: null, fromFeature: null }]);
      const p = blankPresent(); p.phase = "air"; p.clearance = .3;
      let pose = solveBoardRig(p, defs, state, 1 / 60, -1);
      for (let i = 0; i < 2; i += 1) { noteRigEvents(state, []); pose = solveBoardRig(p, defs, state, 1 / 60, -1); }
      const nose = new THREE.Vector3(0, RIG.centreY, BOARD.halfLength).applyMatrix4(pose.carrier), tail = new THREE.Vector3(0, RIG.centreY, -BOARD.halfLength).applyMatrix4(pose.carrier);
      if (from === "tail") expect(nose.y).toBeGreaterThan(tail.y + .1); else expect(tail.y).toBeGreaterThan(nose.y + .1);
      for (let i = 0; i < 20; i += 1) { noteRigEvents(state, []); pose = solveBoardRig(p, defs, state, 1 / 60, -1); }
      const n2 = new THREE.Vector3(0, 0, BOARD.halfLength).applyMatrix4(pose.carrier), t2 = new THREE.Vector3(0, 0, -BOARD.halfLength).applyMatrix4(pose.carrier);
      expect(Math.abs(n2.y - t2.y)).toBeLessThan(.02);
      expect(n2.y).toBeGreaterThan(.05); // lifted up toward the tucked feet
    }
  });

  it("folds an odd half-turn shove-it into the board's rest so the catch never snaps", () => {
    const { state, p } = drive(0, () => undefined);
    p.phase = "air"; p.clearance = .4;
    let last = new THREE.Matrix4();
    for (let i = 0; i <= 40; i += 1) {
      p.trick = { flipId: "shuvit", u: Math.min(1, i / 36) };
      last = solveBoardRig(p, defs, state, 1 / 60, -1).board.clone();
    }
    p.trick = null;
    const after = solveBoardRig(p, defs, state, 1 / 60, -1).board;
    expect(orientation(after).angleTo(orientation(last))).toBeLessThan(.02);
  });

  it("pitches onto the back wheels for a manual and onto the front for a nose manual", () => {
    for (const manual of ["manual", "nose-manual"] as const) {
      const { pose } = drive(60, (p) => { p.phase = "manual"; p.manual = manual; });
      const nose = new THREE.Vector3(0, 0, BOARD.truckZ).applyMatrix4(pose.carrier), tail = new THREE.Vector3(0, 0, -BOARD.truckZ).applyMatrix4(pose.carrier);
      if (manual === "manual") { expect(nose.y).toBeGreaterThan(.05); expect(tail.y).toBeCloseTo(0, 3); }
      else { expect(tail.y).toBeGreaterThan(.05); expect(nose.y).toBeCloseTo(0, 3); }
    }
  });

  it("locks each grind's angle, and only overlays the yaw the sim has not already turned", () => {
    const yaws = new Map<string, number>();
    for (const id of Object.keys(FALLBACK_GRINDS)) {
      const { pose } = drive(90, (p) => { p.phase = "grind"; p.heading = 0; p.boardYaw = 0; p.grind = { grindId: id, grindableId: "r", faceSign: 1 }; });
      const def = FALLBACK_GRINDS[id]!;
      const fwd = new THREE.Vector3(0, 0, 1).transformDirection(pose.carrier);
      const yaw = Math.atan2(fwd.x, fwd.z);
      yaws.set(id, yaw);
      const rel = Math.abs(Math.sin(yaw));
      expect(rel).toBeCloseTo(Math.abs(Math.sin(def.deckYaw)), 1);
    }
    expect(Math.abs(yaws.get("boardslide")! - yaws.get("lipslide")!)).toBeGreaterThan(1);
    // 5-0: tail down (nose up); nosegrind: nose down.
    const five = drive(90, (p) => { p.phase = "grind"; p.grind = { grindId: "5-0", grindableId: "r", faceSign: 1 }; }).pose;
    expect(new THREE.Vector3(0, 0, .2).applyMatrix4(five.carrier).y).toBeGreaterThan(new THREE.Vector3(0, 0, -.2).applyMatrix4(five.carrier).y);
    const nose = drive(90, (p) => { p.phase = "grind"; p.grind = { grindId: "nosegrind", grindableId: "r", faceSign: 1 }; }).pose;
    expect(new THREE.Vector3(0, 0, .2).applyMatrix4(nose.carrier).y).toBeLessThan(new THREE.Vector3(0, 0, -.2).applyMatrix4(nose.carrier).y);
    // A sim that already turned the board across the rail gets no second turn.
    const pre = drive(90, (p) => { p.phase = "grind"; p.heading = 0; p.boardYaw = Math.PI / 2; p.grind = { grindId: "boardslide", grindableId: "r", faceSign: 1 }; }).pose;
    expect(Math.abs(pre.grindYaw)).toBeLessThan(.05);
  });

  it("throws the board clear in a bail and brings it back through the recover", () => {
    const state = createBoardRigState(), p = blankPresent();
    const ride = new THREE.Matrix4();
    for (let i = 0; i < 30; i += 1) { p.phase = "roll"; p.speed = 4; solveBoardRig(p, defs, state, 1 / 60, -1, ride); }
    let maxY = 0, minLow = Infinity;
    for (let i = 0; i < 120; i += 1) {
      p.phase = "bail"; p.bail = { t: i / 60, reason: "bad-angle", dirX: 0, dirZ: 1 }; p.speed = 0;
      const pose = solveBoardRig(p, defs, state, 1 / 60, -1, ride);
      expect(pose.free).toBe(true);
      const pos = new THREE.Vector3().setFromMatrixPosition(pose.freeWorld);
      expect(pos.toArray().every(Number.isFinite)).toBe(true);
      maxY = Math.max(maxY, pos.y); minLow = Math.min(minLow, pos.y);
    }
    expect(maxY).toBeGreaterThan(.1);
    expect(minLow).toBeGreaterThan(-.2);
    let pose = solveBoardRig(p, defs, state, 1 / 60, -1, ride);
    for (let i = 0; i < Math.ceil(RIG.recoverSeconds * 60) + 20; i += 1) { p.phase = "recover"; p.bail = null; pose = solveBoardRig(p, defs, state, 1 / 60, -1, ride); }
    p.phase = "roll";
    for (let i = 0; i < 12; i += 1) pose = solveBoardRig(p, defs, state, 1 / 60, -1, ride);
    expect(pose.free).toBe(false);
    expect(isRest(pose.board, false)).toBe(true);
  });

  it("uses the catalog's own defs over the fallbacks", () => {
    const wild: FlipTrickDef = { id: "kickflip", name: "Kickflip", gesture: [], roll: 3, yaw: 0, pitch: 0, duration: .6, points: 1, difficulty: .5 };
    const d = resolveCatalogs({ flips: [wild] });
    expect(d.flip("kickflip")!.roll).toBe(3);
    expect(d.flip("heelflip")!.roll).toBe(-1);
    expect(d.grind("fs-50-50")?.id ?? d.grind("50-50")!.id).toBe("50-50");
  });
});
