// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { parseQueenModel } from "../src/queen/world/queenModel.ts";
import { createBloomGrowth, type BloomEvidence } from "../src/house/world/bloom.ts";
import { DEFAULT_QUEEN_STYLE } from "../src/house/queenStyle.ts";
import {
  QUEEN_IGNORED_NODES, QUEEN_REGION_ORDER, QUEEN_REGIONS, classifyGesture, gestureAction, isIgnoredQueenNode, projectRegions, queenNodeKey,
  regionOf, regionOfNode, spark, type GestureSample, type QueenGesture, type QueenRegion,
} from "../src/harbour/court/queenTouch.ts";
import { QUEEN_ASSETS, QUEEN_STANDING_HEIGHT, dressQueenPlace, normaliseQueen, seatGrowthAtRoots, tagQueenRegions } from "../src/harbour/court/queenPlace.ts";

type NodeRow = { name: string; mesh: boolean };
/** The GLB's JSON chunk, read the way `test/queen-model.test.ts` reads the header: no loader, no DOM. */
function glbNodes(path: string): NodeRow[] {
  const bytes = readFileSync(path);
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString("utf8")) as { nodes: Array<{ name?: string; mesh?: number }> };
  return json.nodes.map((node) => ({ name: node.name ?? "", mesh: node.mesh !== undefined }));
}
const load = async (path: string) => {
  const b = readFileSync(path);
  const copy = new ArrayBuffer(b.byteLength);
  new Uint8Array(copy).set(b);
  return parseQueenModel(copy);
};

const FILES = {
  presence: resolve(process.cwd(), `public${QUEEN_ASSETS.presence}`),
  v1: resolve(process.cwd(), `public${QUEEN_ASSETS.v1}`),
} as const;
const GESTURES: readonly QueenGesture[] = ["tap", "stroke-up", "stroke-down", "drag-x", "drag-y", "pinch", "long-press"];

describe("region tables cover every node in both Queen GLBs", () => {
  for (const [set, path] of Object.entries(FILES) as Array<[keyof typeof FILES, string]>) {
    it(`${set}: every named node is a region or explicitly ignored, and every table entry exists`, () => {
      const nodes = glbNodes(path);
      expect(nodes.length).toBeGreaterThan(30);
      const uncovered = nodes.filter((node) => regionOf(node.name) === null && !isIgnoredQueenNode(node.name)).map((node) => node.name);
      expect(uncovered).toEqual([]);
      const both = nodes.filter((node) => regionOf(node.name) !== null && isIgnoredQueenNode(node.name)).map((node) => node.name);
      expect(both).toEqual([]);
      const keys = new Set(nodes.map((node) => queenNodeKey(node.name)));
      const stale = [...QUEEN_REGION_ORDER.flatMap((region) => QUEEN_REGIONS[region][set]), ...QUEEN_IGNORED_NODES[set]].filter((name) => !keys.has(queenNodeKey(name)));
      expect(stale).toEqual([]);
      // Every mesh that can be touched carries a region; only the listed hardware/decor is inert.
      const meshes = nodes.filter((node) => node.mesh);
      const inert = meshes.filter((node) => isIgnoredQueenNode(node.name));
      expect(inert.length).toBeLessThanOrEqual(set === "presence" ? 4 : 4);
      expect(meshes.length - inert.length).toBeGreaterThan(meshes.length * 0.85);
    });
  }

  it("no name sits in two regions, and every region has both name sets", () => {
    const seen = new Map<string, QueenRegion>();
    for (const region of QUEEN_REGION_ORDER) {
      expect(QUEEN_REGIONS[region].presence.length).toBeGreaterThan(0);
      expect(QUEEN_REGIONS[region].v1.length).toBeGreaterThan(0);
      for (const name of [...QUEEN_REGIONS[region].presence, ...QUEEN_REGIONS[region].v1]) {
        const key = queenNodeKey(name);
        expect(seen.get(key) ?? region, name).toBe(region);
        seen.set(key, region);
      }
    }
  });

  it("matches on letters and digits only, the way the loader renames nodes", () => {
    expect(regionOf("Face_|_rose_button_nose")).toBe("face");
    expect(regionOf("EARTHWORK | BROAD HAND-THROWN SAUCER")).toBe("potRim");
    expect(regionOf("Living_hair_|_left_vines")).toBe("vines");
    expect(regionOf("Ceramic | curled tail")).toBeNull();
    expect(regionOf("not a queen part")).toBeNull();
  });

  it("reads a scene node's tag first, then its name, then its ancestors", () => {
    const face = new THREE.Group(); face.name = "Face";
    const child = new THREE.Mesh(); child.name = "renamed by an exporter"; face.add(child);
    expect(regionOfNode(child)).toBe("face");
    child.userData.region = "hands";
    expect(regionOfNode(child)).toBe("hands");
    const tail = new THREE.Mesh(); tail.name = "Ceramic | curled tail"; face.add(tail);
    expect(regionOfNode(tail)).toBeNull();
    expect(regionOfNode(null)).toBeNull();
  });
});

describe("classifyGesture", () => {
  const path = (points: Array<[number, number, number]>, pointer?: number): GestureSample[] => points.map(([x, y, t]) => ({ x, y, t, ...(pointer === undefined ? {} : { pointer }) }));

  it("tap: still and quick; long-press: still and held", () => {
    expect(classifyGesture(path([[10, 10, 0], [12, 11, 120]]))).toBe("tap");
    expect(classifyGesture(path([[10, 10, 0]]))).toBe("tap");
    expect(classifyGesture(path([[10, 10, 0], [11, 10, 600]]))).toBe("long-press");
    expect(classifyGesture(path([[10, 10, 0], [10, 10, 499]]))).toBe("tap");
  });

  it("strokes are quick flicks up or down; slow vertical movement is a drag", () => {
    expect(classifyGesture(path([[100, 300, 0], [100, 200, 120]]))).toBe("stroke-up");
    expect(classifyGesture(path([[100, 200, 0], [104, 330, 150]]))).toBe("stroke-down");
    expect(classifyGesture(path([[100, 200, 0], [100, 260, 80], [100, 330, 900]]))).toBe("drag-y");
    expect(classifyGesture(path([[100, 200, 0], [100, 230, 200]]))).toBe("drag-y");
  });

  it("horizontal movement is drag-x whatever the speed", () => {
    expect(classifyGesture(path([[100, 200, 0], [220, 210, 100]]))).toBe("drag-x");
    expect(classifyGesture(path([[100, 200, 0], [40, 190, 900]]))).toBe("drag-x");
  });

  it("two pointers make a pinch; nothing makes nothing", () => {
    expect(classifyGesture([...path([[100, 200, 0], [90, 200, 100]], 1), ...path([[200, 200, 0], [220, 200, 100]], 2)])).toBe("pinch");
    expect(classifyGesture(path([[100, 200, 0], [220, 210, 100]], 7))).toBe("drag-x");
    expect(classifyGesture([])).toBeNull();
  });
});

describe("the grammar", () => {
  it("maps every (region, gesture) to at most one action, and the defined ones as the Court says", () => {
    for (const region of QUEEN_REGION_ORDER) for (const gesture of GESTURES) {
      const action = gestureAction(region, gesture);
      expect(action === null || typeof action === "string").toBe(true);
      expect(gestureAction(region, gesture)).toBe(action);
    }
    expect(gestureAction("crown", "tap")).toBe("growth-lens");
    expect(gestureAction("crown", "drag-y")).toBe("botanical-presence");
    expect(gestureAction("vines", "stroke-up")).toBe("weeks-forward");
    expect(gestureAction("vines", "stroke-down")).toBe("weeks-back");
    expect(gestureAction("hands", "tap")).toBe("held-item");
    expect(gestureAction("hands", "drag-x")).toBe("turn-held-item");
    expect(gestureAction("face", "tap")).toBe("portrait");
    expect(gestureAction("roots", "tap")).toBe("roots-view");
    expect(gestureAction("potRim", "drag-x")).toBe("spin");
    expect(gestureAction("potRim", "drag-y")).toBe("distance");
  });

  it("leaves undefined combinations null: pinch and long-press on her belong to the court", () => {
    for (const region of QUEEN_REGION_ORDER) {
      expect(gestureAction(region, "pinch")).toBeNull();
      expect(gestureAction(region, "long-press")).toBeNull();
    }
    expect(gestureAction("face", "drag-x")).toBeNull();
    expect(gestureAction("vines", "tap")).toBeNull();
    expect(gestureAction("potRim", "tap")).toBeNull();
  });

  it("sparks are feedback only: a phrase and a colour, never a number", () => {
    for (const region of QUEEN_REGION_ORDER) {
      const s = spark(region);
      expect(s.region).toBe(region);
      expect(s.petals).toBe(6);
      expect(s.durationMs).toBe(600);
      expect(s.phrase).not.toMatch(/\d|\$/);
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("projectRegions on a mocked camera", () => {
  const camera = new THREE.PerspectiveCamera(40, 1.5, 0.1, 100);
  camera.position.set(0, 1, 6);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  const viewport = { width: 900, height: 600 };

  it("puts a box in front of the camera on screen, higher boxes higher up, clamped to the viewport", () => {
    const boxes = {
      face: new THREE.Box3(new THREE.Vector3(-0.2, 1.6, -0.2), new THREE.Vector3(0.2, 2.0, 0.2)),
      roots: new THREE.Box3(new THREE.Vector3(-0.3, 0.1, -0.3), new THREE.Vector3(0.3, 0.5, 0.3)),
      potRim: new THREE.Box3(new THREE.Vector3(-40, 0, -40), new THREE.Vector3(40, 0.6, 40)),
    };
    const rects = projectRegions(boxes, camera, viewport);
    expect(rects.face).toBeDefined();
    expect(rects.roots).toBeDefined();
    expect(rects.face!.y + rects.face!.height).toBeLessThan(rects.roots!.y);
    expect(Math.abs(rects.face!.x + rects.face!.width / 2 - 450)).toBeLessThan(2);
    expect(rects.potRim!.x).toBe(0);
    expect(rects.potRim!.width).toBe(900);
    expect(rects.potRim!.y + rects.potRim!.height).toBeLessThanOrEqual(600);
    expect(rects.crown).toBeUndefined();
  });

  it("drops a box entirely behind the camera and an empty box", () => {
    const behind = new THREE.Box3(new THREE.Vector3(-0.2, 0.8, 8), new THREE.Vector3(0.2, 1.2, 9));
    expect(projectRegions({ hands: behind, vines: new THREE.Box3() }, camera, viewport)).toEqual({});
  });
});

describe("the Queen placed in the Court", () => {
  const evidence: BloomEvidence[] = [
    { id: "e1", title: "Rent covered", kind: "lived", date: "2026-09-01", revision: 1 },
    { id: "e2", title: "Newfoundland", kind: "intention", date: null, revision: 1 },
    { id: "e3", title: "Cared", kind: "care", date: "2026-09-10", revision: 2 },
  ];

  it("growth stems alone sit at the origin with their bases near y = 0.15", () => {
    const growth = createBloomGrowth(DEFAULT_QUEEN_STYLE, evidence);
    const box = new THREE.Box3().setFromObject(growth);
    expect(growth.children.length).toBeGreaterThan(3);
    expect(box.min.y).toBeCloseTo(0.15, 1);
  });

  for (const [source, path] of Object.entries(FILES) as Array<[keyof typeof FILES, string]>) {
    it(`${source}: stands 2.05 units on her own base, every region boxed, stems at the roots, body breathing`, async () => {
      const scene = await load(path);
      const group = new THREE.Group();
      group.add(normaliseQueen(scene));
      const place = dressQueenPlace(group, { tier: source === "presence" ? "full" : "lite", source, style: DEFAULT_QUEEN_STYLE, evidence });
      group.updateMatrixWorld(true);
      const whole = new THREE.Box3().setFromObject(scene);
      expect(whole.max.y - whole.min.y).toBeCloseTo(QUEEN_STANDING_HEIGHT, 2);
      expect(whole.min.y).toBeCloseTo(0, 3);
      expect(Math.abs(whole.getCenter(new THREE.Vector3()).x)).toBeLessThan(0.01);

      const counts = tagQueenRegions(group);
      for (const region of QUEEN_REGION_ORDER) expect(counts[region], region).toBeGreaterThan(0);
      let tagged = 0, meshes = 0;
      scene.traverse((node) => { if (node instanceof THREE.Mesh) { meshes += 1; if (node.userData.region) tagged += 1; } });
      const inert = glbNodes(path).filter((node) => node.mesh && isIgnoredQueenNode(node.name)).length;
      expect(tagged).toBe(meshes - inert);

      const boxes = place.regions();
      for (const region of QUEEN_REGION_ORDER) expect(boxes[region], region).toBeDefined();
      const centre = (region: QueenRegion) => boxes[region]!.getCenter(new THREE.Vector3()).y;
      // The crown holds the skull on the presence set and only the vines on v1 (plan §3): it tops out high on her either way.
      expect(boxes.crown!.max.y).toBeGreaterThan(QUEEN_STANDING_HEIGHT * 0.9);
      expect(boxes.crown!.max.y).toBeGreaterThan(boxes.hands!.max.y);
      expect(centre("face")).toBeGreaterThan(centre("hands"));
      expect(centre("hands")).toBeGreaterThan(centre("roots"));
      expect(boxes.potRim!.min.y).toBeCloseTo(0, 2);

      const growth = group.children.find((child) => child.name === "Supported history · identity anchored")!;
      expect(growth).toBeDefined();
      expect(growth.position.y).toBeCloseTo(boxes.roots!.max.y - 0.15, 3);
      expect(Math.abs(growth.position.x - boxes.roots!.getCenter(new THREE.Vector3()).x)).toBeLessThan(0.01);
      const reseat = new THREE.Group(); seatGrowthAtRoots(reseat, growth, {});
      expect(growth.position.y).toBe(0);

      expect(place.breathing.length).toBe(source === "v1" ? 1 : 3);
      place.breathe(1.5);
      for (const node of place.breathing) expect(node.scale.y).toBeCloseTo(1.006, 6);
      place.breathe(4.5);
      for (const node of place.breathing) expect(node.scale.y).toBeCloseTo(0.994, 6);
      place.rest();
      for (const node of place.breathing) expect(node.scale.y).toBe(1);
      const untouched = place.regions();
      expect(untouched.vines!.max.y).toBeCloseTo(boxes.vines!.max.y, 6);

      const poses = place.poses();
      expect(poses.portrait.target[1]).toBeGreaterThan(poses.roots.target[1]);
      expect(poses.portrait.r).toBeLessThan(poses.roots.r);
      place.dispose();
    }, 60_000);
  }

  it("projects the placed Queen's regions into a phone viewport in reading order", async () => {
    const scene = await load(FILES.v1);
    const group = new THREE.Group(); group.add(normaliseQueen(scene));
    const place = dressQueenPlace(group, { tier: "lite", source: "v1", style: DEFAULT_QUEEN_STYLE, evidence });
    const camera = new THREE.PerspectiveCamera(45, 390 / 700, 0.1, 50);
    camera.position.set(0, 1.2, 5); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    const rects = projectRegions(place.regions(), camera, { width: 390, height: 700 });
    for (const region of QUEEN_REGION_ORDER) {
      const rect = rects[region]!;
      expect(rect, region).toBeDefined();
      expect(rect.width).toBeGreaterThan(20);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(390);
    }
    expect(rects.crown!.y).toBeLessThan(rects.roots!.y);
    place.dispose();
  }, 60_000);
});
