import { describe, expect, it } from "vitest";
import { catalogHousehold, parseFlinksInbox, postEntry, prepareImportRows, type FlinksInboxPayload } from "../src/core/index.ts";

const inbox: FlinksInboxPayload = {
  institution: "TD Demo",
  sourceHash: "flinks-batch-demo-hash",
  accounts: [
    {
      accountRef: "flinks:account:chequing-digest",
      accountLast4: "4821",
      title: "Everyday Chequing",
      type: "Chequing",
      category: "Operations",
      currency: "CAD",
      balanceCents: 182344,
    },
    {
      accountRef: "flinks:account:visa-digest",
      accountLast4: "4412",
      title: "Visa Infinite",
      type: "CreditCard",
      category: "Credits",
      currency: "CAD",
      balanceCents: -31218,
    },
  ],
  transactions: [
    {
      accountRef: "flinks:account:chequing-digest",
      provenanceId: "flinks:tx:groc-digest",
      date: "2026-08-20",
      description: "NO FRILLS #1234 TORONTO",
      debitCents: 4723,
      creditCents: null,
    },
    {
      accountRef: "flinks:account:chequing-digest",
      provenanceId: "flinks:tx:payroll-digest",
      date: "2026-08-15",
      description: "PAYROLL DEPOSIT BIANCA INC",
      debitCents: null,
      creditCents: 245000,
    },
    {
      accountRef: "flinks:account:visa-digest",
      provenanceId: "flinks:tx:coffee-digest",
      date: "2026-08-19",
      description: "TIM HORTONS #1234 TORONTO",
      debitCents: 625,
      creditCents: null,
    },
  ],
};

describe("flinks inbox adapter", () => {
  it("normalizes redacted inbox rows into import evidence", () => {
    const batch = parseFlinksInbox(inbox);
    expect(batch.rows.length).toBe(3);
    expect(batch.accounts).toHaveLength(2);
    expect(batch.rows.find((row) => row.note.includes("NO FRILLS"))).toEqual(expect.objectContaining({
      sourceKind: "flinks",
      accountLast4: "4821",
      currency: "CAD",
      suggestedType: "expense",
      provenanceId: "flinks:tx:groc-digest",
    }));
    expect(JSON.stringify(batch)).not.toMatch(/acct-chequing-1|tx-groceries-1|LoginId|RequestId/i);
  });

  it("prefills categories from the mapped account ledger history", () => {
    let household = catalogHousehold();
    for (const [date, amount] of [["2026-05-01", 71], ["2026-06-01", 72], ["2026-07-01", 73]] as const) {
      household = postEntry(household, {
        date,
        type: "expense",
        amount,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-COFFEE",
        note: "Tim Hortons coffee",
        place: "Tim Hortons",
        createdBy: "MEM-002",
      }).household;
    }
    for (const [date, amount] of [["2026-05-01", 45], ["2026-06-01", 46], ["2026-07-01", 47]] as const) {
      household = postEntry(household, {
        date,
        type: "expense",
        amount,
        accountId: "ACC-CHEQUING",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "No Frills groceries",
        place: "No Frills",
        createdBy: "MEM-002",
      }).household;
    }
    const batch = parseFlinksInbox(inbox);
    const rows = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: batch.rows,
    });
    const coffee = rows.find((row) => row.note.includes("TIM HORTONS"));
    const groceries = rows.find((row) => row.note.includes("NO FRILLS"));
    expect(coffee?.accountId).toBe("ACC-VISA");
    expect(coffee?.subcategoryId).toBe("SUB-FOOD-COFFEE");
    expect(groceries?.accountId).toBe("ACC-CHEQUING");
    expect(groceries?.subcategoryId).toBe("SUB-FOOD-GROCERIES");
  });
});
