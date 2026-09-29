// @vitest-environment jsdom
/**
 * The Journey board layer (T3): route layout on the 12 baked station anchors (REAL land from public/, fetch mocked),
 * day spaces, crossings, label placement, the scene's draw budget through the renderer lease's `rendererFactory`
 * seam, the scene's inertness (focus / select / preview call nothing outside it) and flat-twin id parity.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type * as THREE from "three";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { daysInMonthKey, shiftMonthKey } from "../src/core/calendar.ts";
import {
  JOURNEY_CAMERA, JOURNEY_LOD, JOURNEY_THEMES, PIECE_LOOKS, STATION_IDS, compressHeight, tierForRadius,
  type JourneyBoard, type JourneyLandData, type JourneyLandHandle, type MarkAnchor,
} from "../src/journey/contracts.ts";
import { HORIZON_INDEX_URL } from "../src/house/world/horizonAssets.ts";
import { buildJourneyLand, loadJourneyLand, resetJourneyLandCacheForTests } from "../src/journey/land/index.ts";
import { deriveJourneyBoard } from "../src/journey/model/index.ts";
import {
  BOARD_DRESSING_KEYS, BoardFlat, boardMarkIds, boardMarks, createJourneyBoardScene, isAttentionStop, CROSSING_CLEARANCE_EU, JOURNEY_BOARD_DRESSINGS, labelRankFor,
  layoutBoardRoute, layoutRoute, placeLabels, radiusForTier, ribbonWidth, skyPostIds, SKY_POST_LIMIT, type BoardSceneHandle,
  type BoardSceneOptions, type LabelCandidate,
} from "../src/journey/board/index.ts";
import { placeDays } from "../src/journey/board/route.ts";
import { boardDressing } from "../src/journey/board/dressing.ts";
import { pieceShape } from "../src/journey/board/piece.ts";
import { triangleCount } from "../src/journey/board/shapes.ts";
import {
  BIANCA, FIXTURE_TODAY, busyMonthHousehold, emptyBoardHousehold, journeyDemoHousehold, quietMonthHousehold,
} from "./fixtures/journey-board-households.ts";

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const INDEX_GZ = toArrayBuffer(readFileSync("public/horizon/world/horizon-geo-1.index.json.gz"));
const TERRAIN = toArrayBuffer(readFileSync("public/horizon/terrain/horizon-geo-1.bin"));

let land: JourneyLandData;
let board: JourneyBoard;
beforeAll(async () => {
  resetJourneyLandCacheForTests();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === HORIZON_INDEX_URL) return new Response(INDEX_GZ.slice(0), { headers: { "content-type": "application/gzip" } });
    if (url.endsWith("/horizon-geo-1.bin")) return new Response(TERRAIN.slice(0), { headers: { "content-type": "application/octet-stream" } });
    return new Response("not found", { status: 404 });
  }));
  try { land = await loadJourneyLand(); } finally { vi.unstubAllGlobals(); }
  board = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY);
}, 60_000);
afterEach(() => { vi.unstubAllGlobals(); });

const planar = (a: readonly number[], x: number, z: number) => Math.hypot(a[0]! - x, a[2]! - z);
const anchorOf = (id: string) => land.stations.find((s) => s.id === id)!.anchor;

describe("route layout on the baked stations", () => {
  it("puts each month space on its station anchor (±0.5 eu) with a compressed height", () => {
    const route = layoutRoute(board, land);
    expect(route.months.map((m) => m.chapterId)).toEqual(board.chapters.map((c) => c.id));
    for (const m of route.months) {
      const chapter = board.chapters.find((c) => c.id === m.chapterId)!;
      expect(m.stationId).toBe(chapter.stationId);
      expect(m.state).toBe(chapter.state);
      const [ax, ay] = anchorOf(m.stationId);
      expect(planar(m.at, ax, ay)).toBeLessThanOrEqual(0.5);
      // Board space: compressed ground + the route lift, never the raw baked height.
      const station = land.stations.find((s) => s.id === m.stationId)!;
      expect(m.at[1]).toBeLessThan(Math.max(station.height, 1) + 2);
      expect(m.at[1]).toBeGreaterThanOrEqual(compressHeight(Math.min(station.height, 0)));
    }
  });

  it("gives every month's stretch one space per day, day N on the station, ids = the board's dates", () => {
    const route = layoutBoardRoute(board, land);
    expect(route.stretches).toHaveLength(board.chapters.length);
    for (const s of route.stretches) {
      const chapter = board.chapters.find((c) => c.id === s.chapterId)!;
      expect(s.days).toHaveLength(daysInMonthKey(s.chapterId));
      expect(s.days.map((d) => d.date)).toEqual(chapter.days.map((d) => d.date));
      expect(s.days.map((d) => d.index)).toEqual(chapter.days.map((_, i) => i + 1));
      expect(s.toStationId).toBe(chapter.stationId);
      expect(s.fromStationId).toBe(STATION_IDS[(STATION_IDS.indexOf(chapter.stationId) + 11) % 12]);
      const [ax, ay] = anchorOf(chapter.stationId);
      const last = s.days.at(-1)!;
      expect(planar(last.at, ax, ay)).toBeLessThanOrEqual(0.5);
      expect(last.arcEu).toBeCloseTo(s.lengthEu, 2);
      // The stretch starts at the previous station.
      const [px, py] = anchorOf(s.fromStationId);
      expect(planar(s.points[0]!, px, py)).toBeLessThanOrEqual(0.5);
      for (const d of s.days) {
        const cell = chapter.days[d.index - 1]!;
        expect(d.chapterId).toBe(chapter.id);
        expect(d.relation).toBe(cell.relation);
        expect(d.stopIds).toEqual(cell.stopIds);
        expect(d.clusterId).toBe(cell.clusterId);
        expect(d.flagstone).toBe(cell.flagstone);
        expect(Math.hypot(d.tangent[0], d.tangent[1])).toBeCloseTo(1, 3);
      }
    }
    const allDates = route.stretches.flatMap((s) => s.days.map((d) => d.date));
    expect(new Set(allDates).size).toBe(allDates.length);
  });

  it("spaces days by arc length: strictly increasing, on the ribbon's centreline", () => {
    const route = layoutBoardRoute(board, land);
    for (const s of route.stretches) {
      let prev = 0;
      for (const d of s.days) {
        expect(d.arcEu).toBeGreaterThan(prev);
        prev = d.arcEu;
        // On the drawn centreline (within half a sample chord).
        let best = Infinity;
        for (let i = 0; i + 1 < s.points.length; i += 1) {
          const a = s.points[i]!, b = s.points[i + 1]!, dx = b[0] - a[0], dz = b[2] - a[2], len2 = dx * dx + dz * dz;
          const t = len2 ? Math.min(Math.max(((d.at[0] - a[0]) * dx + (d.at[2] - a[2]) * dz) / len2, 0), 1) : 0;
          best = Math.min(best, Math.hypot(a[0] + t * dx - d.at[0], a[2] + t * dz - d.at[2]));
        }
        expect(best).toBeLessThan(0.6);
      }
      // Even spacing away from crossings: the median gap equals length / N.
      const gaps = s.days.map((d, i) => d.arcEu - (i ? s.days[i - 1]!.arcEu : 0)).sort((a, b) => a - b);
      expect(gaps[Math.floor(gaps.length / 2)]!).toBeCloseTo(s.lengthEu / s.days.length, 1);
    }
  });

  it("finds the self-crossings, draws the later month over, and keeps every day space ≥ 12 eu clear", () => {
    const route = layoutRoute(board, land);
    expect(route.crossings.length).toBeGreaterThan(0);
    for (const c of route.crossings) {
      expect(c.overChapterId > c.underChapterId).toBe(true);
      for (const s of route.stretches) for (const d of s.days) expect(planar(d.at, c.at[0], c.at[1])).toBeGreaterThanOrEqual(CROSSING_CLEARANCE_EU);
    }
  });

  it("is deterministic, and a stretch keeps its shape when the window moves", () => {
    const a = layoutRoute(board, land), b = layoutRoute(JSON.parse(JSON.stringify(board)) as JourneyBoard, land);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    const narrow = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY, { pastMonths: 2, aheadMonths: 1 });
    const n = layoutRoute(narrow, land);
    expect(n.stretches.map((s) => s.chapterId)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    for (const s of n.stretches) expect(s.points).toEqual(a.stretches.find((x) => x.chapterId === s.chapterId)!.points);
  });

  it("lays out quiet, busy and empty households", () => {
    for (const h of [quietMonthHousehold(), busyMonthHousehold().household, emptyBoardHousehold()]) {
      const b = deriveJourneyBoard(h, BIANCA, FIXTURE_TODAY);
      const r = layoutRoute(b, land);
      expect(r.months).toHaveLength(b.chapters.length);
      for (const s of r.stretches) expect(s.days).toHaveLength(daysInMonthKey(s.chapterId));
    }
  });

  it("nudges days out of a blocked arc without reordering them", () => {
    const s = placeDays(300, 30, [[95, 125], [200, 212]]);
    expect(s).toHaveLength(30);
    expect(s.at(-1)).toBe(300);
    for (let i = 0; i < s.length; i += 1) {
      if (i) expect(s[i]!).toBeGreaterThan(s[i - 1]!);
      expect((s[i]! > 95 && s[i]! < 125) || (s[i]! > 200 && s[i]! < 212)).toBe(false);
    }
    // Days far from the blocked arcs keep their even places.
    expect(s[0]).toBe(10);
    expect(s[25]).toBe(260);
  });
});

describe("placeLabels", () => {
  const stage = { width: 390, height: 600 };
  const box = (id: string, x: number, y: number, rank: LabelCandidate["rank"], extra: Partial<LabelCandidate> = {}): LabelCandidate =>
    ({ id, x, y, width: 90, height: 28, rank, ...extra });

  it("always places the piece, clamped inside the stage", () => {
    const out = placeLabels([box("piece", 5, 10, "piece"), box("a", 200, 200, "attention")], stage);
    const piece = out.find((p) => p.id === "piece")!;
    expect(piece.placed).toBe(true);
    expect(piece.box!.x0).toBeGreaterThanOrEqual(0);
    expect(piece.box!.y0).toBeGreaterThanOrEqual(0);
    const hidden = placeLabels([box("piece", 200, 300, "piece", { visible: false })], stage);
    expect(hidden[0]!.placed).toBe(true);
  });

  it("lets the higher priority win an overlap, never overlaps, never hangs off the stage", () => {
    const cands = [
      box("district:green", 200, 300, "district"), box("2026-09", 204, 302, "month"), box("memory:x", 198, 299, "memory"),
      box("bill:a@2026-09-30", 202, 301, "attention"), box("piece", 100, 100, "piece"), box("off", 385, 300, "income"),
      box("selected", 100, 104, "selected"), box("cross", 300, 500, "crossroads"), box("gone", 50, 500, "plan", { visible: false }),
    ];
    const out = placeLabels(cands, { ...stage, obstacles: [{ x0: 250, y0: 480, x1: 390, y1: 540 }] });
    expect(out.map((p) => p.id)).toEqual(cands.map((c) => c.id));
    const byId = new Map(out.map((p) => [p.id, p]));
    expect(byId.get("bill:a@2026-09-30")!.placed).toBe(true);
    for (const loser of ["district:green", "2026-09", "memory:x", "selected", "cross", "off", "gone"]) expect(byId.get(loser)!.placed, loser).toBe(false);
    const placed = out.filter((p) => p.placed).map((p) => p.box!);
    for (let i = 0; i < placed.length; i += 1) {
      const a = placed[i]!;
      expect(a.x0 >= 0 && a.y0 >= 0 && a.x1 <= stage.width && a.y1 <= stage.height).toBe(true);
      for (let j = i + 1; j < placed.length; j += 1) {
        const b = placed[j]!;
        expect(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1).toBe(false);
      }
    }
  });

  it("ranks the demo board's marks by the plan's priority", () => {
    expect(labelRankFor(board, "piece", null)).toBe("piece");
    const overdue = board.stops.find((s) => s.kind === "commitment" && s.status === "overdue")!;
    expect(labelRankFor(board, overdue.id, null)).toBe("attention");
    expect(labelRankFor(board, overdue.id, overdue.id)).toBe("selected");
    expect(labelRankFor(board, board.crossroads[0]!.id, null)).toBe("crossroads");
    expect(labelRankFor(board, "2026-09", null)).toBe("month");
    expect(labelRankFor(board, "district:green", null)).toBe("district");
    const cluster = board.clusters.find((c) => c.stopIds.includes(overdue.id));
    if (cluster) expect(labelRankFor(board, cluster.id, null)).toBe("attention");
  });

  it("stands at most eight posts at Sky, crossroads first", () => {
    const sky = skyPostIds(board);
    expect(sky.size).toBeLessThanOrEqual(SKY_POST_LIMIT);
    for (const c of board.crossroads.slice(0, SKY_POST_LIMIT)) expect(sky.has(c.id)).toBe(true);
  });

  it("stands only the crossroads that won a Sky post at Sky; past the limit they wait for a closer tier (PR #567 review)", () => {
    expect(board.crossroads.length).toBeGreaterThan(0);
    const base = board.crossroads[0]!;
    const many: JourneyBoard = { ...board, crossroads: Array.from({ length: SKY_POST_LIMIT + 3 }, (_, i) => ({ ...base, id: `${base.id}~${i}` })) };
    const sky = skyPostIds(many);
    const crossroads = boardMarks(many, layoutRoute(many, land)).filter((m) => m.kind === "crossroads");
    expect(crossroads).toHaveLength(SKY_POST_LIMIT + 3);
    const atSky = crossroads.filter((m) => m.tiers.includes("sky"));
    expect(atSky.length).toBeLessThanOrEqual(SKY_POST_LIMIT);
    for (const m of crossroads) {
      expect(m.tiers.includes("sky"), m.id).toBe(sky.has(m.id));
      expect(m.tiers).toEqual(expect.arrayContaining(["region", "stop"]));
    }
    // The one attention rule reads the same everywhere.
    const overdue = board.stops.find((st) => st.kind === "commitment" && st.status === "overdue")!;
    expect(isAttentionStop(overdue)).toBe(true);
    expect(labelRankFor(board, overdue.id, null)).toBe("attention");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The scene, through the renderer lease's `rendererFactory` test seam.

function fakeRenderer() {
  const canvas = document.createElement("canvas");
  const calls = { render: 0, dispose: 0, lost: 0 };
  const renderer = {
    domElement: canvas,
    render: vi.fn(() => { calls.render += 1; }),
    dispose: vi.fn(() => { calls.dispose += 1; }),
    forceContextLoss: vi.fn(() => { calls.lost += 1; }),
    setPixelRatio: vi.fn(), setSize: vi.fn(), setClearColor: vi.fn(), setRenderTarget: vi.fn(), setScissorTest: vi.fn(),
    autoClear: true, shadowMap: { enabled: true, type: 0 }, outputColorSpace: "", toneMapping: 0,
  } as unknown as THREE.WebGLRenderer;
  return { renderer, calls };
}

type Harness = {
  scene: BoardSceneHandle; land: JourneyLandHandle; anchors: () => MarkAnchor[]; spies: Record<string, ReturnType<typeof vi.fn>>;
  calls: ReturnType<typeof fakeRenderer>["calls"]; raf: ReturnType<typeof vi.fn>; canvas: HTMLCanvasElement; options: BoardSceneOptions;
};
const opened: Harness[] = [];
/** Native frames the shared scheduler asked for; tests flush them explicitly. */
const pendingFrames: FrameRequestCallback[] = [];
function flushFrames(time = 0) {
  for (let guard = 0; guard < 4 && pendingFrames.length; guard += 1) for (const cb of pendingFrames.splice(0)) cb(time);
}

function mount(tier: "full" | "lite", size = { width: 1100, height: 800 }, b: JourneyBoard = board, extra: Partial<BoardSceneOptions> = {}): Harness {
  const raf = vi.fn((cb: FrameRequestCallback) => { pendingFrames.push(cb); return pendingFrames.length; });
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  // Drain frames left by an earlier mount so the shared scheduler is idle.
  flushFrames();
  const made = fakeRenderer();
  const landHandle = buildJourneyLand(land, { theme: "classic", tier, homes: b.homes });
  let last: MarkAnchor[] = [];
  const spies = { onAnchors: vi.fn((a: MarkAnchor[]) => { last = a; }), onTier: vi.fn(), onPick: vi.fn(), onReady: vi.fn(), onLost: vi.fn() };
  const options: BoardSceneOptions = {
    land: landHandle, board: b, route: layoutRoute(b, land), theme: "classic", tier, reducedMotion: true,
    ...spies, rendererFactory: () => made.renderer, shared: false, size, devicePixelRatio: 2, ...extra,
  };
  const scene = createJourneyBoardScene(document.createElement("div"), options);
  const h = { scene, land: landHandle, anchors: () => last, spies, calls: made.calls, raf, canvas: made.renderer.domElement, options };
  opened.push(h);
  return h;
}
afterAll(() => { for (const h of opened) { h.scene.dispose(); h.land.dispose(); } });

describe("board scene", () => {
  it("fits the L0 budget at Sky (≤ 40k tris / 60 draws full; ≤ 25k / 40 lite) and L1 at Region", () => {
    for (const tier of ["full", "lite"] as const) {
      const h = mount(tier, tier === "full" ? { width: 1100, height: 800 } : { width: 390, height: 700 });
      h.scene.focus("piece", "sky", false);
      h.scene.renderNow();
      expect(h.scene.view().tier).toBe("sky");
      const sky = h.scene.stats();
      expect(sky.triangles, `${tier} sky triangles`).toBeLessThanOrEqual(JOURNEY_LOD.sky.triangles[tier]);
      expect(sky.drawCalls, `${tier} sky draws`).toBeLessThanOrEqual(JOURNEY_LOD.sky.drawCalls[tier]);
      h.scene.focus("piece", "region", false);
      h.scene.renderNow();
      const region = h.scene.stats();
      expect(region.triangles, `${tier} region triangles`).toBeLessThanOrEqual(JOURNEY_LOD.region.triangles[tier]);
      expect(region.drawCalls, `${tier} region draws`).toBeLessThanOrEqual(JOURNEY_LOD.sky.drawCalls[tier]);
      console.info(`[journey-board] ${tier}: sky ${sky.triangles} tris / ${sky.drawCalls} draws; region ${region.triangles} / ${region.drawCalls}`);
    }
  });

  it("opens at Region on the piece, reports anchors for every mark and calls onReady once", () => {
    const h = mount("full");
    h.scene.renderNow();
    expect(h.spies.onReady).toHaveBeenCalledTimes(1);
    expect(h.scene.view().tier).toBe("region");
    expect(h.scene.view().radius).toBe(JOURNEY_CAMERA.radius.region);
    const ids = new Set(h.anchors().map((a) => a.id));
    for (const id of boardMarkIds(board, layoutRoute(board, land))) expect(ids.has(id), id).toBe(true);
    const piece = h.anchors().find((a) => a.id === "piece")!;
    expect(piece.visible).toBe(true);
    expect(Math.abs(piece.x - 550)).toBeLessThan(60);
    // At Sky: months + piece visible, day spaces not drawn.
    h.scene.focus("piece", "sky", false);
    h.scene.renderNow();
    const sky = h.anchors();
    expect(sky.filter((a) => /^\d{4}-\d{2}$/.test(a.id)).every((a) => a.visible)).toBe(true);
    expect(sky.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.id)).some((a) => a.visible)).toBe(false);
    expect(h.spies.onTier).toHaveBeenCalledWith("sky");
    expect(radiusForTier("sky", land.extent, 1100, 800)).toBeGreaterThan(Math.sqrt(JOURNEY_CAMERA.radius.sky * JOURNEY_CAMERA.radius.region));
  });

  it("frames inside the safe area: Sky fits the island clear of a left card, a pristine view re-frames, a moved view holds still", () => {
    const h = mount("full");
    h.scene.focus("piece", "sky", false);
    h.scene.renderNow();
    const months = () => h.anchors().filter((a) => /^\d{4}-\d{2}$/.test(a.id));
    const skyRadius = h.scene.view().radius;
    // Before: the island spans the stage, some months under where the card goes.
    expect(Math.min(...months().map((a) => a.x))).toBeLessThan(380);
    // District names are reported at Sky (and Region), not at Stop.
    expect(h.anchors().filter((a) => a.id.startsWith("district:")).some((a) => a.visible)).toBe(true);
    h.scene.setSafeArea({ top: 0, right: 0, bottom: 0, left: 380 });
    h.scene.renderNow();
    expect(h.scene.view().tier).toBe("sky");
    expect(h.scene.view().radius).toBeGreaterThan(skyRadius);
    for (const a of months()) { expect(a.x, a.id).toBeGreaterThanOrEqual(380); expect(a.x, a.id).toBeLessThanOrEqual(1100); }
    // Region: the first safe area re-frames the mount's focus in the uncovered centre (380 + 720 / 2 = 740).
    const r = mount("full");
    r.scene.renderNow();
    r.scene.setSafeArea({ top: 0, right: 0, bottom: 0, left: 380 });
    r.scene.renderNow();
    const piece = () => r.anchors().find((a) => a.id === "piece")!;
    expect(Math.abs(piece().x - 740)).toBeLessThan(60);
    // Once the person has moved the camera, a new safe area (a panel opening) holds the picture still.
    r.scene.panBy(-40, 0);
    r.scene.renderNow();
    const held = piece();
    r.scene.setSafeArea({ top: 0, right: 360, bottom: 0, left: 380 });
    r.scene.renderNow();
    // Near-orthographic, not orthographic: the re-aimed camera leaves a few px of parallax (a 180 px shift ≈ 8 px).
    expect(Math.abs(piece().x - held.x)).toBeLessThan(12);
    expect(Math.abs(piece().y - held.y)).toBeLessThan(12);
    // A new focus lands in the new uncovered centre (380 + 360 / 2 = 560); at Stop, no district names.
    r.scene.focus("piece", "stop", false);
    r.scene.renderNow();
    expect(Math.abs(piece().x - 560)).toBeLessThan(60);
    expect(r.anchors().filter((a) => a.id.startsWith("district:")).some((a) => a.visible)).toBe(false);
  });

  it("focus / select / preview / zoom call nothing outside the scene, and idle draws no frames", () => {
    const h = mount("full");
    h.scene.renderNow();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const getItem = vi.spyOn(Storage.prototype, "getItem"), setItem = vi.spyOn(Storage.prototype, "setItem");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const homeX = board.crossroads.find((c) => c.kind === "homeBlueprint");
    const era = board.crossroads.find((c) => c.kind === "eraProposal")!;
    h.scene.setSelection(board.stops[0]!.id);
    h.scene.setSelection("piece");
    h.scene.setPreview({ crossroadsId: era.id, alternativeId: era.alternatives.find((a) => !a.isCurrent)!.id });
    if (homeX) h.scene.setPreview({ crossroadsId: homeX.id, alternativeId: homeX.alternatives.find((a) => !a.isCurrent)!.id });
    h.scene.focus({ chapterId: "2026-05" }, "region", true);
    h.scene.focus({ date: "2026-09-18" }, "stop", true);
    h.scene.zoomBy(0.5);
    h.scene.zoomBy(0.01); // below Stop: clamped, never "enters" anything
    expect(h.scene.view().radius).toBe(JOURNEY_CAMERA.minRadius);
    h.scene.focus("piece", "region", true);
    h.scene.setPreview(null);
    h.scene.renderNow();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(h.spies.onPick).not.toHaveBeenCalled();
    expect(h.spies.onLost).not.toHaveBeenCalled();
    expect(h.anchors().some((a) => a.id.startsWith("preview:"))).toBe(false);
    // Idle: once drawn, nothing moving means no further frame is requested.
    flushFrames();
    h.raf.mockClear();
    h.scene.renderNow();
    flushFrames();
    expect(h.raf).not.toHaveBeenCalled();
    expect(pendingFrames).toHaveLength(0);
    getItem.mockRestore(); setItem.mockRestore(); open.mockRestore();
  });

  it("only reports a pick; a canvas click or drag never runs anything", () => {
    const h = mount("full");
    h.scene.renderNow();
    const piece = h.anchors().find((a) => a.id === "piece")!;
    const fire = (type: string, x: number, y: number) => h.canvas.dispatchEvent(Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), { pointerId: 1 }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    fire("pointerdown", piece.x, piece.y + 4);
    fire("pointerup", piece.x, piece.y + 4);
    expect(h.spies.onPick).toHaveBeenCalledTimes(1);
    expect(h.spies.onPick).toHaveBeenLastCalledWith("piece");
    // A drag pans; it is not a pick.
    const before = h.scene.view();
    fire("pointerdown", 300, 300);
    fire("pointermove", 340, 330);
    fire("pointerup", 340, 330);
    expect(h.spies.onPick).toHaveBeenCalledTimes(1);
    expect(h.scene.view().x).not.toBe(before.x);
    // Empty sea far off the route picks nothing.
    h.scene.focus("piece", "sky", false);
    h.scene.renderNow();
    fire("pointerdown", 20, 20);
    fire("pointerup", 20, 20);
    expect(h.spies.onPick).toHaveBeenLastCalledWith(null);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("settles the piece in ≤ 600 ms when today's chapter changes; a milestone settle ends on any input", () => {
    let t = 10_000;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => t);
    const h = mount("full", undefined, board, { reducedMotion: false });
    h.scene.renderNow();
    flushFrames(t);
    expect(pendingFrames).toHaveLength(0);
    const moved = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, "2026-10-02");
    h.scene.setBoard(moved, layoutRoute(moved, land));
    expect(pendingFrames.length).toBeGreaterThan(0);
    t += 300; flushFrames(t);
    expect(pendingFrames.length).toBeGreaterThan(0);
    t += 301; flushFrames(t);
    expect(pendingFrames).toHaveLength(0);
    // Re-deriving the same day moves nothing.
    h.scene.setBoard(moved, layoutRoute(moved, land));
    flushFrames(t);
    expect(pendingFrames).toHaveLength(0);
    // A newly granted milestone settles; any key ends it at once.
    const granted = moved.stops.find((s): s is Extract<typeof s, { kind: "milestone" }> => s.kind === "milestone" && s.status === "granted")!;
    h.scene.focus({ date: granted.date }, "region", false);
    h.scene.renderNow();
    const withNew = { ...moved, stops: [...moved.stops, { ...granted, id: `${granted.id}-new`, awardId: `${granted.awardId}-new` }] } as JourneyBoard;
    h.scene.setBoard(withNew, layoutRoute(withNew, land));
    t += 16; flushFrames(t);
    expect(pendingFrames.length).toBeGreaterThan(0); // the pavilion is still settling
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    t += 16; flushFrames(t);
    expect(pendingFrames).toHaveLength(0);
    // Reduced motion (the html flag) makes Back to now a cut.
    document.documentElement.dataset.motion = "reduced";
    h.scene.focus("piece", "region", true);
    flushFrames(t);
    expect(pendingFrames).toHaveLength(0);
    delete document.documentElement.dataset.motion;
    nowSpy.mockRestore();
  });

  it("keeps the frozen contract: options carry no actions, and ground points come back in concept metres", () => {
    const h = mount("full");
    h.scene.renderNow();
    const centre = h.scene.groundAt(550, 400);
    expect(centre).not.toBeNull();
    expect(Math.abs(centre!.x - h.scene.view().x)).toBeLessThan(20);
    expect(land.stations.length).toBe(12);
    const sea = h.scene.screenToWorld(550, 400);
    expect(sea).not.toBeNull();
    // Type-level: the scene's options have no place for JourneyBoardActions (tsc fails if one is ever added).
    const withActions: BoardSceneOptions = {
      ...h.options,
      // @ts-expect-error — `actions` is not a scene option.
      actions: {},
    };
    expect(Object.keys(h.options)).not.toContain("actions");
    void withActions;
    expect(tierForRadius(h.scene.view().radius)).toBe(h.scene.view().tier);
    expect(ribbonWidth(h.scene.view().worldPerPixel)).toBeGreaterThanOrEqual(3);
  });

  it("rebuilds on data, theme and piece-look changes and releases the lease on dispose", () => {
    const h = mount("full");
    h.scene.renderNow();
    for (const theme of JOURNEY_THEMES) h.scene.setTheme(theme);
    const next = { ...board, piece: { ...board.piece, lookId: "boat" as const } };
    h.scene.setBoard(next, layoutRoute(next, land));
    const moved = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, "2026-10-02");
    h.scene.setBoard(moved, layoutRoute(moved, land));
    h.scene.renderNow();
    expect(h.anchors().find((a) => a.id === "piece")).toBeDefined();
    const before = h.calls.render;
    h.scene.sleep();
    h.scene.renderNow();
    expect(h.calls.render).toBe(before);
    h.scene.wake();
    h.scene.dispose();
    expect(h.calls.dispose).toBe(1);
    expect(h.calls.lost).toBe(1);
  });
});

describe("pieces, dressings and the flat twin", () => {
  it("authors all three themes and four original piece looks", () => {
    for (const theme of JOURNEY_THEMES) {
      for (const key of BOARD_DRESSING_KEYS) expect(JOURNEY_BOARD_DRESSINGS[theme][key], `${theme}.${key}`).toBeTruthy();
      const d = boardDressing(theme);
      for (const look of PIECE_LOOKS) {
        expect(d.piece[look].body).toMatch(/^#[0-9a-f]{6}$/);
        const tris = triangleCount(pieceShape(look, d));
        expect(tris).toBeGreaterThan(40);
        expect(tris).toBeLessThan(400);
      }
    }
    const counts = PIECE_LOOKS.map((look) => triangleCount(pieceShape(look, boardDressing("classic"))));
    expect(new Set(counts).size).toBe(PIECE_LOOKS.length);
  });

  it("BoardFlat exposes the same data-ids as the 3D marks", () => {
    const route = layoutRoute(board, land);
    const html = renderToStaticMarkup(createElement("svg", null, createElement(BoardFlat, { route, board, selection: "piece", theme: "taylor" })));
    const flatIds = [...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    expect(new Set(flatIds).size).toBe(flatIds.length);
    expect(new Set(flatIds)).toEqual(new Set(boardMarkIds(board, route)));
    const h = mount("full");
    h.scene.renderNow();
    const sceneIds = h.anchors().map((a) => a.id).filter((id) => !id.startsWith("district:") && !id.startsWith("preview:"));
    expect(new Set(sceneIds)).toEqual(new Set(flatIds));
    expect(html).toContain('data-kind="piece"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("keeps the window's chapters in calendar order across the lap", () => {
    const route = layoutRoute(board, land);
    for (let i = 1; i < route.stretches.length; i += 1) expect(route.stretches[i]!.chapterId).toBe(shiftMonthKey(route.stretches[i - 1]!.chapterId, 1));
  });
});
