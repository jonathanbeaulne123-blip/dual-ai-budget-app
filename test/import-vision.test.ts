import { describe, expect, it } from "vitest";
import { visionDocumentRows, type VisionDocumentResult } from "../src/core/index.ts";

const result: VisionDocumentResult = {
  documentKind: "receipt",
  currency: "CAD",
  accountLast4: "1234",
  rows: [{
    date: "2026-08-24",
    amountCents: 1250,
    direction: "debit",
    typeHint: "expense",
    merchant: "Cafe",
    description: "Lunch total",
    reference: "R-1",
    confidence: 96,
  }],
  receiptNumbers: {
    lineAmountsCents: [1000], subtotalCents: 1000, discountCents: 0,
    taxCents: 150, tipCents: 100, feeCents: 0, totalCents: 1250,
  },
  warnings: [],
};

describe("vision document normalization", () => {
  it("creates deterministic receipt provenance without retaining image bytes", () => {
    const first = visionDocumentRows({ result, sourceName: "receipt.jpg", sourceHash: "image-hash" });
    const second = visionDocumentRows({ result, sourceName: "receipt.jpg", sourceHash: "image-hash" });
    expect(first.rows).toEqual(second.rows);
    expect(first.rows[0]).toEqual(expect.objectContaining({
      sourceKind: "camera",
      documentKind: "receipt",
      suggestedType: "expense",
      signedAmountCents: -1250,
      extractionConfidence: 96,
      receiptNumbers: result.receiptNumbers,
    }));
    expect(first.rows[0]?.provenanceId).toMatch(/^vision:image-hash:/);
    expect(first.rows[0]?.note).toBe("Cafe · Receipt total");
    expect(first.rows[0]?.fitId).toBe("");
    expect(JSON.stringify(first)).not.toContain("base64");
  });

  it("omits unclear invalid rows instead of inventing dates or totals", () => {
    expect(() => visionDocumentRows({
      result: { ...result, rows: [{ ...result.rows[0]!, date: "", amountCents: 0 }] },
      sourceName: "blur.jpg",
      sourceHash: "blur",
    })).toThrow(/No usable transaction/i);
  });
});
