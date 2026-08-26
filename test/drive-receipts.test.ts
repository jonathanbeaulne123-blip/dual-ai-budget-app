// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryTokenStore,
  deleteDriveReceipt,
  resetGoogleEngineForTests,
  saveGoogleSession,
  scopesForServices,
  setGoogleHttpFetch,
  setGoogleTokenStore,
  uploadDriveReceipt,
} from "../src/google/index.ts";

afterEach(() => {
  resetGoogleEngineForTests();
  setGoogleTokenStore(null);
});

describe("private Drive receipt evidence", () => {
  it("creates the private year/month path, uploads once, and deletes only by explicit action", async () => {
    setGoogleTokenStore(createMemoryTokenStore());
    saveGoogleSession("development", {
      memberId: "MEM-002",
      accessToken: "drive-token",
      expiresAt: Date.now() + 3_600_000,
      grantedScopes: scopesForServices(["drive"]),
      identity: { email: "jonathan@example.com", subject: "sub-jon", displayName: "Jonathan" },
    });
    const folderIds = ["folder-root", "folder-year", "folder-month"];
    const requests: Array<{ url: string; method: string; body?: BodyInit | null }> = [];
    const http = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      requests.push({ url, method, body: init?.body });
      if (method === "GET" && url.includes("drive/v3/files")) {
        if (url.includes("hearthSourceHash") && requests.filter((request) => request.url.includes("hearthSourceHash")).length > 1) {
          return new Response(JSON.stringify({ files: [{ id: "receipt-file", webViewLink: "https://drive.google.com/file/receipt-file" }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ files: [] }), { status: 200 });
      }
      if (method === "POST" && url.includes("/drive/v3/files") && !url.includes("/upload/")) {
        return new Response(JSON.stringify({ id: folderIds.shift() }), { status: 200 });
      }
      if (method === "POST" && url.includes("uploadType=multipart")) {
        return new Response(JSON.stringify({ id: "receipt-file", webViewLink: "https://drive.google.com/file/receipt-file" }), { status: 200 });
      }
      if (method === "DELETE") return new Response(null, { status: 204 });
      return new Response("unexpected", { status: 500 });
    });
    setGoogleHttpFetch(http);

    const file = new File(["image"], "shop.jpg", { type: "image/jpeg" });
    const uploaded = await uploadDriveReceipt({
      environment: "development",
      memberId: "MEM-002",
      enabledServices: ["identity", "drive"],
      file,
      sourceHash: "source-123",
      date: "2026-08-25",
    });
    expect(uploaded).toEqual(expect.objectContaining({ ok: true, fileId: "receipt-file", sourceHash: "source-123" }));
    const folderBodies = requests.filter((request) => request.method === "POST" && !request.url.includes("/upload/"))
      .map((request) => JSON.parse(String(request.body)) as { name: string });
    expect(folderBodies.map((body) => body.name)).toEqual(["Hearth Receipts", "2026", "08"]);
    expect(requests.some((request) => request.url.includes("uploadType=multipart") && request.body instanceof Blob)).toBe(true);

    const deleted = await deleteDriveReceipt({
      environment: "development",
      memberId: "MEM-002",
      enabledServices: ["identity", "drive"],
      sourceHash: "source-123",
    });
    expect(deleted.ok).toBe(true);
    expect(requests.some((request) => request.method === "DELETE" && request.url.endsWith("/receipt-file"))).toBe(true);
  });

  it("returns a retryable soft failure instead of throwing or changing books", async () => {
    setGoogleTokenStore(createMemoryTokenStore());
    const result = await uploadDriveReceipt({
      environment: "development",
      memberId: "MEM-002",
      enabledServices: ["identity", "drive"],
      file: new File(["image"], "shop.jpg", { type: "image/jpeg" }),
      sourceHash: "source-failed",
      date: "2026-08-25",
    });
    expect(result.ok).toBe(false);
    expect(result.sourceHash).toBe("source-failed");
  });
});
