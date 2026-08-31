import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  linkGoogleIdentity,
  postEntry,
  reversePostedMoney,
} from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";
import {
  appendHostedCommandEvent,
  buildCommandEventFromReceipt,
  catchUpClientFromCommandLog,
  createMemoryCommandLogStore,
  materializeCommandLogTip,
  sharedConvergenceHash,
  sharedTransactionIds,
  type MemoryCommandLogStore,
} from "../src/ledger/continuityCommandLogHarness.ts";
import { commandEventVisibleToMember, type ContinuityCommandEvent } from "../src/ledger/materializeSnapshotFromEvents.ts";
import { householdCloudProjection } from "../src/ledger/supabase.ts";

const memberA = "MEM-001";
const memberB = "MEM-002";

function twoMemberHousehold(): Household {
  let household = linkGoogleIdentity(catalogHousehold(), {
    memberId: memberA,
    email: "jonathan@example.com",
    subject: "google-sub-jonathan",
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
  household = linkGoogleIdentity(household, {
    memberId: memberB,
    email: "bianca@example.com",
    subject: "google-sub-bianca",
    displayName: "Bianca",
    grantedScopes: ["openid", "email"],
  }).household;
  return household;
}

function expense(
  household: Household,
  note: string,
  amount: string,
  createdBy: string,
  visibility: "household" | "personal" = "household",
) {
  return postEntry(household, {
    date: "2026-08-24",
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy,
    visibility,
    confirmDuplicate: true,
  });
}

async function acceptPost(input: {
  previous: Household;
  posted: ReturnType<typeof postEntry>;
  confirmationId: string;
  commandKind?: string;
}) {
  return acceptHouseholdWrite({
    previous: input.previous,
    candidate: input.posted.household,
    confirmationId: input.confirmationId,
    postedIds: input.posted.postedIds,
    commandKind: input.commandKind ?? "postEntry",
    adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
  });
}

async function appendAcceptedPost(input: {
  store: MemoryCommandLogStore;
  previous: Household;
  accepted: Awaited<ReturnType<typeof acceptPost>>;
  confirmationId: string;
  memberId: string;
  createdAt?: string;
}) {
  const event = buildCommandEventFromReceipt({
    household: input.accepted.household,
    confirmationId: input.confirmationId,
    baseRevision: input.previous.revision,
    memberId: input.memberId,
    createdAt: input.createdAt,
  });
  const appended = appendHostedCommandEvent(input.store, event);
  return { event, appended };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("T2-S5 command-log interleaving harness", () => {
  it("disjoint shared posts interleave with stable shared hash", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    let base = catalog;

    const postA = expense(base, "Device A milk", "4.00", memberA);
    const acceptedA = await acceptPost({ previous: base, posted: postA, confirmationId: "disjoint-a" });
    const appendA = await appendAcceptedPost({
      store,
      previous: base,
      accepted: acceptedA,
      confirmationId: "disjoint-a",
      memberId: memberA,
    });
    expect(appendA.appended.ok).toBe(true);
    base = acceptedA.household;

    const postB = expense(base, "Device B bread", "3.50", memberB);
    const acceptedB = await acceptPost({ previous: base, posted: postB, confirmationId: "disjoint-b" });
    const appendB = await appendAcceptedPost({
      store,
      previous: base,
      accepted: acceptedB,
      confirmationId: "disjoint-b",
      memberId: memberB,
    });
    expect(appendB.appended.ok).toBe(true);

    const tip = await materializeCommandLogTip(catalog, store);
    const clientA = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberA });
    const clientB = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberB });

    const tipHash = await sharedConvergenceHash(tip, memberA);
    expect(await sharedConvergenceHash(clientA, memberA)).toBe(tipHash);
    expect(await sharedConvergenceHash(clientB, memberB)).toBe(tipHash);
    expect(sharedTransactionIds(tip, memberA)).toHaveLength(2);
    expect(tip.transactions.some((row) => row.note === "Device A milk")).toBe(true);
    expect(tip.transactions.some((row) => row.note === "Device B bread")).toBe(true);
  });

  it("same-row divergence applies the later ordered event", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    const postA = expense(catalog, "Conflict row", "8.00", memberA);
    const acceptedA = await acceptPost({ previous: catalog, posted: postA, confirmationId: "conflict-a" });
    await appendAcceptedPost({
      store,
      previous: catalog,
      accepted: acceptedA,
      confirmationId: "conflict-a",
      memberId: memberA,
    });
    const txId = postA.postedIds[0]!;
    const divergent = {
      ...acceptedA.household.transactions.find((row) => row.id === txId)!,
      amountCents: 999,
      note: "Different amount",
    };
    const conflictEvent: ContinuityCommandEvent = {
      id: "evt-conflict-b",
      environment: catalog.environment,
      household_id: catalog.householdId,
      member_id: memberB,
      idempotency_key: "conflict-b",
      confirmation_id: "conflict-b",
      identity_hash: "remote-hash",
      base_revision: acceptedA.household.revision,
      result_revision: acceptedA.household.revision + 1,
      ledger_scope: "shared",
      command_type: "postEntry",
      payload_json: {
        confirmationId: "conflict-b",
        identityHash: "remote-hash",
        commandKind: "postEntry",
        postedIds: [txId],
        auditHash: "",
        revision: acceptedA.household.revision + 1,
        acceptedAt: "2026-08-26T12:01:00.000Z",
        materializationFacts: { transactions: [divergent] },
      },
      created_at: "2026-08-26T12:01:00.000Z",
    };
    appendHostedCommandEvent(store, conflictEvent);

    const tip = await materializeCommandLogTip(catalog, store);
    expect(tip.conflicts?.some((row) => !row.resolved)).toBe(false);
    expect(tip.transactions.find((row) => row.id === txId)?.amountCents).toBe(999);
  });

  it("falls back instead of rewriting a reversed original or opening a chooser", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    const postA = expense(catalog, "Reversal target", "6.00", memberA);
    const acceptedA = await acceptPost({ previous: catalog, posted: postA, confirmationId: "rev-base" });
    await appendAcceptedPost({
      store,
      previous: catalog,
      accepted: acceptedA,
      confirmationId: "rev-base",
      memberId: memberA,
    });
    const txId = postA.postedIds[0]!;
    const reversed = reversePostedMoney(acceptedA.household, txId, { createdBy: memberB });
    const acceptedRev = await acceptPost({
      previous: acceptedA.household,
      posted: reversed,
      confirmationId: "rev-apply",
      commandKind: "reversePostedMoney",
    });
    await appendAcceptedPost({
      store,
      previous: acceptedA.household,
      accepted: acceptedRev,
      confirmationId: "rev-apply",
      memberId: memberB,
    });

    const original = acceptedA.household.transactions.find((row) => row.id === txId)!;
    const editAttempt: ContinuityCommandEvent = {
      id: "evt-rev-edit",
      environment: catalog.environment,
      household_id: catalog.householdId,
      member_id: memberA,
      idempotency_key: "rev-edit",
      confirmation_id: "rev-edit",
      identity_hash: "edit-hash",
      base_revision: acceptedRev.household.revision,
      result_revision: acceptedRev.household.revision + 1,
      ledger_scope: "shared",
      command_type: "postEntry",
      payload_json: {
        confirmationId: "rev-edit",
        identityHash: "edit-hash",
        commandKind: "postEntry",
        postedIds: [txId],
        auditHash: "",
        revision: acceptedRev.household.revision + 1,
        acceptedAt: "2026-08-26T12:02:00.000Z",
        materializationFacts: {
          transactions: [{ ...original, amountCents: 650, note: "Edited after reversal" }],
        },
      },
      created_at: "2026-08-26T12:02:00.000Z",
    };
    appendHostedCommandEvent(store, editAttempt);

    await expect(materializeCommandLogTip(catalog, store)).rejects.toThrow(/immutable-row-divergence/);
  });

  it("personal then shared interleave keeps partner shared hash clean", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    let base = catalog;

    const personal = expense(base, "Hidden meds", "12.00", memberA, "personal");
    const acceptedPersonal = await acceptPost({ previous: base, posted: personal, confirmationId: "interleave-personal" });
    await appendAcceptedPost({
      store,
      previous: base,
      accepted: acceptedPersonal,
      confirmationId: "interleave-personal",
      memberId: memberA,
    });
    base = acceptedPersonal.household;

    const shared = expense(base, "Shared groceries", "5.50", memberB);
    const acceptedShared = await acceptPost({ previous: base, posted: shared, confirmationId: "interleave-shared" });
    await appendAcceptedPost({
      store,
      previous: base,
      accepted: acceptedShared,
      confirmationId: "interleave-shared",
      memberId: memberB,
    });

    const partner = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberB });
    expect(partner.transactions.some((row) => row.note === "Hidden meds")).toBe(false);
    expect(partner.transactions.some((row) => row.note === "Shared groceries")).toBe(true);
    expect(await sharedConvergenceHash(partner, memberB)).toBe(
      await sharedConvergenceHash(await materializeCommandLogTip(catalog, store, memberB), memberB),
    );
  });

  it("personal scope events stay hidden from the partner member", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    const personal = expense(catalog, "Private pharmacy", "9.00", memberA, "personal");
    const accepted = await acceptPost({ previous: catalog, posted: personal, confirmationId: "personal-a" });
    const { event } = await appendAcceptedPost({
      store,
      previous: catalog,
      accepted,
      confirmationId: "personal-a",
      memberId: memberA,
    });
    expect(commandEventVisibleToMember(event, memberB)).toBe(false);

    const tipForA = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberA });
    const tipForB = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberB });
    expect(householdCloudProjection(tipForA, memberA).transactions.some((row) => row.note === "Private pharmacy")).toBe(false);
    expect(tipForA.transactions.some((row) => row.note === "Private pharmacy")).toBe(true);
    expect(tipForB.transactions.some((row) => row.note === "Private pharmacy")).toBe(false);
  });

  it("orders events by result_revision then created_at under clock skew", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    let base = catalog;

    const first = expense(base, "Skew first", "2.00", memberA);
    const acceptedFirst = await acceptPost({ previous: base, posted: first, confirmationId: "skew-1" });
    await appendAcceptedPost({
      store,
      previous: base,
      accepted: acceptedFirst,
      confirmationId: "skew-1",
      memberId: memberA,
      createdAt: "2026-08-26T10:00:00.000Z",
    });
    base = acceptedFirst.household;

    const second = expense(base, "Skew second", "3.00", memberB);
    const acceptedSecond = await acceptPost({ previous: base, posted: second, confirmationId: "skew-2" });
    await appendAcceptedPost({
      store,
      previous: base,
      accepted: acceptedSecond,
      confirmationId: "skew-2",
      memberId: memberB,
      createdAt: "2026-08-26T09:00:00.000Z",
    });

    const tip = await materializeCommandLogTip(catalog, store);
    expect(tip.revision).toBe(2);
    expect(sharedTransactionIds(tip, memberA)).toHaveLength(2);
  });

  it("duplicate delivery is idempotent on append and catch-up", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    const post = expense(catalog, "Dup delivery", "4.25", memberA);
    const accepted = await acceptPost({ previous: catalog, posted: post, confirmationId: "dup-delivery" });
    const { event } = await appendAcceptedPost({
      store,
      previous: catalog,
      accepted,
      confirmationId: "dup-delivery",
      memberId: memberA,
    });
    const again = appendHostedCommandEvent(store, event);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.duplicate).toBe(true);
    expect(store.events).toHaveLength(1);

    const once = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberA });
    const twice = await catchUpClientFromCommandLog({ client: once, store, memberId: memberA });
    expect(await sharedConvergenceHash(once, memberA)).toBe(await sharedConvergenceHash(twice, memberA));
    expect(sharedTransactionIds(twice, memberA)).toHaveLength(1);
  });

  it("long offline client rebases after peer append then converges", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();

    const online = expense(catalog, "Online peer milk", "4.00", memberB);
    const acceptedOnline = await acceptPost({ previous: catalog, posted: online, confirmationId: "offline-peer" });
    await appendAcceptedPost({
      store,
      previous: catalog,
      accepted: acceptedOnline,
      confirmationId: "offline-peer",
      memberId: memberB,
    });

    let offlineLocal = catalog;
    const offline = expense(offlineLocal, "Offline client bread", "3.25", memberA);
    const acceptedOffline = await acceptPost({
      previous: offlineLocal,
      posted: offline,
      confirmationId: "offline-local",
    });
    offlineLocal = acceptedOffline.household;
    const staleAppend = appendHostedCommandEvent(
      store,
      buildCommandEventFromReceipt({
        household: offlineLocal,
        confirmationId: "offline-local",
        baseRevision: 0,
        memberId: memberA,
      }),
    );
    expect(staleAppend.ok).toBe(false);
    if (!staleAppend.ok) expect(staleAppend.reason).toBe("stale-revision");

    const caughtUp = await catchUpClientFromCommandLog({
      client: catalog,
      store,
      memberId: memberA,
    });
    const rebasedPost = expense(caughtUp, "Offline client bread", "3.25", memberA);
    const rebasedAccepted = await acceptPost({
      previous: caughtUp,
      posted: rebasedPost,
      confirmationId: "offline-local-rebased",
    });
    const rebased = await appendAcceptedPost({
      store,
      previous: caughtUp,
      accepted: rebasedAccepted,
      confirmationId: "offline-local-rebased",
      memberId: memberA,
    });
    expect(rebased.appended.ok).toBe(true);

    const tip = await materializeCommandLogTip(catalog, store);
    const clientB = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberB });
    const clientA = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberA });
    const hash = await sharedConvergenceHash(tip, memberA);
    expect(await sharedConvergenceHash(clientA, memberA)).toBe(hash);
    expect(await sharedConvergenceHash(clientB, memberB)).toBe(hash);
    expect(sharedTransactionIds(tip, memberA)).toHaveLength(2);
  });

  it("concurrent same-base append rejects the loser until rebase", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    const postA = expense(catalog, "Race A", "1.00", memberA);
    const postB = expense(catalog, "Race B", "2.00", memberB);
    const acceptedA = await acceptPost({ previous: catalog, posted: postA, confirmationId: "race-a" });
    const acceptedB = await acceptPost({ previous: catalog, posted: postB, confirmationId: "race-b" });

    const first = appendHostedCommandEvent(
      store,
      buildCommandEventFromReceipt({
        household: acceptedA.household,
        confirmationId: "race-a",
        baseRevision: 0,
        memberId: memberA,
      }),
    );
    const second = appendHostedCommandEvent(
      store,
      buildCommandEventFromReceipt({
        household: acceptedB.household,
        confirmationId: "race-b",
        baseRevision: 0,
        memberId: memberB,
      }),
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("stale-revision");
  });
});
