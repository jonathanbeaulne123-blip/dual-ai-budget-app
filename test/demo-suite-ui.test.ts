import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Demo Suite paper-room placement", () => {
  const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
  const styles = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

  it("adds replay and verification under More without restoring the old destructive reloads", () => {
    expect(app).toContain('data-testid="demo-suite-panel"');
    expect(app).toContain("Fresh showcase");
    expect(app).toContain("Replay seed");
    expect(app).toContain("Verify now");
    expect(app).toContain('data-testid="demo-suite-report"');
    expect(app).toContain('aria-live="polite"');
    expect(app).toContain("demo-suite-failures");
    expect(app).toContain("Not verified after books changed");
    expect(app).toContain("compare every generated fact with the seed again");
    expect(app).not.toContain("Reload random data");
    expect(app).not.toContain("Display pretty numbers");
  });

  it("keeps core demo actions at the phone touch target", () => {
    expect(app).toContain("demo-suite-actions");
    expect(styles).toMatch(/\.demo-suite-actions \.ghost \{ min-height: 44px; \}/);
  });

  it("keeps the existing navigation and desk grammar", () => {
    expect(app).toContain('type Tab = "home" | "plan" | "calendar" | "shift" | "ledger" | "more"');
    expect(app).toContain('className="paper-panel"');
    expect(app).not.toContain('type Tab = "demo"');
  });

  it("adopts a new showcase through the current books-readiness gate", () => {
    const createStart = app.indexOf("async function createOrReplayDemoSuite");
    const createEnd = app.indexOf("async function openDiscoveredLedger", createStart);
    const createFlow = app.slice(createStart, createEnd);
    expect(createFlow).toContain("adoptAcceptedHousehold(accepted, status)");
    expect(createFlow).toContain("rememberSession({ memberId, view: \"household\", householdId: accepted.householdId })");
  });
});
