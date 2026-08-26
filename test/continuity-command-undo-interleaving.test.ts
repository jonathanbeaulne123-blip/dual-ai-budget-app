import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  linkGoogleIdentity,
  postEntry,
  reversePostedMoney,
  undo,
  undoLedgerConfirm,
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
) {
  return postEntry(household, {
    date: "2026-08-26",
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy,
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

async function acceptUndo(input: {
  previous: Household;
  undone: ReturnType<typeof undoLedgerConfirm>;
  confirmationId: string;
}) {
  return acceptHouseholdWrite({
    previous: input.previous,
    candidate: input.undone.household,
    confirmationId: input.confirmationId,
    postedIds: input.undone.postedIds,
    commandKind: "undoLedgerConfirm",
    adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
  });
}

async function appendAccepted(input: {
  store: MemoryCommandLogStore;
  previous: Household;
  accepted: Household;
  confirmationId: string;
  memberId: string;
  commandKind?: string;
}) {
  const receipt = input.accepted.commandReceipts?.find((row) => row.confirmationId === input.confirmationId);
  if (!receipt) throw new Error(`missing receipt ${input.confirmationId}`);
  const event = buildCommandEventFromReceipt({
    household: input.accepted,
    confirmationId: input.confirmationId,
    baseRevision: input.previous.revision,
    memberId: input.memberId,
  });
  return appendHostedCommandEvent(input.store, event);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("T2-S6 confirmation-scoped undo in command log", () => {
  it("two-phone: A undo cannot remove B's concurrent post", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();
    let base = catalog;

    const postA = expense(base, "Device A coffee", "4.50", memberA);
    const acceptedA = await acceptPost({ previous: base, posted: postA, confirmationId: "undo-interleave-a" });
    expect((await appendAccepted({
      store,
      previous: base,
      accepted: acceptedA.household,
      confirmationId: "undo-interleave-a",
      memberId: memberA,
    })).ok).toBe(true);
    base = acceptedA.household;

    const postB = expense(base, "Device B bread", "3.25", memberB);
    const acceptedB = await acceptPost({ previous: base, posted: postB, confirmationId: "undo-interleave-b" });
    expect((await appendAccepted({
      store,
      previous: base,
      accepted: acceptedB.household,
      confirmationId: "undo-interleave-b",
      memberId: memberB,
    })).ok).toBe(true);

    const tokenA = { ...postA.undo, actorMemberId: memberA };
    const undone = undoLedgerConfirm(acceptedB.household, tokenA);
    const acceptedUndo = await acceptUndo({
      previous: acceptedB.household,
      undone,
      confirmationId: "undo-interleave-a-undo",
    });
    expect((await appendAccepted({
      store,
      previous: acceptedB.household,
      accepted: acceptedUndo.household,
      confirmationId: "undo-interleave-a-undo",
      memberId: memberA,
    })).ok).toBe(true);

    const tip = await materializeCommandLogTip(catalog, store);
    const clientA = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberA });
    const clientB = await catchUpClientFromCommandLog({ client: catalog, store, memberId: memberB });

    expect(tip.transactions.some((row) => row.note === "Device A coffee")).toBe(false);
    expect(tip.transactions.some((row) => row.note === "Device B bread")).toBe(true);
    expect(clientA.transactions.some((row) => row.note === "Device B bread")).toBe(true);
    expect(clientB.transactions.some((row) => row.note === "Device B bread")).toBe(true);

    const hash = await sharedConvergenceHash(tip, memberA);
    expect(await sharedConvergenceHash(clientA, memberA)).toBe(hash);
    expect(await sharedConvergenceHash(clientB, memberB)).toBe(hash);
    expect(sharedTransactionIds(tip, memberA)).toHaveLength(1);
  });

  it("legacy whole-snapshot undo would tombstone partner rows (regression guard)", () => {
    const base = catalogHousehold();
    const postA = expense(base, "My coffee", "4.00", memberA);
    const postB = expense(postA.household, "Partner bread", "3.00", memberB);
    const tokenA = { ...postA.undo, actorMemberId: memberA };

    const legacy = undo(postB.household, tokenA);
    expect(legacy.transactions.some((row) => row.note === "Partner bread")).toBe(false);

    const scoped = undoLedgerConfirm(postB.household, tokenA);
    expect(scoped.household.transactions.some((row) => row.note === "Partner bread")).toBe(true);
    expect(scoped.household.transactions.some((row) => row.note === "My coffee")).toBe(false);
  });

  it("reversal journal integrity: undo refuses after partner reversal", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();

    const postA = expense(catalog, "Reversal target", "6.00", memberA);
    const acceptedA = await acceptPost({ previous: catalog, posted: postA, confirmationId: "rev-undo-base" });
    await appendAccepted({
      store,
      previous: catalog,
      accepted: acceptedA.household,
      confirmationId: "rev-undo-base",
      memberId: memberA,
    });
    const txId = postA.postedIds[0]!;

    const reversed = reversePostedMoney(acceptedA.household, txId, { createdBy: memberB });
    const acceptedRev = await acceptPost({
      previous: acceptedA.household,
      posted: reversed,
      confirmationId: "rev-undo-apply",
      commandKind: "reversePostedMoney",
    });
    await appendAccepted({
      store,
      previous: acceptedA.household,
      accepted: acceptedRev.household,
      confirmationId: "rev-undo-apply",
      memberId: memberB,
    });

    const tip = await materializeCommandLogTip(catalog, store);
    expect(tip.transactions.some((row) => row.reversalOfId === txId)).toBe(true);
    expect(tip.transactions.some((row) => row.id === txId)).toBe(true);

    const tokenA = { ...postA.undo, actorMemberId: memberA };
    expect(() => undoLedgerConfirm(tip, tokenA)).toThrow(/already reversed/i);
  });

  it("undo of reversal Confirm materializes with journal integrity", async () => {
    const catalog = twoMemberHousehold();
    const store = createMemoryCommandLogStore();

    const postA = expense(catalog, "Undo reversal row", "5.00", memberA);
    const acceptedA = await acceptPost({ previous: catalog, posted: postA, confirmationId: "rev-peel-base" });
    await appendAccepted({
      store,
      previous: catalog,
      accepted: acceptedA.household,
      confirmationId: "rev-peel-base",
      memberId: memberA,
    });
    const txId = postA.postedIds[0]!;

    const reversed = reversePostedMoney(acceptedA.household, txId, { createdBy: memberA });
    const acceptedRev = await acceptPost({
      previous: acceptedA.household,
      posted: reversed,
      confirmationId: "rev-peel-apply",
      commandKind: "reversePostedMoney",
    });
    await appendAccepted({
      store,
      previous: acceptedA.household,
      accepted: acceptedRev.household,
      confirmationId: "rev-peel-apply",
      memberId: memberA,
    });

    const undoneRev = undoLedgerConfirm(acceptedRev.household, {
      ...reversed.undo,
      actorMemberId: memberA,
    });
    const acceptedUndo = await acceptUndo({
      previous: acceptedRev.household,
      undone: undoneRev,
      confirmationId: "rev-peel-undo",
    });
    await appendAccepted({
      store,
      previous: acceptedRev.household,
      accepted: acceptedUndo.household,
      confirmationId: "rev-peel-undo",
      memberId: memberA,
    });

    const tip = await materializeCommandLogTip(catalog, store);
    expect(tip.transactions.some((row) => row.id === txId)).toBe(true);
    expect(tip.transactions.some((row) => row.reversalOfId === txId)).toBe(false);
    expect(tip.tombstones?.some((row) => row.id === reversed.postedIds[0])).toBe(true);
  });
});
