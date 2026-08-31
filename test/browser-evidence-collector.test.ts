import { describe, expect, it } from "vitest";
import {
  parseCollectorArgs,
  redactDiagnosticText,
  reducedMotionBehaviorPass,
  resolveCollectorOutput,
  seriousAxeViolations,
  validatePublicFeature,
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

  it("redacts sensitive diagnostic fragments and URL query data", () => {
    const redacted = redactDiagnosticText(
      "GET https://example.test/path?member=private Bearer abc123 name@example.test token-abcdefghijklmnop",
    );
    expect(redacted).toBe("GET https://example.test/path Bearer [redacted] [redacted-email] [redacted-secret]");
  });

  it("accepts only same-origin public journeys", () => {
    const safe = {
      id: "public-roadmap",
      dataClass: "public-no-household",
      journeys: [{ id: "task", route: "/roadmap/" }],
    };
    expect(() => validatePublicFeature(safe, "https://hearth.example")).not.toThrow();
    expect(() => validatePublicFeature({ ...safe, dataClass: "household" }, "https://hearth.example"))
      .toThrow(/public-only/);
    expect(() => validatePublicFeature({
      ...safe,
      journeys: [{ id: "task", route: "https://other.example/roadmap/" }],
    }, "https://hearth.example")).toThrow(/collector origin/);
  });

  it("fails a page that keeps substantial motion under reduced motion", () => {
    expect(reducedMotionBehaviorPass(
      { maxSeconds: 1, activeElements: 4 },
      { maxSeconds: 1, activeElements: 4 },
      true,
    )).toBe(false);
    expect(reducedMotionBehaviorPass(
      { maxSeconds: 1, activeElements: 4 },
      { maxSeconds: 0.00001, activeElements: 4 },
      true,
    )).toBe(true);
    expect(reducedMotionBehaviorPass(
      { maxSeconds: 0, activeElements: 0 },
      { maxSeconds: 0.00001, activeElements: 4 },
      true,
    )).toBe(true);
  });
});
