// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import {
  ALL_COURT_ASSETS,
  COURT_ASSETS,
  COURT_QUEEN_MAX_BYTES,
  PIECE_MAX_BYTES,
  QUEEN_ASSETS,
  QUEEN_COURT_HEIGHT,
  pieceHeight,
  queenAssetForTier,
  suggestedScaleBesideQueen,
  type GlbAsset,
} from "../src/harbour/assets/manifest.ts";
import { BLOOM_MASTER_SHA256 } from "../src/house/world/bloom.ts";
import { acquireGlb, glbCached, glbHolds, preloadCourtAssets, readGlb } from "../src/harbour/assets/loadGlb.ts";

const publicFile = (url: string) => resolve(process.cwd(), `public${url}`);
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const rows = (table: Readonly<Record<string, GlbAsset>>) => Object.entries(table) as [string, GlbAsset][];

/** A GLB starts with the ASCII magic `glTF`, then version 2. */
const isGlb = (bytes: Buffer) => bytes.subarray(0, 4).toString("latin1") === "glTF" && bytes.readUInt32LE(4) === 2;

describe("Little Harbour · the Court's assets ship exactly as listed (BUILD_PLAN §3–4)", () => {
  it("lists three pieces and two Queens, every url distinct and under /models/", () => {
    expect(Object.keys(COURT_ASSETS).sort()).toEqual(["bishop", "knight", "rook"]);
    expect(Object.keys(QUEEN_ASSETS).sort()).toEqual(["court", "presence"]);
    const urls = ALL_COURT_ASSETS.map((asset) => asset.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(url).toMatch(/^\/models\/.+\.glb$/);
  });

  it("hashes and sizes every manifest entry against the file in public/", () => {
    for (const asset of ALL_COURT_ASSETS) {
      const bytes = readFileSync(publicFile(asset.url));
      expect(isGlb(bytes), asset.url).toBe(true);
      expect(bytes.byteLength, `${asset.url} bytes`).toBe(asset.bytes);
      expect(sha256(bytes), `${asset.url} sha256`).toBe(asset.sha256);
    }
  });

  it("ships a gzip twin for every entry that declares one, inflating to the same bytes", () => {
    for (const asset of ALL_COURT_ASSETS) {
      if (asset.gz === null) continue;
      expect(asset.gz, asset.url).toBe(`${asset.url}.gz`);
      expect(existsSync(publicFile(asset.gz)), asset.gz).toBe(true);
      const inflated = gunzipSync(readFileSync(publicFile(asset.gz)));
      expect(inflated.byteLength, asset.gz).toBe(asset.bytes);
      expect(sha256(inflated), asset.gz).toBe(asset.sha256);
      // The twin is worth serving: it must actually be smaller than the raw file.
      expect(readFileSync(publicFile(asset.gz)).byteLength, `${asset.gz} smaller`).toBeLessThan(asset.bytes);
    }
  });

  it("keeps each piece and the court Queen under their byte budgets, with the twins the phone actually fetches", () => {
    for (const [id, asset] of rows(COURT_ASSETS)) {
      expect(asset.bytes, id).toBeLessThanOrEqual(PIECE_MAX_BYTES);
      expect(asset.gz, `${id} has a gzip twin`).not.toBeNull();
      expect(asset.tier).toBe("any");
    }
    expect(QUEEN_ASSETS.court.bytes).toBeLessThanOrEqual(COURT_QUEEN_MAX_BYTES);
    expect(QUEEN_ASSETS.court.gz).not.toBeNull();
    expect(QUEEN_ASSETS.court.tier).toBe("lite");
    expect(QUEEN_ASSETS.presence.tier).toBe("full");
  });

  it("names the same Living Presence master the house draws", () => {
    expect(QUEEN_ASSETS.presence.sha256).toBe(BLOOM_MASTER_SHA256);
    expect(QUEEN_ASSETS.presence.url).toBe("/models/mandevilla-living-presence.glb");
    expect(queenAssetForTier("full")).toBe(QUEEN_ASSETS.presence);
    expect(queenAssetForTier("lite")).toBe(QUEEN_ASSETS.court);
  });

  it("carries the same node names in the court Queen as in the master, so one region map serves both", () => {
    const names = (url: string) => {
      const bytes = readFileSync(publicFile(url));
      const jsonLength = bytes.readUInt32LE(12);
      const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as { nodes?: { name?: string }[] };
      return (json.nodes ?? []).map((node) => node.name ?? "").filter(Boolean).sort();
    };
    const master = names(QUEEN_ASSETS.presence.url), court = names(QUEEN_ASSETS.court.url);
    expect(court.length).toBeGreaterThan(50);
    expect(court).toEqual(master);
  });

  it("sizes the pieces beside a 2.05-unit Queen, all shorter than her", () => {
    expect(QUEEN_COURT_HEIGHT).toBe(2.05);
    expect(suggestedScaleBesideQueen).toEqual({ knight: 0.79, bishop: 0.91, rook: 0.82 });
    for (const id of ["knight", "bishop", "rook"] as const) {
      expect(pieceHeight(id)).toBeCloseTo(2.05 * suggestedScaleBesideQueen[id], 9);
      expect(pieceHeight(id)).toBeLessThan(QUEEN_COURT_HEIGHT);
    }
    expect(pieceHeight("bishop")).toBeGreaterThan(pieceHeight("rook"));
    expect(pieceHeight("rook")).toBeGreaterThan(pieceHeight("knight"));
  });
});

/** Serve public/ through fetch, remembering what was asked for; `missing` urls answer 404, `hang` never answer. */
function serveFromPublic(options: { missing?: string[]; hang?: string[] } = {}) {
  const asked: string[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    asked.push(url);
    if (options.hang?.includes(url)) return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Closed", "AbortError"))));
    if (options.missing?.includes(url) || !existsSync(publicFile(url))) return new Response(null, { status: 404 });
    const bytes = readFileSync(publicFile(url));
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return new Response(copy, { status: 200 });
  });
  vi.stubGlobal("fetch", stub);
  return asked;
}

describe("Little Harbour · loadGlb: gzip first, one parsed scene per url, holds counted, abortable", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("fetches the gzip twin first and inflates it to the listed bytes", async () => {
    const asked = serveFromPublic();
    const bytes = await readGlb(COURT_ASSETS.knight);
    expect(asked).toEqual([COURT_ASSETS.knight.gz]);
    expect(bytes.byteLength).toBe(COURT_ASSETS.knight.bytes);
    expect(sha256(new Uint8Array(bytes))).toBe(COURT_ASSETS.knight.sha256);
  });

  it("falls back to the raw file when the twin is missing, and goes straight to raw when none is declared", async () => {
    const asked = serveFromPublic({ missing: [COURT_ASSETS.rook.gz ?? ""] });
    const bytes = await readGlb(COURT_ASSETS.rook);
    expect(asked).toEqual([COURT_ASSETS.rook.gz, COURT_ASSETS.rook.url]);
    expect(bytes.byteLength).toBe(COURT_ASSETS.rook.bytes);
    asked.length = 0;
    await readGlb({ ...COURT_ASSETS.rook, gz: null });
    expect(asked).toEqual([COURT_ASSETS.rook.url]);
  });

  it("shares one parsed scene between holds and disposes it on the last release", async () => {
    const asked = serveFromPublic();
    const asset = COURT_ASSETS.bishop;
    const [a, b] = await Promise.all([acquireGlb(asset), acquireGlb(asset)]);
    expect(asked.filter((url) => url === asset.gz)).toHaveLength(1);
    expect(a.root).toBe(b.root);
    expect(glbHolds(asset.url)).toBe(2);
    expect(glbCached(asset.url)).toBe(true);
    let meshes = 0; a.root.traverse((node) => { if ((node as { isMesh?: boolean }).isMesh) meshes += 1; });
    expect(meshes).toBeGreaterThan(10);
    const geometry = (() => { let found: { dispose: () => void } | null = null; a.root.traverse((node) => { const mesh = node as { isMesh?: boolean; geometry?: { dispose: () => void } }; if (!found && mesh.isMesh && mesh.geometry) found = mesh.geometry; }); return found!; })();
    const dispose = vi.spyOn(geometry, "dispose");
    a.release(); a.release();
    expect(glbHolds(asset.url)).toBe(1);
    expect(dispose).not.toHaveBeenCalled();
    b.release();
    expect(glbHolds(asset.url)).toBe(0);
    expect(glbCached(asset.url)).toBe(false);
    expect(dispose).toHaveBeenCalled();
    // A fresh hold after the last release fetches again: nothing stale is kept.
    const c = await acquireGlb(asset);
    expect(asked.filter((url) => url === asset.gz)).toHaveLength(2);
    expect(c.root).not.toBe(a.root);
    c.release();
  });

  it("rejects an aborted hold with AbortError and keeps no count for it", async () => {
    serveFromPublic({ hang: [COURT_ASSETS.knight.gz ?? ""] });
    const controller = new AbortController();
    const pending = acquireGlb(COURT_ASSETS.knight, controller.signal);
    expect(glbHolds(COURT_ASSETS.knight.url)).toBe(1);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(glbHolds(COURT_ASSETS.knight.url)).toBe(0);
    const already = new AbortController(); already.abort();
    await expect(acquireGlb(COURT_ASSETS.knight, already.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(glbHolds(COURT_ASSETS.knight.url)).toBe(0);
  });

  it("preloads the lite court in order — the Queen, then the pieces — and hands back one release for all", async () => {
    const asked = serveFromPublic();
    const release = await preloadCourtAssets("lite");
    expect(asked).toEqual([QUEEN_ASSETS.court.gz, COURT_ASSETS.knight.gz, COURT_ASSETS.bishop.gz, COURT_ASSETS.rook.gz]);
    for (const asset of [QUEEN_ASSETS.court, COURT_ASSETS.knight, COURT_ASSETS.bishop, COURT_ASSETS.rook]) expect(glbHolds(asset.url), asset.url).toBe(1);
    release();
    for (const asset of [QUEEN_ASSETS.court, COURT_ASSETS.knight, COURT_ASSETS.bishop, COURT_ASSETS.rook]) expect(glbHolds(asset.url), asset.url).toBe(0);
  });
});
