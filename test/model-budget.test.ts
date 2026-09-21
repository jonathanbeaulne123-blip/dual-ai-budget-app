// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { relative, resolve } from "node:path";
import { PAY_BANK_MODELS, UMBRELLA_BANK_MODELS } from "../src/queen/world/bankModels.ts";
import { HOME_BANK_MODELS, QUEEN_MODEL_URL } from "../src/queen/world/queenModel.ts";
import { ALL_COURT_ASSETS, QUEEN_ASSETS } from "../src/harbour/assets/manifest.ts";
import { parseGlbScene } from "../src/assets/gltf.ts";

/**
 * The budget fence for `public/models/`.
 *
 * `test/bank-models.test.ts`, `test/queen-model.test.ts` and
 * `test/harbour-assets.test.ts` each hash the files their own manifest names.
 * This one looks the other way round — at the directory — and asks three
 * questions no single manifest can answer:
 *
 *   1. Is every shipped `.glb` named by a manifest, and does it have a gzip
 *      twin that inflates back to it? The loaders all ask for `<url>.gz`
 *      first, so a model without a twin quietly ships at full weight (which
 *      is exactly how the 12.32 MB Living Presence master went unnoticed).
 *   2. Is every bank model inside the 0.8 MB product rule?
 *   3. Has the directory grown past what anyone agreed to carry?
 *
 * The ceiling is a number someone has to come and change on purpose. Raising
 * it is a decision about what a phone on a Newfoundland connection downloads
 * before it sees the Queen, not a formality.
 *
 * No money is read here.
 */

const MODELS = resolve(process.cwd(), "public/models");

/**
 * Measured 2026-09-21 on `claude/asset-pipeline`, over 46 files. It includes
 * the 12.32 MB Living Presence master and its 8.15 MB twin, which nothing
 * fetches any more and which come out once the optimised Queen has been
 * accepted by eye — that alone takes the directory to 44.58 MB. Lower this
 * then, rather than treating the rollback copy as permanent weight.
 */
const MEASURED_TOTAL_BYTES = 68_215_434;
/** 20% of headroom on top of that. Changing this is a decision; make it one. */
const TOTAL_CEILING_BYTES = Math.floor(MEASURED_TOTAL_BYTES * 1.2);

/**
 * A bank model may not weigh more than this. The rule is for models made from
 * here on; the two below predate it and are exempt by name rather than by
 * lowering the bar. `test/bank-models.test.ts` holds them to 1.5 MB.
 */
const BANK_MAX_BYTES = 800_000;
const BANK_EXEMPT = new Set(["pay-clink.v2.glb", "pay-poise.v2.glb"]);

/** Every url any manifest names, as the browser fetches it. */
const MANIFEST_URLS = new Set<string>([
  ...Object.values(UMBRELLA_BANK_MODELS).map((model) => model.url),
  ...Object.values(PAY_BANK_MODELS).map((model) => model.url),
  ...Object.values(HOME_BANK_MODELS).map((model) => model.url),
  QUEEN_MODEL_URL,
  ...ALL_COURT_ASSETS.map((asset) => asset.url),
]);

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found.sort();
}

const files = walk(MODELS);
const glbs = files.filter((path) => path.endsWith(".glb"));
/** `public/models/queen/x.glb` → `/models/queen/x.glb`, the url the app asks for. */
const urlOf = (path: string) => `/${relative(resolve(process.cwd(), "public"), path).split(/[\\/]/).join("/")}`;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("public/models stays inside its budget", () => {
  it("names every shipped .glb in a manifest, and ships nothing but .glb and .glb.gz", () => {
    expect(glbs.length).toBeGreaterThan(20);
    for (const path of glbs) expect(MANIFEST_URLS, urlOf(path)).toContain(urlOf(path));
    for (const path of files) expect(path, `${urlOf(path)} is neither a model nor a transfer twin`).toMatch(/\.glb(\.gz)?$/);
  });

  it("gives every .glb a gzip twin that inflates back to it, and is worth fetching", () => {
    for (const path of glbs) {
      const twin = `${path}.gz`;
      expect(existsSync(twin), `${urlOf(path)} has no .gz twin`).toBe(true);
      const raw = readFileSync(path);
      const packed = readFileSync(twin);
      expect(sha256(gunzipSync(packed)), `${urlOf(twin)} inflates to ${urlOf(path)}`).toBe(sha256(raw));
      expect(packed.byteLength, `${urlOf(twin)} is smaller than the raw file`).toBeLessThan(raw.byteLength);
    }
  });

  it("declares the gzip twin in the one manifest that carries a gz field", () => {
    for (const asset of ALL_COURT_ASSETS) {
      expect(asset.gz, `${asset.url} records its twin`).toBe(`${asset.url}.gz`);
    }
  });

  it("keeps every bank model inside the 0.8 MB rule, the two that predate it exempt by name", () => {
    const banks = glbs.filter((path) => urlOf(path).startsWith("/models/banks/"));
    expect(banks.length).toBeGreaterThan(10);
    for (const path of banks) {
      const name = urlOf(path).split("/").pop()!;
      if (BANK_EXEMPT.has(name)) continue;
      expect(statSync(path).size, `${name} is over the 0.8 MB bank rule`).toBeLessThanOrEqual(BANK_MAX_BYTES);
    }
    // The exemptions are for files that exist; a stale name would hide a new offender.
    for (const name of BANK_EXEMPT) expect(banks.some((path) => path.endsWith(`/${name}`)), `${name} is exempt but not shipped`).toBe(true);
  });

  it("holds the whole directory under its agreed ceiling", () => {
    const total = files.reduce((sum, path) => sum + statSync(path).size, 0);
    expect(
      total,
      `public/models is ${(total / 1_048_576).toFixed(2)} MB against a ${(TOTAL_CEILING_BYTES / 1_048_576).toFixed(2)} MB ceiling — optimise, or raise MEASURED_TOTAL_BYTES on purpose`,
    ).toBeLessThanOrEqual(TOTAL_CEILING_BYTES);
  });

  it("parses the meshopt-compressed Queen through the shared loader", async () => {
    const bytes = readFileSync(resolve(process.cwd(), `public${QUEEN_ASSETS.presence.url}`));
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const scene = await parseGlbScene(copy);
    let meshes = 0, vertices = 0;
    scene.traverse((node) => {
      const mesh = node as { isMesh?: boolean; geometry?: { getAttribute: (name: string) => { count: number } | undefined } };
      if (!mesh.isMesh) return;
      meshes += 1;
      vertices += mesh.geometry?.getAttribute("position")?.count ?? 0;
    });
    // The master's own counts, welded: a decoder that silently did nothing would not reach these.
    expect(meshes).toBe(71);
    expect(vertices).toBe(335_813);
  });
});
