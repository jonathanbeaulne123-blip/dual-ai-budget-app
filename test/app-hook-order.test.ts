import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App hook order", () => {
  it("has no Evidence money runner; D-172 keeps background capture proposal-only", () => {
    const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    const bootGuard = source.indexOf("  if (booting) {");

    expect(bootGuard).toBeGreaterThan(0);
    expect(source).not.toContain("processEvidenceAutomationJobs");
    expect(source).not.toContain("claimEvidenceAutomationJob");
    expect(source).not.toContain("validateEvidenceAutomationJob");
  });

  it("exposes the selected environment and the opposite ledger from the live header", () => {
    const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

    expect(source).toContain('className={`pill ${environment === "production" ? "prod" : "dev"}`}');
    expect(source).toContain('next: environment === "production" ? "development" : "production"');
    expect(source).not.toContain('<span className="pill dev" aria-label="Development environment">Development</span>');
  });
});
