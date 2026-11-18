import { describe, expect, it } from "vitest";
import { postShift } from "../src/core/commands.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import { shiftBibleMaterialHash, type ShiftBible } from "../src/core/shiftEnvelope.ts";
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
import type { CommandReceipt, HerculesProPermissions } from "../src/core/types.ts";

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
