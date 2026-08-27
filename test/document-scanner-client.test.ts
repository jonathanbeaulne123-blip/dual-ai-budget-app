import { describe, expect, it, vi } from "vitest";
import { scanFinancialDocument } from "../src/imports/documentScanner.ts";

const result = {
  documentKind: "receipt" as const,
  currency: "CAD",
  accountLast4: "1234",
  rows: [{
    date: "2026-08-24",
    amountCents: 1250,
    direction: "debit" as const,
    typeHint: "expense" as const,
    merchant: "Cafe",
    description: "Lunch",
    reference: "R-1",
    confidence: 96,
  }],
  warnings: [],
};

describe("document scanner client", () => {
  it("submits a selected image exactly once and returns stable image provenance", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe("/documents/scan");
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const file = new File([new Uint8Array([1, 2, 3, 4])], "receipt.jpg", { type: "image/jpeg" });
    const first = await scanFinancialDocument(file, fetcher as typeof fetch);
    const second = await scanFinancialDocument(file, fetcher as typeof fetch);
    expect(first.result).toEqual(result);
    expect(first.sourceHash).toBe(second.sourceHash);
    expect(first.sourceHash).toMatch(/^[a-f0-9]{16,64}$/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported or oversized images before any network call", async () => {
    const fetcher = vi.fn();
    await expect(scanFinancialDocument(new File(["x"], "receipt.gif", { type: "image/gif" }), fetcher as typeof fetch)).rejects.toThrow(/JPEG, PNG, or WebP/i);
    const huge = { type: "image/jpeg", size: 10 * 1024 * 1024 + 1, name: "huge.jpg" } as File;
    await expect(scanFinancialDocument(huge, fetcher as typeof fetch)).rejects.toThrow(/larger than 10 MB/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards cancellation to the shared document request", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const file = new File([new Uint8Array([1, 2, 3])], "receipt.jpg", { type: "image/jpeg" });
    await scanFinancialDocument(file, fetcher as typeof fetch, { signal: controller.signal });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to the original bytes when canvas compression is unavailable", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { imageDataUrl: string; mimeType: string };
      expect(body.mimeType).toBe("image/jpeg");
      expect(body.imageDataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
      return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const file = new File([new Uint8Array([9, 8, 7, 6])], "tip-sheet.jpg", { type: "image/jpeg" });
    await scanFinancialDocument(file, fetcher as typeof fetch, { documentHint: "shift-report" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
