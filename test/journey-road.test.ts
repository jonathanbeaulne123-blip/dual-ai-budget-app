import { BRIDGE_CAST } from '../src/harbour/horizon/land/bridges/catalog';
/**
 * The road on the Journey land (ROAD.md §7, Jonathan's brief §8): bridges drawn as bridges, covered stretches dimmed,
 * boulevard reaches as a wider road with a planted band — extracted from the REAL baked index + journey terrain LOD in
 * public/, with and without corridors, slim round-trip, bridges kept clear of the stations, the flat twin's bridges and
 * underpass masks, and the clay land's plank decks. (The route board's road meshes went with that board; the Horizon
 * Clock map is tested in test/journey-map-board.test.ts.)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as THREE from "three";
import { beforeAll, describe, expect, it } from "vitest";
import { compressHeight, type JourneyLandData, type Point2 } from "../src/journey/contracts.ts";
import {
  buildJourneyLand, CLAY_NAMES, decodeJourneyLandSlim, encodeJourneyLandSlim, extractJourneyLand, journeyLandFlatData, JourneyLandFlat,
  JOURNEY_LAND_SLIM_FORMAT,
} from "../src/journey/land/index.ts";
import { BRIDGE_DRAW_ERROR, bridgeDrawIndices, planBridges, RAMP_EU } from "../src/journey/land/road.ts";
import { parseHorizonIndex } from "../src/house/world/horizonAssets.ts";
type LoadedWorld = ReturnType<typeof parseHorizonIndex>;
import { decodeTerrainAsset } from "../src/harbour/horizon/land/terrain/asset.ts";
import type { Corridor, CorridorContext, CorridorSide, CorridorStation } from "../src/harbour/horizon/land/corridor/types.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

/**
 * The legacy station reservation the land's cover masks and bridge clearance are held to (the v1 board's largest month
 * pad: 17 eu × the pad unit 2.2; the open month 12 % larger). Land facts, kept as numbers now that the route board is
 * gone; the Horizon Clock draws no station pads.
 */
const PAD_UNIT_MAX = 2.2, PAD_EU = 17, OPEN_PAD_SCALE = 1.12;

/** The road's named spans (MAP.md / ROAD.md §3) and the drawn road each one carries. */
const SPANS: Record<string, string> = { quayBridge: "V01", bightBridge: "V01", highSpan: "VG", mountainRoadCanalBridge: "V03" };
/** Original named cast plus the native bridges actually exported by the Mountain corridor. */
const bridgeIds = () => [...new Set([...BRIDGE_CAST.map(b => b.id),
  ...(world.corridors ?? []).flatMap(c => (c.sourceBridges ?? []).map(b => b.id))])].sort();

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
    expect([...byId.keys()].sort()).toEqual(bridgeIds());
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

  it("marks every authored road tunnel and the Prow gallery as covered, portal to portal", () => {
    const covers = land.covers ?? [];
    expect(covers.map((c) => `${c.id}:${c.kind}:${c.lineId}`)).toEqual(["mountainRoadTunnel:tunnel:V03", "prowTunnel:gallery:V01", "rimTunnel:tunnel:V01", "stillwaterTunnel:tunnel:spur stillwater"]);
    const mouths = new Map((world.collision?.mouths ?? []).map((m) => [m.id, m]));
    for (const c of covers) {
      c.portals.forEach((p, n) => {
        const m = mouths.get(`${c.id}.portal.${n}`)!;
        const centre: Point2 = [m.outline.reduce((a, q) => a + q[0], 0) / m.outline.length, m.outline.reduce((a, q) => a + q[1], 0) / m.outline.length];
        expect(planar(p, centre), `${c.id} portal ${n}`).toBeLessThan(6);
      });
    }
  });

  it("without corridors: only their boulevards and source-owned bridges disappear", () => {
    // Native bridge axes are deliberately owned by corridor source metadata. Removing
    // that metadata removes those bridge records, but must not alter any cast bridge,
    // cover, line, host, station or other extracted geography. A synthetic corridor
    // without source bridge metadata must not invent replacement bridge geometry.
    const bare = freshWorld(); delete bare.corridors;
    const without = extractJourneyLand(bare, journeyTerrain());
    expect("boulevards" in without).toBe(false);
    const { boulevards, bridges, ...rest } = land;
    expect(boulevards?.length).toBeGreaterThan(0);
    const native = new Map((world.corridors ?? []).flatMap(c => (c.sourceBridges ?? []).map(b => [b.id, b] as const)));
    expect(native.size).toBe(3);
    expect(bridges!.filter(b => native.has(b.id)).map(b => b.id).sort()).toEqual([...native.keys()].sort());
    expect({ ...rest, bridges: bridges!.filter(b => !native.has(b.id)) }).toStrictEqual(without);
    for (const b of bridges!.filter(b => native.has(b.id))) {
      const source = native.get(b.id)!;
      expect(b.width).toBeCloseTo(source.width, 2);
      expect(b.axis).toHaveLength(source.axis.length);
      b.axis.forEach((p, i) => p.forEach((v, k) => expect(Math.abs(v - source.axis[i]![k]!)).toBeLessThanOrEqual(.005001)));
    }
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
    expect(decoded.bridges!.map(b => b.id).sort()).toEqual(bridgeIds());
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

describe("the road's spans keep clear of the stations", () => {
  it("keeps every bridge (deck half-width + ramp) clear of every station's old pad reservation", () => {
    const padRadius = PAD_EU * PAD_UNIT_MAX;
    const w = freshWorld();
    w.corridors = [syntheticCorridor(w)];
    const all = extractJourneyLand(w, journeyTerrain());
    for (const s of all.stations) {
      for (const b of all.bridges!) {
        const axis = b.axis.map((p) => [p[0], p[2]] as const);
        const reach = b.width / 2 + RAMP_EU;
        expect(polyDist(s.anchor, axis) - reach, `${b.id} vs ${s.id}`).toBeGreaterThan(padRadius);
      }
    }
    // The Stillwater tunnel's portals stay beyond February's reservation; the source cover is kept unchanged.
    const tunnel = land.covers!.find((c) => c.id === "stillwaterTunnel")!;
    const feb = land.stations.find((st) => st.id === "feb")!;
    for (const portal of tunnel.portals) expect(planar(portal, feb.anchor)).toBeGreaterThan(PAD_EU * PAD_UNIT_MAX * OPEN_PAD_SCALE);
    expect(all.boulevards!.length).toBeGreaterThan(0);
  });
});

describe("the flat twin with the road", () => {
  it("masks only roads beneath a bridge and gives each mounted flat map distinct mask IDs", () => {
    const flat=journeyLandFlatData(land);
    const garden=flat.bridges!.find(b=>b.id==='gardenWalkBridge')!;
    expect(garden.underIds).toContain('VG');
    for(const theme of ['classic','taylor','newfoundland'] as const){
      const html=renderToStaticMarkup(createElement('div',null,
        createElement(JourneyLandFlat,{data:flat,theme}),createElement(JourneyLandFlat,{data:flat,theme})));
      const ids=[...html.matchAll(/<mask[^>]* id="([^"]+)"/g)].map(m=>m[1]);
      expect(ids.length).toBeGreaterThan(0);expect(new Set(ids).size).toBe(ids.length);
      const vgMasks=[...html.matchAll(/<mask[^>]*data-land-under-mask="VG"[^>]*>([\s\S]*?)<\/mask>/g)];
      expect(vgMasks).toHaveLength(2);
      for(const mask of vgMasks){expect(mask[1]).toContain('fill="white"');expect(mask[1]).toContain('data-under-bridge="gardenWalkBridge"');expect(mask[1]).not.toContain('data-under-bridge="highSpan"');}
      const vg=html.match(/<path[^>]*data-land-line="VG"[^>]*>/)?.[0];expect(vg).toContain('mask="url(#');
      // Decks remain before carried lines; masking an underpass must not erase a carried road.
      expect(flat.bridges!.filter(b=>b.underIds?.includes('V01')).some(b=>b.id==='bightBridge')).toBe(false);
      expect(html.indexOf('data-land-bridge="highSpan"')).toBeLessThan(html.indexOf('data-land-line="VG"'));
    }
  });

  it("the flat twin draws the bridges at their true width", () => {
    const flat = journeyLandFlatData(land);
    expect(flat.bridges!.map((b) => b.id).sort()).toEqual(bridgeIds());
    const html = renderToStaticMarkup(createElement(JourneyLandFlat, { data: flat, theme: "taylor" }));
    for (const id of Object.keys(SPANS)) expect(html).toContain(`data-land-bridge="${id}"`);
    expect(html).toContain(`stroke-width="${land.bridges!.find((b) => b.id === "bightBridge")!.width}"`);
  });
});


describe("clay land with the road (Horizon Clock)", () => {
  it("lays a clay plank under every span that carries a drawn road, and draws main and minor roads apart", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    try {
      const planks = handle.group.getObjectByName(CLAY_NAMES.bridges) as THREE.Mesh;
      const drawn = new Set(land.lines.filter((l) => l.kind === "road").map((l) => l.id));
      const carrying = planBridges(land).filter((b) => [...b.lineIds].some((id) => drawn.has(id)));
      expect(carrying.length).toBeGreaterThan(0);
      // Each carrying span is under its plank: the plank's vertices cover every span's axis ends (diorama units).
      const pos = planks.geometry.getAttribute("position"), frame = handle.frame!;
      for (const b of carrying) for (const end of [b.plan[0]!, b.plan[b.plan.length - 1]!]) {
        const x = (end[0] - frame.centre[0]) * frame.scale, z = (end[1] - frame.centre[1]) * frame.scale;
        let best = Infinity;
        for (let i = 0; i < pos.count; i++) best = Math.min(best, Math.hypot(pos.getX(i) - x, pos.getZ(i) - z));
        // The plank's edge vertices sit half its (true or minimum) width off the axis.
        expect(best, b.id).toBeLessThanOrEqual(Math.max(0.05, b.width * frame.scale) / 2 + 1e-3);
      }
      expect(handle.group.getObjectByName(CLAY_NAMES.roads)).toBeTruthy();
      expect(handle.group.getObjectByName(CLAY_NAMES.minorRoads)).toBeTruthy();
    } finally { handle.dispose(); }
  });
});

describe("map-only bridge mesh detail", () => {
  it("keeps height and plan shape, not just endpoints or a planar chord", () => {
    expect(bridgeDrawIndices([[0, 10, 0], [1, 10, 0], [2, 10, 0]])).toEqual([0, 2]);
    expect(bridgeDrawIndices([[0, 10, 0], [1, 10.1, 0], [2, 10, 0]])).toEqual([0, 1, 2]);
    expect(bridgeDrawIndices([[0, 10, 0], [1, 10, 1], [2, 10, 0]])).toEqual([0, 1, 2]);
  });

  it("retains full source axes, widths, identities and crossing relationships within explicit drawing bounds", () => {
    const before = structuredClone(land.bridges), plans = planBridges(land);
    const nativeIds = (world.corridors ?? []).flatMap(c => (c.sourceBridges ?? []).map(b => b.id)).sort();
    expect(nativeIds).toEqual(["mountainV2:b-foot", "mountainV2:b2", "mountainV2:b3"]);
    for (const p of plans) {
      const source = land.bridges!.find(b => b.id === p.id)!, indices = p.drawIndices!;
      expect(p.plan).toEqual(source.axis.map(q => [q[0], q[2]]));
      expect(p.tops).toEqual(source.axis.map(q => compressHeight(q[1])));
      expect(p.width).toBe(source.width);
      expect([...p.lineIds]).toEqual(source.lineIds);
      expect([...p.underIds]).toEqual(source.underIds ?? []);
      expect(indices[0]).toBe(0); expect(indices.at(-1)).toBe(source.axis.length - 1);
      for (let k = 1; k < indices.length; k++) {
        const first = indices[k - 1]!, last = indices[k]!, a = source.axis[first]!, b = source.axis[last]!;
        expect(last).toBeGreaterThan(first);
        const dx = b[0] - a[0], dz = b[2] - a[2], length2 = dx * dx + dz * dz;
        let previousT = 0;
        for (let i = first; i <= last; i++) {
          const q = source.axis[i]!, t = length2 ? ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / length2 : 0;
          expect(t).toBeGreaterThanOrEqual(previousT - 1e-9); previousT = t; expect(t).toBeLessThanOrEqual(1 + 1e-9);
          expect(Math.hypot(q[0] - a[0] - t * dx, q[2] - a[2] - t * dz), p.id).toBeLessThanOrEqual(BRIDGE_DRAW_ERROR.plan + 1e-9);
          expect(Math.abs(q[1] - a[1] - t * (b[1] - a[1])), p.id).toBeLessThanOrEqual(BRIDGE_DRAW_ERROR.height + 1e-9);
        }
      }
    }
    // Includes every cast glyph/landmark, untouched source axis and relationship list.
    expect(land.bridges).toEqual(before);
  });
});
