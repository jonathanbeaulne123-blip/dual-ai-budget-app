import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createShiftScanScope } from "../src/shiftScanScope.ts";

describe("shift camera scope", () => {
  it("invalidates a pending scan when Add closes or a newer scan starts", () => {
    const scope = createShiftScanScope();
    const first = scope.begin();
    expect(first.isCurrent()).toBe(true);

    const second = scope.begin();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);

    scope.cancel();
    expect(second.signal.aborted).toBe(true);
    expect(second.isCurrent()).toBe(false);
  });

  it("binds both Timesheet camera surfaces to cancellation and stale-response guards", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../src/WorkShiftPage.tsx", import.meta.url), "utf8");
    expect(app).toContain("shiftScanScopeRef.current.cancel()");
    expect(app).toContain("scanShiftReportFile(file, fetch, scan.signal, loadDocumentVisionProvider())");
    // App rechecks once after the lazy import boundary and around the async scan.
    expect(app.match(/if \(!scan\.isCurrent\(\)\) return;/g)).toHaveLength(3);
    expect(app).toContain("setWorkShiftDraft(null)");
    expect(app).toContain("setShiftScanWarnings([])");
    expect(page).toContain("shiftScanScopeRef.current.cancel()");
    expect(page).toContain("scanShiftReportFile(file, fetch, scan.signal, loadDocumentVisionProvider())");
    expect(page.match(/if \(!scan\.isCurrent\(\)\) return;/g)).toHaveLength(2);
  });
});
