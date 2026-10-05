// @vitest-environment jsdom
/**
 * The Horizon Clock board (L3): the pure layouts (`layoutClock`, `layoutWeek`, `layoutYear`), coin stacks from
 * `ringsFor` only, the level pull (`levels.ts`), the label cap, the map scene on the renderer lease's
 * `rendererFactory` seam (with a stub land handle standing in for L2's clay land), and the SVG twin at all three
 * levels. Real land: the baked slim artefact in public/ (gunzipped with zlib), never a hand-drawn island.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  JOURNEY_DIORAMA, JOURNEY_MAP_MARKS, JOURNEY_THEMES, LEVEL_T, STACK_RULER, isToCheck, ringsFor, toDiorama,
  type DioramaFrame, type JourneyBoardActions, type JourneyBoard, type JourneyLandData, type JourneyLandHandle, type MarkAnchor,
  type Point2, type Stop,
} from "../src/journey/contracts.ts";
import { decodeJourneyLandSlim } from "../src/journey/land/slim.ts";
import { deriveJourneyBoard } from "../src/journey/model/index.ts";
import { directionOf, isRecorded } from "../src/journey/model/money.ts";
import {
  BoardFlat, cameraAt, chapterTurn, createJourneyMapScene, flatViewBoxFor, frameFromCoast, layoutClock, layoutWeek, layoutYear, levelTransition,
  mapLabels, MAP_LABEL_LIMIT, NO_INSET, placeLabels, popsAt, propKindFor, RING_HEIGHT_DU, stackFor, weekFrame, YEAR_RING_DU,
  type MapSceneHandle, type MapSceneOptions,
} from "../src/journey/board/index.ts";
import { distToLine, inPoly } from "../src/journey/board/geo.ts";
import { boardPalette } from "../src/journey/board/palette.ts";
import { JOURNEY_CLAY_PALETTES } from "../src/journey/land/clayPalette.ts";
import { BIANCA, FIXTURE_TODAY, emptyBoardHousehold, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";

const SLIM = JSON.parse(gunzipSync(readFileSync("public/horizon/world/horizon-geo-1.journey.json.gz")).toString());

let land: JourneyLandData;
let board: JourneyBoard;
let frame: DioramaFrame;
beforeAll(() => {
  land = decodeJourneyLandSlim(SLIM);
  board = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY) as JourneyBoard;
  frame = frameFromCoast(land.coastline);
});

const stopsById = () => new Map(board.stops.map((s) => [s.id, s] as const));
const planar = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------------------------------------------------------------------------------------------------------------
describe("layoutClock (Month)", () => {
  it("has 31 slots, day 1 at north on the top arch, clockwise, every slot on the bezel road", () => {
    const clock = layoutClock(board, "2026-09");
    expect(clock.slots).toHaveLength(JOURNEY_DIORAMA.slots);
    const s1 = clock.slots[0]!;
    expect(s1.slot).toBe(1);
    expect(s1.at[0]).toBeCloseTo(0, 6);
    expect(s1.at[1]).toBeLessThan(0); // north = −z
    expect(clock.slots[7]!.at[0]).toBeGreaterThan(0); // day 8 is east of north: clockwise from above
    for (const s of clock.slots) expect(Math.hypot(s.at[0], s.at[1])).toBeCloseTo(JOURNEY_DIORAMA.bezel.road, 6);
    // The arch and its "1" sit over the gap between day 31 and day 1.
    expect(clock.gate.at[1]).toBeLessThan(0);
    expect(Math.abs(clock.gate.angle)).toBeLessThan((2 * Math.PI) / 31);
    expect(clock.numerals.map((n) => n.day)).toEqual([8, 15, 22, 29]);
  });

  it("same date → same slot in every month; a short month keeps its slots, past its end the slot has no date", () => {
    const sep = layoutClock(board, "2026-09"), oct = layoutClock(board, "2026-10"), feb = layoutClock(board, "2026-02");
    for (let d = 1; d <= 28; d += 1) {
      expect(sep.slots[d - 1]!.at).toEqual(oct.slots[d - 1]!.at);
      expect(sep.slots[d - 1]!.at).toEqual(feb.slots[d - 1]!.at);
      expect(sep.slots[d - 1]!.date).toBe(`2026-09-${String(d).padStart(2, "0")}`);
    }
    expect(sep.slots[30]!.date).toBeNull();
    expect(feb.slots[28]!.date).toBeNull();
    // Every stop of the chapter is on the slot of its own day, and nowhere else.
    for (const stop of board.stops.filter((s) => s.chapterId === "2026-09")) {
      const holders = sep.slots.filter((s) => s.stopIds.includes(stop.id));
      expect(holders.map((s) => s.slot), stop.id).toEqual([Number(stop.date.slice(8, 10))]);
    }
  });

  it("stands toys on coin stacks whose rings are exactly ringsFor; income on the island side, bills on the sea side", () => {
    const byId = stopsById();
    for (const chapter of board.chapters) {
      const clock = layoutClock(board, chapter.id);
      for (const slot of clock.slots) {
        expect(slot.items.length).toBeLessThanOrEqual(2);
        expect(slot.more).toBe(Math.max(0, slot.stopIds.length - 2));
        expect(slot.needsYou).toBe(slot.stopIds.some((id) => isToCheck(byId.get(id)!)));
        for (const item of slot.items) {
          const stop = byId.get(item.stopId)!;
          const want = directionOf(stop) === "none" ? null : ringsFor(stop.amountBasis === "unknown" ? null : stop.amountCents, "month");
          if (!want) { expect(item.stack, stop.id).toBeNull(); continue; }
          expect(item.stack!.rings).toEqual(want);
          expect(item.stack!.fill).toBe(isRecorded(stop) ? "solid" : "see-through");
          expect(item.stack!.heightDu).toBeCloseTo(Math.max(0.012, want.drawnRings * RING_HEIGHT_DU.month), 9);
          if (slot.items.length === 1) expect(Math.sign(item.radial)).toBe(directionOf(stop) === "in" ? -1 : 1);
        }
        const kinds = slot.items.map((i) => directionOf(byId.get(i.stopId)!));
        if (kinds.length === 2 && kinds.includes("in") && kinds.includes("out")) {
          for (const i of slot.items) expect(i.radial < 0).toBe(directionOf(byId.get(i.stopId)!) === "in");
        }
      }
    }
  });

  it("draws no stack for a null or unknown amount (never zero), one flat coin for a known $0, and caps at 30 rings", () => {
    const base = board.stops.find((s): s is Extract<Stop, { kind: "commitment" }> => s.kind === "commitment")!;
    expect(stackFor({ ...base, amountCents: null, amountBasis: "unknown" }, "month")).toBeNull();
    expect(stackFor({ ...base, amountCents: 5000, amountBasis: "unknown" }, "month")).toBeNull();
    expect(stackFor({ ...base, amountCents: undefined }, "month")).toBeNull();
    const zero = stackFor({ ...base, amountCents: 0, amountBasis: "scheduled" }, "month")!;
    expect(zero.rings.rings).toBe(0);
    expect(zero.heightDu).toBeGreaterThan(0);
    const huge = stackFor({ ...base, amountCents: 1_000_000, amountBasis: "scheduled" }, "month")!;
    expect(huge.rings).toEqual({ rings: 100, drawnRings: STACK_RULER.maxRings, capped: true });
    expect(huge.heightDu).toBeCloseTo(STACK_RULER.maxRings * RING_HEIGHT_DU.month, 9);
    // A goal (a target) never gets a stack.
    const goal = board.stops.find((s) => s.kind === "plan");
    if (goal) expect(stackFor(goal, "month")).toBeNull();
    // A null-amount stop on the board lays out with no stack at its slot.
    const nulled: JourneyBoard = { ...board, stops: board.stops.map((s) => (s.id === base.id ? { ...s, amountCents: null, amountBasis: "unknown" } as Stop : s)) };
    const slot = layoutClock(nulled, base.chapterId).slots.find((s) => s.stopIds.includes(base.id))!;
    const item = slot.items.find((i) => i.stopId === base.id);
    if (item) expect(item.stack).toBeNull();
  });

  it("puts the bus at today only in today's chapter, and picks a toy per kind", () => {
    const sep = layoutClock(board, "2026-09"), oct = layoutClock(board, "2026-10");
    expect(sep.todaySlot).toBe(28);
    expect(sep.bus).not.toBeNull();
    expect(oct.bus).toBeNull();
    const kinds = new Set(board.stops.map(propKindFor));
    expect(kinds.has("pay")).toBe(true);
    expect(kinds.has("fund")).toBe(true);
    const fund = board.stops.find((s) => s.kind === "income" && s.origin === "fund-estimate")!;
    expect(propKindFor(fund)).toBe("fund");
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("layoutWeek (Week)", () => {
  it("lays Mon–Sun on the baked Year Walk: every tile within 25 m of it, in order, sized today > money > stone", () => {
    const week = layoutWeek(board, land, frame);
    expect(week.tiles.map((t) => t.date)).toEqual(board.week.days.map((d) => d.date));
    expect(week.from).toBe("2026-09-28");
    const walk = land.yearWalk.flatMap((w) => w.points.map((p) => [p[0], p[2]] as Point2));
    const stretches = land.yearWalk.map((w) => w.points.map((p) => [p[0], p[2]] as Point2));
    for (const tile of week.tiles) {
      const d = Math.min(...stretches.map((s) => distToLine(s, tile.at[0], tile.at[1], false)));
      expect(d, tile.date).toBeLessThanOrEqual(25);
    }
    expect(walk.length).toBeGreaterThan(10);
    for (let i = 1; i < week.tiles.length; i += 1) expect(week.tiles[i]!.arc).toBeGreaterThan(week.tiles[i - 1]!.arc);
    const today = week.tiles.find((t) => t.size === "today")!, money = week.tiles.find((t) => t.size === "money")!, stone = week.tiles.find((t) => t.size === "stone")!;
    expect(today.edgeDu).toBeGreaterThan(money.edgeDu);
    expect(money.edgeDu).toBeGreaterThan(stone.edgeDu);
    expect(stone.empty || stone.stopIds.every((id) => directionOf(stopsById().get(id)!) === "none")).toBe(true);
  });

  it("turns the month at the station: Wed 30 Sep and Thu 1 Oct stand either side of the Sep station's arc", () => {
    const week = layoutWeek(board, land, frame);
    const i = week.tiles.findIndex((t) => t.date === "2026-10-01");
    expect(week.tiles[i - 1]!.arc).toBeLessThan(week.stationArc);
    expect(week.tiles[i]!.arc).toBeGreaterThan(week.stationArc);
  });

  it("puts the to-check pile on ONE tile with its count, on dry free ground beside Monday; nothing shown twice", () => {
    const week = layoutWeek(board, land, frame);
    expect(week.pile).not.toBeNull();
    expect(week.pile!.stopIds).toEqual(board.week.pileStopIds);
    expect(week.pile!.count).toBe(board.week.pileStopIds.length);
    const [x, y] = week.pile!.at;
    expect(inPoly(land.coastline, x, y)).toBe(true);
    expect(land.water.some((w) => inPoly(w.outline, x, y))).toBe(false);
    expect(planar(week.pile!.at, week.tiles[0]!.at)).toBeLessThan(430);
    for (const t of week.tiles) for (const id of t.stopIds) expect(week.pile!.stopIds).not.toContain(id);
    const byId = stopsById();
    for (const t of week.tiles) expect(t.needsYou).toBe(t.stopIds.some((id) => isToCheck(byId.get(id)!)));
    expect(week.tiles.filter((t) => t.next).map((t) => t.date)).toEqual(board.digest.nextLeavingStopId ? [byId.get(board.digest.nextLeavingStopId)!.date] : []);
  });

  it("follows the land: a rerouted Year Walk moves the trail and the tiles", () => {
    const moved: JourneyLandData = { ...land, yearWalk: land.yearWalk.map((w) => ({ ...w, points: w.points.map((p) => [p[0] + 30, p[1], p[2] - 20] as const) as unknown as typeof w.points })) };
    const a = layoutWeek(board, land, frame), b = layoutWeek(board, moved, frame);
    // A 36 m shift of the walk (the stations stay): Monday re-projects onto the moved walk (≈17 m on the baked land with
    // L2's enclosing-circle frame), well beyond any rounding.
    expect(planar(b.tiles[0]!.at, a.tiles[0]!.at)).toBeGreaterThan(10);
    expect(b.trail[0]).not.toEqual(a.trail[0]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("layoutYear (Year)", () => {
  it("rings twelve minis by calendar month, January north, with Year-ruler stacks side by side (recorded, not recorded)", () => {
    const year = layoutYear(board);
    expect(year.minis.map((m) => m.chapterId)).toEqual(board.chapters.map((c) => c.id));
    for (const m of year.minis) {
      expect(Math.hypot(m.at[0], m.at[1])).toBeCloseTo(YEAR_RING_DU, 6);
      const row = board.year.find((y) => y.chapterId === m.chapterId)!;
      const solid = m.stack.find((s) => s.fill === "solid"), open = m.stack.find((s) => s.fill === "see-through");
      expect(solid?.rings ?? null).toEqual(row.outRecordedCents > 0 ? ringsFor(row.outRecordedCents, "year") : null);
      expect(open?.rings ?? null).toEqual(row.outOpenCents > 0 ? ringsFor(row.outOpenCents, "year") : null);
      expect(m.toCheck).toBe(row.toCheck);
      expect(m.kept).toBe(row.kept);
    }
    const jan = year.minis.find((m) => m.month === 1)!;
    expect(jan.at[1]).toBeLessThan(0);
    expect(jan.treatment).toBe("empty");
    expect(year.minis.find((m) => m.chapterId === "2026-10")!.treatment).toBe("future");
    expect(year.minis.find((m) => m.chapterId === "2026-09")!.treatment).toBe("open");
    expect(year.minis.find((m) => m.chapterId === "2026-08")!.kept).toBe(true);
    // Mini dots sit at the same day slots as the Month clock.
    const sep = year.minis.find((m) => m.chapterId === "2026-09")!;
    expect(sep.dots.length).toBe(board.stops.filter((s) => s.chapterId === "2026-09").length);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("levels: one pull t 0→2", () => {
  const view = { width: 1100, height: 800, safe: NO_INSET, focus: { target: [0, 0, 0] as [number, number, number], zoom: 1 }, week: null, dive: null };
  it("interpolates the camera Year → Month → Week continuously, Year farthest, Week a dive onto the trail", () => {
    const wk = layoutWeek(board, land, frame);
    const W = weekFrame(wk.tiles.map((t) => [(t.at[0] - frame.centre[0]) * frame.scale, (t.at[1] - frame.centre[1]) * frame.scale] as Point2), wk.yaw, 0.5);
    const v = { ...view, week: W };
    const year = cameraAt(LEVEL_T.year, v), month = cameraAt(LEVEL_T.month, v), week = cameraAt(LEVEL_T.week, v);
    expect(year.distance).toBeGreaterThan(month.distance);
    expect(month.distance).toBeGreaterThan(week.distance);
    expect(month.elevationDeg).toBe(JOURNEY_DIORAMA.elevationDeg);
    expect(year.yearScale).toBeCloseTo(1, 6);
    expect(month.yearScale).toBeLessThan(0.01);
    expect(year.worldScale).toBeCloseTo(0.25, 6);
    let prev = cameraAt(0, v).distance;
    for (let t = 0.05; t <= 2.0001; t += 0.05) {
      const d = cameraAt(t, v).distance;
      expect(Math.abs(d - prev) / prev, `t ${t.toFixed(2)}`).toBeLessThan(0.25);
      prev = d;
    }
    expect(cameraAt(-3, v).distance).toBeCloseTo(year.distance, 6);
    expect(cameraAt(9, v).distance).toBeCloseTo(week.distance, 6);
    // The phone composition looks from higher up.
    expect(cameraAt(1, { ...v, width: 390, height: 844 }).elevationDeg).toBeGreaterThan(month.elevationDeg);
  });

  it("pops by t: month props shrink as Week arrives, tiles pop in after; reduced motion makes the pull a cut", () => {
    const m = popsAt(1, false), w = popsAt(2, false);
    expect(m.monthProp(0)).toBe(1);
    expect(w.monthProp(1)).toBe(0);
    expect(m.weekVisible).toBe(false);
    expect(w.weekTile(1)).toBe(1);
    expect(m.calm).toBe(0);
    expect(w.calm).toBe(1);
    const r = popsAt(1.6, true);
    expect([0, 1]).toContain(r.weekTile(0.5));
    expect(levelTransition(0, 2, true).duration).toBe(0);
    expect(levelTransition(0, 2, true).at(0)).toBe(2);
    const anim = levelTransition(1, 2, false);
    expect(anim.duration).toBeGreaterThan(0);
    expect(anim.at(anim.duration / 2)).toBeCloseTo(1.5, 6);
    expect(anim.at(anim.duration)).toBe(2);
  });

  it("turns a chapter as one parameter: one full spin in its direction, swapped at u 0.5, props out then in", () => {
    const a = chapterTurn(0, 1), half = chapterTurn(0.5, 1), end = chapterTurn(1, 1), back = chapterTurn(1, -1);
    expect(a.yaw).toBe(0);
    expect(end.yaw).toBeCloseTo(Math.PI * 2, 6);
    expect(back.yaw).toBeCloseTo(-Math.PI * 2, 6);
    expect(chapterTurn(0.49, 1).swapped).toBe(false);
    expect(half.swapped).toBe(true);
    expect(chapterTurn(0.45, 1).prop(0)).toBeLessThan(0.01);
    expect(end.prop(0)).toBe(1);
    expect(end.lift).toBeCloseTo(0, 6);
  });
});

describe("labels: at most three", () => {
  it("names today, the next leaving and the selection — never more — and Year none", () => {
    const sel = board.stops.find((s) => s.chapterId === "2026-09" && s.kind === "commitment")!.id;
    const month = mapLabels(board, "month", "2026-09", sel);
    expect(month.map((l) => l.role)).toEqual(["today", "next", "selected"]);
    expect(month[0]!.id).toBe(JOURNEY_MAP_MARKS.piece);
    expect(month[1]!.id).toBe(board.digest.nextLeavingStopId);
    expect(mapLabels(board, "month", "2026-10", null)).toEqual([]);
    expect(mapLabels(board, "year", "2026-09", sel)).toEqual([]);
    const week = mapLabels(board, "week", "2026-09", null);
    expect(week[0]!.id).toBe(board.today);
    expect(week.length).toBeLessThanOrEqual(MAP_LABEL_LIMIT);
    const cands = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, x: 40 + i * 100, y: 300, width: 80, height: 24, rank: "commitment" as const }));
    const placed = placeLabels(cands, { width: 1000, height: 600, limit: MAP_LABEL_LIMIT });
    expect(placed.filter((p) => p.placed)).toHaveLength(MAP_LABEL_LIMIT);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The scene, through the renderer lease's `rendererFactory` seam, on a stub land handle (L2's clay land stands in).

function stubLand(data: JourneyLandData): JourneyLandHandle & { setCalm: ReturnType<typeof vi.fn>; disposed: () => boolean } {
  const fr = frameFromCoast(data.coastline);
  const tr = data.terrain;
  const raw = (x: number, y: number) => {
    const fx = Math.min(Math.max(x / tr.step, 0), tr.columns - 1.001), fy = Math.min(Math.max(y / tr.step, 0), tr.rows - 1.001);
    const c = Math.floor(fx), r = Math.floor(fy), u = fx - c, v = fy - r, i = r * tr.columns + c;
    const h = tr.heights;
    return (h[i]! * (1 - u) + h[i + 1]! * u) * (1 - v) + (h[i + tr.columns]! * (1 - u) + h[i + tr.columns + 1]! * u) * v;
  };
  const isLand = (x: number, y: number) => inPoly(data.coastline, x, y) && !data.water.some((w) => inPoly(w.outline, x, y));
  const group = new THREE.Group();
  const mini = new THREE.CircleGeometry(JOURNEY_DIORAMA.islandUnits, 24);
  let gone = false;
  return {
    group, data, frame: fr,
    worldToBoard: (x, y) => [x, raw(x, y), y], heightAt: raw, rawHeightAt: raw, isLand,
    stationAt: (id) => { const s = data.stations.find((st) => st.id === id)!; return [s.anchor[0], s.height, s.anchor[1]]; },
    setTheme: vi.fn(), setHomes: vi.fn(),
    dioramaGroundAt: (x, y) => toDiorama(fr, x, y, isLand(x, y) ? raw(x, y) : 0)[1],
    miniGeometry: () => mini,
    stats: () => ({ triangles: 0, drawCalls: 0 }),
    dispose: () => { gone = true; mini.dispose(); },
    setCalm: vi.fn(),
    disposed: () => gone,
  } as JourneyLandHandle & { setCalm: ReturnType<typeof vi.fn>; disposed: () => boolean };
}

function fakeRenderer() {
  const canvas = document.createElement("canvas");
  const calls = { render: 0, dispose: 0, lost: 0 };
  const renderer = {
    domElement: canvas,
    render: vi.fn(() => { calls.render += 1; }),
    dispose: vi.fn(() => { calls.dispose += 1; }),
    forceContextLoss: vi.fn(() => { calls.lost += 1; }),
    setPixelRatio: vi.fn(), setSize: vi.fn(), setClearColor: vi.fn(), setRenderTarget: vi.fn(), setScissorTest: vi.fn(),
    autoClear: true, shadowMap: { enabled: false, type: 0 }, outputColorSpace: "", toneMapping: 0,
  } as unknown as THREE.WebGLRenderer;
  return { renderer, calls };
}

const pendingFrames: FrameRequestCallback[] = [];
function flushFrames(time = 0, rounds = 4) {
  for (let guard = 0; guard < rounds && pendingFrames.length; guard += 1) for (const cb of pendingFrames.splice(0)) cb(time);
}
type Spies = { onAnchors: ReturnType<typeof vi.fn>; onPick: ReturnType<typeof vi.fn>; onLevel: ReturnType<typeof vi.fn>; onReady: ReturnType<typeof vi.fn>; onLost: ReturnType<typeof vi.fn> };
type Harness = { scene: MapSceneHandle; land: ReturnType<typeof stubLand>; spies: Spies; calls: ReturnType<typeof fakeRenderer>["calls"]; canvas: HTMLCanvasElement; last: () => MarkAnchor[]; host: HTMLElement };
const opened: Harness[] = [];
function mount(extra: Partial<MapSceneOptions> = {}, b: JourneyBoard = board): Harness {
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => { pendingFrames.push(cb); return pendingFrames.length; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  flushFrames();
  const made = fakeRenderer();
  const landHandle = stubLand(land);
  let last: MarkAnchor[] = [];
  const spies = { onAnchors: vi.fn((a: MarkAnchor[]) => { last = a; }), onPick: vi.fn(), onLevel: vi.fn(), onReady: vi.fn(), onLost: vi.fn() };
  const host = document.createElement("div");
  const scene = createJourneyMapScene(host, {
    land: landHandle, board: b, theme: "classic", tier: "lite", reducedMotion: true, t: LEVEL_T.month, chapterId: b.currentChapterId,
    ...spies, rendererFactory: () => made.renderer, shared: false, size: { width: 1100, height: 800 }, devicePixelRatio: 1, ...extra,
  });
  const h = { scene, land: landHandle, spies, calls: made.calls, canvas: made.renderer.domElement, last: () => last, host };
  opened.push(h);
  return h;
}
afterEach(() => { vi.unstubAllGlobals(); });
afterAll(() => { for (const h of opened) h.scene.dispose(); });

/** Every JourneyBoardActions member as a spy: the scene must never reach one. */
function actionSpies(): JourneyBoardActions & Record<string, ReturnType<typeof vi.fn>> {
  const names = ["openRecord", "openBillPaid", "openPlace", "openCampfire", "openWeeklySitdown", "openHomeBook", "openEraPlanner", "openKitty", "openCalendar", "openBooks", "openDueReview", "enterHorizon", "back", "openAllTools", "chooseSimpleView"];
  return Object.fromEntries(names.map((n) => [n, vi.fn()])) as never;
}

describe("map scene", () => {
  it("draws once, calls onReady once, reports anchors for slots, stops, the bus and Hercules at Month", () => {
    const h = mount();
    h.scene.renderNow();
    h.scene.renderNow();
    expect(h.spies.onReady).toHaveBeenCalledTimes(1);
    const a = new Map(h.last().map((x) => [x.id, x] as const));
    expect(a.get(JOURNEY_MAP_MARKS.piece)?.visible).toBe(true);
    expect(a.has(JOURNEY_MAP_MARKS.hercules)).toBe(true);
    for (const s of board.stops.filter((st) => st.chapterId === "2026-09")) expect(a.has(s.id), s.id).toBe(true);
    expect(a.get("2026-09-28")?.visible).toBe(true);
    expect(h.canvas.getAttribute("aria-hidden")).toBe("true");
    const stats = h.scene.stats();
    expect(stats.drawCalls).toBeGreaterThan(0);
    expect(stats.drawCalls).toBeLessThan(260);
  });

  it("levels, selecting and picking call no action and post nothing; reduced motion cuts straight to the level", () => {
    const actions = actionSpies();
    const h = mount();
    h.scene.renderNow();
    h.scene.setSelection(board.stops.find((s) => s.chapterId === "2026-09" && s.kind === "commitment")!.id);
    h.scene.setLevel(LEVEL_T.week, true);
    expect(h.scene.view().t).toBe(LEVEL_T.week); // a cut, not an animation
    h.scene.renderNow();
    const wk = new Map(h.last().map((x) => [x.id, x] as const));
    expect(wk.get(board.today)?.visible).toBe(true);
    expect(wk.get(JOURNEY_MAP_MARKS.pile)?.visible).toBe(true);
    expect(h.land.setCalm).toHaveBeenCalled();
    // One contract method: (the week's calm request, amount). The trail is the Week trail; tiles stay clear.
    const [calm, amount] = h.land.setCalm.mock.calls.at(-1)!;
    expect(amount).toBe(1);
    expect(calm.trail.length).toBeGreaterThan(1);
    expect(calm.clear.length).toBeGreaterThanOrEqual(7);
    h.scene.setLevel(LEVEL_T.year, true);
    h.scene.renderNow();
    const yr = h.last().filter((x) => x.visible).map((x) => x.id);
    expect(yr.filter((id) => /^\d{4}-\d{2}$/.test(id)).sort()).toEqual(board.chapters.map((c) => c.id).sort());
    h.scene.setChapter("2026-10", 1, true);
    h.scene.setLevel(LEVEL_T.month, true);
    expect(h.scene.view().chapterId).toBe("2026-10");
    expect(h.scene.view().turning).toBe(false);
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
    // The level setter does not echo through onLevel (only the canvas pull reports).
    expect(h.spies.onLevel).not.toHaveBeenCalled();
  });

  it("a canvas tap reports every stop id on the slot (the UI asks \"Which one?\"); a wheel moves the pull and reports it", () => {
    const h = mount();
    h.scene.renderNow();
    const slot = layoutClock(board, "2026-09").slots.find((s) => s.stopIds.length > 1)!;
    const anchor = h.last().find((x) => x.id === slot.date)!;
    const ev = (type: string, x: number, y: number, id = 1) => { const e = new Event(type) as PointerEvent; Object.assign(e, { clientX: x, clientY: y, pointerId: id }); h.canvas.dispatchEvent(e); };
    ev("pointerdown", anchor.x, anchor.y);
    ev("pointerup", anchor.x, anchor.y);
    expect(h.spies.onPick).toHaveBeenCalledTimes(1);
    const ids = h.spies.onPick.mock.calls[0]![0] as string[];
    for (const id of slot.stopIds) expect(ids).toContain(id);
    const wheel = new Event("wheel") as WheelEvent;
    Object.assign(wheel, { deltaY: 100, deltaMode: 0, clientX: 500, clientY: 400 });
    h.canvas.dispatchEvent(wheel);
    expect(h.spies.onLevel).toHaveBeenCalled();
    expect(h.spies.onLevel.mock.calls.at(-1)![0]).toBeLessThan(1);
  });

  it("turns a chapter with one spin when motion is allowed, and a cut when reduced", () => {
    vi.stubGlobal("matchMedia", undefined);
    const h = mount({ reducedMotion: false });
    h.scene.renderNow();
    h.scene.setChapter("2026-10", 1, true);
    expect(h.scene.view().turning).toBe(true);
    const r = mount({ reducedMotion: true });
    r.scene.setChapter("2026-10", 1, true);
    expect(r.scene.view().turning).toBe(false);
    expect(r.scene.view().chapterId).toBe("2026-10");
  });

  it("hands ground points back in concept metres (fromDiorama), null off the island", () => {
    const h = mount();
    h.scene.renderNow();
    expect(h.scene.groundAt(2, 2)).toBeNull();
    let found: { x: number; y: number } | null = null;
    for (let y = 300; y <= 500 && !found; y += 20) for (let x = 450; x <= 650 && !found; x += 20) found = h.scene.groundAt(x, y);
    expect(found).not.toBeNull();
    expect(h.land.isLand(found!.x, found!.y)).toBe(true);
    expect(found!.x).toBeGreaterThan(0);
    expect(found!.x).toBeLessThan(land.extent.w);
  });

  it("rebuilds on theme and data, idles with no frames, sleeps, and releases the lease on dispose", () => {
    const h = mount();
    h.scene.renderNow();
    flushFrames(0, 10);
    pendingFrames.length = 0;
    const before = h.calls.render;
    flushFrames();
    expect(h.calls.render).toBe(before); // idle: nothing queued
    for (const theme of JOURNEY_THEMES) { h.scene.setTheme(theme); h.scene.renderNow(); }
    h.scene.setBoard(deriveJourneyBoard(emptyBoardHousehold(), BIANCA, FIXTURE_TODAY) as JourneyBoard);
    h.scene.renderNow();
    h.scene.sleep();
    pendingFrames.length = 0;
    h.scene.setSelection("2026-09-28");
    expect(pendingFrames.length).toBe(0);
    h.scene.dispose();
    expect(h.calls.dispose).toBe(1);
    expect(h.calls.lost).toBe(1);
    h.scene.dispose();
    expect(h.calls.dispose).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe("BoardFlat (SVG twin) at all three levels", () => {
  const ids = (html: string) => new Set([...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]!));
  it("carries the same ids as the 3D anchors: slots and stops (Month), minis (Year), tiles, stops and the pile (Week)", () => {
    const month = renderToStaticMarkup(createElement("svg", null, createElement(BoardFlat, { board, land, level: "month", theme: "classic" })));
    const m = ids(month);
    for (const s of board.stops.filter((st) => st.chapterId === "2026-09")) expect(m.has(s.id), s.id).toBe(true);
    expect(m.has(JOURNEY_MAP_MARKS.piece)).toBe(true);
    expect(m.has("2026-09-28")).toBe(true);
    expect(month).toContain('data-needs-you=""');
    const year = renderToStaticMarkup(createElement("svg", null, createElement(BoardFlat, { board, land, level: "year", theme: "taylor" })));
    for (const c of board.chapters) expect(ids(year).has(c.id)).toBe(true);
    expect(year).toContain('data-treatment="empty"');
    expect(year).toContain('data-kept=""');
    const week = renderToStaticMarkup(createElement("svg", null, createElement(BoardFlat, { board, land, level: "week", theme: "newfoundland" })));
    const w = ids(week);
    for (const d of board.week.days) expect(w.has(d.date)).toBe(true);
    expect(w.has(JOURNEY_MAP_MARKS.pile)).toBe(true);
    for (const id of board.week.pileStopIds) expect(w.has(id)).toBe(true);
    // Solid and see-through stacks both appear (recorded vs not), never colour alone (a dashed outline).
    expect(month).toContain('data-stack="solid"');
    expect(month).toContain('data-stack="see-through"');
    expect(month).toContain('stroke-dasharray="3 2"');
    // No words on the drawing: the UI's buttons carry them.
    expect(month).not.toMatch(/<text/);
  });

  it("frames each level from the land's own coastline", () => {
    const m = flatViewBoxFor("month", land), y = flatViewBoxFor("year", land);
    expect(y[2]).toBeGreaterThan(m[2]);
    const shifted = { ...land, coastline: land.coastline.map((p) => [p[0] + 100, p[1]] as Point2) };
    expect(flatViewBoxFor("month", shifted)[0]).toBeCloseTo(m[0] + 100, 6);
  });

  it("reads L2's palettes for all three themes (no board copy)", () => {
    for (const t of JOURNEY_THEMES) expect(boardPalette(t)).toBe(JOURNEY_CLAY_PALETTES[t]);
    expect(boardPalette("newfoundland").plinthFinish).toBe("clapboard");
  });
});
