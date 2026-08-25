import { describe, expect, it } from "vitest";
import {
  booksEquation,
  buildBatchImport,
  catalogHousehold,
  compileHousehold,
  postEntry,
  prepareImportRows,
  trialBalance,
  type ImportedSourceRow,
} from "../src/core/index.ts";

function source(overrides: Partial<ImportedSourceRow> = {}): ImportedSourceRow {
  return {
    id: "IMP-POST",
    sourceKind: "ofx",
    sourceName: "bank.ofx",
    sourceHash: "hash",
    provenanceId: "ofx:acct:fit-post",
    documentKind: "bank-statement",
    accountRef: "acct",
    accountLast4: "",
    currency: "CAD",
    date: "2026-08-20",
    amountCents: 4723,
    signedAmountCents: -4723,
    suggestedType: "expense",
    bankType: "DEBIT",
    note: "No Frills groceries",
    place: "No Frills",
    fitId: "fit-post",
    extractionConfidence: null,
    ...overrides,
  };
}

describe("confirmed batch import", () => {
  it("stages without mutation, then posts through ordinary commands as balanced import provenance", () => {
    const household = catalogHousehold();
    const before = structuredClone(household);
    const rows = prepareImportRows({ household, memberId: "MEM-002", view: "household", rows: [source({ accountLast4: "4821" })] });
    rows[0]!.accountId = "ACC-CHEQUING";
    rows[0]!.subcategoryId = "SUB-FOOD-GROCERIES";
    expect(household).toEqual(before);

    const result = buildBatchImport({ household, memberId: "MEM-002", rows });
    expect(household).toEqual(before);
    expect(result.postedIds).toHaveLength(1);
    expect(result.household.transactions.at(-1)).toEqual(expect.objectContaining({
      source: "import",
      sourceId: "ofx:acct:fit-post",
      reviewed: true,
    }));
    const books = compileHousehold(result.household);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(booksEquation(books).holds).toBe(true);
  });

  it("can preserve the imported row and exclude the selected old ledger row without deleting it", () => {
    const household = postEntry(catalogHousehold(), {
      date: "2026-08-20", type: "expense", amount: 47.23, accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "No Frills groceries", place: "No Frills",
      createdBy: "MEM-002",
    }).household;
    const oldId = household.transactions[0]!.id;
    const rows = prepareImportRows({ household, memberId: "MEM-002", view: "household", rows: [source({ accountLast4: "4821" })] });
    rows[0]!.accountId = "ACC-CHEQUING";
    rows[0]!.subcategoryId = "SUB-FOOD-GROCERIES";
    rows[0]!.resolution = "exclude-ledger";
    rows[0]!.resolutionTouched = true;
    const result = buildBatchImport({ household, memberId: "MEM-002", rows });
    expect(result.household.transactions.find((row) => row.id === oldId)?.isDuplicate).toBe(true);
    expect(result.household.transactions).toHaveLength(2);
    expect(result.household.transactions.some((row) => row.sourceId === "ofx:acct:fit-post")).toBe(true);
    expect(result.postedIds).toContain(oldId);
  });

  it("posts an imported transfer pair with provenance and rejects unresolved or all-cancelled batches", () => {
    const household = catalogHousehold();
    const rows = prepareImportRows({ household, memberId: "MEM-002", view: "household", rows: [source({
      suggestedType: "transfer", bankType: "XFER", signedAmountCents: -10000, amountCents: 10000,
    })] });
    rows[0]!.accountId = "ACC-CHEQUING";
    rows[0]!.transferAccountId = "ACC-SAVINGS";
    rows[0]!.resolution = "keep-import";
    const result = buildBatchImport({ household, memberId: "MEM-002", rows });
    expect(result.postedIds).toHaveLength(2);
    expect(result.household.transactions.slice(-2).every((row) => row.source === "import" && row.sourceId === "ofx:acct:fit-post")).toBe(true);

    rows[0]!.resolution = "undecided";
    expect(() => buildBatchImport({ household, memberId: "MEM-002", rows })).toThrow(/Not sure/i);
    rows[0]!.resolution = "cancel-import";
    expect(() => buildBatchImport({ household, memberId: "MEM-002", rows })).toThrow(/Nothing will change/i);
  });
});
