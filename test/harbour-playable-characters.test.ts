import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAYABLE_AVATARS } from "../src/harbour/body/avatarDefinition.ts";
import { createPlayableFigure } from "../src/harbour/body/playableFigure.ts";

const root = resolve(process.cwd(), "public/models/players");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

describe("Little Harbour playable character derivatives", () => {
  it("ships compact, provenance-fenced authored surfaces", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")) as { characters: Array<{ avatar: string; url: string; bytes: number; sha256: string; triangles: number; drawMaterials: number; source: { sha256: string } }> };
    expect(manifest.characters.map((row) => row.avatar).sort()).toEqual(["bianca", "jonathan"]);
    for (const row of manifest.characters) {
      const file = resolve(process.cwd(), `public${row.url}`);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file).byteLength).toBe(row.bytes);
      expect(hash(readFileSync(file))).toBe(row.sha256);
      expect(row.triangles).toBeLessThanOrEqual(10_000);
      expect(row.drawMaterials).toBeLessThanOrEqual(4);
      expect(row.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("returns an immediately poseable procedural biped for either explicit avatar", () => {
    for (const avatar of Object.keys(PLAYABLE_AVATARS) as Array<keyof typeof PLAYABLE_AVATARS>) {
      const figure = createPlayableFigure(avatar, "lite");
      expect(figure.height).toBeGreaterThan(0);
      figure.pose(0.4, 1, 1, { lean: 0, bank: 0, run: 1, air: 0.2, flourish: 0 });
      expect(figure.group.position.y).toBe(0);
      figure.dispose();
    }
  });
});
