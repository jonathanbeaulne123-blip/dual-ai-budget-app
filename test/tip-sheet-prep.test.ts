// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contrastStretchImageData } from "../src/imports/tipSheetImagePrep.ts";
import { looksLikeEmployeeShiftReport } from "../workers/shiftReportParse.js";

function makeImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  if (typeof ImageData === "function") return new ImageData(data, width, height);
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

describe("tip sheet image prep", () => {
  it("stretches low-contrast frames toward fuller black/white", () => {
    const image = makeImageData(8, 8);
    for (let i = 0; i < image.data.length; i += 4) {
      const mid = 120 + ((i / 4) % 2) * 20;
      image.data[i] = mid;
      image.data[i + 1] = mid;
      image.data[i + 2] = mid;
      image.data[i + 3] = 255;
    }
    const stretched = contrastStretchImageData(image, 0.05);
    let min = 255;
    let max = 0;
    for (let i = 0; i < stretched.data.length; i += 4) {
      const y = stretched.data[i] ?? 0;
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
    expect(max - min).toBeGreaterThan(80);
  });
});

describe("tip sheet transcript detection", () => {
  it("recognizes Toast Employee Shift Report labels", () => {
    expect(looksLikeEmployeeShiftReport(`
      EMPLOYEE SHIFT REPORT
      Net Sales $100.00
      TIP SUMMARY
      Headcount 12
    `)).toBe(true);
    expect(looksLikeEmployeeShiftReport("Cafe latte $5.00")).toBe(false);
  });
});
