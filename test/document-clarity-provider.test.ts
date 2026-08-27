// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  CLARITY_READY_SCORE,
  compositeClarityScore,
  scoreDocumentClarity,
  sharpnessFromGray,
  statsFromGray,
} from "../src/imports/documentClarity.ts";
import {
  DOCUMENT_VISION_PROVIDERS,
  isDocumentVisionProvider,
  loadDocumentVisionProvider,
  saveDocumentVisionProvider,
} from "../src/imports/documentScanProvider.ts";

describe("document clarity gate", () => {
  it("scores sharp high-contrast text as ready and blurry frames as locked", () => {
    const width = 64;
    const height = 48;
    const sharpGray = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        // Vertical stripes ≈ printed columns on a tip sheet.
        sharpGray[y * width + x] = x % 4 < 2 ? 30 : 220;
      }
    }
    const sharp = sharpnessFromGray(sharpGray, width, height);
    const sharpStats = statsFromGray(sharpGray);
    const ready = scoreDocumentClarity({
      sharp,
      contrast: sharpStats.std,
      brightness: sharpStats.mean,
      textiness: sharpStats.textiness,
    });
    expect(ready.ready).toBe(true);
    expect(ready.score).toBeGreaterThanOrEqual(CLARITY_READY_SCORE);
    expect(ready.issues).toEqual([]);

    const blurGray = new Float32Array(width * height);
    blurGray.fill(128);
    const blurry = scoreDocumentClarity({
      sharp: sharpnessFromGray(blurGray, width, height),
      contrast: statsFromGray(blurGray).std,
      brightness: 128,
      textiness: 0.001,
    });
    expect(blurry.ready).toBe(false);
    expect(blurry.issues.length).toBeGreaterThan(0);
    expect(blurry.reason).toMatch(/blur|print|contrast|dark|bright/i);
  });

  it("keeps composite score in 0–100", () => {
    expect(compositeClarityScore({ sharp: 0, contrast: 0, brightness: 0, textiness: 0 })).toBe(0);
    expect(compositeClarityScore({ sharp: 200, contrast: 80, brightness: 120, textiness: 0.2 })).toBeLessThanOrEqual(100);
  });
});

describe("document vision provider preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("exposes Auto plus all three backends and persists the choice", () => {
    expect(DOCUMENT_VISION_PROVIDERS.map((row) => row.id)).toEqual([
      "auto",
      "workers-ai",
      "openai",
      "anthropic",
    ]);
    expect(loadDocumentVisionProvider()).toBe("auto");
    expect(saveDocumentVisionProvider("openai")).toBe("openai");
    expect(loadDocumentVisionProvider()).toBe("openai");
    expect(isDocumentVisionProvider("workers-ai")).toBe(true);
    expect(isDocumentVisionProvider("gemini")).toBe(false);
  });
});
