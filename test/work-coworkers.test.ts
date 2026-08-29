import { describe, expect, it } from "vitest";
import {
  commandIdentityFacts,
  compileHousehold,
  financialAuditFacts,
  householdForAiDisclosure,
  importCoworkerRoster,
  matchCoworkerName,
  mergePersonal,
  normalizeCoworkerName,
  postWorkShiftWithAttendanceReview,
  recordCoworkerAttendance,
  scheduledCoworkersForReview,
  seedDemoHousehold,
  splitForSync,
  trialBalance,
  undoLedgerConfirm,
  upsertCoworker,
  type Coworker,
  type Shift,
  type PostWorkShiftInput,
} from "../src/core/index.ts";
import { coworkerRosterDraft } from "../src/imports/coworkerRosterDraft.ts";
import { booksIntegrityFacts } from "../src/ledger/engine.ts";

function roster(): Coworker[] {
  const at = "2026-08-28T12:00:00.000Z";
  return [
    { id: "COW-1", ownerMemberId: "MEM-002", jobId: "JOB-1", locationName: "Capra's Kitchen", displayName: "Joséphine Di Nicola", normalizedName: "josephine di nicola", aliases: ["josephine di nicola"], observedRoles: [], source: "seven-shifts-roster", active: true, provisional: false, createdAt: at, updatedAt: at },
    { id: "COW-2", ownerMemberId: "MEM-002", jobId: "JOB-1", locationName: "Capra's Kitchen", displayName: "Alex Moore", normalizedName: "alex moore", aliases: ["alex moore"], observedRoles: [], source: "seven-shifts-roster", active: true, provisional: false, createdAt: at, updatedAt: at },
    { id: "COW-3", ownerMemberId: "MEM-002", jobId: "JOB-1", locationName: "Capra's Kitchen", displayName: "Taylor Moore", normalizedName: "taylor moore", aliases: ["taylor moore"], observedRoles: [], source: "seven-shifts-roster", active: true, provisional: false, createdAt: at, updatedAt: at },
  ];
}

describe("D-166 private coworker roster", () => {
  it("normalizes names and only auto-matches an exact full name in the same job/location", () => {
    expect(normalizeCoworkerName("  Joséphine   DI NICOLA ")).toBe("josephine di nicola");
    const exact = matchCoworkerName(roster(), "Josephine Di Nicola", { ownerMemberId: "MEM-002", jobId: "JOB-1", locationName: "Capra's Kitchen" });
    expect(exact).toMatchObject({ kind: "exact", coworker: { id: "COW-1" } });
    expect(matchCoworkerName(roster(), "Di Nicola", { ownerMemberId: "MEM-002", jobId: "JOB-1", locationName: "Capra's Kitchen" })).toMatchObject({ kind: "suggested-last-name", coworker: { id: "COW-1" } });
    expect(matchCoworkerName(roster(), "Moore", { ownerMemberId: "MEM-002", jobId: "JOB-1", locationName: "Capra's Kitchen" })).toMatchObject({ kind: "ambiguous" });
    expect(matchCoworkerName(roster(), "Josephine Di Nicola", { ownerMemberId: "MEM-002", jobId: "JOB-1", locationName: "Other" })).toEqual({ kind: "none", candidates: [] });
  });

  it("stores coworkers only in the owner's Personal envelope and leaves financial facts unchanged", () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-002")!;
    const beforeFinancial = financialAuditFacts(household);
    const result = upsertCoworker(household, {
      ownerMemberId: "MEM-002",
      jobId: job.id,
      locationName: job.locationName,
      displayName: "Josephine Di Nicola",
      observedRoles: [{ label: "Support", firstObservedAt: "2026-08-28T12:00:00.000Z", lastObservedAt: "2026-08-28T12:00:00.000Z" }],
      source: "seven-shifts-roster",
    });
    expect(result.household.members).toEqual(household.members);
    expect(result.household.coworkers).toHaveLength(1);
    expect(result.household.activity.at(-1)?.summary).toBe("Updated the private workplace roster");
    expect(JSON.stringify(result.household.activity)).not.toContain("Josephine");
    expect(financialAuditFacts(result.household)).toEqual(beforeFinancial);
    const split = splitForSync(result.household, "MEM-002");
    expect("coworkers" in split.shared).toBe(false);
    expect(split.personal.coworkers).toMatchObject([{ ownerMemberId: "MEM-002", displayName: "Josephine Di Nicola" }]);
    expect(householdForAiDisclosure(result.household, "MEM-002").coworkers).toEqual([]);
  });

  it("binds command identity to private roster material without making it financial", () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-002")!;
    const first = upsertCoworker(household, { ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, displayName: "Alex Moore" });
    const id = first.postedIds[0]!;
    const edited = upsertCoworker(household, { id, ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, displayName: "Alexandra Moore" });
    expect(commandIdentityFacts(household, first.household, first.postedIds)).not.toEqual(commandIdentityFacts(household, edited.household, edited.postedIds));
  });

  it("records reviewed attendance beside a confirmed shift and rejects cross-job coworkers", () => {
    const base = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = base.workJobs.find((row) => row.memberId === "MEM-002")!;
    const added = upsertCoworker(base, { ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, displayName: "Alex Moore" });
    const coworker = added.household.coworkers![0]!;
    const template = added.household.shifts.find((row) => row.memberId === "MEM-002")!;
    const shift: Shift = { ...template, id: "SHIFT-ATTENDANCE", jobId: job.id, roleId: job.roles[0]!.id, memberId: "MEM-002", createdBy: "MEM-002" };
    const withShift = { ...added.household, shifts: [...added.household.shifts, shift] };
    const recorded = recordCoworkerAttendance(withShift, {
      ownerMemberId: "MEM-002",
      shiftId: shift.id,
      rows: [{ coworkerId: coworker.id, roleLabel: "Support", status: "user-confirmed-present", scheduledStart: "2026-08-28T14:00:00-04:00", scheduledEnd: "2026-08-28T22:00:00-04:00" }],
    });
    expect(recorded.household.coworkerAttendance).toMatchObject([{ shiftId: shift.id, coworkerId: coworker.id, status: "user-confirmed-present" }]);
    expect(recorded.household.shifts.find((row) => row.id === shift.id)).toEqual(shift);
    expect(() => recordCoworkerAttendance(withShift, {
      ownerMemberId: "MEM-001",
      shiftId: shift.id,
      rows: [{ coworkerId: coworker.id, status: "user-confirmed-present" }],
    })).toThrow(/this member's confirmed job shift/i);
  });

  it("replaces a whole shift attendance review and tombstones omitted rows", () => {
    const base = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = base.workJobs.find((row) => row.memberId === "MEM-002")!;
    const first = upsertCoworker(base, { ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, displayName: "Alex Lee" });
    const second = upsertCoworker(first.household, { ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, displayName: "Alex Lee" });
    expect(second.household.coworkers).toHaveLength(2);
    const [left, right] = second.household.coworkers! as [Coworker, Coworker];
    const template = second.household.shifts.find((row) => row.memberId === "MEM-002")!;
    const shift: Shift = { ...template, id: "SHIFT-REPLACE", jobId: job.id, roleId: job.roles[0]!.id, memberId: "MEM-002", createdBy: "MEM-002" };
    const withShift = { ...second.household, shifts: [...second.household.shifts, shift] };
    const both = recordCoworkerAttendance(withShift, {
      ownerMemberId: "MEM-002", shiftId: shift.id,
      rows: [left, right].map((row) => ({ coworkerId: row.id, status: "scheduled-assumed" as const })),
    });
    expect(both.household.coworkerAttendance).toHaveLength(2);
    const one = recordCoworkerAttendance(both.household, {
      ownerMemberId: "MEM-002", shiftId: shift.id,
      rows: [{ coworkerId: left.id, status: "user-confirmed-present" }],
    });
    expect(one.household.coworkerAttendance).toMatchObject([{ coworkerId: left.id, status: "user-confirmed-present" }]);
    const removedId = both.household.coworkerAttendance!.find((row) => row.coworkerId === right.id)!.id;
    expect(one.household.tombstones).toEqual(expect.arrayContaining([expect.objectContaining({ id: removedId })]));
    expect(JSON.stringify(commandIdentityFacts(both.household, one.household, one.postedIds))).toContain(removedId);
    const none = recordCoworkerAttendance(one.household, { ownerMemberId: "MEM-002", shiftId: shift.id, rows: [] });
    expect(none.household.coworkerAttendance).toEqual([]);
    expect(none.postedIds).toHaveLength(1);
    const stale = splitForSync(both.household, "MEM-002").personal;
    const cleared = splitForSync(none.household, "MEM-002").personal;
    expect(mergePersonal(stale, cleared).coworkerAttendance).toEqual([]);
  });

  it("batches reviewed Evidence names into one private roster update", () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-002")!;
    const rows = coworkerRosterDraft({
      evidenceId: "evi_test",
      revision: 1,
      state: "ready_to_review",
      parserVersion: "v2",
      schemaFingerprint: "shape",
      derivatives: [
        { canonicalShiftKey: "cow-1", parserVersion: "v2", schemaFingerprint: "shape", facts: { bundleFacts: { providerResourceKind: "coworker-roster", providerSubjectKey: "s7subject_cccccccccccccccccccc" } }, createdAt: "2026-08-28T12:00:00.000Z" },
        { canonicalShiftKey: "cow-2", parserVersion: "v2", schemaFingerprint: "shape", facts: { bundleFacts: { providerResourceKind: "coworker-schedule", providerSubjectKey: "s7subject_dddddddddddddddddddd" } }, createdAt: "2026-08-28T12:00:00.000Z" },
      ],
      observations: [
        { observationId: "1", canonicalShiftKey: "cow-1", field: "coworkerName", value: "Josephine Di Nicola", unit: "text", sourceLocation: "roster[0].name", confidenceBps: 10_000, finality: "outlook", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-28T12:00:00.000Z" },
        { observationId: "2", canonicalShiftKey: "cow-1", field: "observedRole", value: "Support", unit: "text", sourceLocation: "roster[0].role", confidenceBps: 10_000, finality: "outlook", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-28T12:00:00.000Z" },
        { observationId: "3", canonicalShiftKey: "cow-2", field: "coworkerName", value: "Alex Moore", unit: "text", sourceLocation: "roster[1].name", confidenceBps: 10_000, finality: "outlook", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-28T12:00:00.000Z" },
      ],
      schemaDrift: [],
    });
    rows.push(...coworkerRosterDraft({
      evidenceId: "evi_duplicate_names", revision: 1, state: "ready_to_review", parserVersion: "v2", schemaFingerprint: "shape",
      derivatives: [
        { canonicalShiftKey: "cow-3", parserVersion: "v2", schemaFingerprint: "shape", facts: { bundleFacts: { providerResourceKind: "coworker-roster", providerSubjectKey: "s7subject_aaaaaaaaaaaaaaaaaaaa" } }, createdAt: "2026-08-28T12:00:00.000Z" },
        { canonicalShiftKey: "cow-4", parserVersion: "v2", schemaFingerprint: "shape", facts: { bundleFacts: { providerResourceKind: "coworker-roster", providerSubjectKey: "s7subject_bbbbbbbbbbbbbbbbbbbb" } }, createdAt: "2026-08-28T12:00:00.000Z" },
      ],
      observations: [
        { observationId: "4", canonicalShiftKey: "cow-3", field: "coworkerName", value: "Alex Lee", unit: "text", sourceLocation: "roster[2].name", confidenceBps: 10_000, finality: "outlook", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-28T12:00:00.000Z" },
        { observationId: "5", canonicalShiftKey: "cow-4", field: "coworkerName", value: "Alex Lee", unit: "text", sourceLocation: "roster[3].name", confidenceBps: 10_000, finality: "outlook", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-28T12:00:00.000Z" },
      ], schemaDrift: [],
    }));
    const imported = importCoworkerRoster(household, { ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, rows });
    expect(imported.postedIds).toHaveLength(4);
    expect(rows.find((row) => row.displayName === "Alex Moore")?.source).toBe("seven-shifts-schedule");
    expect(imported.household.coworkers?.filter((row) => row.displayName === "Alex Lee")).toHaveLength(2);
    expect(matchCoworkerName(imported.household.coworkers!, "Alex Lee", { ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName })).toMatchObject({ kind: "ambiguous" });
    expect(imported.household.coworkers?.find((row) => row.displayName.startsWith("Josephine"))?.observedRoles).toMatchObject([{ label: "Support" }]);
    expect(imported.household.activity.at(-1)?.summary).toBe("Updated 4 private workplace identities");
  });

  it("does not persist shift-instance keys as durable coworker identities", () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-002")!;
    const detail = {
      evidenceId: "evi_unbound_schedule", revision: 1, state: "ready_to_review", parserVersion: "v2", schemaFingerprint: "shape",
      derivatives: [
        { canonicalShiftKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", parserVersion: "v2", schemaFingerprint: "shape", facts: { bundleFacts: { providerResourceKind: "coworker-schedule", providerSubjectKey: "s7subject_unbound_aaaaaaaaaaaaaaaaaaaa" } }, createdAt: "2026-08-28T12:00:00.000Z" },
        { canonicalShiftKey: "s7shift_bbbbbbbbbbbbbbbbbbbb", parserVersion: "v2", schemaFingerprint: "shape", facts: { bundleFacts: { providerResourceKind: "coworker-schedule", providerSubjectKey: "s7subject_unbound_bbbbbbbbbbbbbbbbbbbb" } }, createdAt: "2026-08-28T12:00:00.000Z" },
      ],
      observations: [
        { observationId: "u1", canonicalShiftKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", field: "coworkerName", value: "Taylor Shift", unit: "text", sourceLocation: "schedule[0].name", confidenceBps: 10_000, finality: "outlook", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-28T12:00:00.000Z" },
        { observationId: "u2", canonicalShiftKey: "s7shift_bbbbbbbbbbbbbbbbbbbb", field: "coworkerName", value: "Taylor Shift", unit: "text", sourceLocation: "schedule[1].name", confidenceBps: 10_000, finality: "outlook", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-28T12:00:00.000Z" },
      ], schemaDrift: [],
    };
    const rows = coworkerRosterDraft(detail);
    expect(rows).toMatchObject([{ displayName: "Taylor Shift", source: "seven-shifts-schedule", sourceIdentityKey: null }]);
    const imported = importCoworkerRoster(household, { ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, rows });
    expect(imported.household.coworkers).toMatchObject([{ displayName: "Taylor Shift", provisional: true, sourceIdentityKey: null }]);
    expect(() => importCoworkerRoster(household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName,
      rows: [{ displayName: "Direct Shift Key", source: "seven-shifts-schedule", sourceIdentityKey: "s7shift_cccccccccccccccccccc" }],
    })).toThrow(/invalid protected source identity/i);
  });

  it("stores published schedule windows only in Personal and preloads the overlapping coworker", () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-002")!;
    const imported = importCoworkerRoster(household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName,
      rows: [{
        displayName: "Alex Schedule", roleLabel: "Support", source: "seven-shifts-schedule",
        sourceIdentityKey: "s7subject_aaaaaaaaaaaaaaaaaaaa",
        scheduledWindows: [{
          sourceScheduleKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", date: "2026-08-28",
          scheduledStart: "2026-08-28T18:00:00.000Z", scheduledEnd: "2026-08-29T02:00:00.000Z",
          observedAt: "2026-08-27T12:00:00.000Z",
        }],
      }],
    });
    expect(imported.household.coworkerSchedules).toMatchObject([{ date: "2026-08-28", roleLabel: "Support" }]);
    expect(scheduledCoworkersForReview(imported.household.coworkerSchedules!, {
      ownerMemberId: "MEM-002", jobId: job.id, date: "2026-08-28",
      startedAt: "2026-08-28T20:00:00.000Z", endedAt: "2026-08-29T01:00:00.000Z",
    })).toHaveLength(1);
    const split = splitForSync(imported.household, "MEM-002");
    expect("coworkerSchedules" in split.shared).toBe(false);
    expect(split.personal.coworkerSchedules).toHaveLength(1);
    expect(householdForAiDisclosure(imported.household, "MEM-002").coworkerSchedules).toEqual([]);
    expect(JSON.stringify(commandIdentityFacts(household, imported.household, imported.postedIds))).not.toContain("s7shift_");
    const changed = importCoworkerRoster(household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName,
      rows: [{
        displayName: "Alex Schedule", roleLabel: "Support", source: "seven-shifts-schedule",
        sourceIdentityKey: "s7subject_aaaaaaaaaaaaaaaaaaaa",
        scheduledWindows: [{
          sourceScheduleKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", date: "2026-08-28",
          scheduledStart: "2026-08-28T18:00:00.000Z", scheduledEnd: "2026-08-29T03:00:00.000Z",
          observedAt: "2026-08-27T12:00:00.000Z",
        }],
      }],
    });
    expect(commandIdentityFacts(household, changed.household, changed.postedIds))
      .not.toEqual(commandIdentityFacts(household, imported.household, imported.postedIds));
    expect(JSON.stringify(commandIdentityFacts(household, changed.household, changed.postedIds))).not.toContain("s7shift_");
  });

  it("keeps an open-ended CL shift as dated outlook without inventing an end time", () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-002")!;
    const imported = importCoworkerRoster(household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName,
      replaceScheduleRange: { fromDate: "2026-08-28", toDate: "2026-08-28" },
      rows: [{
        displayName: "Open End", roleLabel: "Server", source: "seven-shifts-schedule",
        sourceIdentityKey: "s7subject_openendedaaaaaaaaaaa",
        scheduledWindows: [{
          sourceScheduleKey: "s7shift_openendedaaaaaaaaaaaa", date: "2026-08-28",
          scheduledStart: "2026-08-28T20:30:00.000Z", scheduledEnd: null,
          observedAt: "2026-08-27T12:00:00.000Z",
        }],
      }],
    });
    expect(imported.household.coworkerSchedules).toMatchObject([{
      date: "2026-08-28", scheduledStart: null, scheduledEnd: null, roleLabel: "Server",
    }]);
    expect(scheduledCoworkersForReview(imported.household.coworkerSchedules!, {
      ownerMemberId: "MEM-002", jobId: job.id, date: "2026-08-28",
      startedAt: "2026-08-28T20:00:00.000Z", endedAt: "2026-08-29T02:00:00.000Z",
    })).toHaveLength(1);
  });

  it("retires missing schedule windows only after an explicit complete-range review and tombstones them across replicas", () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-002")!;
    const two = importCoworkerRoster(household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName,
      rows: [
        {
          displayName: "Alex Schedule", source: "seven-shifts-schedule", sourceIdentityKey: "s7subject_aaaaaaaaaaaaaaaaaaaa",
          scheduledWindows: [{ sourceScheduleKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", date: "2026-08-28", scheduledStart: "2026-08-28T18:00:00.000Z", scheduledEnd: "2026-08-29T02:00:00.000Z", observedAt: "2026-08-27T12:00:00.000Z" }],
        },
        {
          displayName: "Taylor Cancelled", source: "seven-shifts-schedule", sourceIdentityKey: "s7subject_bbbbbbbbbbbbbbbbbbbb",
          scheduledWindows: [{ sourceScheduleKey: "s7shift_bbbbbbbbbbbbbbbbbbbb", date: "2026-08-28", scheduledStart: "2026-08-28T19:00:00.000Z", scheduledEnd: "2026-08-29T01:00:00.000Z", observedAt: "2026-08-27T12:00:00.000Z" }],
        },
      ],
    });
    const stale = splitForSync(two.household, "MEM-002").personal;
    const cancelledId = two.household.coworkerSchedules!.find((row) => row.sourceScheduleKey.includes("bbbb"))!.id;
    const keptRow = {
      displayName: "Alex Schedule", source: "seven-shifts-schedule" as const, sourceIdentityKey: "s7subject_aaaaaaaaaaaaaaaaaaaa",
      scheduledWindows: [{ sourceScheduleKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", date: "2026-08-28", scheduledStart: "2026-08-28T18:00:00.000Z", scheduledEnd: "2026-08-29T03:00:00.000Z", observedAt: "2026-08-28T12:00:00.000Z" }],
    };
    const additive = importCoworkerRoster(two.household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, rows: [keptRow],
    });
    expect(additive.household.coworkerSchedules).toHaveLength(2);
    const replaced = importCoworkerRoster(two.household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, rows: [keptRow],
      replaceScheduleRange: { fromDate: "2026-08-28", toDate: "2026-08-28" },
    });
    expect(replaced.household.coworkerSchedules).toMatchObject([{ sourceScheduleKey: "s7shift_aaaaaaaaaaaaaaaaaaaa", scheduledEnd: "2026-08-29T03:00:00.000Z" }]);
    expect(replaced.household.tombstones).toEqual(expect.arrayContaining([expect.objectContaining({ id: cancelledId })]));
    const merged = mergePersonal(stale, splitForSync(replaced.household, "MEM-002").personal);
    expect(merged.coworkerSchedules).toHaveLength(1);
    expect(merged.coworkerSchedules?.some((row) => row.id === cancelledId)).toBe(false);
    expect(() => importCoworkerRoster(two.household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, rows: [keptRow],
      replaceScheduleRange: { fromDate: "2026-08-29", toDate: "2026-08-29" },
    })).toThrow(/does not cover every imported shift/i);
    expect(() => importCoworkerRoster(two.household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName, rows: [keptRow, keptRow],
    })).toThrow(/duplicate protected source identity/i);
    expect(() => importCoworkerRoster(two.household, {
      ownerMemberId: "MEM-002", jobId: job.id, locationName: job.locationName,
      rows: [{ displayName: "Roster only", roleLabel: "Server", sourceIdentityKey: "s7subject_cccccccccccccccccccc", source: "seven-shifts-roster" }],
      replaceScheduleRange: { fromDate: "2026-08-28", toDate: "2026-08-28" },
    })).toThrow(/needs at least one published shift/i);
  });

  it("saves reviewed attendance and a surprise helper through the same visible Shift Confirm result", () => {
    const household = seedDemoHousehold({ today: "2026-08-27", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-001" && row.active)!;
    const role = job.roles.find((row) => row.active)!;
    const added = upsertCoworker(household, {
      ownerMemberId: "MEM-001", jobId: job.id, locationName: job.locationName, displayName: "Scheduled Person",
    });
    const coworker = added.household.coworkers![0]!;
    const input: PostWorkShiftInput = {
      date: "2026-08-27", memberId: "MEM-001", jobId: job.id, roleId: role.id,
      workedHours: "6.25", paidBreakHours: "0", sales: "250",
      salesByField: { [job.salesFields[0]!.id]: "250" }, cashTips: "40", cardTips: "55",
      customersServed: 28, staffingCount: 4, eventTag: "regular",
      cashTipsAccountId: job.defaults.cashTipsAccountId, wagesDepositAccountId: job.defaults.wagesDepositAccountId,
      cardTipsDepositAccountId: job.defaults.cardTipsDepositAccountId, createdBy: "MEM-001",
    };
    const result = postWorkShiftWithAttendanceReview(added.household, input, {
      locationName: job.locationName,
      rows: [{ coworkerId: coworker.id, roleLabel: "Support", status: "user-confirmed-absent" }],
      surpriseHelpers: ["Surprise Helper"],
    });
    const shift = result.household.shifts.find((row) => result.postedIds.includes(row.id))!;
    expect(result.household.coworkerAttendance?.filter((row) => row.shiftId === shift.id)).toMatchObject([
      { coworkerId: coworker.id, status: "user-confirmed-absent" },
      { status: "surprise-helper" },
    ]);
    expect(result.household.coworkers?.find((row) => row.displayName === "Surprise Helper")).toMatchObject({ source: "surprise-helper" });
    expect(result.undo.snapshot).toEqual(added.household);
    expect(shift.staffingCount).toBe(4);
    expect(result.household.transactions.every((row) => !String(row.sourceId ?? "").startsWith("COW"))).toBe(true);
    expect(trialBalance(compileHousehold(result.household)).inBalance).toBe(true);
    expect(JSON.stringify(booksIntegrityFacts(result.household))).not.toContain("Surprise Helper");
    expect(JSON.stringify(booksIntegrityFacts(result.household))).not.toContain("s7shift_");
    const undone = undoLedgerConfirm(result.household, result.undo);
    expect(undone.household.shifts.some((row) => row.id === shift.id)).toBe(false);
    expect(undone.household.coworkerAttendance?.some((row) => row.shiftId === shift.id)).toBe(false);
    expect(undone.household.coworkers?.some((row) => row.displayName === "Surprise Helper")).toBe(false);
    expect(undone.household.coworkers?.some((row) => row.id === coworker.id)).toBe(true);
    expect(trialBalance(compileHousehold(undone.household)).inBalance).toBe(true);
  });

  it("reuses an exact surprise-helper identity and stops an ambiguous match atomically", () => {
    const household = seedDemoHousehold({ today: "2026-08-27", environment: "development" });
    const job = household.workJobs.find((row) => row.memberId === "MEM-001" && row.active)!;
    const role = job.roles.find((row) => row.active)!;
    const input: PostWorkShiftInput = {
      date: "2026-08-27", memberId: "MEM-001", jobId: job.id, roleId: role.id,
      workedHours: "6.25", paidBreakHours: "0", sales: "250",
      salesByField: { [job.salesFields[0]!.id]: "250" }, cashTips: "40", cardTips: "55",
      customersServed: 28, staffingCount: 4, eventTag: "regular",
      cashTipsAccountId: job.defaults.cashTipsAccountId, wagesDepositAccountId: job.defaults.wagesDepositAccountId,
      cardTipsDepositAccountId: job.defaults.cardTipsDepositAccountId, createdBy: "MEM-001",
    };
    const first = upsertCoworker(household, {
      ownerMemberId: "MEM-001", jobId: job.id, locationName: job.locationName, displayName: "Known Helper",
    });
    const knownId = first.household.coworkers![0]!.id;
    const reused = postWorkShiftWithAttendanceReview(first.household, input, {
      locationName: job.locationName, rows: [], surpriseHelpers: ["Known Helper"],
    });
    expect(reused.household.coworkers).toHaveLength(1);
    expect(reused.household.coworkerAttendance).toMatchObject([{ coworkerId: knownId, status: "surprise-helper" }]);

    const second = upsertCoworker(first.household, {
      ownerMemberId: "MEM-001", jobId: job.id, locationName: job.locationName, displayName: "Known Helper",
    });
    const before = structuredClone(second.household);
    expect(() => postWorkShiftWithAttendanceReview(second.household, input, {
      locationName: job.locationName, rows: [], surpriseHelpers: ["Known Helper"],
    })).toThrow(/multiple coworkers and needs review/i);
    expect(second.household).toEqual(before);
    expect(() => postWorkShiftWithAttendanceReview(first.household, input, {
      locationName: "Another restaurant", rows: [], surpriseHelpers: ["Wrong Place"],
    })).toThrow(/another job location/i);
    expect(first.household.coworkers?.some((row) => row.displayName === "Wrong Place")).toBe(false);
  });
});
