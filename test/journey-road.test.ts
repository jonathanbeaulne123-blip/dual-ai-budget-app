import { BRIDGE_CAST } from '../src/harbour/horizon/land/bridges/catalog';
/**
 * The road on the Journey land (ROAD.md §7, Jonathan's brief §8): bridges drawn as bridges, covered stretches dimmed,
 * boulevard reaches as a wider road with a planted band — extracted from the REAL baked index + journey terrain LOD in
 * public/, with and without corridors, slim round-trip, and the board overlay (route, stations, spaces) unchanged and
 * never drawn over.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { compressHeight, STATION_IDS, type JourneyLandData, type Point2 } from "../src/journey/contracts.ts";
import {
  buildJourneyLand, BRIDGES_NAME, DECK_LINES_NAME, decodeJourneyLandSlim, encodeJourneyLandSlim, extractJourneyLand, journeyLandFlatData,
  JourneyLandFlat, JOURNEY_LAND_EXTRAS, JOURNEY_LAND_SLIM_FORMAT, LAND_EXTRA_KEYS, MAJOR_LINES_NAME, planRoad, createLandSurface,
} from "../src/journey/land/index.ts";
import { DECK_LINE_LIFT, locateOnBridge, RAMP_EU } from "../src/journey/land/road.ts";
import { layoutRoute } from "../src/journey/board/index.ts";
import { PAD_UNIT_MAX } from "../src/journey/board/scene.ts";
import { RENDER_ORDER } from "../src/journey/board/layers.ts";
import { deriveJourneyBoard } from "../src/journey/model/index.ts";
import { parseHorizonIndex } from "../src/house/world/horizonAssets.ts";
type LoadedWorld = ReturnType<typeof parseHorizonIndex>;
import { decodeTerrainAsset } from "../src/harbour/horizon/land/terrain/asset.ts";
import type { Corridor, CorridorContext, CorridorSide, CorridorStation } from "../src/harbour/horizon/land/corridor/types.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BIANCA, FIXTURE_TODAY, journeyDemoHousehold } from "./fixtures/journey-board-households.ts";
import { createHash } from "node:crypto";

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const INDEX_GZ = readFileSync("public/horizon/world/horizon-geo-1.index.json.gz");
const TERRAIN = ab(readFileSync("public/horizon/terrain/horizon-geo-1.bin"));
const SLIM = JSON.parse(gunzipSync(readFileSync("public/horizon/world/horizon-geo-1.journey.json.gz")).toString()) as { format: number; land: unknown };
const freshWorld = () => parseHorizonIndex(ab(INDEX_GZ));
const journeyTerrain = () => decodeTerrainAsset(TERRAIN, "journey");
const planar = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
const segDist = (p: Point2, a: Point2, b: Point2) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.min(Math.max(((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2, 0), 1) : 0;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dz - p[1]);
};
const polyDist = (p: Point2, pts: readonly Point2[]) => pts.slice(1).reduce((m, q, i) => Math.min(m, segDist(p, pts[i]!, q)), Infinity);

/** The road's named spans (MAP.md / ROAD.md §3) and the drawn road each one carries. */
const SPANS: Record<string, string> = { quayBridge: "V01", bightBridge: "V01", highSpan: "VG", mountainRoadCanalBridge: "V03" };

let world: LoadedWorld;
let land: JourneyLandData;
beforeAll(() => {
  world = freshWorld();
  land = extractJourneyLand(world, journeyTerrain());
}, 60_000);

// ---------------------------------------------------------------------------------------------------------------------
// A synthetic corridor over the real V01 (the corridor itself lands in a parallel track): stations every ~2 eu along the
// baked V01 points, R10-like boulevard reach (with a median on part of it and a structure station that breaks it), and a
// boulevard reach that wraps the loop's start.

const side = (): CorridorSide => ({ edge: "shoulder", guard: "none", drop: 0, waterEu: null, paved: 5 });
function syntheticCorridor(w: LoadedWorld): Corridor {
  const v01 = w.lines.find((l) => l.id === "V01")!;
  const pts = v01.points;
  const stations: CorridorStation[] = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (i > 0) s += planar([a[0], a[2]], [pts[i - 1]![0], pts[i - 1]![2]]);
    const len = planar([a[0], a[2]], [b[0], b[2]]) || 1;
    stations.push({ s, at: [a[0], a[1], a[2]], tangent: [(b[0] - a[0]) / len, (b[2] - a[2]) / len], grade: 0, context: "open", reachId: "R6", half: 4, left: side(), right: side() });
  }
  const length = s;
  // Boulevard: 1100…1500 eu of arc (a straight run), median on 1300…1400, one structure station at ~1200 breaks it.
  // Wrapping boulevard: the last 60 eu and the first 60 eu of the loop.
  const set = (from: number, to: number, context: CorridorContext, reachId: string) => {
    for (const st of stations) if (st.s >= from && st.s <= to) { st.context = context; st.reachId = reachId; }
  };
  set(1100, 1500, "boulevard", "R10");
  for (const st of stations) if (st.s >= 1300 && st.s <= 1400) st.median = { half: 1.5 };
  const breaker = stations.find((st) => st.s >= 1200)!;
  breaker.context = "structure"; breaker.structureId = "duneCulvert";
  set(length - 60, length, "boulevard", "R13");
  set(0, 60, "boulevard", "R13");
  return {
    id: "V01", closed: true, step: 2, stations,
    reaches: [
      { id: "R6", label: "West Rise", from: 0, to: length, context: "open" },
      { id: "R10", label: "Long Sands Boulevard", from: 1100, to: 1500, context: "boulevard" },
      { id: "R13", label: "Harbour Avenue", from: length - 60, to: 60, context: "boulevard" },
    ],
    markings: [], guards: [], lamps: [], planting: [], stops: [],
  };
}

describe("extract: bridges and covered stretches", () => {
  it("draws the road's named spans as bridges, each carrying its road, with the deck's own axis and width", () => {
    const byId = new Map((land.bridges ?? []).map((b) => [b.id, b]));
    expect([...byId.keys()].sort()).toEqual(BRIDGE_CAST.map(b=>b.id).sort());
    for (const [id, road] of Object.entries(SPANS)) {
      const b = byId.get(id)!, bed = world.beds.find((x) => x.id === `structure.${id}`)!;
      expect(b.lineIds, id).toContain(road);
      expect(b.width, id).toBe(bed.width);
      // The axis IS the structure bed (a rebake that moves the span moves the drawn bridge; nothing is cached).
      expect(b.axis.length, id).toBe(bed.points.length);
      b.axis.forEach((p, i) => { for (let k = 0; k < 3; k++) expect(p[k], `${id}[${i}]`).toBeCloseTo(bed.points[i]![k]!, 1); });
    }
    // The wide decks carry their skate lane too; what passes under a deck is broken beneath it.
    expect(byId.get("bightBridge")!.lineIds).toEqual(["S2", "V01"]);
    expect(byId.get("quayBridge")!.lineIds).toEqual(["S3", "V01"]);
    expect(byId.get("bightBridge")!.underIds).toContain("FERRY");
    expect(byId.get("highSpan")!.underIds).toContain("S1");
    // The bridge cast now includes walking landmarks; the unnamed companion stays quiet.
    for (const id of ["hollowBridge", "gardenWalkBridge"]) expect(byId.has(id)).toBe(true);
    expect(byId.has("reachFootbridge")).toBe(false);
  });

  it("marks the Prow gallery and the Mountain Road tunnel as covered, portal to portal", () => {
    const covers = land.covers ?? [];
    expect(covers.map((c) => `${c.id}:${c.kind}:${c.lineId}`)).toEqual(["mountainRoadTunnel:tunnel:V03", "prowTunnel:gallery:V01"]);
    const mouths = new Map((world.collision?.mouths ?? []).map((m) => [m.id, m]));
    for (const c of covers) {
      c.portals.forEach((p, n) => {
        const m = mouths.get(`${c.id}.portal.${n}`)!;
        const centre: Point2 = [m.outline.reduce((a, q) => a + q[0], 0) / m.outline.length, m.outline.reduce((a, q) => a + q[1], 0) / m.outline.length];
        expect(planar(p, centre), `${c.id} portal ${n}`).toBeLessThan(6);
      });
    }
  });

  it("without corridors: no boulevards, and everything else is exactly what the same index extracts with corridors", () => {
    // The committed index carries the corridors (road main integration): boulevards come from them; strip them and nothing
    // else changes. A synthetic corridor alone still yields boulevards.
    const bare = freshWorld(); delete bare.corridors;
    const without = extractJourneyLand(bare, journeyTerrain());
    expect("boulevards" in without).toBe(false);
    const { boulevards, ...rest } = land;
    expect(boulevards?.length).toBeGreaterThan(0);
    expect(rest).toStrictEqual(without);
    const w = freshWorld();
    w.corridors = [syntheticCorridor(w)];
    expect(extractJourneyLand(w, journeyTerrain()).boulevards?.length).toBeGreaterThan(0);
  });
});

describe("extract: boulevard reaches from the corridor", () => {
  it("reads boulevard stations as runs (a structure station breaks one, a reach may wrap the loop), with the median flag", () => {
    const w = freshWorld();
    const corridor = syntheticCorridor(w);
    w.corridors = [corridor, { ...corridor, id: "notDrawn" }];
    const out = extractJourneyLand(w, journeyTerrain()).boulevards!;
    expect(out.map((b) => b.id)).toEqual(["V01:R10:0", "V01:R10:1", "V01:R13:0"]);
    expect(out.every((b) => b.lineId === "V01")).toBe(true);
    const [first, second, wrap] = out as [typeof out[0], typeof out[0], typeof out[0]];
    // The first R10 run ends at the structure station; the second begins after it and holds the median.
    expect(first.median).toBe(false);
    expect(second.median).toBe(true);
    // The wrapping run is one run across the loop's start, in order along the road.
    const v01 = land.lines.find((l) => l.id === "V01")!.points;
    expect(planar(wrap.points[0]!, v01[0]!)).toBeGreaterThan(20);
    expect(wrap.points.some((p) => planar(p, v01[0]!) < 3)).toBe(true);
    // Every boulevard point is on the drawn road.
    for (const b of out) for (const p of b.points) expect(polyDist(p, v01), b.id).toBeLessThan(LINE_TOLERANCE_FULL + 0.5);
  });
});
const LINE_TOLERANCE_FULL = 4;

describe("slim round-trip", () => {
  it("the baked slim file is this format and decodes to what the index extracts, bridges and covers included", () => {
    expect(SLIM.format).toBe(JOURNEY_LAND_SLIM_FORMAT);
    // Format 3 carries baked landmark identities for road and walking crossings.
    expect(JOURNEY_LAND_SLIM_FORMAT).toBe(3);
    const decoded = decodeJourneyLandSlim(SLIM);
    expect(decoded).toStrictEqual(land);
    expect(decoded.bridges?.length).toBe(10);
  });

  it("carries boulevards through encode → JSON → decode, and refuses malformed road fields", () => {
    const w = freshWorld();
    w.corridors = [syntheticCorridor(w)];
    const withCorridor = extractJourneyLand(w, journeyTerrain());
    const json = JSON.parse(JSON.stringify(encodeJourneyLandSlim(withCorridor, { index: "x", indexSha256: "a", terrainSha256: "b" }))) as { land: Record<string, unknown> };
    expect(decodeJourneyLandSlim(json)).toStrictEqual(withCorridor);
    const bad = (patch: Record<string, unknown>) => () => decodeJourneyLandSlim({ ...json, land: { ...json.land, ...patch } });
    for (const glyph of ["constructor", "toString", "missing"]) expect(bad({bridges:[{...withCorridor.bridges![0]!,landmark:{name:"Bridge",glyph,at:[0,0,0]}}]})).toThrow(/landmark/);
    expect(bad({ bridges: undefined })).toThrow(/bridges/);
    expect(bad({ covers: undefined })).toThrow(/covers/);
    expect(bad({ bridges: [{ ...withCorridor.bridges![0]!, lineIds: ["NOPE"] }] })).toThrow(/does not draw/);
    expect(bad({ boulevards: [{ id: "x", lineId: "NOPE", points: [[0, 0], [1, 1]], median: false }] })).toThrow(/malformed/);
    expect(() => decodeJourneyLandSlim({ ...json, format: 1 })).toThrow(/format/);
  });

  it("a rebake that moves a span's deck moves the drawn bridge and the road on it (no stale geometry)", () => {
    const w = freshWorld();
    const bed = w.beds.find((b) => b.id === "structure.bightBridge")!;
    bed.points = bed.points.map((p) => [p[0] + 3, p[1], p[2] - 2] as const);
    const moved = extractJourneyLand(w, journeyTerrain()).bridges!.find((b) => b.id === "bightBridge")!;
    expect(moved.axis[0]![0]).toBeCloseTo(bed.points[0]![0], 1);
    expect(moved.axis[1]![2]).toBeCloseTo(bed.points[1]![2], 1);
  });
});

describe("road plan: what is drawn where", () => {
  it("puts the carried road ON the deck, breaks what passes under it, and blends back to the ground past its ends", () => {
    const surface = createLandSurface(land);
    const plan = planRoad(land, surface, "full");
    const bight = plan.bridges.find((b) => b.id === "bightBridge")!;
    const deckTop = compressHeight(12);
    const onDeck = plan.deck.filter((r) => r.lineId === "V01").flatMap((r) => r.verts).filter((v) => { const w = locateOnBridge(bight, v.x, v.z); return w.along > 1 && w.along < bight.length - 1 && w.lateral < bight.half; });
    expect(onDeck.length).toBeGreaterThan(5);
    for (const v of onDeck) expect(v.y).toBeCloseTo(deckTop + DECK_LINE_LIFT, 3);
    // No ground run of V01 lies over the deck (it would paint the road on the water under the bridge).
    for (const r of plan.ground.filter((x) => x.lineId === "V01")) for (const v of r.verts) {
      const w = locateOnBridge(bight, v.x, v.z);
      expect(w.along > 0 && w.along < bight.length && w.lateral < bight.half, `${v.x},${v.z}`).toBe(false);
    }
    // The ramps end on the ground: every deck run starts and ends on a vertex at deck blend 0 (RAMP_EU past the deck),
    // unless the drawn line itself ends there (V03 ends at the Mountain Road's town lane, inside the canal bridge's ramp).
    expect(RAMP_EU).toBeGreaterThan(0);
    for (const r of plan.deck) {
      const line = land.lines.find((l) => l.id === r.lineId)!.points, ends = [line[0]!, line[line.length - 1]!];
      for (const v of [r.verts[0]!, r.verts[r.verts.length - 1]!]) if (!ends.some((e) => planar(e, [v.x, v.z]) < 0.01)) expect(v.deck, r.lineId).toBe(0);
    }
    // The ferry and the lower skate lane are broken under the Bight Bridge and the High Span.
    const high = plan.bridges.find((b) => b.id === "highSpan")!;
    const under = (lineId: string, b: typeof bight) => plan.ground.filter((r) => r.lineId === lineId).flatMap((r) => r.verts).filter((v) => { const w = locateOnBridge(b, v.x, v.z); return w.along > 0 && w.along < b.length && w.lateral < b.half; });
    expect(under("FERRY", bight)).toEqual([]);
    expect(under("S1", high)).toEqual([]);
  });

  it("dims and dashes the covered stretches with a notch at each portal, and leaves every other line as it was", () => {
    const plan = planRoad(land, createLandSurface(land), "full");
    const v01 = plan.ground.filter((r) => r.lineId === "V01").flatMap((r) => r.verts);
    expect(v01.some((v) => v.covered)).toBe(true);
    expect(v01.filter((v) => v.notch).length).toBeGreaterThanOrEqual(4);
    const v03 = plan.ground.filter((r) => r.lineId === "V03").flatMap((r) => r.verts);
    expect(v03.some((v) => v.covered)).toBe(true);
    // No boulevard without corridors (the same land with its boulevards stripped).
    const { boulevards: _b, ...plain } = land; void _b;
    const plainPlan = planRoad(plain as JourneyLandData, createLandSurface(plain as JourneyLandData), "full");
    expect([...plainPlan.ground, ...plainPlan.deck].every((r) => r.verts.every((v) => v.plant === 0))).toBe(true);
    // A line no bridge, cover or boulevard touches is draped exactly as before: surfaceAt + lift at the densified points.
    const surface = createLandSurface(land);
    const ore = plan.ground.find((r) => r.lineId === "ORE")!;
    for (const v of ore.verts) expect(v.y).toBeCloseTo(surface.surfaceAt(v.x, v.z) + 0.65, 6);
  });

  it("flags boulevard reaches (median / verges) when the corridor is there", () => {
    const w = freshWorld();
    w.corridors = [syntheticCorridor(w)];
    const withCorridor = extractJourneyLand(w, journeyTerrain());
    const plan = planRoad(withCorridor, createLandSurface(withCorridor), "full");
    const verts = plan.ground.filter((r) => r.lineId === "V01").flatMap((r) => r.verts);
    expect(verts.some((v) => v.plant === 1)).toBe(true);
    expect(verts.some((v) => v.plant === 2)).toBe(true);
  });
});

describe("the board overlay does not move and is never drawn over", () => {
  it("lays out the same route, stations, spaces and crossings with or without the road fields", () => {
    const board = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, FIXTURE_TODAY);
    const { bridges: _b, covers: _c, ...bare } = land;
    const w = freshWorld();
    w.corridors = [syntheticCorridor(w)];
    const withBoulevards = extractJourneyLand(w, journeyTerrain());
    const route = layoutRoute(board, land);
    expect(layoutRoute(board, bare as JourneyLandData)).toStrictEqual(route);
    expect(layoutRoute(board, withBoulevards)).toStrictEqual(route);
    // Pinned plan geometry of the baked board layout (x/z only: a rebake that changes terrain heights may lift the
    // route, it may not move it). Recorded on the pre-road land (format 1) at this branch's base.
    const q = (n: number) => Math.round(n * 1000) / 1000;
    const plan = {
      months: route.months.map((m) => [m.chapterId, m.stationId, q(m.at[0]), q(m.at[2])]),
      stretches: route.stretches.map((s) => [s.chapterId, s.points.map((p) => [q(p[0]), q(p[2])]), s.days.map((d) => [d.date, q(d.at[0]), q(d.at[2])])]),
      crossings: route.crossings.map((c) => [q(c.at[0]), q(c.at[1]), c.overChapterId, c.underChapterId]),
    };
    expect(createHash("sha256").update(JSON.stringify(plan)).digest("hex")).toBe("6fe908db734f176ae812099540e6174586d107fe860c59e639231d0b1b01bea3");
    expect(route.months.map((m) => m.stationId).sort()).toEqual([...STATION_IDS].sort());
  });

  it("keeps every bridge, cover and boulevard clear of every station pad at its largest (Sky) size", () => {
    // Month pads are 17 eu × the pad unit (≤ PAD_UNIT_MAX) in radius; bridges also reach out by their ramp and shadow.
    const padRadius = 17 * PAD_UNIT_MAX;
    const w = freshWorld();
    w.corridors = [syntheticCorridor(w)];
    const all = extractJourneyLand(w, journeyTerrain());
    for (const s of all.stations) {
      for (const b of all.bridges!) {
        const axis = b.axis.map((p) => [p[0], p[2]] as const);
        // All ten landmarks now include elevated inland walks. Absolute deck altitude
        // overestimates their shadow by the underlying hillside height; keep the
        // ramp bound here and test the actual rendered shadow triangles below.
        const reach = b.width / 2 + RAMP_EU;
        expect(polyDist(s.anchor, axis) - reach, `${b.id} vs ${s.id}`).toBeGreaterThan(padRadius);
      }
      for (const c of all.covers!) expect(polyDist(s.anchor, c.points), `${c.id} vs ${s.id}`).toBeGreaterThan(padRadius);
    }
    const drawn=buildJourneyLand(all,{theme:'classic',tier:'full',homes:[]});
    const geometry=(drawn.group.getObjectByName(BRIDGES_NAME) as THREE.Mesh).geometry;
    const pos=geometry.getAttribute('position'),ix=geometry.index!,side=geometry.getAttribute('aSide'),width=geometry.getAttribute('aWidth');
    let railReach=0;for(let i=0;i<pos.count;i++)railReach=Math.max(railReach,Math.hypot(side.getX(i),side.getY(i))*width.getZ(i)/2);
    const triangle=new THREE.Triangle(),point=new THREE.Vector3(),nearest=new THREE.Vector3();
    for(const station of all.stations){let minimum=Infinity;point.set(station.anchor[0],0,station.anchor[1]);
      for(let i=0;i<ix.count;i+=3){for(let k=0;k<3;k++){const n=ix.getX(i+k);(k===0?triangle.a:k===1?triangle.b:triangle.c).set(pos.getX(n),0,pos.getZ(n));}
        if(triangle.getArea()<1e-8){for(const [a,b] of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]]){new THREE.Line3(a,b).closestPointToPoint(point,true,nearest);minimum=Math.min(minimum,nearest.distanceTo(point));}}else{triangle.closestPointToPoint(point,nearest);minimum=Math.min(minimum,nearest.distanceTo(point));}}
      // Reserve the rail shader's maximum half-width including each corner miter as well as the unchanged pad.
      expect(minimum-railReach,`rendered bridge or shadow vs ${station.id}`).toBeGreaterThan(padRadius);
    }
    drawn.dispose();
    // The real boulevards (R10 Long Sands, R13 Harbour Avenue) must pass the same check once the corridor lands; the
    // synthetic ones here only prove the check runs.
    expect(all.boulevards!.length).toBeGreaterThan(0);
  });

  it("draws every land mesh before the board, and the bridges and deck lines write no depth (so they never hide a mark)", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    const bridges = handle.group.getObjectByName(BRIDGES_NAME) as THREE.Mesh;
    const deck = handle.group.getObjectByName(DECK_LINES_NAME) as THREE.Mesh;
    const major = handle.group.getObjectByName(MAJOR_LINES_NAME) as THREE.Mesh;
    expect(bridges && deck && major).toBeTruthy();
    // Every land line, the bridges and the lines on them are drawn before the board's marks (2); the ground lines were
    // at 2 before this pass (tied with the board), now 1.3.
    for (const name of [MAJOR_LINES_NAME, "journey-land:lines:minor", BRIDGES_NAME, DECK_LINES_NAME]) {
      expect(handle.group.getObjectByName(name)!.renderOrder, name).toBeLessThan(RENDER_ORDER.board);
    }
    // The board's ghost pass (1) tests against the land's depth; the bridges and the lines on them add none.
    expect(bridges.renderOrder).toBeGreaterThan(RENDER_ORDER.ghost);
    expect(deck.renderOrder).toBeGreaterThan(bridges.renderOrder);
    expect((bridges.material as THREE.Material).depthWrite).toBe(false);
    expect((deck.material as THREE.Material).depthWrite).toBe(false);
    handle.dispose();
  });
});

describe("three.js land with the road", () => {
  it("stays inside the land budget on full and lite and recolours the bridges per theme", () => {
    for (const tier of ["full", "lite"] as const) {
      const handle = buildJourneyLand(land, { theme: "classic", tier, homes: [] });
      const stats = handle.stats();
      expect(stats.triangles).toBeLessThanOrEqual(tier === "full" ? 25_000 : 15_000);
      expect(stats.drawCalls).toBeLessThanOrEqual(20);
      const bridges = handle.group.getObjectByName(BRIDGES_NAME) as THREE.Mesh;
      const colours = () => Array.from(bridges.geometry.getAttribute("aColor").array as Float32Array);
      const tris = (bridges.geometry.index?.count ?? 0) / 3;
      expect(tris).toBeGreaterThan(50);
      expect(tris).toBeLessThan(1500);
      const classic = colours();
      handle.setTheme("newfoundland");
      expect(colours()).not.toEqual(classic);
      handle.setTheme("classic");
      expect(colours()).toEqual(classic);
      handle.dispose();
    }
  });

  it("authors the road's colours for every theme, and the flat twin draws the bridges at their true width", () => {
    for (const key of ["deck", "deckRail", "planted"] as const) {
      expect(LAND_EXTRA_KEYS).toContain(key);
      for (const theme of ["classic", "taylor", "newfoundland"] as const) expect(JOURNEY_LAND_EXTRAS[theme][key]).toMatch(/^#[0-9a-f]{6}$/);
    }
    const flat = journeyLandFlatData(land);
    expect(flat.bridges!.map((b) => b.id).sort()).toEqual(BRIDGE_CAST.map(b=>b.id).sort());
    const html = renderToStaticMarkup(createElement(JourneyLandFlat, { data: flat, theme: "taylor" }));
    for (const id of Object.keys(SPANS)) expect(html).toContain(`data-land-bridge="${id}"`);
    expect(html).toContain(`stroke-width="${land.bridges!.find((b) => b.id === "bightBridge")!.width}"`);
  });
});
