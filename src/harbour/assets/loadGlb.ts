import * as THREE from "three";
import { disposeObject } from "../../house/world/bloom.ts";
import { COURT_ASSETS, queenAssetForTier, type GlbAsset } from "./manifest.ts";

/**
 * Little Harbour · loading a GLB for the Court (BUILD_PLAN #27).
 *
 * - Fetches the gzip twin first and inflates it with `DecompressionStream`
 *   (the same recipe as `queenModel.ts` `readQueenModel`), falling back to the
 *   raw `.glb` when the browser cannot inflate or the twin is missing.
 * - Parses with `GLTFLoader.parseAsync` (imported lazily, so the loader's
 *   weight is paid only by a scene that draws).
 * - Keeps one parsed scene per url in a ref-counted cache: every `acquire`
 *   returns the same shared root, callers clone what they place, and the
 *   last `release` disposes the shared geometry through `disposeObject`.
 * - Honours an `AbortSignal`: an aborted acquire drops its hold and rejects
 *   with an `AbortError`; the shared load itself finishes for anyone else
 *   still waiting on it.
 *
 * Nothing here reads money, the DOM, or storage.
 */

export type GlbHandle = {
  /** The shared parsed scene. Clone it (`root.clone(true)`) before placing or altering it. */
  root: THREE.Group;
  /** The asset this hold is on. */
  asset: GlbAsset;
  /** Let go of the hold. Idempotent; the shared scene is disposed on the last release. */
  release(): void;
};

type CacheEntry = { promise: Promise<THREE.Group>; root: THREE.Group | null; users: number };

const cache = new Map<string, CacheEntry>();

const abortError = () => new DOMException("Closed", "AbortError");

const isGzip = (bytes: ArrayBuffer) => {
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  return head[0] === 31 && head[1] === 139;
};

/** Inflate a gzip buffer with the browser's own stream — no Blob, which some hosts (jsdom) cannot stream. */
async function inflateGzip(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const source = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(new Uint8Array(bytes)); controller.close(); } });
  return new Response(source.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}

/** Fetch the asset's bytes, gzip twin first where the browser can inflate it, raw otherwise. */
export async function readGlb(asset: GlbAsset, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (signal?.aborted) throw abortError();
  const inflate = typeof DecompressionStream !== "undefined" && asset.gz !== null;
  let response: Response | null = null;
  if (inflate && asset.gz) {
    try { response = await fetch(asset.gz, { signal }); } catch (error) { if (signal?.aborted) throw error; response = null; }
    if (response && !response.ok) response = null;
  }
  if (!response) response = await fetch(asset.url, { signal });
  if (!response.ok) throw new Error(`Court asset unavailable: ${asset.url}`);
  let bytes = await response.arrayBuffer();
  // A host that already inflated the transfer copy hands back the glb itself; only real gzip is inflated here.
  if (inflate && isGzip(bytes)) bytes = await inflateGzip(bytes);
  if (signal?.aborted) throw abortError();
  return bytes;
}

/** Parse GLB bytes into a scene. The loader is imported on first use. */
export async function parseGlb(bytes: ArrayBuffer): Promise<THREE.Group> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  return gltf.scene;
}

function dropHold(url: string): void {
  const entry = cache.get(url);
  if (!entry) return;
  entry.users -= 1;
  if (entry.users > 0) return;
  cache.delete(url);
  if (entry.root) disposeObject(entry.root);
  else entry.promise.then((root) => { if (!cache.has(url)) disposeObject(root); }, () => undefined);
}

/**
 * Take a hold on the asset's parsed scene. The first caller for a url starts
 * the fetch; later callers share it. Release the handle when the scene that
 * placed it is disposed.
 */
export async function acquireGlb(asset: GlbAsset, signal?: AbortSignal): Promise<GlbHandle> {
  if (signal?.aborted) throw abortError();
  let entry = cache.get(asset.url);
  if (!entry) {
    const fresh: CacheEntry = { promise: Promise.resolve(new THREE.Group()), root: null, users: 0 };
    fresh.promise = readGlb(asset).then(parseGlb).then((root) => { fresh.root = root; return root; });
    fresh.promise.catch(() => { if (cache.get(asset.url) === fresh) cache.delete(asset.url); });
    cache.set(asset.url, fresh);
    entry = fresh;
  }
  entry.users += 1;
  let released = false;
  const release = () => { if (released) return; released = true; dropHold(asset.url); };
  const abort = signal ? abortRace(signal) : null;
  try {
    const root = await (abort ? Promise.race([entry.promise, abort.rejected]) : entry.promise);
    if (signal?.aborted) throw abortError();
    return { root, asset, release };
  } catch (error) {
    release();
    throw error;
  } finally {
    abort?.unlisten();
  }
}

/** A promise that rejects with AbortError when the signal fires, and a way to stop listening once the race is over. */
function abortRace(signal: AbortSignal): { rejected: Promise<never>; unlisten: () => void } {
  let reject: (error: Error) => void = () => undefined;
  const rejected = new Promise<never>((_, r) => { reject = r; });
  const onAbort = () => reject(abortError());
  signal.addEventListener("abort", onAbort, { once: true });
  return { rejected, unlisten: () => signal.removeEventListener("abort", onAbort) };
}

/** How many holds a url has right now (0 when it is not cached). For tests and the runtime's own bookkeeping. */
export function glbHolds(url: string): number {
  return cache.get(url)?.users ?? 0;
}

/** Is a parsed scene for this url resident? */
export function glbCached(url: string): boolean {
  return cache.get(url)?.root != null;
}

/**
 * Warm the Court: the Queen for the tier first, then the three pieces one
 * after another (each parse is main-thread work; the Queen must be on screen
 * before a piece competes with her). Resolves to a function that lets go of
 * every hold the preload took — call it once the scene has taken its own.
 */
export async function preloadCourtAssets(tier: "full" | "lite", signal?: AbortSignal): Promise<() => void> {
  const held: GlbHandle[] = [];
  const releaseAll = () => { for (const handle of held.splice(0)) handle.release(); };
  try {
    held.push(await acquireGlb(queenAssetForTier(tier), signal));
    for (const piece of [COURT_ASSETS.knight, COURT_ASSETS.bishop, COURT_ASSETS.rook]) held.push(await acquireGlb(piece, signal));
  } catch (error) {
    releaseAll();
    throw error;
  }
  return releaseAll;
}
