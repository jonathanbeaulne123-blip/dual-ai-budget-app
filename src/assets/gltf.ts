import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The one place Hearth builds a `GLTFLoader`.
 *
 * Every GLB the app parses comes through here so that a model compressed with
 * `EXT_meshopt_compression` (what `scripts/optimize-models.mjs` writes) and a
 * model shipped exactly as it was sculpted both load with the same call. The
 * decoder is a pure function over the buffer — it never changes how a model
 * looks, only how its bytes travelled.
 *
 * Both the loader class and the decoder are imported lazily, so a screen that
 * draws no model pays for neither.
 *
 * Nothing here reads money, the DOM, or storage.
 */

let decoderReady: Promise<unknown> | null = null;

/** A loader that can read both plain and meshopt-compressed GLBs. */
export async function createGltfLoader(): Promise<import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("meshoptimizer"),
  ]);
  decoderReady ??= MeshoptDecoder.ready;
  await decoderReady;
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

/** Parse GLB bytes into the whole document — scene, animations and all. */
export async function parseGltf(bytes: ArrayBuffer): Promise<GLTF> {
  return (await createGltfLoader()).parseAsync(bytes, "");
}

/** Parse GLB bytes into their scene. */
export async function parseGlbScene(bytes: ArrayBuffer): Promise<THREE.Group> {
  return (await parseGltf(bytes)).scene;
}
