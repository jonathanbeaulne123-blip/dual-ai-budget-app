import { describe, expect, it } from "vitest";
import { postShift } from "../src/core/commands.ts";
import { createCompanionProfile } from "../src/core/herculesCompanionContracts.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import type { Coworker } from "../src/core/coworkers.ts";
import { parseSevenShiftsCalendar } from "../src/core/sevenShiftsCalendar.ts";
import { shiftBibleMaterialHash, type ShiftBible, type ShiftEnvelope } from "../src/core/shiftEnvelope.ts";
import {
  assembleHousehold,
  mergePersonal,
  mergeShared,
  overlayPersonalReplica,
  shapeHerculesProPermissions,
  splitForSync,
  mergeRecords,
  mergeTombstones,
  recency,
} from "../src/core/sync.ts";
import type { CommandReceipt, HerculesProPermissions, SyntheticFixtureProvenance } from "../src/core/types.ts";
import { emptyPersonalLife } from "../src/hearthside/personalLifeContracts.ts";

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

function receipt(overrides: Partial<CommandReceipt> = {}): CommandReceipt {
  return {
    confirmationId: "C-1",
    identityHash: "hash-a",
    auditHash: "audit-a",
    commandKind: "postEntry",
    postedIds: ["TXN-1"],
    revision: 1,
    acceptedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function permissions(overrides: Partial<HerculesProPermissions> = {}): HerculesProPermissions {
  return {
    personalWrite: false,
    householdWrite: false,
    updatedAt: null,
    ...overrides,
  };
}

function workedBible(input: {
  id: string;
  householdId: string;
  memberId: string;
  envelopeId: string;
  linkedShiftId: string;
  revision: number;
  correctedByBibleId?: string | null;
}): ShiftBible {
  const facts: Omit<ShiftBible, "materialHash"> = {
    id: input.id,
    version: 1,
    revision: input.revision,
    environment: "development",
    householdId: input.householdId,
    memberId: input.memberId,
    envelopeId: input.envelopeId,
    outcome: "worked",
    jobId: "JOB-001",
    roleId: "ROLE-001",
    locationName: "Patio",
    timezone: "America/Toronto",
    scheduledStart: "2026-08-29T20:30:00.000Z",
    scheduledEnd: "2026-08-30T02:30:00.000Z",
    actualStart: "2026-08-29T20:30:00.000Z",
    actualEnd: "2026-08-30T02:30:00.000Z",
    workedMinutes: 345,
    paidBreakMinutes: 15,
    unpaidBreakMinutes: 0,
    approvalState: "approved",
    scheduleDifferenceMinutes: 0,
    cashTipsCents: 4000,
    cardTipsCents: 5500,
    salesCents: 25000,
    salesByField: {},
    customersServed: 28,
    staffingCount: 4,
    grossWagesCents: null,
    netTipsCents: null,
    tipOutCents: null,
    attendance: [],
    weather: null,
    weatherGlass: null,
    eventTag: "regular",
    contextFacts: [],
    revisionHistory: [],
    authority: [],
    linkedShiftId: input.linkedShiftId,
    commandConfirmationId: "confirm-bible-0001",
    correctionOfBibleId: null,
    correctedByBibleId: input.correctedByBibleId ?? null,
    confirmedAt: "2026-08-30T03:00:00.000Z",
    createdAt: "2026-08-30T03:00:00.000Z",
    updatedAt: "2026-08-30T03:00:00.000Z",
  };
  return { ...facts, materialHash: shiftBibleMaterialHash(facts) };
}

function postedShift(memberId: string, date: string) {
  return postShift(catalogHousehold(), {
    date,
    memberId,
    accountId: "ACC-CASH",
    sales: "100.00",
    hours: "4.00",
    createdBy: memberId,
    visibility: "household",
    confirmDuplicate: true,
    customersServed: 40,
    staffingCount: 4,
    eventTag: "regular",
  }).household;
}

describe("two-device command receipt merge", () => {
  it("keeps the higher revision for a confirmation and unions the rest, sorted by id", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-002");
    const merged = mergeShared(
      { ...shared, commandReceipts: [receipt({ confirmationId: "C-2", revision: 1 }), receipt({ confirmationId: "C-1", revision: 1 })] },
      { ...shared, commandReceipts: [receipt({ confirmationId: "C-1", revision: 3, identityHash: "newer" })] },
    );
    expect((merged.commandReceipts ?? []).map((row) => [row.confirmationId, row.revision, row.identityHash])).toEqual([
      ["C-1", 3, "newer"],
      ["C-2", 1, "hash-a"],
    ]);
  });

  it("breaks an equal-revision tie with acceptedAt, then with a stable JSON compare", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-002");
    const laterAccepted = mergeShared(
      { ...shared, commandReceipts: [receipt({ acceptedAt: "2026-08-01T00:00:00.000Z" })] },
      { ...shared, commandReceipts: [receipt({ acceptedAt: "2026-08-02T00:00:00.000Z", identityHash: "client" })] },
    );
    expect(laterAccepted.commandReceipts).toEqual([
      receipt({ acceptedAt: "2026-08-02T00:00:00.000Z", identityHash: "client" }),
    ]);

    const jsonTie = mergeShared(
      { ...shared, commandReceipts: [receipt({ identityHash: "aaa" })] },
      { ...shared, commandReceipts: [receipt({ identityHash: "zzz" })] },
    );
    expect(jsonTie.commandReceipts?.[0]?.identityHash).toBe("zzz");
    const jsonKeepsFirst = mergeShared(
      { ...shared, commandReceipts: [receipt({ identityHash: "zzz" })] },
      { ...shared, commandReceipts: [receipt({ identityHash: "aaa" })] },
    );
    expect(jsonKeepsFirst.commandReceipts?.[0]?.identityHash).toBe("zzz");
  });
});

describe("two-device envelope recency", () => {
  it("lets the later-committed replica keep the household name and ignores an uncommitted client", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-002");
    expect(mergeShared(
      { ...shared, name: "Server House", lastCommittedAt: "2026-08-01T00:00:00.000Z" },
      { ...shared, name: "Client House", lastCommittedAt: "2026-08-02T00:00:00.000Z" },
    ).name).toBe("Client House");
    expect(mergeShared(
      { ...shared, name: "Server House", lastCommittedAt: "2026-08-01T00:00:00.000Z" },
      { ...shared, name: "Client House", lastCommittedAt: null },
    ).name).toBe("Server House");
  });

  it("copies timezone and shift settings from the later envelope, including a clock tie", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-002");
    const later = mergeShared(
      {
        ...shared,
        timezone: "America/Toronto",
        shiftSettings: { ...shared.shiftSettings, floorPct: 6 },
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...shared,
        timezone: "America/Vancouver",
        shiftSettings: { ...shared.shiftSettings, floorPct: 8 },
        lastCommittedAt: "2026-08-02T00:00:00.000Z",
      },
    );
    expect(later.timezone).toBe("America/Vancouver");
    expect(later.shiftSettings.floorPct).toBe(8);

    const uncommittedClient = mergeShared(
      {
        ...shared,
        timezone: "America/Toronto",
        shiftSettings: { ...shared.shiftSettings, floorPct: 6 },
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...shared,
        timezone: "America/Vancouver",
        shiftSettings: { ...shared.shiftSettings, floorPct: 8 },
        lastCommittedAt: null,
      },
    );
    expect(uncommittedClient.timezone).toBe("America/Toronto");
    expect(uncommittedClient.shiftSettings.floorPct).toBe(6);

    const tied = mergeShared(
      {
        ...shared,
        timezone: "America/Toronto",
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...shared,
        timezone: "UTC",
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
    );
    expect(tied.timezone).toBe("UTC");

    const uncommittedServer = mergeShared(
      {
        ...shared,
        timezone: "America/Toronto",
        lastCommittedAt: null,
      },
      {
        ...shared,
        timezone: "Pacific/Auckland",
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
    );
    expect(uncommittedServer.timezone).toBe("Pacific/Auckland");
  });

  it("lets the later envelope keep ledger names and environment, then shapes blank names", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-002");
    const kitchen = {
      shared: "Kitchen Books",
      personal: { "MEM-001": "Bianca's Notebook", "MEM-002": "Jonathan's Quiet Books" },
    };
    const later = mergeShared(
      {
        ...shared,
        name: "Server House",
        ledgerNames: shared.ledgerNames,
        environment: "development",
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...shared,
        name: "North House",
        ledgerNames: kitchen,
        environment: "production",
        lastCommittedAt: "2026-08-02T00:00:00.000Z",
      },
    );
    expect(later.name).toBe("North House");
    expect(later.ledgerNames).toEqual(kitchen);
    expect(later.environment).toBe("production");

    const uncommittedClient = mergeShared(
      {
        ...shared,
        ledgerNames: kitchen,
        environment: "production",
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...shared,
        ledgerNames: shared.ledgerNames,
        environment: "development",
        lastCommittedAt: null,
      },
    );
    expect(uncommittedClient.ledgerNames).toEqual(kitchen);
    expect(uncommittedClient.environment).toBe("production");

    const tied = mergeShared(
      {
        ...shared,
        ledgerNames: kitchen,
        environment: "production",
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
      {
        ...shared,
        ledgerNames: shared.ledgerNames,
        environment: "development",
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
    );
    expect(tied.ledgerNames).toEqual(shared.ledgerNames);
    expect(tied.environment).toBe("development");

    const blank = mergeShared(
      {
        ...shared,
        ledgerNames: { shared: "  ", personal: {} },
        lastCommittedAt: "2026-08-02T00:00:00.000Z",
      },
      {
        ...shared,
        ledgerNames: kitchen,
        lastCommittedAt: "2026-08-01T00:00:00.000Z",
      },
    );
    expect(blank.ledgerNames.shared).toBe("Household Ledger");
    expect(blank.ledgerNames.personal["MEM-001"]).toBe("Bianca's Personal Ledger");
    expect(blank.ledgerNames.personal["MEM-002"]).toBe("Jonathan's Personal Ledger");
  });

  it("uses the client's invite when the server phrase does not normalize, otherwise keeps the server token", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-002");
    expect(mergeShared(
      { ...shared, inviteCode: "   " },
      { ...shared, inviteCode: "cedar-lantern-maple" },
    ).inviteCode).toBe("cedar-lantern-maple");
    expect(mergeShared(
      { ...shared, inviteCode: "no" },
      { ...shared, inviteCode: "Cedar Lantern Maple" },
    ).inviteCode).toBe("Cedar Lantern Maple");
    expect(mergeShared(
      { ...shared, inviteCode: "https://hearth.example/?join=maple-hearth-linen" },
      { ...shared, inviteCode: "cedar-lantern-maple" },
    ).inviteCode).toBe("maple-hearth-linen");
    expect(mergeShared(
      { ...shared, inviteCode: "cedar lantern maple" },
      { ...shared, inviteCode: "maple-hearth-linen" },
    ).inviteCode).toBe("cedar-lantern-maple");
  });
});

function coworker(overrides: Partial<Coworker> = {}): Coworker {
  return {
    id: "COW-001",
    ownerMemberId: "MEM-002",
    jobId: "JOB-001",
    locationName: "Patio",
    displayName: "Alex Moore",
    normalizedName: "alex moore",
    aliases: ["alex moore"],
    observedRoles: [],
    source: "manual",
    sourceIdentityKey: null,
    active: true,
    provisional: false,
    mergedIntoCoworkerId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function shiftEnvelope(overrides: Partial<ShiftEnvelope> = {}): ShiftEnvelope {
  return {
    id: "ENV-001",
    environment: "development",
    householdId: "HH-001",
    memberId: "MEM-002",
    canonicalShiftKey: "schedule:7shifts-calendar:001",
    jobId: "JOB-001",
    roleId: "ROLE-001",
    roleLabel: "Server",
    locationName: "Patio",
    timezone: "America/Toronto",
    date: "2026-08-29",
    scheduledStart: "2026-08-29T20:30:00.000Z",
    scheduledEnd: "2026-08-30T02:30:00.000Z",
    actualStart: null,
    actualEnd: null,
    workedMinutes: null,
    paidBreakMinutes: null,
    unpaidBreakMinutes: null,
    approvalState: "unknown",
    status: "upcoming",
    sourceCategories: ["seven_shifts_schedule"],
    authority: [],
    conflicts: [],
    lastObservedAt: "2026-08-29T12:00:00.000Z",
    sourceFinality: "outlook",
    confirmedBibleId: null,
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
    ...overrides,
  };
}

describe("personal coworker and shift-envelope recency", () => {
  it("lets the later coworker updatedAt win even when the other envelope committed later", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const earlierName = coworker({ displayName: "Alex Moore", updatedAt: "2026-08-01T00:00:00.000Z" });
    const laterName = coworker({ displayName: "Alexandra Moore", updatedAt: "2026-08-03T00:00:00.000Z" });
    const staleEnvelope = { ...personal, lastCommittedAt: "2026-08-04T00:00:00.000Z", coworkers: [earlierName] };
    const liveEnvelope = { ...personal, lastCommittedAt: "2026-08-02T00:00:00.000Z", coworkers: [laterName] };
    expect(mergePersonal(staleEnvelope, liveEnvelope).coworkers).toMatchObject([
      { id: "COW-001", displayName: "Alexandra Moore" },
    ]);
    expect(mergePersonal(liveEnvelope, staleEnvelope).coworkers).toMatchObject([
      { id: "COW-001", displayName: "Alexandra Moore" },
    ]);
  });

  it("drops another member's coworker and a tombstoned id, then unions live rows", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const mine = coworker({ id: "COW-MINE", displayName: "Alex Moore" });
    const theirs = coworker({ id: "COW-THEIRS", ownerMemberId: "MEM-001", displayName: "Bianca Helper" });
    const deleted = coworker({ id: "COW-GONE", displayName: "Retired Name", updatedAt: "2026-08-04T00:00:00.000Z" });
    const merged = mergePersonal(
      { ...personal, coworkers: [theirs, deleted] },
      {
        ...personal,
        coworkers: [mine],
        tombstones: [{ id: "COW-GONE", deletedAt: "2026-08-02T00:00:00.000Z" }],
      },
    );
    expect(merged.coworkers).toMatchObject([{ id: "COW-MINE", displayName: "Alex Moore" }]);
    expect(merged.coworkers?.some((row) => row.ownerMemberId === "MEM-001")).toBe(false);
  });

  it("lets the later shift envelope updatedAt win and ignores another member's copy", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const earlier = shiftEnvelope({ status: "upcoming", updatedAt: "2026-08-01T00:00:00.000Z" });
    const later = shiftEnvelope({ status: "worked_ready", workedMinutes: 330, updatedAt: "2026-08-03T00:00:00.000Z" });
    const theirs = shiftEnvelope({ id: "ENV-OTHER", memberId: "MEM-001", canonicalShiftKey: "schedule:7shifts-calendar:other" });
    const merged = mergePersonal(
      { ...personal, lastCommittedAt: "2026-08-04T00:00:00.000Z", shiftEnvelopes: [earlier, theirs] },
      { ...personal, lastCommittedAt: "2026-08-02T00:00:00.000Z", shiftEnvelopes: [later] },
    );
    expect(merged.shiftEnvelopes).toMatchObject([{ id: "ENV-001", status: "worked_ready", workedMinutes: 330 }]);
    expect(merged.shiftEnvelopes?.some((row) => row.memberId === "MEM-001")).toBe(false);

    const tied = mergePersonal(
      { ...personal, shiftEnvelopes: [shiftEnvelope({ status: "upcoming", updatedAt: "2026-08-01T00:00:00.000Z" })] },
      { ...personal, shiftEnvelopes: [shiftEnvelope({ status: "cut", updatedAt: "2026-08-01T00:00:00.000Z" })] },
    );
    expect(tied.shiftEnvelopes?.[0]?.status).toBe("cut");
  });
});

function demoFixture(overrides: Partial<SyntheticFixtureProvenance> = {}): SyntheticFixtureProvenance {
  return {
    kind: "hearth-demo-suite",
    version: "1",
    seed: 1,
    generatedForDate: "2026-08-01",
    generatedAt: "2026-08-01T00:00:00.000Z",
    buildSha: "abc",
    profile: "investor",
    numberStyle: "realistic",
    coverageDigest: "digest-a",
    fixtureHashSha256: "hash-a",
    ...overrides,
  };
}

describe("synthetic Demo Suite merge", () => {
  it("keeps the later generatedAt key, fills a missing side, and refuses Production provenance", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-002");
    const earlier = demoFixture({ generatedAt: "2026-08-01T00:00:00.000Z", fixtureHashSha256: "hash-old" });
    const later = demoFixture({ generatedAt: "2026-08-02T00:00:00.000Z", fixtureHashSha256: "hash-new" });
    expect(mergeShared(
      { ...shared, syntheticFixture: earlier },
      { ...shared, syntheticFixture: later },
    ).syntheticFixture).toEqual(later);
    expect(mergeShared(
      { ...shared, syntheticFixture: later },
      { ...shared, syntheticFixture: earlier },
    ).syntheticFixture).toEqual(later);
    expect(mergeShared(
      { ...shared, syntheticFixture: earlier },
      { ...shared, syntheticFixture: null },
    ).syntheticFixture).toEqual(earlier);
    expect(mergeShared(
      { ...shared, syntheticFixture: null },
      { ...shared, syntheticFixture: later },
    ).syntheticFixture).toEqual(later);

    const tied = demoFixture({ coverageDigest: "digest-client", fixtureHashSha256: "hash-client" });
    expect(mergeShared(
      { ...shared, syntheticFixture: earlier },
      { ...shared, syntheticFixture: tied },
    ).syntheticFixture).toEqual(tied);

    expect(() => mergeShared(
      { ...shared, environment: "production", syntheticFixture: later },
      shared,
    )).toThrow(/only in Development/);
  });
});

describe("personal companion and life authority", () => {
  it("refuses a clock merge when companion profiles differ and keeps identical profiles", () => {
    const household = catalogHousehold();
    const { personal } = splitForSync(household, "MEM-002");
    const profile = createCompanionProfile({
      environment: household.environment,
      householdId: household.householdId,
      memberId: "MEM-002",
    });
    const quiet = { ...profile, remembering: { ...profile.remembering, enabled: false } };
    expect(() => mergePersonal(
      { ...personal, companionProfile: profile },
      { ...personal, companionProfile: quiet },
    )).toThrow("COMPANION_REQUIRES_AUTHORITY_REFRESH");
    expect(() => mergePersonal(
      { ...personal, companionProfile: undefined },
      { ...personal, companionProfile: profile },
    )).toThrow("COMPANION_REQUIRES_AUTHORITY_REFRESH");

    const merged = mergePersonal(
      { ...personal, companionProfile: profile },
      { ...personal, companionProfile: structuredClone(profile) },
    );
    expect(merged.companionProfile).toEqual(profile);
    expect(merged.companionProfile).not.toBe(profile);
  });

  it("refuses a clock merge when both Personal Together documents differ and restores a one-sided copy", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const empty = emptyPersonalLife("MEM-002");
    expect(mergePersonal(
      { ...personal, personalLife: empty },
      { ...personal, personalLife: structuredClone(empty) },
    ).personalLife).toEqual(empty);
    expect(() => mergePersonal(
      { ...personal, personalLife: empty },
      { ...personal, personalLife: { ...empty, ownerMemberId: "MEM-001" } },
    )).toThrow("PERSONAL_LIFE_REQUIRES_AUTHORITY_REFRESH");

    const restoredFromClient = mergePersonal(
      { ...personal, personalLife: undefined },
      { ...personal, personalLife: empty },
    );
    expect(restoredFromClient.personalLife).toEqual(empty);
    const restoredFromServer = mergePersonal(
      { ...personal, personalLife: empty },
      { ...personal, personalLife: undefined },
    );
    expect(restoredFromServer.personalLife).toEqual(empty);
  });
});

const RAIL_SHAPE = ["level", "contribute", "waiting", "ask", "next-out", "streams", "shape", "week"] as const;
const RAIL_WEEK = ["level", "contribute", "waiting", "ask", "next-out", "streams", "week", "shape"] as const;

describe("personal preference clock ties", () => {
  it("converges glance and Fund-card ids on later clocks, missing sides, and lexicographic ties", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const visa = {
      ...personal,
      glanceAccountId: "ACC-VISA",
      glanceAccountUpdatedAt: "2026-08-01T00:00:00.000Z",
      fundCardAccountId: "ACC-VISA",
      fundCardAccountUpdatedAt: "2026-08-01T00:00:00.000Z",
    };
    const mc = {
      ...personal,
      glanceAccountId: "ACC-MC",
      glanceAccountUpdatedAt: "2026-08-01T00:00:00.000Z",
      fundCardAccountId: "ACC-MC",
      fundCardAccountUpdatedAt: "2026-08-01T00:00:00.000Z",
    };
    expect(mergePersonal(mc, visa).glanceAccountId).toBe("ACC-VISA");
    expect(mergePersonal(visa, mc).glanceAccountId).toBe("ACC-VISA");
    expect(mergePersonal(mc, visa).fundCardAccountId).toBe("ACC-VISA");
    expect(mergePersonal(visa, mc).fundCardAccountId).toBe("ACC-VISA");

    const missingServer = mergePersonal(
      { ...personal, glanceAccountId: undefined, fundCardAccountId: undefined },
      { ...mc, glanceAccountUpdatedAt: "2026-07-01T00:00:00.000Z", fundCardAccountUpdatedAt: "2026-07-01T00:00:00.000Z" },
    );
    expect(missingServer.glanceAccountId).toBe("ACC-MC");
    expect(missingServer.fundCardAccountId).toBe("ACC-MC");

    const byCommit = mergePersonal(
      { ...personal, glanceAccountId: "ACC-MC", lastCommittedAt: "2026-08-01T00:00:00.000Z" },
      { ...personal, glanceAccountId: "ACC-VISA", lastCommittedAt: "2026-08-02T00:00:00.000Z" },
    );
    expect(byCommit.glanceAccountId).toBe("ACC-VISA");
    expect(byCommit.glanceAccountUpdatedAt).toBe("2026-08-02T00:00:00.000Z");

    const blankServer = mergePersonal(
      { ...personal, glanceAccountId: "   ", fundCardAccountId: "" },
      mc,
    );
    expect(blankServer.glanceAccountId).toBe("ACC-MC");
    expect(blankServer.fundCardAccountId).toBe("ACC-MC");

    const bothBlank = mergePersonal(
      { ...personal, glanceAccountId: " ", fundCardAccountId: "" },
      { ...personal, glanceAccountId: "", fundCardAccountId: "   " },
    );
    expect(bothBlank.glanceAccountId).toBeUndefined();
    expect(bothBlank.fundCardAccountId).toBeUndefined();
  });

  it("converges Fund rails on later updatedAt, JSON slot ties, and a missing side", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const shapeRail = { memberId: "MEM-002", slots: [...RAIL_SHAPE], updatedAt: "2026-08-01T00:00:00.000Z" };
    const weekRail = { memberId: "MEM-002", slots: [...RAIL_WEEK], updatedAt: "2026-08-01T00:00:00.000Z" };
    expect(mergePersonal({ ...personal, fundRail: shapeRail }, { ...personal, fundRail: weekRail }).fundRail?.slots)
      .toEqual([...RAIL_WEEK]);
    expect(mergePersonal({ ...personal, fundRail: weekRail }, { ...personal, fundRail: shapeRail }).fundRail?.slots)
      .toEqual([...RAIL_WEEK]);

    const later = { ...shapeRail, updatedAt: "2026-08-02T00:00:00.000Z" };
    expect(mergePersonal({ ...personal, fundRail: weekRail }, { ...personal, fundRail: later }).fundRail)
      .toEqual(later);
    expect(mergePersonal({ ...personal, fundRail: undefined }, { ...personal, fundRail: shapeRail }).fundRail)
      .toEqual(shapeRail);
  });

  it("ignores an invalid landing surface and uses lastCommittedAt when the surface clock is missing", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const invalid = mergePersonal(
      {
        ...personal,
        landingSurface: "kitchen" as never,
        landingSurfaceUpdatedAt: "2026-08-03T00:00:00.000Z",
        lastCommittedAt: "2026-08-03T00:00:00.000Z",
      },
      {
        ...personal,
        landingSurface: "desk",
        landingSurfaceUpdatedAt: "2026-08-01T00:00:00.000Z",
      },
    );
    expect(invalid.landingSurface).toBe("desk");

    const byCommit = mergePersonal(
      { ...personal, landingSurface: "desk", lastCommittedAt: "2026-08-01T00:00:00.000Z" },
      { ...personal, landingSurface: "till", lastCommittedAt: "2026-08-02T00:00:00.000Z" },
    );
    expect(byCommit.landingSurface).toBe("till");
    expect(byCommit.landingSurfaceUpdatedAt).toBe("2026-08-02T00:00:00.000Z");
  });
});

const SEVEN_SHIFTS_ICS = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//7shifts//Personal Schedule//EN\r
BEGIN:VEVENT\r
UID:jonathan-20260901@example.7shifts.com\r
DTSTAMP:20260827T120000Z\r
DTSTART:20260901T210000Z\r
DTEND:20260902T030000Z\r
SUMMARY:Jonathan - Server\r
END:VEVENT\r
END:VCALENDAR\r
`;

describe("personal 7shifts schedule source", () => {
  it("keeps the older replica when the newer envelope omits the key, and clears when the newer list is present and empty", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const schedules = parseSevenShiftsCalendar({
      source: SEVEN_SHIFTS_ICS,
      sourceName: "7shifts.ics",
      memberId: "MEM-002",
      memberName: "Jonathan",
      jobs: [],
    }).shifts;
    expect(schedules).toHaveLength(1);
    const withSchedules = { ...personal, sevenShiftsSchedules: schedules, lastCommittedAt: "2026-08-01T00:00:00.000Z" };

    const laterServerOmits = { ...personal, lastCommittedAt: "2026-08-02T00:00:00.000Z" };
    delete laterServerOmits.sevenShiftsSchedules;
    expect(mergePersonal(laterServerOmits, withSchedules).sevenShiftsSchedules).toEqual(schedules);

    const laterClientOmits = { ...personal, lastCommittedAt: "2026-08-02T00:00:00.000Z" };
    delete laterClientOmits.sevenShiftsSchedules;
    expect(mergePersonal(withSchedules, laterClientOmits).sevenShiftsSchedules).toEqual(schedules);

    const laterEmpty = { ...personal, sevenShiftsSchedules: [], lastCommittedAt: "2026-08-02T00:00:00.000Z" };
    expect(mergePersonal(withSchedules, laterEmpty).sevenShiftsSchedules).toEqual([]);
    expect(mergePersonal(laterEmpty, withSchedules).sevenShiftsSchedules).toEqual([]);
  });
});

describe("Hercules Pro permission restore", () => {
  it("treats only boolean true as write consent and drops invalid clocks", () => {
    expect(shapeHerculesProPermissions(undefined)).toEqual({
      personalWrite: false,
      householdWrite: false,
      updatedAt: null,
    });
    expect(shapeHerculesProPermissions({
      personalWrite: "true",
      householdWrite: 1,
      updatedAt: "not-a-date",
    })).toEqual({
      personalWrite: false,
      householdWrite: false,
      updatedAt: null,
    });
    expect(shapeHerculesProPermissions({
      personalWrite: true,
      householdWrite: true,
      updatedAt: "2026-08-02T12:00:00Z",
    })).toEqual({
      personalWrite: true,
      householdWrite: true,
      updatedAt: "2026-08-02T12:00:00.000Z",
    });
  });

  it("lets the later permission clock win and prefers the client on a tie", () => {
    const { personal } = splitForSync(catalogHousehold(), "MEM-002");
    const server = {
      ...personal,
      herculesProPermissions: permissions({ personalWrite: true, updatedAt: "2026-08-01T00:00:00.000Z" }),
    };
    const client = {
      ...personal,
      herculesProPermissions: permissions({ householdWrite: true, updatedAt: "2026-08-02T00:00:00.000Z" }),
    };
    expect(mergePersonal(server, client).herculesProPermissions).toEqual(client.herculesProPermissions);
    expect(mergePersonal(client, server).herculesProPermissions).toEqual(client.herculesProPermissions);

    const tiedClient = {
      ...personal,
      herculesProPermissions: permissions({ householdWrite: true, updatedAt: "2026-08-01T00:00:00.000Z" }),
    };
    expect(mergePersonal(server, tiedClient).herculesProPermissions?.householdWrite).toBe(true);
    expect(mergePersonal(server, { ...personal, herculesProPermissions: undefined }).herculesProPermissions?.personalWrite).toBe(true);
  });
});

describe("personal shift bible uniqueness and reattach", () => {
  it("keeps the higher revision when a list copy and a shift-attached copy share an id", () => {
    const household = postedShift("MEM-002", "2026-08-18");
    const shift = household.shifts[0]!;
    const stale = workedBible({
      id: "BIBLE-001",
      householdId: household.householdId,
      memberId: "MEM-002",
      envelopeId: "ENV-001",
      linkedShiftId: shift.id,
      revision: 1,
    });
    const live = workedBible({
      id: "BIBLE-001",
      householdId: household.householdId,
      memberId: "MEM-002",
      envelopeId: "ENV-001",
      linkedShiftId: shift.id,
      revision: 2,
    });
    const withBibles = {
      ...household,
      shifts: household.shifts.map((row) => row.id === shift.id ? { ...row, shiftBible: live } : row),
      shiftBibles: [stale],
    };
    const { shared, personal } = splitForSync(withBibles, "MEM-002");
    expect(shared.shifts.find((row) => row.id === shift.id)?.shiftBible).toBeUndefined();
    expect(personal.shiftBibles?.find((row) => row.id === "BIBLE-001")?.revision).toBe(2);

    const assembled = assembleHousehold(shared, personal);
    expect(assembled.shifts.find((row) => row.id === shift.id)?.shiftBible?.revision).toBe(2);
    expect(assembled.shiftBibles?.some((row) => row.id === "BIBLE-001")).toBe(false);
  });

  it("does not leak another member's bible or reattach a superseded correction", () => {
    const jonathan = postedShift("MEM-002", "2026-08-18");
    const bianca = postShift(jonathan, {
      date: "2026-08-19",
      memberId: "MEM-001",
      accountId: "ACC-CASH",
      sales: "80.00",
      hours: "3.00",
      createdBy: "MEM-001",
      visibility: "household",
      confirmDuplicate: true,
      customersServed: 20,
      staffingCount: 3,
      eventTag: "regular",
    }).household;
    const jonathanShift = bianca.shifts.find((row) => row.memberId === "MEM-002")!;
    const biancaShift = bianca.shifts.find((row) => row.memberId === "MEM-001")!;
    const jonathanLive = workedBible({
      id: "BIBLE-JON",
      householdId: bianca.householdId,
      memberId: "MEM-002",
      envelopeId: "ENV-JON",
      linkedShiftId: jonathanShift.id,
      revision: 1,
    });
    const jonathanSuperseded = workedBible({
      id: "BIBLE-OLD",
      householdId: bianca.householdId,
      memberId: "MEM-002",
      envelopeId: "ENV-OLD",
      linkedShiftId: jonathanShift.id,
      revision: 1,
      correctedByBibleId: "BIBLE-JON",
    });
    const biancaBible = workedBible({
      id: "BIBLE-BIA",
      householdId: bianca.householdId,
      memberId: "MEM-001",
      envelopeId: "ENV-BIA",
      linkedShiftId: biancaShift.id,
      revision: 1,
    });
    const withBibles = {
      ...bianca,
      shifts: bianca.shifts.map((row) => {
        if (row.id === jonathanShift.id) return { ...row, shiftBible: jonathanLive };
        if (row.id === biancaShift.id) return { ...row, shiftBible: biancaBible };
        return row;
      }),
      shiftBibles: [jonathanSuperseded, biancaBible],
    };
    const { shared, personal } = splitForSync(withBibles, "MEM-002");
    expect(personal.shiftBibles?.map((row) => row.id).sort()).toEqual(["BIBLE-JON", "BIBLE-OLD"]);
    expect(personal.shiftBibles?.some((row) => row.memberId === "MEM-001")).toBe(false);

    const assembled = assembleHousehold(shared, personal);
    expect(assembled.shifts.find((row) => row.id === jonathanShift.id)?.shiftBible?.id).toBe("BIBLE-JON");
    expect(assembled.shifts.find((row) => row.id === biancaShift.id)?.shiftBible).toBeUndefined();
    expect(assembled.shiftBibles?.map((row) => row.id)).toEqual(["BIBLE-OLD"]);

    const cloud = assembleHousehold(shared, null);
    const overlaid = overlayPersonalReplica(cloud, personal, "MEM-002");
    expect(overlaid.shifts.find((row) => row.id === jonathanShift.id)?.shiftBible?.id).toBe("BIBLE-JON");
    expect(overlaid.shifts.find((row) => row.id === biancaShift.id)?.shiftBible).toBeUndefined();
  });

  it("attaches the highest linked revision when two bibles point at the same shift", () => {
    const household = postedShift("MEM-002", "2026-08-18");
    const shift = household.shifts[0]!;
    const older = workedBible({
      id: "BIBLE-001",
      householdId: household.householdId,
      memberId: "MEM-002",
      envelopeId: "ENV-001",
      linkedShiftId: shift.id,
      revision: 1,
    });
    const newer = workedBible({
      id: "BIBLE-002",
      householdId: household.householdId,
      memberId: "MEM-002",
      envelopeId: "ENV-002",
      linkedShiftId: shift.id,
      revision: 2,
    });
    const withBibles = { ...household, shiftBibles: [older, newer] };
    const { shared, personal } = splitForSync(withBibles, "MEM-002");
    const assembled = assembleHousehold(shared, personal);
    expect(assembled.shifts.find((row) => row.id === shift.id)?.shiftBible?.id).toBe("BIBLE-002");
  });
});
