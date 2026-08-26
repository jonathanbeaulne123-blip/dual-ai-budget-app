import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, "dist/hercules-pro");
const modelSource = resolve(root, "models/hercules.pro.glb");
const modelOutput = resolve(outputDirectory, "hercules.pro.v1.glb");

await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: [resolve(root, "workers/hercules-pro-ui/widget.ts")],
  outfile: resolve(outputDirectory, "companion.v1.js"),
  bundle: true,
  format: "esm",
  minify: true,
  sourcemap: false,
  target: ["es2022"],
  legalComments: "none",
});
await copyFile(modelSource, modelOutput);

const model = await stat(modelOutput);
if (model.size > 3_000_000) {
  throw new Error(`Hercules Pro model is ${model.size} bytes; keep the preserved-rig build below 3 MB.`);
}

const glb = await readFile(modelSource);
if (glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(16) !== 0x4e4f534a) {
  throw new Error("Hercules Pro model is not a valid JSON-first GLB.");
}
const jsonLength = glb.readUInt32LE(12);
const manifest = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
const nodeNames = new Set((manifest.nodes ?? []).map((node) => node.name));
const requiredRig = [
  "rig_head",
  "rig_chest",
  "rig_eyelid_L",
  "rig_eyelid_R",
  "rig_ear_L",
  "rig_ear_R",
  "rig_tailBase",
  ...Array.from({ length: 10 }, (_, index) => `rig_tail_${String(index + 1).padStart(2, "0")}`),
];
const missingRig = requiredRig.filter((name) => !nodeNames.has(name));
if (missingRig.length) {
  throw new Error(`Hercules Pro model lost its animation rig: ${missingRig.join(", ")}.`);
}
