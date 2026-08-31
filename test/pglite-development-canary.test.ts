import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { incrementalBooksEnabled } from "../src/ledger/engine.ts";

describe("Development incremental PGlite release boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bakes the canary into the kitchen build while keeping Production continuity off", () => {
    const workflow = readFileSync(".github/workflows/pages.yml", "utf8");

    expect(workflow).toMatch(/^\s+VITE_PGLITE_INCREMENTAL_DEV: "1"$/m);
    expect(workflow).toContain('test "$VITE_PGLITE_INCREMENTAL_DEV" = "1"');
    expect(workflow).toMatch(/^\s+VITE_PRODUCTION_CONTINUITY: "0"$/m);
    expect(workflow).toContain('test "$VITE_PRODUCTION_CONTINUITY" = "0"');
  });

  it("refuses the incremental writer in Production even when the build flag is on", () => {
    vi.stubEnv("VITE_PGLITE_INCREMENTAL_DEV", "1");
    expect(incrementalBooksEnabled("development")).toBe(true);
    expect(incrementalBooksEnabled("production")).toBe(false);
  });
});
