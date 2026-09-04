import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  createWriteQueue,
  memberPersonalPreferenceUpdateAllowed,
  postEntry,
  setGlanceAccount,
  setHerculesProPermissions,
  setLandingSurface,
} from "../src/core/index.ts";
import { financialAuditHashForScope } from "../src/core/commandIdentity.ts";
import { buildCommandRef } from "../src/ledger/continuityCommandLog.ts";
import { acceptHouseholdWrite } from "../src/core/commandRuntime.ts";
import { applyCommandEventLocally, type ContinuityCommandEvent } from "../src/ledger/materializeSnapshotFromEvents.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

describe("member-Personal preference authority", () => {
  it("allows only the named member preference diff", () => {
    const before = catalogHousehold();
    const landing = setLandingSurface(before, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      surface: "till",
    });
    expect(memberPersonalPreferenceUpdateAllowed(
      before,
      landing.household,
      JONATHAN,
      "landing-surface-personal",
    )).toBe(true);
    expect(memberPersonalPreferenceUpdateAllowed(
      before,
      { ...landing.household, name: "smuggled" },
      JONATHAN,
      "landing-surface-personal",
    )).toBe(false);

    const glance = setGlanceAccount(before, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      accountId: "ACC-CHEQUING",
    });
    expect(memberPersonalPreferenceUpdateAllowed(
      before,
      glance.household,
      JONATHAN,
      "glance-account-personal",
    )).toBe(true);
  });

  it("models Hercules consent as a validated member-Personal command", () => {
    const before = catalogHousehold();
    const result = setHerculesProPermissions(before, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      personalWrite: true,
      householdWrite: false,
    });
    expect(result).toMatchObject({ persistenceScope: "member-personal", personalMemberId: JONATHAN });
    expect(result.undo.commandKind).toBe("hercules-permissions-personal");
    expect(memberPersonalPreferenceUpdateAllowed(
      before,
      result.household,
      JONATHAN,
      "hercules-permissions-personal",
    )).toBe(true);
    expect(() => setHerculesProPermissions(before, {
      memberId: JONATHAN,
      createdBy: BIANCA,
      personalWrite: true,
      householdWrite: false,
    })).toThrow(/only you/i);
  });

  it("computes Hercules consent inside the write lane so an earlier paired install is preserved", async () => {
    const enqueueWrite = createWriteQueue();
    let live = catalogHousehold();
    let releasePair!: () => void;
    const pairPaused = new Promise<void>((resolve) => { releasePair = resolve; });
    const pairedInstall = enqueueWrite(async () => {
      await pairPaused;
      live = postEntry(live, {
        date: "2026-09-04",
        type: "expense",
        amount: "2.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "paired install witness",
        createdBy: BIANCA,
        confirmDuplicate: true,
      }).household;
    });
    const permissionWrite = enqueueWrite(async () => {
      const current = live;
      const result = setHerculesProPermissions(current, {
        memberId: JONATHAN,
        createdBy: JONATHAN,
        personalWrite: true,
        householdWrite: false,
      });
      expect(memberPersonalPreferenceUpdateAllowed(
        current,
        result.household,
        JONATHAN,
        "hercules-permissions-personal",
      )).toBe(true);
      live = result.household;
    });

    releasePair();
    await Promise.all([pairedInstall, permissionWrite]);
    expect(live.transactions.some((row) => row.note === "paired install witness")).toBe(true);
    expect(live.herculesProPermissions?.personalWrite).toBe(true);
  });

  it("classifies empty-row Personal settings as Personal and hashes the acting member", async () => {
    const personalBase = {
      ...catalogHousehold(),
      accounts: catalogHousehold().accounts.map((account) => account.id === "ACC-CHEQUING"
        ? { ...account, scope: "personal" as const, ownerMemberId: JONATHAN }
        : account),
    };
    const before = postEntry(personalBase, {
      date: "2026-09-04",
      type: "expense",
      amount: "1.00",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Jonathan private hash witness",
      visibility: "personal",
      createdBy: JONATHAN,
      confirmDuplicate: true,
    }).household;
    const result = setLandingSurface(before, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      surface: "till",
    });
    const outcome = await acceptHouseholdWrite({
      previous: before,
      candidate: result.household,
      confirmationId: "personal-setting-mem-002",
      commandKind: result.undo.commandKind,
      postedIds: [],
      actingMemberId: JONATHAN,
      adapters: {
        persist: async () => undefined,
        ingest: async () => ({ ok: true }),
      },
    });
    const ref = buildCommandRef({
      household: outcome.household,
      confirmationId: "personal-setting-mem-002",
      baseRevision: before.revision,
    });
    const receipt = outcome.household.commandReceipts.find((row) => row.confirmationId === "personal-setting-mem-002");
    expect(ref?.ledgerScope).toBe("personal");
    expect(ref?.commandPayload.auditHash).toBe(receipt?.scopedAuditHashes?.personal);
    expect(receipt?.scopedAuditHashes?.personal).toBe(
      await financialAuditHashForScope(outcome.household, "personal", JONATHAN),
    );
    expect(receipt?.scopedAuditHashes?.personal).not.toBe(
      await financialAuditHashForScope(outcome.household, "personal", BIANCA),
    );

    const event: ContinuityCommandEvent = {
      id: "evt-personal-setting-mem-002",
      environment: outcome.household.environment,
      household_id: outcome.household.householdId,
      member_id: JONATHAN,
      idempotency_key: ref!.idempotencyKey,
      confirmation_id: ref!.confirmationId,
      identity_hash: ref!.identityHash,
      base_revision: before.revision,
      result_revision: outcome.household.revision,
      ledger_scope: ref!.ledgerScope,
      command_type: ref!.commandType,
      payload_json: ref!.commandPayload,
      created_at: ref!.commandPayload.acceptedAt,
    };
    await expect(applyCommandEventLocally({
      local: before,
      event,
      memberId: JONATHAN,
    })).resolves.toEqual({
      ok: false,
      reason: "missing-materialization-facts",
      fallback: true,
    });
    await expect(applyCommandEventLocally({
      local: before,
      event,
      memberId: BIANCA,
    })).resolves.toEqual({
      ok: false,
      reason: "personal-scope-hidden",
      fallback: false,
    });
  });
});
