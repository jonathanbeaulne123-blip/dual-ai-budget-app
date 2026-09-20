import type * as THREE from "three";

/**
 * Minimal GLB loader (writer C owns the full ref-counted version; this copy keeps
 * the signature `loadGlb(url, {signal}) → Promise<THREE.Group>`).
 * Prefers the `.gz` twin and inflates it with DecompressionStream, like
 * `src/queen/world/queenModel.ts:37-48`.
 */
export async function loadGlb(url: string, opts: { signal?: AbortSignal } = {}): Promise<THREE.Group> {
  const { signal } = opts;
  const inflate = typeof DecompressionStream !== "undefined";
  let response = await fetch(url + (inflate ? ".gz" : ""), { signal });
  if (!response.ok && inflate) response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Model unavailable: ${url}`);
  let bytes = await response.arrayBuffer();
  const head = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (inflate && head[0] === 31 && head[1] === 139) bytes = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  if (signal?.aborted) throw new DOMException("Closed", "AbortError");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  if (signal?.aborted) throw new DOMException("Closed", "AbortError");
  return gltf.scene;
}
