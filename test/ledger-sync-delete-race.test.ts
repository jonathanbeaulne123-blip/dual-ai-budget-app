import { expect, it, vi } from "vitest";
vi.mock("../workers/ledgerRoom.ts", () => ({ LedgerRoom: class {} }));
import { handleLedgerSync } from "../workers/ledgerSync.ts";

it("a deletion reservation won during import cannot reach control-plane deletion", async () => {
  const room = {
    deletionOwner: vi.fn().mockResolvedValue(null),
    // Another owner reserved deletion after our ownership read.
    ensureImported: vi.fn().mockRejectedValue(new Error("LEDGER_DELETED")),
    beginDelete: vi.fn(),
    finishDelete: vi.fn().mockResolvedValue({ deleted: true }),
  };
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({
      subject: "owner-b",
      memberId: "MEM-002",
      role: "owner",
      members: [{ id: "MEM-002", name: "Owner B", active: true }],
    }),
  );
  try {
    const response = await handleLedgerSync(
      new Request(
        "https://hearth.example/ledger-sync/v2/development/HH-RACE/delete",
        { method: "POST", headers: { Authorization: "Bearer test-token" } },
      ),
      {
        SUPABASE_URL: "https://control.example",
        SUPABASE_PUBLISHABLE_KEY: "test-public-key",
        LEDGER_ROOMS: {
          idFromName: (name: string) => name,
          get: () => room,
        } as any,
      },
    );
    expect(response?.status).toBe(409);
    expect(await response?.json()).toEqual({ error: "LEDGER_DELETED" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe(
      "https://control.example/rest/v1/rpc/ledger_sync_scope",
    );
    expect(room.beginDelete).not.toHaveBeenCalled();
    expect(room.finishDelete).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});
