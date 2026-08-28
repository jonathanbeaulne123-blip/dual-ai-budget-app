import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../workers/evidence.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/evidence/0001_evidence_mesh.sql", import.meta.url), "utf8");

describe("Evidence companion capabilities", () => {
  it("mints short-lived owner-scoped tokens but stores only their hash", () => {
    expect(worker).toContain("await verifiedScope(request, env, input)");
    expect(worker).toContain("now.getTime() + 5 * 60_000");
    expect(worker).toContain("capabilityHash = await sha256");
    expect(migration).toContain("capability_hash TEXT PRIMARY KEY");
    expect(migration).not.toMatch(/\n\s+capability TEXT/);
  });

  it("atomically burns capabilities before upload and binds extension or app identity", () => {
    expect(worker).toContain("SET used_at = ? WHERE capability_hash = ? AND used_at IS NULL");
    expect(worker).toContain("caller !== row.origin");
    expect(worker).toContain("chrome-extension");
    expect(worker).toContain('clean === "com.hearth.capture.dev"');
    expect(worker).toContain("readBytes(request, Math.min(MAX_BYTES, Number(row.byte_limit)))");
  });
});
