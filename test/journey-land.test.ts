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
import { compressHeight, JOURNEY_LOD, JOURNEY_THEMES, STATION_IDS, type JourneyLandData } from "../src/journey/contracts.ts";
import {
  buildJourneyLand, countDraws, extractJourneyLand, JOURNEY_LAND_DRESSINGS, journeyLandFlatData, JourneyLandFlat, journeyLandTimings,
  JOURNEY_LAND_SLIM_URL, LAND_DRESSING_KEYS, loadJourneyLand, parseJourneyLandSlim, resetJourneyLandCacheForTests, setJourneyLandTier,
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
    expect(land.stations[0]!.anchor).toEqual([1330, 640]);
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
      ["coastline", "districts", "extent", "homestead", "hosts", "kittyPlaza", "landforms", "lines", "lod", "reserves", "revision", "seaLevel", "stations", "terrain", "water", "yearWalk"].sort(),
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
    expect(SLIM_JSON).toMatchObject({ id: "journey-land", format: 1, revision: "horizon-geo-1", source: { index: HORIZON_INDEX_URL } });
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
    expect(() => parseJourneyLandSlim(gz({ ...SLIM_JSON, format: 2 }))).toThrow(/format/);
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

describe("three.js land", () => {
  const homes = [{ memberId: "MEM-001", plotId: "plot.terraces.1", layout: starterLayout() }];

  it("stays inside the land budget on full and lite", () => {
    const full = buildJourneyLand(land, { theme: "classic", tier: "full", homes });
    const lite = buildJourneyLand(land, { theme: "classic", tier: "lite", homes });
    const f = full.stats(), l = lite.stats();
    console.info(`[journey-land] full ${f.triangles} tris / ${f.drawCalls} draws · lite ${l.triangles} tris / ${l.drawCalls} draws`);
    expect(f.triangles).toBeLessThanOrEqual(25_000);
    expect(f.drawCalls).toBeLessThanOrEqual(20);
    expect(l.triangles).toBeLessThanOrEqual(15_000);
    expect(l.triangles).toBeLessThan(f.triangles);
    expect(full.group.getObjectByName("journey-land:terrain")).toBeTruthy();
    expect(full.group.getObjectByName("journey-land:hosts")).toBeTruthy();
    expect(full.group.getObjectByName("journey-land:home:MEM-001@plot.terraces.1")).toBeTruthy();
    full.dispose(); lite.dispose();
  });

  it("draws a provisional home translucent with an outline, and replaces homes in place", () => {
    const handle = buildJourneyLand(land, { theme: "taylor", tier: "full", homes: [] });
    const before = handle.stats();
    handle.setHomes([...homes, { memberId: "MEM-001", plotId: "plot.terraces.1", layout: starterLayout(), provisional: true }]);
    const provisional = handle.group.getObjectByName("journey-land:home:provisional:MEM-001@plot.terraces.1") as import("three").Mesh;
    expect(provisional).toBeTruthy();
    expect((provisional.material as import("three").Material).transparent).toBe(true);
    expect(handle.group.getObjectByName("journey-land:home:provisional-outline:MEM-001@plot.terraces.1")).toBeTruthy();
    const after = handle.stats();
    expect(after.drawCalls).toBeGreaterThan(before.drawCalls);
    expect(after.drawCalls).toBeLessThanOrEqual(20);
    handle.setHomes([]);
    expect(handle.stats()).toEqual(before);
    handle.dispose();
  });

  it("maps concept (x, y) to board space: x and z kept, y = compressHeight(rawHeightAt)", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    for (const [x, y] of [[1494, 1165], [1330, 640], [700, 470], [12.5, 1799], [1000, 900]] as const) {
      const p = handle.worldToBoard(x, y);
      expect(p[0]).toBe(x);
      expect(p[2]).toBe(y);
      expect(p[1]).toBeCloseTo(compressHeight(handle.rawHeightAt(x, y)), 9);
      expect(handle.heightAt(x, y)).toBeCloseTo(p[1], 9);
      expect(handle.worldToBoard(x, y, 1.2)[1]).toBeCloseTo(p[1] + 1.2, 9);
    }
    // On a lattice node the baked height is returned exactly.
    const { columns, step, heights } = land.terrain;
    expect(handle.rawHeightAt(40 * step, 30 * step)).toBeCloseTo(heights[30 * columns + 40]!, 5);
    // Stations sit on their anchors.
    for (const s of land.stations) { const at = handle.stationAt(s.id); expect([at[0], at[2]]).toEqual([...s.anchor]); }
    handle.dispose();
  });

  it("knows land from water: false on the sea and in Stillwater, true at the hosts", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "lite", homes: [] });
    expect(handle.isLand(40, 40)).toBe(false);
    expect(handle.isLand(1990, 1790)).toBe(false);
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

  it("hides minor roads at Sky, shows them closer, and recolours on a theme change", () => {
    const handle = buildJourneyLand(land, { theme: "classic", tier: "full", homes: [] });
    const minor = handle.group.getObjectByName("journey-land:lines:minor")!;
    expect(minor).toBeTruthy();
    const all = handle.stats();
    setJourneyLandTier(handle, "sky");
    expect(minor.visible).toBe(false);
    expect(handle.stats().drawCalls).toBe(all.drawCalls - 1);
    setJourneyLandTier(handle, "region");
    expect(minor.visible).toBe(true);
    const terrain = handle.group.getObjectByName("journey-land:terrain") as import("three").Mesh;
    const colours = () => Array.from((terrain.geometry.getAttribute("color").array as Float32Array).slice(0, 3000));
    const classic = colours();
    handle.setTheme("newfoundland");
    expect(colours()).not.toEqual(classic);
    handle.setTheme("classic");
    expect(colours()).toEqual(classic);
    handle.dispose();
    expect(handle.group.children).toHaveLength(0);
    expect(countDraws(handle.group)).toEqual({ triangles: 0, drawCalls: 0 });
  });
});

describe("flat twin", () => {
  it("uses the same coordinates as the 3D land", () => {
    const flat = journeyLandFlatData(land);
    const handle = buildJourneyLand(land, { theme: "classic", tier: "lite", homes: [] });
    expect(flat.viewBox).toEqual([0, 0, 2000, 1800]);
    expect(flat.stations.map((s) => s.id)).toEqual([...STATION_IDS]);
    for (const s of flat.stations) { const at = handle.stationAt(s.id); expect([s.x, s.y]).toEqual([at[0], at[2]]); }
    expect(flat.hosts).toHaveLength(land.hosts.length);
    for (const h of flat.hosts) {
      const door = land.hosts.find((x) => x.id === h.id)!.door, at = handle.worldToBoard(door[0], door[1]);
      expect([h.x, h.y]).toEqual([at[0], at[2]]);
    }
    expect(flat.hosts.find((h) => h.id === "home")).toEqual({ id: "home", x: 1494, y: 1165 });
    expect(flat.coast.startsWith("M")).toBe(true);
    expect(flat.lines).toHaveLength(land.lines.length);
    expect(flat.districts.every((d) => d.label.length > 0)).toBe(true);
    handle.dispose();
  });

  it("renders SVG with no WebGL, every host, and an accessible overlay slot", () => {
    const flat = journeyLandFlatData(land);
    for (const theme of JOURNEY_THEMES) {
      const bare = renderToStaticMarkup(createElement(JourneyLandFlat, { data: flat, theme }));
      expect(bare).toContain('viewBox="0 0 2000 1800"');
      expect(bare).toMatch(/^<svg[^>]*aria-hidden="true"/);
      expect(bare).toContain(`journey-land-flat--${theme}`);
      for (const h of flat.hosts) expect(bare).toContain(`data-land-host="${h.id}" data-x="${h.x}" data-y="${h.y}"`);
      const withOverlay = renderToStaticMarkup(createElement(JourneyLandFlat, { data: flat, theme }, createElement("circle", { "data-overlay": "piece", cx: 1032, cy: 652, r: 10 })));
      expect(withOverlay).not.toMatch(/^<svg[^>]*aria-hidden/);
      expect(withOverlay).toContain('<g class="journey-land-flat__overlay"><circle data-overlay="piece"');
      expect(withOverlay).toContain('<g class="journey-land-flat__land" aria-hidden="true">');
    }
  });
});

describe("dressings", () => {
  it("authors every key for every theme", () => {
    expect(LAND_DRESSING_KEYS.length).toBe(21);
    for (const theme of JOURNEY_THEMES) {
      const d = JOURNEY_LAND_DRESSINGS[theme];
      expect(Object.keys(d).sort()).toEqual([...LAND_DRESSING_KEYS].sort());
      for (const key of LAND_DRESSING_KEYS) expect(d[key], `${theme}.${key}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(JOURNEY_LAND_DRESSINGS.classic.sea).not.toBe(JOURNEY_LAND_DRESSINGS.newfoundland.sea);
  });
});
