import { describe, expect, it } from "vitest";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import {
  decodeJsonPayload,
  encodeJsonPayload,
  isSnapshotPayloadEnvelope,
  SNAPSHOT_COMPRESS_MIN_BYTES,
  SNAPSHOT_PAYLOAD_CODEC,
} from "../src/ledger/snapshotPayload.ts";

describe("D-145 snapshot payload codec", () => {
  it("keeps tiny payloads as plain JSON", async () => {
    const encoded = await encodeJsonPayload({ hello: "hearth", n: 1 });
    expect(encoded.codec).toBe("plain");
    expect(encoded.text).toBe(JSON.stringify({ hello: "hearth", n: 1 }));
    expect(await decodeJsonPayload(encoded.text)).toEqual({ hello: "hearth", n: 1 });
  });

  it("round-trips a large personal envelope through the gzip codec", async () => {
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
        visibility: "personal",
        confirmDuplicate: true,
      }).household;
    }
    const last = household.transactions.at(-1)!;
    const encoded = await encodeJsonPayload(household);
    expect(encoded.rawBytes).toBeGreaterThan(SNAPSHOT_COMPRESS_MIN_BYTES);
    expect(encoded.codec).toBe(SNAPSHOT_PAYLOAD_CODEC);
    expect(encoded.wireBytes).toBeLessThan(encoded.rawBytes * 0.9);
    expect(isSnapshotPayloadEnvelope(JSON.parse(encoded.text))).toBe(true);
    const decoded = await decodeJsonPayload(encoded.text) as typeof household;
    expect(decoded.householdId).toBe(household.householdId);
    expect(decoded.revision).toBe(household.revision);
    expect(decoded.transactions).toHaveLength(household.transactions.length);
    expect(decoded.transactions.at(-1)).toMatchObject({
      note: last.note,
      amountCents: last.amountCents,
      date: last.date,
      visibility: "personal",
      splits: last.splits,
    });
  });

  it("keeps personal envelopes plain for Migration 012 payload_is_member_personal", async () => {
    const { encodePersonalEnvelopePayload, isSnapshotPayloadEnvelope } = await import("../src/ledger/snapshotPayload.ts");
    const { personalReplicaForMember } = await import("../src/core/sync.ts");
    let household = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: "jonathan@example.com",
      subject: "google-sub-jonathan",
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    for (let i = 0; i < 12; i += 1) {
      household = postEntry(household, {
        date: "2026-08-24",
        type: "expense",
        amount: "12.34",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `Personal atomic publish line ${i} with enough text to exceed gzip threshold`,
        createdBy: "MEM-001",
        visibility: "personal",
        confirmDuplicate: true,
      }).household;
    }
    const envelope = personalReplicaForMember(household, "MEM-001");
    const text = await encodePersonalEnvelopePayload(envelope);
    expect(Buffer.byteLength(text, "utf8")).toBeGreaterThan(SNAPSHOT_COMPRESS_MIN_BYTES);
    expect(isSnapshotPayloadEnvelope(JSON.parse(text))).toBe(false);
    const parsed = JSON.parse(text) as typeof envelope;
    expect(parsed.kind).toBe("personal");
    expect(parsed.memberId).toBe("MEM-001");
    expect(parsed.transactions.every((row) => row.createdBy === "MEM-001")).toBe(true);
  });

  it("keeps shared snapshot payloads plain so live CAS SQL can inspect them", async () => {
    const { encodeSharedSnapshotPayload } = await import("../src/ledger/snapshotPayload.ts");
    let household = catalogHousehold();
    for (let i = 0; i < 40; i += 1) {
      household = postEntry(household, {
        date: "2026-08-24",
        type: "expense",
        amount: "9.99",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `Shared stress line ${i}`,
        createdBy: "MEM-001",
        confirmDuplicate: true,
      }).household;
    }
    const text = await encodeSharedSnapshotPayload(household);
    expect(isSnapshotPayloadEnvelope(JSON.parse(text))).toBe(false);
    const parsed = JSON.parse(text) as typeof household;
    expect(parsed.householdId).toBe(household.householdId);
    expect(parsed.transactions.some((row) => row.visibility === "personal")).toBe(false);
  });

  it("proves slim outbox + personal gzip beat a fat localStorage tip", async () => {
    const {
      createMemoryContinuityStore,
      enqueueContinuitySnapshot,
      setContinuityStore,
    } = await import("../src/continuity.ts");
    const { encodeSharedSnapshotPayload: encodeShared } = await import("../src/ledger/snapshotPayload.ts");

    let household = linkGoogleIdentity(catalogHousehold(), {
      memberId: "MEM-001",
      email: "jonathan@example.com",
      subject: "google-sub-jonathan",
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    for (let i = 0; i < 100; i += 1) {
      household = postEntry(household, {
        date: "2026-08-24",
        type: "expense",
        amount: "11.11",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `quota stress line ${i} xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
        createdBy: "MEM-001",
        visibility: i % 2 ? "personal" : "household",
        confirmDuplicate: true,
      }).household;
    }

    const fatOutboxBytes = Buffer.byteLength(JSON.stringify([{ id: "legacy", snapshot: household }]));
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    enqueueContinuitySnapshot({
      household,
      identity: { subject: "google-sub-jonathan", email: "jonathan@example.com" },
      expectedRevision: 0,
      confirmationId: "size-demo",
    });
    const slim = store.getItem("hearth:continuity-outbox:v1:development") ?? "";
    const personal = await encodeJsonPayload(household);
    const shared = await encodeShared(household);
    expect(Buffer.byteLength(slim)).toBeLessThan(fatOutboxBytes / 50);
    expect(slim).not.toMatch(/"transactions"/);
    expect(personal.codec).toBe(SNAPSHOT_PAYLOAD_CODEC);
    expect(personal.wireBytes).toBeLessThan(personal.rawBytes * 0.2);
    expect(shared.includes("gzip-base64")).toBe(false);
  });

  it("still decodes legacy plain hosted rows", async () => {
    const household = catalogHousehold();
    const plain = JSON.stringify(household);
    const decoded = await decodeJsonPayload(plain) as typeof household;
    expect(decoded.householdId).toBe(household.householdId);
    expect(decoded.transactions).toEqual(household.transactions);
  });
});
