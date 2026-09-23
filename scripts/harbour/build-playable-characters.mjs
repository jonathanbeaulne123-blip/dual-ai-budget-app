#!/usr/bin/env node
/**
 * Builds Little Harbour's two playable character surfaces from the supplied
 * static character deliveries.  The deliveries are read directly from their
 * ZIPs; no source payload, preview, or viewer is copied into the repository.
 *
 * Their crossed-leg poses are intentionally not shipped as a pose source.
 * We retain the recognisable authored face, hair/headwear, and coat torso,
 * then the runtime places that surface over Hearth's neutral procedural biped.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, normals, prune, quantize, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const root = new URL("../../", import.meta.url);
const output = new URL("../../public/models/players/", import.meta.url);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const triangles = (doc) => doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((total, primitive) => total + Math.floor((primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3), 0);
const countDrawMaterials = (doc) => new Set(doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()).map((primitive) => primitive.getMaterial()).filter(Boolean)).size;

const supplied = [
  {
    avatar: "bianca", zip: "C:/Users/jonat/Downloads/Woman_Cap_06_Complete.zip", glb: "Woman_Cap_06/Woman_Cap_06.glb",
    // The supplied audit omitted one `e` after `7c79410`; the ZIP byte hash
    // below is the value we actually fence before deriving anything.
    sha256: "7c79410eeea65a27b55346b0914a7e97392117ec49bc5ec08cddf046371bb94e",
    // Face/head, hair/cap and jacket body only. Bent pocket arms and crossed
    // legs stay out: they cannot be animated honestly.
    keep: /rounded face|tapered neck|ear|happy eye|eyebrow|asymmetric smile|shaped nose|jacket chest|standing collar|closure seam|center-back jacket|rooted scalp|hair|crown|curl|cap|visor|fabric button|adjustment strap/i,
    material: (name) => /face|neck|ear|eye|eyebrow|smile|nose/i.test(name) ? "skin" : /hair|scalp|curl/i.test(name) ? "hair" : /cap|visor|button|strap/i.test(name) ? "headwear" : "coat",
  },
  {
    avatar: "jonathan", zip: "C:/Users/jonat/Downloads/Man_Surface_05_Complete.zip", glb: "Man_Surface_05/Man_Surface_05.glb",
    sha256: "ef639ebc34f93c03eff3140efe2b61b6334b14311b9a841e89064ace483e41b1",
    keep: /overcoat|closure edge|center seam|rear vent|sweatshirt|hood|exposed tapered neck|coat collar|lapel|collar notch|button|oval face|shaped ear|oval eye|eyebrow|curved smile|rounded nose|temple hair|hair at nape|beanie/i,
    material: (name) => /face|neck|ear|eye|eyebrow|smile|nose/i.test(name) ? "skin" : /hair/i.test(name) ? "hair" : /beanie/i.test(name) ? "headwear" : "coat",
  },
];

const colours = {
  skin: [0.78, 0.57, 0.43, 1], hair: [0.15, 0.10, 0.08, 1], headwear: [0.16, 0.24, 0.31, 1], coat: [0.23, 0.35, 0.42, 1],
};

async function build(spec) {
  const archive = unzipSync(await readFile(spec.zip));
  const source = archive[spec.glb];
  if (!source) throw new Error(`${spec.avatar}: ${spec.glb} missing from ZIP`);
  if (sha256(source) !== spec.sha256) throw new Error(`${spec.avatar}: supplied GLB hash mismatch`);
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.simplifier": MeshoptSimplifier });
  const doc = await io.readBinary(source);
  const fullBounds = getBounds(doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]);
  const materials = Object.fromEntries(Object.entries(colours).map(([id, factor]) => [id, doc.createMaterial(`harbour-${id}`).setBaseColorFactor(factor).setRoughnessFactor(0.9).setMetallicFactor(0)]));
  let retained = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (!spec.keep.test(node.getName())) { node.setMesh(null); continue; }
    retained += 1;
    const material = materials[spec.material(node.getName())];
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(material);
  }
  if (!retained) throw new Error(`${spec.avatar}: selector retained no authored surface`);
  // The deliveries are textured high-poly display sculpts. This game surface
  // uses four flat colour batches, so UVs/tangents and their split vertices
  // would only prevent useful simplification. Rebuild smooth normals after.
  for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) if (semantic !== "POSITION") primitive.setAttribute(semantic, null);
  }
  await doc.transform(dedup(), prune(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.055, error: 1, lockBorder: false }), normals(), quantize({ quantizationVolume: "scene", quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const glb = Buffer.from(await io.writeBinary(doc));
  const gz = gzipSync(glb, { level: 9 });
  await writeFile(new URL(`${spec.avatar}.v1.glb`, output), glb);
  await writeFile(new URL(`${spec.avatar}.v1.glb.gz`, output), gz);
  return {
    avatar: spec.avatar, source: { archive: spec.zip.split("/").at(-1), path: spec.glb, sha256: spec.sha256, bytes: source.byteLength },
    authoredSurface: "face, hair/headwear, and torso only; static crossed legs and pocket arms replaced by the procedural playable biped",
    sourceFullBounds: fullBounds, url: `/models/players/${spec.avatar}.v1.glb`, gz: `/models/players/${spec.avatar}.v1.glb.gz`,
    bytes: glb.byteLength, gzBytes: gz.byteLength, sha256: sha256(glb), triangles: triangles(doc), drawMaterials: countDrawMaterials(doc), retainedNodes: retained,
  };
}

await mkdir(output, { recursive: true });
const characters = await Promise.all(supplied.map(build));
for (const character of characters) {
  if (character.triangles > 10_000) throw new Error(`${character.avatar}: phone surface exceeds 10k triangles (${character.triangles})`);
  if (character.drawMaterials > 4) throw new Error(`${character.avatar}: exceeds four draw materials`);
}
const manifest = { version: 1, generatedBy: "scripts/harbour/build-playable-characters.mjs", characters };
await writeFile(new URL("manifest.json", output), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(new URL("PROVENANCE.md", output), `# Playable character derivatives\n\nGenerated reproducibly from the two user-supplied ZIP deliveries by \`scripts/harbour/build-playable-characters.mjs\`. The source archives, original GLBs, previews, viewers and scripts are deliberately not copied here. Each derivative preserves its named supplied GLB hash in \`manifest.json\`, retains selected authored face/hair/headwear/torso surfaces, and excludes the static crossed legs and bent pocket arms so Hearth's neutral procedural biped can animate walk, run, jump, slide and emotes.\n\nNo household data, money, network request, or external service is used.\n`);
console.log(JSON.stringify(manifest, null, 2));
