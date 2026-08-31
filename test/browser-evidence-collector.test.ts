import { describe, expect, it } from "vitest";
import {
  parseCollectorArgs,
  resolveCollectorOutput,
  seriousAxeViolations,
} from "../scripts/collect-browser-evidence.mjs";

describe("browser evidence collector", () => {
  it("parses an explicit origin, feature, output, and headed mode", () => {
    expect(parseCollectorArgs([
      "--origin", "http://127.0.0.1:4173",
      "--feature", "public-roadmap",
      "--output", "artifacts/browser-evidence/example",
      "--headed",
    ])).toMatchObject({
      origin: "http://127.0.0.1:4173",
      featureId: "public-roadmap",
      outputPath: "artifacts/browser-evidence/example",
      headed: true,
    });
  });

  it("fails closed when output tries to escape the ignored evidence root", () => {
    expect(() => resolveCollectorOutput("artifacts/browser-evidence/safe", "fallback")).not.toThrow();
    expect(() => resolveCollectorOutput("docs/unsafe", "fallback")).toThrow(/artifacts\/browser-evidence/);
  });

  it("treats serious and critical axe findings as release blockers", () => {
    expect(seriousAxeViolations([
      { impact: "minor" },
      { impact: "serious" },
      { impact: "critical" },
    ])).toEqual([{ impact: "serious" }, { impact: "critical" }]);
  });
});
