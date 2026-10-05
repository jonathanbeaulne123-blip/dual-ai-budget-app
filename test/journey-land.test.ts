/**
 * The Journey land (T2): extracted from the REAL baked Horizon index + journey terrain LOD (read from public/ with
 * fs; fetch mocked). Coordinates, no pathGraph, LOD budget, flat parity, dressings, loader cache and abort.
 * REVIEW M2: the slim baked artefact (`<revision>.journey.json.gz`) is the first path; the index path is the fallback
 * (404, dev HTML, revision/format mismatch, corrupt) and both yield the same data.
 */
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeshStandardMaterial, Vector3 } from "three";
import { compressHeight, fromDiorama, JOURNEY_DIORAMA, JOURNEY_LOD, JOURNEY_THEMES, STATION_IDS, toDiorama, type JourneyLandData } from "../src/journey/contracts.ts";
import {
  buildJourneyLand, CLAY_COLOUR_KEYS, CLAY_NAMES, createClayLights, countDraws, dioramaFrame, extractJourneyLand, JOURNEY_CLAY_PALETTES, JOURNEY_LAND_BUDGET,
  JOURNEY_LAND_DRESSINGS, JOURNEY_PROP_PALETTE, journeyLandFlatData, JourneyLandFlat, journeyLandTimings, JOURNEY_LAND_SLIM_FORMAT, JOURNEY_LAND_SLIM_URL,
  LAND_DRESSING_KEYS, loadJourneyLand, parseJourneyLandSlim, PROP_COLOUR_KEYS, resetJourneyLandCacheForTests, setJourneyLandCalm, type ClayLandHandle,
} from "../src/journey/land/index.ts";
import { HORIZON_INDEX_URL, parseHorizonIndex } from "../src/house/world/horizonAssets.ts";
import { decodeTerrainAsset } from "../src/harbour/horizon/land/terrain/asset.ts";
import { starterLayout } from "../src/home/model.ts";

const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const INDEX_GZ = toArrayBuffer(readFileSync("public/horizon/world/horizon-geo-1.index.json.gz"));
const TERRAIN = toArrayBuffer(readFileSync("public/horizon/terrain/horizon-geo-1.bin"));
const SLIM_GZ = toArrayBuffer(readFileSync("public/horizon/world/horizon-geo-1.journey.json.gz"));
const SLIM_JSON = JSON.parse(gunzipSync(Buffer.from(SLIM_GZ)).toString()) as Record<string, unknown>;
const gz = (value: unknown) => toArrayBuffer(gzipSync(JSON.stringify(value)));
/** The raw index, parsed independently of the code under test, as the reference. */
const RAW = JSON.parse(gunzipSync(Buffer.from(INDEX_GZ)).toString()) as {
  journey: { stations: { id: string; anchor: { xy: [number, number] } }[] }; hosts: { id: string; door: { xy: [number, number] } }[];
  water: { id: string; outline: [number, number][] }[];
};

/** `slim`: what the slim URL serves — the baked artefact (default), other bytes, a 404, or the dev server's HTML fallback. */
type SlimServe = "baked" | "404" | "html" | ArrayBuffer;
function mockFetch(slim: SlimServe = "baked") {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    await Promise.resolve();
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    if (url === JOURNEY_LAND_SLIM_URL) {
      if (slim === "404") return new Response("not found", { status: 404 });
      if (slim === "html") return new Response("<!doctype html><html></html>", { headers: { "content-type": "text/html" } });
      return new Response((slim === "baked" ? SLIM_GZ : slim).slice(0), { headers: { "content-type": "application/gzip" } });
    }
    if (url === HORIZON_INDEX_URL) return new Response(INDEX_GZ.slice(0), { headers: { "content-type": "application/gzip" } });
    if (url.endsWith("/horizon-geo-1.bin")) return new Response(TERRAIN.slice(0), { headers: { "content-type": "application/octet-stream" } });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const urls = (fetch: ReturnType<typeof mockFetch>) => fetch.mock.calls.map((c) => c[0]).sort();

let land: JourneyLandData;
/** The same land through the fallback (index + terrain → parse → extract). */
let landFromIndex: JourneyLandData;
beforeAll(async () => {
  resetJourneyLandCacheForTests();
  mockFetch();
  try { land = await loadJourneyLand(); } finally { vi.unstubAllGlobals(); }
  expect(journeyLandTimings()?.path).toBe("slim");
  resetJourneyLandCacheForTests();
  mockFetch("404");
  try { landFromIndex = await loadJourneyLand(); } finally { vi.unstubAllGlobals(); }
  expect(journeyLandTimings()?.path).toBe("index");
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("extracted land", () => {
  it("has the twelve stations jan…dec at the index's xy", () => {
    expect(land.stations.map((s) => s.id)).toEqual([...STATION_IDS]);
    for (const s of land.stations) {
      const raw = RAW.journey.stations.find((r) => r.id === s.id)!;
      expect(s.anchor).toEqual(raw.anchor.xy);
      expect(s.month).toBe(STATION_IDS.indexOf(s.id) + 1);
    }
    expect(land.stations[0]!.anchor).toEqual([1364, 650]); // #566 moved Jan onto Mountain v2's summit (the index is the source)
    expect(land.yearWalk).toHaveLength(12);
  });

  it("keeps the seven hosts, the shared home at its door [1494,1165]", () => {
    expect(land.hosts.map((h) => h.id).sort()).toEqual(RAW.hosts.map((h) => h.id).sort());
    const home = land.hosts.find((h) => h.id === "home")!;
    expect(home.door).toEqual([1494, 1165]);
    expect(home.roofHeight).toBeGreaterThan(0);
    expect(land.reserves).toHaveLength(9);
  });

  it("keeps the coastline within the coast budget and the surface water only", () => {
    expect(land.coastline.length).toBeLessThanOrEqual(JOURNEY_LOD.coastVertices);
    expect(land.coastline.length).toBeGreaterThan(100);
    expect(land.water.map((w) => w.kind)).not.toContain("sea");
    expect(land.water.map((w) => w.kind)).not.toContain("deep");
    expect(land.water.some((w) => w.id === "water.stillwater")).toBe(true);
    const kinds = new Set(land.lines.map((l) => l.kind));
    for (const k of ["road", "skate", "cable", "rail", "ferry", "row"]) expect(kinds.has(k as never)).toBe(true);
    expect(land.lines.some((l) => l.id === "strip" || l.id === "dam.apron.level")).toBe(false);
    expect(land.terrain.columns).toBe(101);
    expect(land.terrain.rows).toBe(91);
    expect(land.terrain.step).toBe(20);
  });

  it("serializes without pathGraph, collision, geometry or solids, under 400 KB", () => {
    const json = JSON.stringify(land);
    for (const key of ["pathGraph", "collision", "geometry", "solids", "crossings", "beds"]) expect(json).not.toContain(`"${key}"`);
    expect(Object.keys(land).sort()).toEqual(
      // bridges / covers: the road pass (ROAD.md §7); `boulevards`: the committed index carries the corridors (journey-road.test.ts).
      ["boulevards", "bridges", "coastline", "covers", "districts", "extent", "homestead", "hosts", "kittyPlaza", "landforms", "lines", "lod", "reserves", "revision", "seaLevel", "stations", "terrain", "water", "yearWalk"].sort(),
    );
    expect(json.length).toBeLessThan(400_000);
    console.info(`[journey-land] extracted data ${(json.length / 1024).toFixed(1)} KB as JSON (terrain typed arrays included)`);
  });

  it("measures the slim parse against the index parse + extract (PLAN R3, REVIEW M2)", () => {
    const runs = 20, median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const slim: number[] = [], index: number[] = [], decode: number[] = [], extract: number[] = [];
    for (let i = 0; i < runs; i++) {
      const s0 = performance.now();
      expect(parseJourneyLandSlim(SLIM_GZ.slice(0)).stations).toHaveLength(12);
      slim.push(performance.now() - s0);
      const t0 = performance.now();
      const world = parseHorizonIndex(INDEX_GZ.slice(0));
      const t1 = performance.now();
      const terrain = decodeTerrainAsset(TERRAIN.slice(0), "journey");
      const t2 = performance.now();
      expect(extractJourneyLand(world, terrain).stations).toHaveLength(12);
      const t3 = performance.now();
      index.push(t1 - t0); decode.push(t2 - t1); extract.push(t3 - t2);
    }
    console.info(`[journey-land] median of ${runs} (Node, unthrottled): slim gunzip+parse+decode ${median(slim).toFixed(1)} ms (${(SLIM_GZ.byteLength / 1024).toFixed(1)} KB gz) · index parse ${median(index).toFixed(1)} ms + decode journey LOD ${median(decode).toFixed(1)} ms + extract ${median(extract).toFixed(1)} ms (${((INDEX_GZ.byteLength + TERRAIN.byteLength) / 1024).toFixed(0)} KB)`);
    expect(median(slim)).toBeLessThan(median(index));
  });
});

describe("slim artefact (REVIEW M2)", () => {
  it("equals, deeply, the land the index path extracts", () => {
    expect(land).toStrictEqual(landFromIndex);
    expect(land.terrain.heights).toBeInstanceOf(Float32Array);
    expect(land.terrain.surfaces).toBeInstanceOf(Uint8Array);
  });

  it("is small: one request of at most 120 KB gzip, the terrain lattice embedded", () => {
    expect(SLIM_GZ.byteLength).toBeLessThanOrEqual(120 * 1024);
    expect(gunzipSync(Buffer.from(SLIM_GZ)).byteLength).toBeLessThan(400_000);
    expect(SLIM_JSON).toMatchObject({ id: "journey-land", format: JOURNEY_LAND_SLIM_FORMAT, revision: "horizon-geo-1", source: { index: HORIZON_INDEX_URL } });
    const terrain = (SLIM_JSON.land as { terrain: { columns: number; rows: number; heightsCm: number[] } }).terrain;
    expect(terrain.heightsCm).toHaveLength(terrain.columns * terrain.rows);
    console.info(`[journey-land] slim ${(SLIM_GZ.byteLength / 1024).toFixed(1)} KB gz vs index ${(INDEX_GZ.byteLength / 1024).toFixed(0)} KB gz + terrain ${(TERRAIN.byteLength / 1024).toFixed(0)} KB`);
  });

  it("was baked from the index and terrain in public/ (source sha256)", async () => {
    const { createHash } = await import("node:crypto");
    const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
    expect(SLIM_JSON.source).toEqual({ index: HORIZON_INDEX_URL, indexSha256: sha(gunzipSync(Buffer.from(INDEX_GZ))), terrainSha256: sha(Buffer.from(TERRAIN)) });
  });

  it("reads raw JSON too (a server that already decoded the gzip)", () => {
    expect(parseJourneyLandSlim(toArrayBuffer(gunzipSync(Buffer.from(SLIM_GZ))))).toStrictEqual(land);
  });

  it("rejects a different revision, an unknown format and a malformed lattice", () => {
    expect(() => parseJourneyLandSlim(gz({ ...SLIM_JSON, revision: "horizon-geo-2" }))).toThrow(/revision/);
    expect(() => parseJourneyLandSlim(gz({ ...SLIM_JSON, format: 1 }))).toThrow(/format/);
    expect(() => parseJourneyLandSlim(gz({ ...SLIM_JSON, format: JOURNEY_LAND_SLIM_FORMAT + 1 }))).toThrow(/format/);
    const landJson = SLIM_JSON.land as { terrain: { heightsCm: number[] } };
    expect(() => parseJourneyLandSlim(gz({ ...SLIM_JSON, land: { ...landJson, terrain: { ...landJson.terrain, heightsCm: landJson.terrain.heightsCm.slice(1) } } }))).toThrow(/lattice/);
  });
});

describe("loader", () => {
  it("makes ONE request (the slim land) and returns the same promise to a second caller", async () => {
    resetJourneyLandCacheForTests();
    const fetch = mockFetch();
    const first = loadJourneyLand(), second = loadJourneyLand();
    expect(second).toBe(first);
    const data = await first;
    expect(await loadJourneyLand()).toBe(data);
    expect(loadJourneyLand()).toBe(first);
    expect(urls(fetch)).toEqual([JOURNEY_LAND_SLIM_URL]);
    expect(journeyLandTimings()).toMatchObject({ path: "slim", slimBytes: SLIM_GZ.byteLength, indexBytes: 0, terrainBytes: 0, extractMs: 0 });
    expect(journeyLandTimings()?.fallbackReason).toBeUndefined();
  });

  it.each([
    ["a 404 (an older deploy)", "404" as SlimServe, /slim 404/],
    ["the dev server's HTML fallback", "html" as SlimServe, /slim 200 html/],
    ["a different revision", gz({ ...SLIM_JSON, revision: "horizon-geo-2" }) as SlimServe, /revision/],
    ["an unknown format", gz({ ...SLIM_JSON, format: 99 }) as SlimServe, /format/],
    ["corrupt bytes", toArrayBuffer(Buffer.from([0x1f, 0x8b, 1, 2, 3])) as SlimServe, /./],
  ])("falls back to the index and terrain on %s, with the same land", async (_name, serve, reason) => {
    resetJourneyLandCacheForTests();
    const fetch = mockFetch(serve);
    const data = await loadJourneyLand();
    expect(urls(fetch)).toEqual([JOURNEY_LAND_SLIM_URL, HORIZON_INDEX_URL, "/horizon/terrain/horizon-geo-1.bin"].sort());
    const timings = journeyLandTimings()!;
    expect(timings).toMatchObject({ path: "index", slimBytes: 0, indexBytes: INDEX_GZ.byteLength, terrainBytes: TERRAIN.byteLength });
    expect(timings.fallbackReason).toMatch(reason);
    expect(data).toStrictEqual(land);
  });

  it("rejects an aborted load, then loads again", async () => {
    resetJourneyLandCacheForTests();
    const fetch = mockFetch();
    const already = new AbortController(); already.abort();
    await expect(loadJourneyLand(already.signal)).rejects.toMatchObject({ name: "AbortError" });
    const controller = new AbortController();
    const pending = loadJourneyLand(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    // An abort never falls back to the index.
    expect(fetch.mock.calls.map((c) => c[0])).not.toContain(HORIZON_INDEX_URL);
    const data = await loadJourneyLand(new AbortController().signal);
    expect(data.stations).toHaveLength(12);
  });

  it("rejects an unavailable asset and forgets the failure", async () => {
    resetJourneyLandCacheForTests();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html></html>", { headers: { "content-type": "text/html" } })));
    await expect(loadJourneyLand()).rejects.toThrow(/unavailable/);
    mockFetch();
    await expect(loadJourneyLand()).resolves.toMatchObject({ revision: "horizon-geo-1" });
  });
});

describe("the diorama frame (from the baked coastline, never constants)", () => {
  it("encloses the coast in the smallest circle and fits it to islandUnits", () => {
    const frame = dioramaFrame(land);
    const ring = land.coastline;
    const far = Math.max(...ring.map((p) => Math.hypot(p[0] - frame.centre[0], p[1] - frame.centre[1])));
    expect(far).toBeCloseTo(frame.radius, 6);
    // Smallest: at least two coast points lie on the circle, and no smaller circle about the bbox centre fits.
    expect(ring.filter((p) => Math.abs(Math.hypot(p[0] - frame.centre[0], p[1] - frame.centre[1]) - frame.radius) < 1e-6).length).toBeGreaterThanOrEqual(2);
    expect(frame.scale).toBeCloseTo(JOURNEY_DIORAMA.islandUnits / frame.radius, 12);
    expect(ring.every((p) => { const d = toDiorama(frame, p[0], p[1]); return Math.hypot(d[0], d[2]) <= JOURNEY_DIORAMA.islandUnits + 1e-9; })).toBe(true);
  });

  it("moves with the coastline: a coast shifted 50 m moves the centre 50 m, same radius and scale", () => {
    const frame = dioramaFrame(land);
    for (const [dx, dy] of [[50, 0], [0, -50], [35.355, 35.355]] as const) {
      const shifted: JourneyLandData = { ...structuredClone(land), coastline: land.coastline.map((p) => [p[0] + dx, p[1] + dy] as const) };
      const moved = dioramaFrame(shifted);
      expect(moved.centre[0]).toBeCloseTo(frame.centre[0] + dx, 6);
      expect(moved.centre[1]).toBeCloseTo(frame.centre[1] + dy, 6);
      expect(moved.radius).toBeCloseTo(frame.radius, 6);
      expect(moved.scale).toBeCloseTo(frame.scale, 12);
      // The built land follows: its frame, and the slab's plan centre in diorama units stays put relative to the coast.
      const handle = buildJourneyLand(shifted, { theme: "classic", tier: "lite", homes: [] });
      expect(handle.frame).toEqual(moved);
      handle.dispose();
    }
    // A wider coast grows the radius.
    const wider: JourneyLandData = { ...land, coastline: land.coastline.map((p) => [frame.centre[0] + (p[0] - frame.centre[0]) * 1.1, frame.centre[1] + (p[1] - frame.centre[1]) * 1.1] as const) };
    expect(dioramaFrame(wider).radius).toBeCloseTo(frame.radius * 1.1, 6);
  });

  it("toDiorama / fromDiorama are exact inverses on the frame, and the handle grounds on the clay", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    const frame = handle.frame!;
    expect(handle.frame).toEqual(dioramaFrame(land));
    for (const h of land.hosts) {
      const d = toDiorama(frame, h.door[0], h.door[1], h.doorHeight);
      const back = fromDiorama(frame, d[0], d[2]);
      expect(back.x).toBeCloseTo(h.door[0], 9); expect(back.y).toBeCloseTo(h.door[1], 9);
      // On land the clay is at least the slab top and at most the toy-lifted height.
      const g = handle.dioramaGroundAt!(h.door[0], h.door[1]);
      expect(g).toBeGreaterThanOrEqual(JOURNEY_DIORAMA.slab.top);
      expect(g).toBeLessThanOrEqual(JOURNEY_DIORAMA.slab.top + 0.01 + compressHeight(160) * JOURNEY_DIORAMA.toyLift);
    }
    expect(handle.dioramaGroundAt!(20, 20)).toBe(JOURNEY_DIORAMA.slab.sea);
    // The Crown stands well above the harbour.
    const crown = land.districts.find((d) => d.id === "crown")!.heart!, harbour = land.districts.find((d) => d.id === "harbour")!.heart!;
    expect(handle.dioramaGroundAt!(crown[0], crown[1]) - handle.dioramaGroundAt!(harbour[0], harbour[1])).toBeGreaterThan(0.4);
    handle.dispose();
  });
});

describe("clay land", () => {
  const homes = [{ memberId: "MEM-001", plotId: "plot.terraces.1", layout: starterLayout() }];
  const mesh = (h: { group: import("three").Group }, name: string) => h.group.getObjectByName(name) as import("three").Mesh | undefined;

  it("draws every feature from the land data inside the land budget on full and lite", () => {
    const full = buildJourneyLand(land, { theme: "classic", tier: "full", homes });
    const lite = buildJourneyLand(land, { theme: "classic", tier: "lite", homes });
    const f = full.stats(), l = lite.stats();
    console.info(`[journey-land] clay full ${f.triangles} tris / ${f.drawCalls} draws · lite ${l.triangles} tris / ${l.drawCalls} draws`);
    expect(f.triangles).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.full.triangles);
    expect(f.drawCalls).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.full.drawCalls);
    expect(l.triangles).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.lite.triangles);
    expect(l.drawCalls).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.lite.drawCalls);
    expect(l.triangles).toBeLessThan(f.triangles);
    // Land + the board's whole Sky allowance: the land leaves the board most of JOURNEY_LOD.
    expect(f.triangles).toBeLessThan(JOURNEY_LOD.sky.triangles.full * 0.65);
    for (const name of Object.values(CLAY_NAMES).filter((n) => n !== CLAY_NAMES.homes)) expect(mesh(full, name), name).toBeTruthy();
    expect(full.group.getObjectByName("journey-land:home:MEM-001@plot.terraces.1")).toBeTruthy();
    // The terrain is the baked lattice (one vertex per node at stride 1), never more.
    const terrain = mesh(full, CLAY_NAMES.terrain)!;
    expect(terrain.geometry.getAttribute("position").count).toBe(land.terrain.columns * land.terrain.rows);
    // One house per host inside the coast, plus village houses on the bake's settled paint.
    const houses = mesh(full, CLAY_NAMES.houses)!;
    expect(houses.geometry.index!.count).toBeGreaterThan(0);
    full.dispose(); lite.dispose();
  });

  it("real shadow map on full, blob contact shadows on lite", () => {
    const full = buildJourneyLand(land, { theme: "taylor", tier: "full", homes: [] });
    const lite = buildJourneyLand(land, { theme: "taylor", tier: "lite", homes: [] });
    for (const name of [CLAY_NAMES.terrain, CLAY_NAMES.houses, CLAY_NAMES.trees, CLAY_NAMES.slab]) {
      expect(mesh(full, name)!.castShadow, name).toBe(true);
      expect(mesh(full, name)!.receiveShadow, name).toBe(true);
      expect(mesh(lite, name)!.castShadow, name).toBe(false);
    }
    expect(mesh(full, CLAY_NAMES.blobs)!.visible).toBe(false);
    expect(mesh(lite, CLAY_NAMES.blobs)!.visible).toBe(true);
    const lights = { full: createClayLights("taylor", "full"), lite: createClayLights("taylor", "lite") };
    expect(lights.full.sun.castShadow).toBe(true);
    expect(lights.full.sun.shadow.mapSize.x).toBe(2048);
    expect(lights.lite.sun.castShadow).toBe(false);
    lights.full.setTheme("newfoundland");
    expect("#" + lights.full.sun.color.getHexString()).toBe(JOURNEY_CLAY_PALETTES.newfoundland.light);
    lights.full.dispose(); lights.lite.dispose();
    full.dispose(); lite.dispose();
  });

  it("keeps the concept-metre queries: x and z kept, y = compressHeight(rawHeightAt)", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    for (const [x, y] of [[1494, 1165], [1330, 640], [700, 470], [12.5, 1799], [1000, 900]] as const) {
      const p = handle.worldToBoard(x, y);
      expect(p[0]).toBe(x);
      expect(p[2]).toBe(y);
      expect(p[1]).toBeCloseTo(compressHeight(handle.rawHeightAt(x, y)), 9);
      expect(handle.heightAt(x, y)).toBeCloseTo(p[1], 9);
    }
    const { columns, step, heights } = land.terrain;
    expect(handle.rawHeightAt(40 * step, 30 * step)).toBeCloseTo(heights[30 * columns + 40]!, 5);
    for (const s of land.stations) { const at = handle.stationAt(s.id); expect([at[0], at[2]]).toEqual([...s.anchor]); }
    handle.dispose();
  });

  it("knows land from water: false on the sea and in Stillwater, true at the hosts", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "lite", homes: [] });
    expect(handle.isLand(40, 40)).toBe(false);
    expect(handle.isLand(-10, 500)).toBe(false);
    const still = RAW.water.find((w) => w.id === "water.stillwater")!.outline;
    const cx = still.reduce((s, p) => s + p[0], 0) / still.length, cy = still.reduce((s, p) => s + p[1], 0) / still.length;
    expect(handle.isLand(cx, cy)).toBe(false);
    for (const id of ["home", "bank", "library", "glasshouse", "studio", "cottage"]) {
      const door = land.hosts.find((h) => h.id === id)!.door;
      expect(handle.isLand(door[0], door[1]), id).toBe(true);
    }
    handle.dispose();
  });

  it("draws member homes (D53) as clay at their plot, provisional translucent, replaced in place", () => {
    const handle = buildJourneyLand(land, { theme: "taylor", tier: "full", homes: [] });
    const before = handle.stats();
    handle.setHomes([...homes, { memberId: "MEM-001", plotId: "plot.terraces.1", layout: starterLayout(), provisional: true }]);
    const built = handle.group.getObjectByName("journey-land:home:MEM-001@plot.terraces.1") as import("three").Mesh;
    const provisional = handle.group.getObjectByName("journey-land:home:provisional:MEM-001@plot.terraces.1") as import("three").Mesh;
    expect(built.material).toBeInstanceOf(MeshStandardMaterial);
    expect((provisional.material as import("three").Material).transparent).toBe(true);
    // At the plot, in diorama units.
    built.geometry.computeBoundingBox();
    const centre = built.geometry.boundingBox!.getCenter(new Vector3());
    const plot = land.reserves.find((r) => r.id === "plot.terraces.1")!.outline;
    const px = plot.reduce((s, p) => s + p[0], 0) / plot.length, py = plot.reduce((s, p) => s + p[1], 0) / plot.length;
    const at = toDiorama(handle.frame!, px, py);
    expect(Math.hypot(centre.x - at[0], centre.z - at[2])).toBeLessThan(0.15);
    expect(handle.stats().drawCalls).toBeLessThanOrEqual(JOURNEY_LAND_BUDGET.full.drawCalls);
    handle.setHomes([]);
    expect(handle.stats()).toEqual(before);
    handle.dispose();
  });

  it("recolours every theme in place and back", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    const terrain = mesh(handle, CLAY_NAMES.terrain)!, slab = mesh(handle, CLAY_NAMES.slab)!, houses = mesh(handle, CLAY_NAMES.houses)!;
    const snap = () => [Array.from((terrain.geometry.getAttribute("color").array as Float32Array).slice(0, 3000)),
      (slab.material as MeshStandardMaterial).color.getHexString(), Array.from((houses.geometry.getAttribute("color").array as Float32Array).slice(0, 300))];
    const classic = snap();
    expect("#" + (slab.material as MeshStandardMaterial).color.getHexString()).toBe(JOURNEY_CLAY_PALETTES.classic.sand);
    handle.setTheme("newfoundland");
    expect(snap()).not.toEqual(classic);
    expect("#" + (slab.material as MeshStandardMaterial).color.getHexString()).toBe(JOURNEY_CLAY_PALETTES.newfoundland.sand);
    handle.setTheme("taylor");
    handle.setTheme("classic");
    expect(snap()).toEqual(classic);
    handle.dispose();
  });

  it("shares one cheap stride-2 mini island for the Year ring, owned and disposed by the land", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    const mini = handle.miniGeometry!();
    expect(handle.miniGeometry!()).toBe(mini);
    const tris = mini.index!.count / 3, terrainTris = mesh(handle, CLAY_NAMES.terrain)!.geometry.index!.count / 3;
    expect(tris).toBeLessThan(terrainTris * 0.5);
    // Twelve instanced minis stay well inside the board's Sky allowance.
    expect(tris * 12).toBeLessThan(JOURNEY_LOD.sky.triangles.full * 0.75);
    expect(mini.getAttribute("color")).toBeTruthy();
    // Centred on the frame: its plan reach is the coast's islandUnits plus the sea shoulder and the clay edge.
    const pos = mini.getAttribute("position");
    let reach = 0;
    for (let i = 0; i < pos.count; i++) reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
    expect(reach).toBeGreaterThan(JOURNEY_DIORAMA.islandUnits * 0.95);
    expect(reach).toBeLessThan(JOURNEY_DIORAMA.islandUnits * 1.1);
    let freed = false;
    mini.addEventListener("dispose", () => { freed = true; });
    handle.dispose();
    expect(freed).toBe(true);
  });

  it("calms the land away from the Week trail: softer, lower, minor roads and rivers hidden, trees thinned; null restores", () => {
    const handle = buildJourneyLand(land, { theme: "taylor", tier: "full", homes: [] }) as ClayLandHandle;
    const trail = land.yearWalk.find((w) => w.stationId === "oct")!.points.map((p) => [p[0], p[2]] as const);
    const terrain = mesh(handle, CLAY_NAMES.terrain)!, trees = mesh(handle, CLAY_NAMES.trees)!;
    const ys = () => Array.from(terrain.geometry.getAttribute("position").array as Float32Array).filter((_, i) => i % 3 === 1);
    const cols = () => Array.from(terrain.geometry.getAttribute("color").array as Float32Array);
    const base = { y: ys(), c: cols(), stats: handle.stats() };
    handle.setCalm({ trail }, 1);
    expect(mesh(handle, CLAY_NAMES.minorRoads)!.visible).toBe(false);
    expect(mesh(handle, CLAY_NAMES.rivers)!.visible).toBe(false);
    expect(mesh(handle, CLAY_NAMES.roads)!.visible).toBe(true);
    // Far from the trail the clay is lower; never above where it was.
    const calmY = ys();
    expect(calmY.every((y, i) => y <= base.y[i]! + 1e-6)).toBe(true);
    expect(calmY.reduce((s, y) => s + y, 0)).toBeLessThan(base.y.reduce((s, y) => s + y, 0));
    expect(cols()).not.toEqual(base.c);
    // Trees thinned: hidden toys collapse onto their base (zero-area triangles), so fewer have extent.
    const extent = (g: import("three").BufferGeometry) => { const p = g.getAttribute("position"), ix = g.index!; let n = 0; for (let t = 0; t < ix.count; t += 3) { const a = ix.getX(t), b = ix.getX(t + 1); if (p.getX(a) !== p.getX(b) || p.getY(a) !== p.getY(b) || p.getZ(a) !== p.getZ(b)) n++; } return n; };
    expect(extent(trees.geometry)).toBeLessThan(trees.geometry.index!.count / 3 * 0.6);
    // Near the trail the land is unchanged.
    const near = trail[Math.floor(trail.length / 2)]!;
    expect(handle.dioramaGroundAt!(near[0], near[1])).toBeGreaterThanOrEqual(JOURNEY_DIORAMA.slab.top);
    setJourneyLandCalm(handle, null);
    expect(ys()).toEqual(base.y);
    expect(cols()).toEqual(base.c);
    expect(handle.stats()).toEqual(base.stats);
    handle.dispose();
  });

  it("frees every geometry and material it made on dispose", () => {
    const handle = buildJourneyLand(land, { theme: "newfoundland", tier: "full", homes });
    handle.miniGeometry!();
    const made = new Set<{ addEventListener(t: "dispose", f: () => void): void }>();
    handle.group.traverse((o) => { const m = o as import("three").Mesh; if (m.geometry) made.add(m.geometry); if (m.material) made.add(m.material as import("three").Material); });
    let freed = 0;
    for (const r of made) r.addEventListener("dispose", () => { freed++; });
    handle.dispose();
    expect(made.size).toBeGreaterThan(10);
    expect(freed).toBe(made.size);
    expect(handle.group.children).toHaveLength(0);
    expect(countDraws(handle.group)).toEqual({ triangles: 0, drawCalls: 0 });
  });
});

describe("flat twin", () => {
  it("uses the same concept coordinates as the land data", () => {
    const flat = journeyLandFlatData(land);
    const handle = buildJourneyLand(land, { theme: "classic", tier: "lite", homes: [] });
    expect(flat.viewBox).toEqual([0, 0, land.extent.w, land.extent.h]);
    expect(flat.stations.map((s) => s.id)).toEqual([...STATION_IDS]);
    for (const s of flat.stations) { const at = handle.stationAt(s.id); expect([s.x, s.y]).toEqual([at[0], at[2]]); }
    expect(flat.hosts).toHaveLength(land.hosts.length);
    for (const h of flat.hosts) {
      const door = land.hosts.find((x) => x.id === h.id)!.door;
      expect([h.x, h.y]).toEqual([door[0], door[1]]);
    }
    expect(flat.coast.startsWith("M")).toBe(true);
    expect(flat.lines).toHaveLength(land.lines.length);
    expect(flat.districts.every((d) => d.label.length > 0)).toBe(true);
    handle.dispose();
  });

  it("renders SVG with no WebGL in each theme's clay palette, every host, and an accessible overlay slot", () => {
    const flat = journeyLandFlatData(land);
    for (const theme of JOURNEY_THEMES) {
      const p = JOURNEY_CLAY_PALETTES[theme];
      const bare = renderToStaticMarkup(createElement(JourneyLandFlat, { data: flat, theme }));
      expect(bare).toContain(`viewBox="0 0 ${land.extent.w} ${land.extent.h}"`);
      expect(bare).toMatch(/^<svg[^>]*aria-hidden="true"/);
      expect(bare).toContain(`journey-land-flat--${theme}`);
      // Clay palette: water sea, shallows shoulder, sand rim, grass land, wall hosts under the home roof.
      expect(bare).toContain(`fill="${p.water}"`);
      expect(bare).toMatch(new RegExp(`<path[^>]*fill="${p.shallow}"[^>]*data-land-shoulder`));
      expect(bare).toContain(`fill="${p.sand}"`);
      expect(bare).toMatch(new RegExp(`<path[^>]*fill="${p.grass}"[^>]*data-land-coast`));
      expect(bare).toMatch(new RegExp(`data-land-host="home"`));
      expect(bare).toMatch(new RegExp(`fill="${p.wall}" stroke="${p.homeRoof}"[^>]*data-land-host="home"`));
      // Nothing the land data does not carry (the old airport block is gone).
      expect(bare).not.toContain("data-land-airport");
      for (const h of flat.hosts) expect(bare).toContain(`data-land-host="${h.id}" data-x="${h.x}" data-y="${h.y}"`);
      const withOverlay = renderToStaticMarkup(createElement(JourneyLandFlat, { data: flat, theme }, createElement("circle", { "data-overlay": "piece", cx: 1032, cy: 652, r: 10 })));
      expect(withOverlay).not.toMatch(/^<svg[^>]*aria-hidden/);
      expect(withOverlay).toContain('<g class="journey-land-flat__overlay"><circle data-overlay="piece"');
      expect(withOverlay).toContain('<g class="journey-land-flat__land" aria-hidden="true">');
    }
    // The themes differ.
    const html = JOURNEY_THEMES.map((theme) => renderToStaticMarkup(createElement(JourneyLandFlat, { data: flat, theme })));
    expect(new Set(html).size).toBe(3);
  });
});

describe("clay palettes", () => {
  it("authors every JourneyClayPalette key as #rrggbb for all three themes, keyed as the prototype", () => {
    expect(Object.keys(JOURNEY_CLAY_PALETTES).sort()).toEqual([...JOURNEY_THEMES].sort());
    // The contract's 39 colour keys + plinthFinish.
    expect(CLAY_COLOUR_KEYS.length).toBe(39);
    for (const theme of JOURNEY_THEMES) {
      const p = JOURNEY_CLAY_PALETTES[theme];
      expect(Object.keys(p).sort()).toEqual([...CLAY_COLOUR_KEYS, "plinthFinish"].sort());
      for (const key of CLAY_COLOUR_KEYS) expect(p[key], `${theme}.${key}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(JOURNEY_CLAY_PALETTES.newfoundland.plinthFinish).toBe("clapboard");
    expect(JOURNEY_CLAY_PALETTES.classic.plinthFinish).toBe("plain");
    expect(JOURNEY_CLAY_PALETTES.taylor.plinthFinish).toBe("plain");
    // The prototype's values (spot checks).
    expect(JOURNEY_CLAY_PALETTES.taylor.plinth).toBe("#eab3a3");
    expect(JOURNEY_CLAY_PALETTES.classic.water).toBe("#88d0cf");
    expect(JOURNEY_CLAY_PALETTES.newfoundland.tbase).toBe("#e9473f");
    expect(new Set(JOURNEY_THEMES.map((t) => JOURNEY_CLAY_PALETTES[t].plinth)).size).toBe(3);
  });

  it("authors the shared prop palette", () => {
    expect(PROP_COLOUR_KEYS.length).toBe(28);
    for (const key of PROP_COLOUR_KEYS) expect(JOURNEY_PROP_PALETTE[key], key).toMatch(/^#[0-9a-f]{6}$/);
    expect(JOURNEY_PROP_PALETTE.coin).toBe("#ffd158");
    expect(JOURNEY_PROP_PALETTE.mint).toBe("#8fe0bd");
  });

  it("keeps the deprecated route-board dressings complete until the route board is deleted", () => {
    expect(LAND_DRESSING_KEYS.length).toBe(21);
    for (const theme of JOURNEY_THEMES) {
      const d = JOURNEY_LAND_DRESSINGS[theme];
      for (const key of LAND_DRESSING_KEYS) expect(d[key], `${theme}.${key}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
