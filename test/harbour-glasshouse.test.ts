// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildGlasshouseReading, EMPTY_GLASSHOUSE_READING, GLASSHOUSE_POT_CAP, type GlassPot } from "../src/harbour/data/reading.ts";
import { GLASSHOUSE_DRESSING } from "../src/harbour/glasshouse/dressing.ts";
import { GLASSHOUSE_LAYOUT, benchRows, benchWords, createGlasshouse, glasshousePoses, potSpot, readGlasshouseReading } from "../src/harbour/glasshouse/GlasshouseScene.ts";
import { PLACES, PLACE_HOLDS } from "../src/harbour/scene/place.ts";
import { holdPoseInRoom, poseEye } from "../src/harbour/camera/poses.ts";
import type { Task } from "../src/core/tasks.ts";

const today = "2026-09-20"; // a Sunday: the week runs Sep 20 – 26.

const task = (over: Partial<Task> & { id: string }): Task => ({
  version: 1, revision: 1, createdBy: "MEM-001", visibility: "household",
  title: over.title ?? "Water the garden", notes: "", listId: null, parentId: null,
  doDate: null, dueDate: null, repeat: "none" as Task["repeat"], cue: "none" as Task["cue"],
  assigneeId: null, backupId: null, acknowledgedBy: [], chapterId: null, planReference: null,
  moneyLink: null, expectedAmountCents: null, completedAt: null, completedBy: null, completionEvidence: null,
  deleted: false, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  ...over,
  id: `TASK-${over.id}`,
});

const household = (tasks: Task[]) => ({ tasks, members: [{ id: "MEM-001" }, { id: "MEM-002" }] });

describe("the Glasshouse reading (LITTLE_HARBOUR_v2 §3)", () => {
  it("benches a pot by its date: this week in the light, next week behind, the month at the back", () => {
    const reading = buildGlasshouseReading(household([
      task({ id: "a", doDate: "2026-09-22" }),
      task({ id: "b", doDate: "2026-09-30" }),
      task({ id: "c", dueDate: "2026-10-12" }),
      task({ id: "d" }), // undated waits at the back
      task({ id: "far", doDate: "2026-12-01" }), // past the month: the paper holds it
    ]), "MEM-001", today);
    const bench = Object.fromEntries(reading.pots.map((pot) => [pot.key.slice(10), pot.bench]));
    expect(bench).toEqual({ a: 0, b: 1, c: 2, d: 2 });
  });

  it("reads the plant from the pot: a seed until someone takes it, a sprout after, harvest when done", () => {
    const reading = buildGlasshouseReading(household([
      task({ id: "seed" }),
      task({ id: "sprout", acknowledgedBy: ["MEM-002"] }),
      task({ id: "bloom", completedAt: "2026-09-18T12:00:00.000Z", completedBy: "MEM-001" }),
      task({ id: "old-bloom", completedAt: "2026-08-01T12:00:00.000Z", completedBy: "MEM-001" }),
    ]), "MEM-001", today);
    expect(reading.pots.find((p) => p.key === "task/TASK-seed")?.state).toBe("seed");
    expect(reading.pots.find((p) => p.key === "task/TASK-sprout")?.state).toBe("sprout");
    expect(reading.pots.some((p) => p.key === "task/TASK-bloom")).toBe(false);
    expect(reading.harvested).toBe(1); // this week's bloom; the August one rests
  });

  it("calls a pot past its date dry — never overdue — and counts the can out", () => {
    const reading = buildGlasshouseReading(household([
      task({ id: "dry", doDate: "2026-09-15" }),
      task({ id: "fine", doDate: "2026-09-21" }),
    ]), "MEM-001", today);
    expect(reading.pots.find((p) => p.key === "task/TASK-dry")?.dry).toBe(true);
    expect(reading.pots.find((p) => p.key === "task/TASK-fine")?.dry).toBe(false);
    expect(reading.dry).toBe(1);
  });

  it("threads the tag: copper mine, pine the partner's, twisted for both, plain for nobody's yet", () => {
    const reading = buildGlasshouseReading(household([
      task({ id: "mine", assigneeId: "MEM-001" }),
      task({ id: "hers", assigneeId: "MEM-002" }),
      task({ id: "ours", assigneeId: "MEM-001", acknowledgedBy: ["MEM-002"] }),
      task({ id: "open" }),
    ]), "MEM-001", today);
    const thread = Object.fromEntries(reading.pots.map((pot) => [pot.key.slice(10), pot.thread]));
    expect(thread).toEqual({ mine: "mine", hers: "partner", ours: "both", open: "plain" });
  });

  it("marks a stake for a chapter or plan pot and a cat for a goal-linked one, and caps the room", () => {
    const many = Array.from({ length: GLASSHOUSE_POT_CAP + 4 }, (_, i) => task({ id: `t${i}`, doDate: "2026-09-22" }));
    const reading = buildGlasshouseReading(household([
      ...many,
      task({ id: "staked", chapterId: "CH-1", doDate: "2026-09-21" }),
      task({ id: "cat", moneyLink: { kind: "goal", goalId: "GOAL-1" } as Task["moneyLink"], doDate: "2026-09-21" }),
    ]), "MEM-001", today);
    expect(reading.pots.length).toBe(GLASSHOUSE_POT_CAP);
    expect(reading.overflow).toBe(6);
    expect(reading.pots.find((p) => p.key === "task/TASK-staked")?.staked).toBe(true);
    expect(reading.pots.find((p) => p.key === "task/TASK-cat")?.cat).toBe(true);
  });

  it("keeps a personal task off the household benches", () => {
    const reading = buildGlasshouseReading(household([
      task({ id: "private", visibility: "personal", createdBy: "MEM-002" }),
      task({ id: "shared" }),
    ]), "MEM-001", today);
    expect(reading.pots.map((p) => p.key)).toEqual(["task/TASK-shared"]);
  });
});

describe("the Glasshouse as a place", () => {
  const reading = { glasshouse: buildGlasshouseReading(household([
    task({ id: "a", doDate: "2026-09-22", assigneeId: "MEM-001" }),
    task({ id: "b", doDate: "2026-09-15", acknowledgedBy: ["MEM-002"] }),
    task({ id: "c", doDate: "2026-10-01", chapterId: "CH-1" }),
  ]), "MEM-001", today) };

  it("registers itself, builds, reads, and every pot is a door onto the planner — never a command", () => {
    const scene = new THREE.Scene();
    const handle = PLACES.glasshouse!.build(scene, { theme: "classic" } as never, reading as never, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
    const anchors = handle.anchors();
    const pots = anchors.filter((anchor) => anchor.zone === "pot");
    expect(pots.length).toBe(3);
    for (const pot of pots) {
      expect(pot.door?.target).toBe("planner");
      expect(pot.door?.object).toMatch(/^task\//);
      expect(pot.label).toMatch(/Open the Master Planner/);
    }
    expect(anchors.find((anchor) => anchor.id === "beds")?.door?.target).toBe("calendar");
    expect(anchors.find((anchor) => anchor.id === "garden-door")?.zone).toBe("stair");
    // The can is out: one pot is dry.
    expect(anchors.some((anchor) => anchor.id === "can")).toBe(true);
    expect(handle.regions().length).toBeGreaterThanOrEqual(pots.length + 2);
    handle.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("draws inside the harbour's budget", () => {
    const scene = new THREE.Scene();
    const handle = createGlasshouse(scene, { dressing: GLASSHOUSE_DRESSING.classic, reading, quality: "lite" });
    let meshes = 0;
    scene.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBeLessThanOrEqual(120);
    handle.dispose();
  });

  it("keeps every named pose inside its own room's hold, and the room pose untouched", () => {
    const scene = new THREE.Scene();
    const handle = createGlasshouse(scene, { dressing: GLASSHOUSE_DRESSING.classic, reading, quality: "lite" });
    const roomHold = PLACE_HOLDS.glasshouse!;
    for (const [key, pose] of Object.entries(handle.poses())) {
      const heldPose = holdPoseInRoom(pose, roomHold);
      const eye = poseEye(heldPose);
      for (let axis = 0; axis < 3; axis++) {
        expect(eye[axis]!, `${key} eye[${axis}]`).toBeGreaterThanOrEqual(roomHold.eye.min[axis]! - 1e-6);
        expect(eye[axis]!, `${key} eye[${axis}]`).toBeLessThanOrEqual(roomHold.eye.max[axis]! + 1e-6);
      }
    }
    handle.dispose();
  });

  it("stands pots a step apart from the middle, and reads rubbish as an empty room", () => {
    expect(potSpot(0, 1)).toBe(0);
    const spots = [0, 1, 2].map((i) => potSpot(i, 3));
    expect(spots[1]).toBe(0);
    expect(spots[2]! - spots[1]!).toBeCloseTo(spots[1]! - spots[0]!, 9);
    expect(readGlasshouseReading(null).glasshouse).toBeNull();
    expect(readGlasshouseReading({ glasshouse: EMPTY_GLASSHOUSE_READING }).glasshouse).toBe(EMPTY_GLASSHOUSE_READING);
    expect(benchWords("This week", 0, 0)).toBe("This week — a clear bench");
    expect(benchWords("The month", 3, 1)).toBe("The month — 3 pots, 1 dry");
    const rows = benchRows([{ bench: 0 } as GlassPot, { bench: 2 } as GlassPot]);
    expect(rows[0].length).toBe(1); expect(rows[2].length).toBe(1);
    expect(GLASSHOUSE_LAYOUT.benches.length).toBe(3);
    expect(glasshousePoses([])["door:desktop"]).toBeTruthy();
  });
});
