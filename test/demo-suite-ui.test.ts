import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogHousehold, createWriteQueue, linkGoogleIdentity } from "../src/core/index.ts";
import { requireDemoSuiteContinuityIdentity } from "../src/demoSuiteIdentity.ts";

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
    expect(createFlow).toContain("persist(candidate");
    expect(createFlow).not.toContain("commitHousehold(candidate");
    expect(createFlow).not.toContain("acceptHouseholdWrite({");
    expect(createFlow).not.toContain("cloud copy is still pending");
    expect(createFlow).toContain("adoptAcceptedHousehold(accepted, status)");
    expect(createFlow).toContain("rememberSession({ memberId, view: \"household\", householdId: accepted.householdId })");
  });

  it("refuses to bind a new Demo Suite to a cached Auth identity for another member", () => {
    const current = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: "bianca@example.test",
      subject: "google-bianca",
      displayName: "Bianca",
      grantedScopes: ["openid", "email", "profile"],
    }).household;
    expect(() => requireDemoSuiteContinuityIdentity({
      household: current,
      memberId: "MEM-002",
      authRequired: true,
      authIdentity: { email: "bianca@example.test", subject: "google-bianca" },
      fallbackIdentity: null,
    })).toThrow(/does not match the selected household member/i);
  });

  it("keeps first-time Demo acceptance behind an in-flight paired install", async () => {
    const enqueueWrite = createWriteQueue();
    const order: string[] = [];
    let releasePair!: () => void;
    const pairPaused = new Promise<void>((resolve) => { releasePair = resolve; });
    const pairedInstall = enqueueWrite(async () => {
      order.push("pair-start");
      await pairPaused;
      order.push("pair-installed");
    });
    const demoPersist = enqueueWrite(async () => {
      order.push("demo-staged");
      order.push("demo-cloud-ack");
      order.push("demo-active");
      return "synchronized";
    });

    await Promise.resolve();
    expect(order).toEqual(["pair-start"]);
    releasePair();
    await expect(Promise.all([pairedInstall, demoPersist])).resolves.toEqual([undefined, "synchronized"]);
    expect(order).toEqual([
      "pair-start",
      "pair-installed",
      "demo-staged",
      "demo-cloud-ack",
      "demo-active",
    ]);
  });

  it("routes member-Personal commands through the same commit boundary", () => {
    const runStart = app.indexOf("function run(fn:");
    const runEnd = app.indexOf("function requestClearThisPhone", runStart);
    const commandFlows = app.slice(runStart, runEnd);
    expect(commandFlows).not.toContain("savePersonalReplicaOnly");
    expect(commandFlows).not.toContain("persistMemberPersonalPreferenceNow");
    expect(commandFlows).toContain("assertMemberPersonalUpdate(current, result)");
    expect(commandFlows.match(/commitHousehold\(/g)).toHaveLength(2);
  });
});
