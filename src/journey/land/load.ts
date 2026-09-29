/**
 * `loadJourneyLand()` — the Journey Board's ONLY network read (T2; REVIEW M2).
 *
 * Slim path first: ONE request for the baked `JourneyLandData` (`/horizon/world/<revision>.journey.json.gz`, ≈ 21 KB
 * gzip, terrain lattice embedded; written by `scripts/horizon/bake-terrain.mjs` from the same index and terrain and held
 * by its `--check`). Validated by revision and format (`slim.ts`).
 *
 * Fallback (an older deploy, a dev tree without a rebake, a 404, a revision/format mismatch or a parse failure): the
 * index path — fetch the baked Horizon index and the terrain asset, validate the geography revision
 * (`parseHorizonIndex`), decode only the 20 m `journey` LOD and copy what `JourneyLandData` names (`extract.ts`). It
 * never calls `loadHorizonAssets`: that module-level cache holds the whole world object HorizonWorld needs. The parsed
 * index goes out of scope when this resolves. `journeyLandTimings().path` records which path served the land.
 *
 * One load per session (module-level promise). Each caller may pass an AbortSignal: an aborted caller is rejected
 * with an AbortError; the shared request itself is cancelled (and forgotten) only when every waiting caller has aborted
 * before it finished. An abort never falls back. A failure is forgotten too, so a later call retries.
 */
import type { JourneyLandData, LoadJourneyLand } from "../contracts.ts";
import { HORIZON_INDEX_URL, parseHorizonIndex } from "../../house/world/horizonAssets.ts";
import { decodeTerrainAsset } from "../../harbour/horizon/land/terrain/asset.ts";
import { HORIZON_GEOGRAPHY } from "../../worldGeography.ts";
import { extractJourneyLand } from "./extract.ts";
import { JOURNEY_LAND_SLIM_URL, parseJourneyLandSlim } from "./slim.ts";

/** The terrain asset's usual address; the index's `heightfield.url` is authoritative (re-fetched if it differs). */
const TERRAIN_GUESS_URL = `/horizon/terrain/${HORIZON_GEOGRAPHY}.bin`;
const TERRAIN_LIMIT = 2_500_000;
/** The slim artefact is ≈ 21 KB gzip / ≈ 100 KB raw; anything far larger is not it. */
const SLIM_LIMIT = 1_000_000;

/**
 * Timings of the last successful load (ms), for the performance note (PLAN R3 / REVIEW M2).
 * `path`: "slim" (one request, the baked Journey land) or "index" (fallback: index + terrain, parsed and extracted here).
 * `parseMs`: decode of whatever was fetched (slim JSON + lattice, or the index JSON). `extractMs`: 0 on the slim path.
 * `indexBytes` / `terrainBytes`: 0 on the slim path. `slimBytes`: the slim response (0 when it was not usable).
 * `fallbackReason`: why the slim path was not used (absent on the slim path).
 */
export type JourneyLandTimings = {
  path: "slim" | "index"; fetchMs: number; parseMs: number; extractMs: number;
  slimBytes: number; indexBytes: number; terrainBytes: number; fallbackReason?: string;
};
let lastTimings: JourneyLandTimings | null = null;
export function journeyLandTimings(): JourneyLandTimings | null { return lastTimings; }

/** `pinned`: a caller without a signal holds the shared promise, so it is never cancelled. */
type Shared = { promise: Promise<JourneyLandData>; controller: AbortController; waiters: number; pinned: boolean; settled: boolean; failed: boolean };
let shared: Shared | null = null;

const abortError = () => new DOMException("The Journey land load was cancelled.", "AbortError");
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const isAbort = (error: unknown) => (error as { name?: unknown } | null)?.name === "AbortError";

function unavailable(response: Response): boolean {
  return !response.ok || /text\/html/.test(response.headers.get("content-type") ?? "");
}

/** The slim path; resolves `{ reason }` when it cannot serve, so the caller falls back. Aborts propagate. */
async function fetchSlim(signal: AbortSignal): Promise<{ data: JourneyLandData; timings: JourneyLandTimings } | { reason: string }> {
  const started = now();
  let bytes: ArrayBuffer;
  try {
    const response = await fetch(JOURNEY_LAND_SLIM_URL, { signal });
    if (unavailable(response)) return { reason: `slim ${response.status}${response.ok ? " html" : ""}` };
    bytes = await response.arrayBuffer();
  } catch (error) {
    if (signal.aborted || isAbort(error)) throw error;
    return { reason: "slim request failed" };
  }
  if (bytes.byteLength > SLIM_LIMIT) return { reason: "slim too large" };
  const parseStart = now();
  try {
    const data = parseJourneyLandSlim(bytes, HORIZON_GEOGRAPHY);
    return { data, timings: { path: "slim", fetchMs: parseStart - started, parseMs: now() - parseStart, extractMs: 0, slimBytes: bytes.byteLength, indexBytes: 0, terrainBytes: 0 } };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : "slim unreadable" };
  }
}

/** The index path (fallback): index + terrain → parse → extract. */
async function fetchFromIndex(signal: AbortSignal, fallbackReason: string): Promise<JourneyLandData> {
  const started = now();
  const [indexResponse, guessResponse] = await Promise.all([fetch(HORIZON_INDEX_URL, { signal }), fetch(TERRAIN_GUESS_URL, { signal })]);
  if (unavailable(indexResponse)) throw new Error("The island map is unavailable right now.");
  const indexBytes = await indexResponse.arrayBuffer();
  const parseStart = now();
  const world = parseHorizonIndex(indexBytes);
  const parseMs = now() - parseStart;
  const ref = world.heightfield;
  if (ref.kind !== "baked") throw new Error("The island map has no baked terrain.");
  let terrainResponse = guessResponse;
  if (ref.url !== TERRAIN_GUESS_URL) terrainResponse = await fetch(ref.url, { signal });
  if (unavailable(terrainResponse)) throw new Error("The island terrain is unavailable right now.");
  const terrainBytes = await terrainResponse.arrayBuffer();
  if (terrainBytes.byteLength > TERRAIN_LIMIT) throw new Error("The island terrain exceeds its 2.5 MB budget.");
  if (ref.bytes && terrainBytes.byteLength !== ref.bytes) throw new Error("The island terrain and map index are from different bakes.");
  const extractStart = now();
  const data = extractJourneyLand(world, decodeTerrainAsset(terrainBytes, "journey"));
  const extractMs = now() - extractStart;
  lastTimings = { path: "index", fetchMs: parseStart - started, parseMs, extractMs, slimBytes: 0, indexBytes: indexBytes.byteLength, terrainBytes: terrainBytes.byteLength, fallbackReason };
  return data;
}

async function fetchLand(signal: AbortSignal): Promise<JourneyLandData> {
  const slim = await fetchSlim(signal);
  if ("data" in slim) { lastTimings = slim.timings; return slim.data; }
  if (signal.aborted) throw abortError();
  return fetchFromIndex(signal, slim.reason);
}

function start(): Shared {
  const controller = new AbortController();
  const entry: Shared = { promise: Promise.resolve() as unknown as Promise<JourneyLandData>, controller, waiters: 0, pinned: false, settled: false, failed: false };
  entry.promise = fetchLand(controller.signal).then(
    (data) => { entry.settled = true; return data; },
    (error: unknown) => { entry.settled = true; entry.failed = true; if (shared === entry) shared = null; throw error; },
  );
  // A rejection is always delivered to the callers; keep an unobserved one from surfacing as unhandled.
  entry.promise.catch(() => undefined);
  return entry;
}

export const loadJourneyLand: LoadJourneyLand = (signal) => {
  if (signal?.aborted) return Promise.reject(abortError());
  if (!shared) shared = start();
  const entry = shared;
  // Without a signal, or once the land is here, every caller gets the one shared promise.
  if (!signal) { entry.pinned = true; return entry.promise; }
  if (entry.settled && !entry.failed) return entry.promise;
  entry.waiters += 1;
  return new Promise<JourneyLandData>((resolve, reject) => {
    let done = false;
    const finish = () => { done = true; entry.waiters -= 1; signal.removeEventListener("abort", onAbort); };
    const onAbort = () => {
      if (done) return;
      finish();
      if (entry.waiters <= 0 && !entry.pinned && !entry.settled) {
        entry.controller.abort();
        if (shared === entry) shared = null;
      }
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    entry.promise.then(
      (data) => { if (done) return; finish(); resolve(data); },
      (error: unknown) => { if (done) return; finish(); reject(error); },
    );
  });
};

/** Tests only: forget the session's land so the next call fetches again. */
export function resetJourneyLandCacheForTests(): void {
  shared = null;
  lastTimings = null;
}
