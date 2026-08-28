import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App hook order", () => {
  it("registers the Evidence automation wake effect before App early returns", () => {
    const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    const bootGuard = source.indexOf("  if (booting) {");
    const automationEffect = source.indexOf(
      "const timer = window.setTimeout(() => { void processEvidenceAutomationJobs(); }, 750);",
    );

    expect(bootGuard).toBeGreaterThan(0);
    expect(automationEffect).toBeGreaterThan(0);
    expect(automationEffect).toBeLessThan(bootGuard);
  });
});
