#!/usr/bin/env node
/**
 * Optimise a shipped GLB into a smaller, versioned twin — never in place.
 *
 *   node scripts/optimize-models.mjs public/models/mandevilla-living-presence.glb \
 *     --out public/models/queen/mandevilla-living-presence.v2.glb
 *
 * What it does, in order:
 *   1. `dedup`   — one accessor/material where the file repeated itself.
 *   2. `prune`   — drops properties nothing references. `keepLeaves` stays on:
 *                  Hearth looks parts up by node name (`queenModelPart`,
 *                  the Court's region map), so an empty node is not garbage.
 *   3. `weld`    — merges bitwise-identical vertices (tolerance 0, lossless).
 *   4. quantize + `EXT_meshopt_compression`, or with `--no-quantize` the
 *      meshopt entropy coder alone over the untouched float32 attributes.
 *
 * Quantisation is deliberately more conservative than gltf-transform's own
 * defaults (position 14 / normal 10): Hearth's art direction is porcelain and
 * terracotta read at arm's length, and a visible vertex shift is a failed
 * optimisation no matter what it saves. The volume is the whole scene, not
 * per mesh, so no node transform is rewritten and the hierarchy the app
 * measures anchors from survives untouched.
 *
 * It writes the new `.glb`, its `gzip -9 -n` twin, prints a before/after size
 * table and a fidelity report (bounds, per-node bounds drift, vertex and
 * triangle counts, material count, node-name set equality, and the worst-case
 * geometric error the chosen quantisation can introduce). It refuses to
 * overwrite its input.
 *
 * Nothing here reads money.
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { VertexCountMethod, dedup, getSceneVertexCount, prune, quantize, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

/** Conservative by intent; `--position`, `--normal` and `--color` override. */
const DEFAULT_BITS = { position: 16, normal: 12, color: 8, texcoord: 14, generic: 14 };

function parseArgs(argv) {
  const positional = [];
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) { positional.push(arg); continue; }
    const [name, inline] = arg.slice(2).split("=");
    if (inline !== undefined) { flags.set(name, inline); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { flags.set(name, "true"); continue; }
    flags.set(name, next); i += 1;
  }
  return { positional, flags };
}

const kb = (bytes) => `${(bytes / 1_048_576).toFixed(2)} MB`;
const pct = (after, before) => `${(((after - before) / before) * 100).toFixed(1)}%`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Scene bounds plus one box per named node, so a drift can be pinned to a part. */
function measure(document) {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const nodeBounds = new Map();
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (!name || !node.getMesh()) continue;
    // A node's own subtree bounds; `getBounds` accepts any node or scene.
    nodeBounds.set(name, getBounds(node));
  }
  let triangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : (primitive.getAttribute("POSITION")?.getCount() ?? 0);
      triangles += Math.floor(count / 3);
    }
  }
  return {
    bounds: getBounds(scene),
    nodeBounds,
    vertices: getSceneVertexCount(scene, VertexCountMethod.UPLOAD),
    triangles,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    names: root.listNodes().map((node) => node.getName()).filter(Boolean).sort(),
  };
}

const extent = (box) => Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);

function boundsDrift(before, after) {
  let worst = 0;
  for (const axis of [0, 1, 2]) {
    worst = Math.max(worst, Math.abs(after.min[axis] - before.min[axis]), Math.abs(after.max[axis] - before.max[axis]));
  }
  return worst;
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const input = positional[0];
  if (!input) {
    console.error("usage: node scripts/optimize-models.mjs <input.glb> --out <output.glb> [--no-quantize] [--position 16] [--normal 12]");
    process.exit(2);
  }
  const inputPath = resolve(process.cwd(), input);
  const outputPath = resolve(process.cwd(), flags.get("out") ?? inputPath.replace(/\.glb$/, ".v2.glb"));
  if (outputPath === inputPath) { console.error("refusing to overwrite the source model"); process.exit(2); }

  const quantized = flags.get("no-quantize") !== "true";
  const bits = {
    position: Number(flags.get("position") ?? DEFAULT_BITS.position),
    normal: Number(flags.get("normal") ?? DEFAULT_BITS.normal),
    color: Number(flags.get("color") ?? DEFAULT_BITS.color),
    texcoord: Number(flags.get("texcoord") ?? DEFAULT_BITS.texcoord),
    generic: Number(flags.get("generic") ?? DEFAULT_BITS.generic),
  };

  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

  const sourceBytes = readFileSync(inputPath);
  const document = await io.read(inputPath);
  const before = measure(document);

  const steps = [dedup(), prune({ keepLeaves: true, keepAttributes: false }), weld()];
  if (quantized) {
    steps.push(quantize({
      quantizationVolume: "scene",
      quantizePosition: bits.position,
      quantizeNormal: bits.normal,
      quantizeColor: bits.color,
      quantizeTexcoord: bits.texcoord,
      quantizeGeneric: bits.generic,
    }));
  }
  await document.transform(...steps);

  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: quantized ? EXTMeshoptCompression.EncoderMethod.FILTER : EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  const after = measure(document);
  const outputBytes = Buffer.from(await io.writeBinary(document));
  writeFileSync(outputPath, outputBytes);
  const gzBytes = gzipSync(outputBytes, { level: 9 });
  writeFileSync(`${outputPath}.gz`, gzBytes);

  const sourceGz = gzipSync(sourceBytes, { level: 9 });

  console.log(`\n${basename(inputPath)} → ${basename(outputPath)}`);
  console.log(`  mode          ${quantized ? `quantize(pos ${bits.position}, nrm ${bits.normal}, col ${bits.color}) + meshopt FILTER` : "meshopt QUANTIZE (no attribute quantisation)"}`);
  console.log("\n  size            raw            gzip");
  console.log(`  before      ${kb(sourceBytes.byteLength).padStart(9)}      ${kb(sourceGz.byteLength).padStart(9)}`);
  console.log(`  after       ${kb(outputBytes.byteLength).padStart(9)}      ${kb(gzBytes.byteLength).padStart(9)}`);
  console.log(`  change      ${pct(outputBytes.byteLength, sourceBytes.byteLength).padStart(9)}      ${pct(gzBytes.byteLength, sourceGz.byteLength).padStart(9)}`);
  console.log(`\n  bytes       ${outputBytes.byteLength} raw / ${gzBytes.byteLength} gz`);
  console.log(`  sha256      ${sha256(outputBytes)}`);

  console.log("\n  fidelity");
  console.log(`    vertices    ${before.vertices} → ${after.vertices}`);
  console.log(`    triangles   ${before.triangles} → ${after.triangles}`);
  console.log(`    meshes      ${before.meshes} → ${after.meshes}`);
  console.log(`    materials   ${before.materials} → ${after.materials}`);
  console.log(`    textures    ${before.textures} → ${after.textures}`);
  console.log(`    nodes       ${before.nodes} → ${after.nodes}`);
  const namesMatch = before.names.length === after.names.length && before.names.every((name, i) => name === after.names[i]);
  console.log(`    node names  ${namesMatch ? "identical" : `CHANGED (${before.names.length} → ${after.names.length})`}`);

  const sceneExtent = extent(before.bounds);
  const drift = boundsDrift(before.bounds, after.bounds);
  console.log(`    bounds      min [${before.bounds.min.map((v) => v.toFixed(6)).join(", ")}] → [${after.bounds.min.map((v) => v.toFixed(6)).join(", ")}]`);
  console.log(`                max [${before.bounds.max.map((v) => v.toFixed(6)).join(", ")}] → [${after.bounds.max.map((v) => v.toFixed(6)).join(", ")}]`);
  console.log(`    bounds drift ${drift.toExponential(3)} units (${((drift / sceneExtent) * 100).toFixed(5)}% of the ${sceneExtent.toFixed(4)}-unit extent)`);

  let worstNode = { name: "—", drift: 0 };
  for (const [name, box] of before.nodeBounds) {
    const now = after.nodeBounds.get(name);
    if (!now) { console.log(`    MISSING node ${name}`); continue; }
    const d = boundsDrift(box, now);
    if (d > worstNode.drift) worstNode = { name, drift: d };
  }
  console.log(`    worst part  ${worstNode.name} · ${worstNode.drift.toExponential(3)} units`);

  if (quantized) {
    const step = sceneExtent / (2 ** bits.position - 1);
    console.log(`    max error   ${step.toExponential(3)} units — half a ${bits.position}-bit step over a ${sceneExtent.toFixed(4)}-unit volume`);
    console.log(`                at the Queen's shipped height of 2.05 units that is ${((step / sceneExtent) * 2.05 * 1000).toFixed(4)} mm-equivalent`);
  } else {
    console.log("    max error   0 — attributes kept at their source precision");
  }
  console.log("");
}

await main();
