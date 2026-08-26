import { describe, expect, it } from "vitest";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import {
  decodeJsonPayload,
  encodeJsonPayload,
  isSnapshotPayloadEnvelope,
  SNAPSHOT_COMPRESS_MIN_BYTES,
  SNAPSHOT_PAYLOAD_CODEC,
} from "../src/ledger/snapshotPayload.ts";

describe("D-144 snapshot payload codec", () => {
  it("keeps tiny payloads as plain JSON", async () => {
    const encoded = await encodeJsonPayload({ hello: "hearth", n: 1 });
    expect(encoded.codec).toBe("plain");
    expect(encoded.text).toBe(JSON.stringify({ hello: "hearth", n: 1 }));
    expect(await decodeJsonPayload(encoded.text)).toEqual({ hello: "hearth", n: 1 });
  });

  it("round-trips a large household through the gzip envelope", async () => {
    let household = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: "jonathan@example.com",
      subject: "google-sub-jonathan",
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    for (let i = 0; i < 80; i += 1) {
      household = postEntry(household, {
        date: "2026-08-24",
        type: "expense",
        amount: "12.34",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `Stress grocery line ${i} with enough text to inflate the journal for compression`,
        createdBy: "MEM-001",
        confirmDuplicate: true,
      }).household;
    }
    const encoded = await encodeJsonPayload(household);
    expect(encoded.rawBytes).toBeGreaterThan(SNAPSHOT_COMPRESS_MIN_BYTES);
    expect(encoded.codec).toBe(SNAPSHOT_PAYLOAD_CODEC);
    expect(encoded.wireBytes).toBeLessThan(encoded.rawBytes * 0.9);
    expect(isSnapshotPayloadEnvelope(JSON.parse(encoded.text))).toBe(true);
    const decoded = await decodeJsonPayload(encoded.text) as typeof household;
    expect(decoded.householdId).toBe(household.householdId);
    expect(decoded.revision).toBe(household.revision);
    expect(decoded.transactions).toHaveLength(household.transactions.length);
    expect(decoded.transactions.at(-1)?.note).toContain("Stress grocery line 79");
  });

  it("still decodes legacy plain hosted rows", async () => {
    const household = catalogHousehold();
    const plain = JSON.stringify(household);
    const decoded = await decodeJsonPayload(plain) as typeof household;
    expect(decoded.householdId).toBe(household.householdId);
    expect(decoded.transactions).toEqual(household.transactions);
  });
});
