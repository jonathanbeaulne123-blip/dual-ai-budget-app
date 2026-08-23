import { describe, expect, it } from "vitest";
import {
  askHercules,
  catalogHousehold,
  equalSplits,
  householdSettle,
  postEntry,
  voidPostedMoney,
} from "../src/core/index.ts";
import { booksIntegrityFacts, hashBooksSnapshot } from "../src/ledger/engine.ts";

describe("household settle (who owes whom)", () => {
  it("does not invent an IOU when a joint account pays a split expense", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "100.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Groceries",
      splits: equalSplits(["MEM-001", "MEM-002"], 10000),
      confirmDuplicate: true,
    });
    const settle = householdSettle(posted.household);
    expect(settle.positions.every((row) => row.netCents === 0)).toBe(true);
    expect(settle.suggested).toBeNull();
    expect(askHercules(posted.household, "Who owes whom?", "2026-08-21").sentence).toMatch(/even/i);
  });

  it("says Bianca owes Jonathan when his personal account covers her half", () => {
    const base = catalogHousehold();
    base.accounts = base.accounts.map((account) => (
      account.id === "ACC-CASH" ? { ...account, ownerMemberId: "MEM-002" } : account
    ));
    const posted = postEntry(base, {
      date: "2026-08-21",
      type: "expense",
      amount: "40.00",
      accountId: "ACC-CASH",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      splits: equalSplits(["MEM-001", "MEM-002"], 4000),
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    const settle = householdSettle(posted.household);
    const bianca = settle.positions.find((row) => row.memberId === "MEM-001");
    const jonathan = settle.positions.find((row) => row.memberId === "MEM-002");
    expect(jonathan?.netCents).toBe(2000);
    expect(bianca?.netCents).toBe(-2000);
    expect(settle.suggested).toMatchObject({
      fromMemberId: "MEM-001",
      toMemberId: "MEM-002",
      amountCents: 2000,
    });
    expect(settle.suggested?.spoken).toMatch(/transfer/i);
    expect(settle.suggested?.spoken).not.toMatch(/Interac|e-transfer/i);

    const asked = askHercules(posted.household, "Who owes whom?", "2026-08-21");
    expect(asked.sentence).toMatch(/Bianca owes Jonathan/);
    expect(asked.sentence).toMatch(/transfer/i);
    expect(asked.sentence).not.toMatch(/Interac|e-transfer/i);
  });

  it("zeros the IOU when the personal-account expense is refunded", () => {
    const base = catalogHousehold();
    const posted = postEntry(base, {
      date: "2026-08-21",
      type: "expense",
      amount: "40.00",
      accountId: "ACC-CASH",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      splits: equalSplits(["MEM-001", "MEM-002"], 4000),
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    const refunded = postEntry(posted.household, {
      date: "2026-08-21",
      type: "refund",
      amount: "40.00",
      accountId: "ACC-CASH",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk back",
      splits: equalSplits(["MEM-001", "MEM-002"], 4000),
      refundOfId: posted.postedIds[0],
      createdBy: "MEM-002",
      confirmDuplicate: true,
    });
    const settle = householdSettle(refunded.household);
    expect(settle.positions.every((row) => row.netCents === 0)).toBe(true);
    expect(settle.suggested).toBeNull();
  });
});

describe("integrity facts include removals", () => {
  it("changes the digest when a posted row is removed", async () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "QA milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const beforeFacts = JSON.stringify(booksIntegrityFacts(posted.household));
    const beforeHash = await hashBooksSnapshot(posted.household);
    const removed = voidPostedMoney(posted.household, posted.postedIds[0]!);
    const afterFacts = JSON.stringify(booksIntegrityFacts(removed.household));
    expect(afterFacts).not.toBe(beforeFacts);
    expect(await hashBooksSnapshot(removed.household)).not.toBe(beforeHash);
    expect(booksIntegrityFacts(removed.household).tombstones.some((row) => row.id === posted.postedIds[0])).toBe(true);
  });
});
