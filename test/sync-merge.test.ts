import { describe, expect, it } from "vitest";
import { mergeRecords, mergeTombstones, recency } from "../src/core/sync.ts";

describe("two-device tombstone merge", () => {
  it("keeps the latest deletedAt for a shared id and unions the rest", () => {
    expect(mergeTombstones(
      [{ id: "TXN-1", deletedAt: "2026-08-01T00:00:00.000Z" }],
      [
        { id: "TXN-1", deletedAt: "2026-08-03T00:00:00.000Z" },
        { id: "TXN-2", deletedAt: "2026-08-02T00:00:00.000Z" },
      ],
    )).toEqual([
      { id: "TXN-1", deletedAt: "2026-08-03T00:00:00.000Z" },
      { id: "TXN-2", deletedAt: "2026-08-02T00:00:00.000Z" },
    ]);
  });

  it("keeps the first tombstone when deletedAt ties", () => {
    expect(mergeTombstones(
      [{ id: "TXN-1", deletedAt: "2026-08-01T00:00:00.000Z" }],
      [{ id: "TXN-1", deletedAt: "2026-08-01T00:00:00.000Z" }],
    )).toEqual([{ id: "TXN-1", deletedAt: "2026-08-01T00:00:00.000Z" }]);
    expect(mergeTombstones(undefined, undefined)).toEqual([]);
  });
});

describe("two-device record merge", () => {
  it("lets a newer client overwrite a live server row", () => {
    const merged = mergeRecords(
      [{ id: "TXN-1", updatedAt: "2026-08-01T00:00:00.000Z", note: "server" }],
      [{ id: "TXN-1", updatedAt: "2026-08-02T00:00:00.000Z", note: "client" }],
      [],
    );
    expect(merged).toEqual([{ id: "TXN-1", updatedAt: "2026-08-02T00:00:00.000Z", note: "client" }]);
  });

  it("lets the client win on equal recency so a retry is stable", () => {
    const merged = mergeRecords(
      [{ id: "TXN-1", updatedAt: "2026-08-01T00:00:00.000Z", note: "server" }],
      [{ id: "TXN-1", updatedAt: "2026-08-01T00:00:00.000Z", note: "client" }],
      [],
    );
    expect(merged[0]?.note).toBe("client");
  });

  it("omits a tombstoned id even when a stale phone re-uploads a newer copy", () => {
    expect(mergeRecords(
      [{ id: "TXN-1", updatedAt: "2026-08-03T00:00:00.000Z", note: "server" }],
      [{ id: "TXN-1", updatedAt: "2026-08-04T00:00:00.000Z", note: "stale-phone" }],
      [{ id: "TXN-1", deletedAt: "2026-08-02T00:00:00.000Z" }],
    )).toEqual([]);
    expect(mergeRecords(
      [],
      [{ id: "TXN-2", updatedAt: "2026-08-01T00:00:00.000Z" }],
      [{ id: "TXN-2", deletedAt: "2026-08-01T00:00:00.000Z" }],
    )).toEqual([]);
  });

  it("keeps server-only live rows and adds client-only live rows", () => {
    expect(mergeRecords(
      [{ id: "TXN-1", updatedAt: "2026-08-01T00:00:00.000Z" }],
      [{ id: "TXN-2", updatedAt: "2026-08-02T00:00:00.000Z" }],
      [],
    )).toEqual([
      { id: "TXN-1", updatedAt: "2026-08-01T00:00:00.000Z" },
      { id: "TXN-2", updatedAt: "2026-08-02T00:00:00.000Z" },
    ]);
  });

  it("falls back to createdAt when updatedAt is empty", () => {
    expect(recency({ updatedAt: "", createdAt: "2026-08-02T00:00:00.000Z" })).toBe("2026-08-02T00:00:00.000Z");
    const merged = mergeRecords(
      [{ id: "TXN-1", updatedAt: "", createdAt: "2026-08-01T00:00:00.000Z" }],
      [{ id: "TXN-1", updatedAt: "", createdAt: "2026-08-02T00:00:00.000Z" }],
      [],
    );
    expect(merged[0]?.createdAt).toBe("2026-08-02T00:00:00.000Z");
  });
});
