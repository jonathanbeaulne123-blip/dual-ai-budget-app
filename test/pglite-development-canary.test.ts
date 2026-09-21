import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { incrementalBooksEnabled } from "../src/ledger/engine.ts";

describe("incremental PGlite release boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("carries no Development canary flag any more, and still keeps Production continuity off", () => {
    const workflow = readFileSync(".github/workflows/pages.yml", "utf8");

    // The incremental writer is the default write path in every environment
    // (D-177 amendment, 2026-09-21), so the Development-only opt-in is dead.
    // It must not come back: a build that sets it would be describing a
    // boundary the engine no longer has.
    expect(workflow).not.toContain("VITE_PGLITE_INCREMENTAL_DEV");
    // The one remaining switch is the kill switch, and the kitchen build does
    // not force it — the build takes the default path like every other client.
    expect(workflow).not.toContain("VITE_PGLITE_FULL_PROJECTION");
    // Production continuity is a separate decision and stays off.
    expect(workflow).toMatch(/^\s+VITE_PRODUCTION_CONTINUITY: "0"$/m);
    expect(workflow).toContain('test "$VITE_PRODUCTION_CONTINUITY" = "0"');
  });

  it("runs the incremental writer in both environments unless the kill switch forces the full path", () => {
    expect(incrementalBooksEnabled("development")).toBe(true);
    expect(incrementalBooksEnabled("production")).toBe(true);
    vi.stubEnv("VITE_PGLITE_FULL_PROJECTION", "1");
    expect(incrementalBooksEnabled("development")).toBe(false);
    expect(incrementalBooksEnabled("production")).toBe(false);
  });
});
