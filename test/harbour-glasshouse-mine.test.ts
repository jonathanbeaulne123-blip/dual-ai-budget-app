// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildGlasshouseReading, EMPTY_GLASSHOUSE_READING } from "../src/harbour/data/reading.ts";
import { GLASSHOUSE_DRESSING } from "../src/harbour/glasshouse/dressing.ts";
import { GLASSHOUSE_LAYOUT, GLASSHOUSE_MINE_CAP, createGlasshouse, mineWords, minePots, readGlasshouseReading } from "../src/harbour/glasshouse/GlasshouseScene.ts";
import { PLACE_HOLDS } from "../src/harbour/scene/place.ts";
import { holdPoseInRoom, poseEye } from "../src/harbour/camera/poses.ts";
import type { Task } from "../src/core/tasks.ts";

/**
 * The Glasshouse's private side bench (W6 #2). A member's own private tasks
 * stand as counts by state on a bench of their own. A private task's title
 * never enters the reading, the words, the labels or the scene.
 */

const today = "2026-09-20"; // a Sunday: the week runs Sep 20 – 26.
const ME = "MEM-001", PARTNER = "MEM-002";
const SECRET = "Her birthday surprise";

const task = (over: Partial<Task> & { id: string }): Task => ({
  version: 1, revision: 1, createdBy: ME, visibility: "household",
  title: over.title ?? "Water the garden", notes: "", listId: null, parentId: null,
  doDate: null, dueDate: null, repeat: "none" as Task["repeat"], cue: "none" as Task["cue"],
  assigneeId: null, backupId: null, acknowledgedBy: [], chapterId: null, planReference: null,
  moneyLink: null, expectedAmountCents: null, completedAt: null, completedBy: null, completionEvidence: null,
  deleted: false, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
  ...over,
  id: `TASK-${over.id}`,
});
const household = (tasks: Task[]) => ({ tasks, members: [{ id: ME }, { id: PARTNER }] });
const mine = (tasks: Task[]) => buildGlasshouseReading(household(tasks), ME, today).mine;

describe("the side bench reading", () => {
  it("counts only my own private tasks, by state, in the glasshouse's own words", () => {
    const counts = mine([
      task({ id: "seed", visibility: "personal", createdBy: ME, title: SECRET }),
      task({ id: "seed-two", visibility: "personal", createdBy: ME, doDate: "2026-12-30" }),
      task({ id: "sprout", visibility: "personal", createdBy: ME, acknowledgedBy: [ME] }),
      task({ id: "bloom", visibility: "personal", createdBy: ME, completedAt: "2026-09-18T12:00:00.000Z", completedBy: ME }),
      task({ id: "old", visibility: "personal", createdBy: ME, completedAt: "2026-08-01T12:00:00.000Z", completedBy: ME }),
    ]);
    // Two seeds (one of them dated past the month — a count, not a bench), one sprout, one bloom this week.
    expect(counts).toEqual({ seed: 2, sprout: 1, bloom: 1 });
  });

  it("never counts the partner's private rows, the shared benches, or a deleted one", () => {
    expect(mine([
      task({ id: "theirs", visibility: "personal", createdBy: PARTNER }),
      task({ id: "shared" }),
      task({ id: "shared-done", completedAt: "2026-09-19T12:00:00.000Z", completedBy: ME }),
      task({ id: "gone", visibility: "personal", createdBy: ME, deleted: true }),
    ])).toEqual({ seed: 0, sprout: 0, bloom: 0 });
    // And the shared benches never gain a private pot of mine.
    const reading = buildGlasshouseReading(household([task({ id: "p", visibility: "personal", createdBy: ME, title: SECRET })]), ME, today);
    expect(reading.pots).toEqual([]);
    expect(reading.mine.seed).toBe(1);
  });

  it("carries no title of a private task anywhere in the reading", () => {
    const reading = buildGlasshouseReading(household([
      task({ id: "a", visibility: "personal", createdBy: ME, title: SECRET }),
      task({ id: "b", visibility: "personal", createdBy: ME, title: SECRET, acknowledgedBy: [ME] }),
      task({ id: "c", visibility: "personal", createdBy: ME, title: SECRET, completedAt: "2026-09-19T12:00:00.000Z", completedBy: ME }),
      task({ id: "d", visibility: "personal", createdBy: PARTNER, title: "Their own secret" }),
    ]), ME, today);
    expect(JSON.stringify(reading)).not.toContain(SECRET);
    expect(JSON.stringify(reading)).not.toContain("Their own secret");
    expect(mineWords(reading.mine)).not.toContain(SECRET);
  });

  it("says a clear bench rather than a row of zeroes, and names each state only when it stands", () => {
    expect(mineWords({ seed: 0, sprout: 0, bloom: 0 })).toBe("Your own bench — clear");
    expect(mineWords({ seed: 1, sprout: 0, bloom: 0 })).toBe("Your own bench — 1 seed");
    expect(mineWords({ seed: 2, sprout: 1, bloom: 3 })).toBe("Your own bench — 2 seeds, 1 sprout, 3 harvested this week");
  });

  it("stands one pot per task to the cap, in the glasshouse's own order", () => {
    expect(minePots({ seed: 0, sprout: 0, bloom: 0 })).toEqual([]);
    expect(minePots({ seed: 2, sprout: 1, bloom: 1 })).toEqual(["seed", "seed", "sprout", "bloom"]);
    expect(minePots({ seed: 40, sprout: 40, bloom: 40 }).length).toBe(GLASSHOUSE_MINE_CAP * 3);
    expect(minePots({ seed: -3, sprout: 0, bloom: 0 })).toEqual([]);
  });

  it("stands an empty bench for a reading from before it existed", () => {
    const { pots: _pots, mine: _mine, ...older } = EMPTY_GLASSHOUSE_READING;
    expect(readGlasshouseReading({ glasshouse: { ...older, pots: [] } }).glasshouse!.mine).toEqual({ seed: 0, sprout: 0, bloom: 0 });
  });
});

describe("the side bench as a place", () => {
  const reading = (tasks: Task[]) => ({ glasshouse: buildGlasshouseReading(household(tasks), ME, today) });
  const loaded = reading([
    task({ id: "shared", doDate: "2026-09-22" }),
    ...Array.from({ length: 5 }, (_, i) => task({ id: `s${i}`, visibility: "personal", createdBy: ME, title: SECRET })),
    ...Array.from({ length: 4 }, (_, i) => task({ id: `g${i}`, visibility: "personal", createdBy: ME, title: SECRET, acknowledgedBy: [ME] })),
    task({ id: "b", visibility: "personal", createdBy: ME, title: SECRET, completedAt: "2026-09-19T12:00:00.000Z", completedBy: ME }),
  ]);

  it("is one door onto the planner, labelled in counts, and never says what a private task is", () => {
    const scene = new THREE.Scene();
    const handle = createGlasshouse(scene, { dressing: GLASSHOUSE_DRESSING.classic, reading: loaded, quality: "lite" });
    const bench = handle.anchors().find((anchor) => anchor.id === "mine")!;
    expect(bench.door).toEqual({ target: "planner" });
    expect(bench.zone).toBe("bench");
    expect(bench.label).toBe("Your own bench — 5 seeds, 4 sprouts, 1 harvested this week. Yours alone. Open the steps.");
    expect(bench.label).not.toContain(SECRET);
    const region = handle.regions().find((region) => region.id === "mine")!;
    expect(region.box).toBeTruthy();
    expect(region.label).not.toContain(SECRET);
    // Nothing anywhere in the room's own words names a private task.
    expect(JSON.stringify(handle.anchors()) + JSON.stringify(handle.regions().map((row) => row.label))).not.toContain(SECRET);
    handle.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("stands its pots capped, on its own bench, and keeps the room inside its budget and its hold", () => {
    const scene = new THREE.Scene();
    const handle = createGlasshouse(scene, { dressing: GLASSHOUSE_DRESSING.classic, reading: loaded, quality: "lite" });
    let own = 0, meshes = 0;
    handle.group.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) meshes++;
      if (node instanceof THREE.Group && node.userData.anchor === "mine" && node.parent === handle.group && node.name === "") own++;
    });
    // Five seeds and four sprouts are capped at three each; the one bloom stands as itself.
    expect(own).toBe(GLASSHOUSE_MINE_CAP + GLASSHOUSE_MINE_CAP + 1);
    expect(meshes).toBeLessThanOrEqual(120);
    const roomHold = PLACE_HOLDS.glasshouse!;
    for (const [key, pose] of Object.entries(handle.poses())) {
      const eye = poseEye(holdPoseInRoom(pose, roomHold));
      for (let axis = 0; axis < 3; axis++) {
        expect(eye[axis]!, `${key} eye[${axis}]`).toBeGreaterThanOrEqual(roomHold.eye.min[axis]! - 1e-6);
        expect(eye[axis]!, `${key} eye[${axis}]`).toBeLessThanOrEqual(roomHold.eye.max[axis]! + 1e-6);
      }
    }
    // The bench stands clear of the perennial bed and the harvest shelf.
    expect(GLASSHOUSE_LAYOUT.mine.z - GLASSHOUSE_LAYOUT.mine.length / 2).toBeGreaterThan(1.0);
    expect(GLASSHOUSE_LAYOUT.mine.z + GLASSHOUSE_LAYOUT.mine.length / 2).toBeLessThan(GLASSHOUSE_LAYOUT.halfDepth);
    handle.dispose();
  });

  it("clears the bench when the private rows go, and stands nothing when there are none", () => {
    const scene = new THREE.Scene();
    const handle = createGlasshouse(scene, { dressing: GLASSHOUSE_DRESSING.classic, reading: loaded, quality: "lite" });
    handle.update(reading([task({ id: "shared", doDate: "2026-09-22" })]) as never);
    let own = 0;
    handle.group.traverse((node) => { if (node instanceof THREE.Group && node.userData.anchor === "mine" && node.parent === handle.group && node.name === "") own++; });
    expect(own).toBe(0);
    expect(handle.anchors().find((anchor) => anchor.id === "mine")!.label).toContain("Your own bench — clear");
    handle.dispose();
  });
});
