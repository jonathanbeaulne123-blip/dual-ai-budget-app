import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  defaultImportResolution,
  duplicateTier,
  postEntry,
  prepareImportRows,
  type Household,
  type ImportedSourceRow,
} from "../src/core/index.ts";

function source(overrides: Partial<ImportedSourceRow> = {}): ImportedSourceRow {
  return {
    id: "IMP-1",
    sourceKind: "ofx",
    sourceName: "bank.ofx",
    sourceHash: "hash",
    provenanceId: "ofx:acct:fit-1",
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
    fitId: "fit-1",
    extractionConfidence: null,
    ...overrides,
  };
}

function withExisting(): Household {
  return postEntry(catalogHousehold(), {
    date: "2026-08-20",
    type: "expense",
    amount: 47.23,
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "No Frills groceries",
    place: "No Frills",
    source: "import",
    sourceId: "ofx:acct:fit-1",
    createdBy: "MEM-002",
  }).household;
}

describe("import duplicate triage", () => {
  it("uses the existing 0–100 scorer with the exact requested tier boundaries", () => {
    expect(duplicateTier(91)).toBe("confident");
    expect(defaultImportResolution(91)).toBe("cancel-import");
    expect(duplicateTier(90)).toBe("not-sure");
    expect(defaultImportResolution(90)).toBe("undecided");
    expect(duplicateTier(50)).toBe("not-sure");
    expect(duplicateTier(49)).toBe("probably-not");
    expect(defaultImportResolution(49)).toBe("keep-import");
  });

  it("auto-cancels exact bank provenance above 90 and shows the posted ledger side", () => {
    const rows = prepareImportRows({ household: withExisting(), memberId: "MEM-002", view: "household", rows: [source()] });
    expect(rows[0]).toEqual(expect.objectContaining({
      duplicateConfidence: 100,
      duplicateTier: "confident",
      resolution: "cancel-import",
      duplicateMatch: expect.objectContaining({ kind: "ledger" }),
    }));
  });

  it("leaves weak/no matches kept, requires a choice at 50, and catches duplicates inside one batch", () => {
    const household = withExisting();
    const notSure = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: [source({ id: "NOT-SURE", provenanceId: "different", place: "", accountLast4: "1234" })],
    })[0]!;
    expect(notSure.duplicateConfidence).toBeGreaterThanOrEqual(0);

    const noMatch = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: [source({ id: "NEW", provenanceId: "new", amountCents: 9999, signedAmountCents: -9999, note: "Unrelated", place: "Elsewhere" })],
    })[0]!;
    expect(noMatch.duplicateTier).toBe("probably-not");
    expect(noMatch.resolution).toBe("keep-import");

    const batch = prepareImportRows({
      household: catalogHousehold(),
      memberId: "MEM-002",
      view: "household",
      rows: [source({ id: "FIRST" }), source({ id: "SECOND" })],
    });
    expect(batch[1]).toEqual(expect.objectContaining({
      duplicateConfidence: 100,
      resolution: "cancel-import",
      duplicateMatch: { kind: "batch", rowId: "FIRST" },
    }));
  });

  it("does not expose a partner-only Personal transaction during duplicate matching", () => {
    const personal = postEntry(catalogHousehold(), {
      date: "2026-08-20", type: "expense", amount: 47.23, accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "No Frills groceries", place: "No Frills",
      createdBy: "MEM-001", visibility: "personal", source: "import", sourceId: "ofx:acct:fit-1",
    }).household;
    const row = prepareImportRows({ household: personal, memberId: "MEM-002", view: "personal", rows: [source()] })[0]!;
    expect(row.duplicateConfidence).toBe(0);
    expect(row.duplicateMatch).toBeNull();
  });

  it("maps an exact account last-four but never guesses among several accounts", () => {
    const household = catalogHousehold();
    const exact = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: [source({ accountLast4: "4821" })],
    })[0]!;
    expect(exact.accountId).toBe("ACC-CHEQUING");

    const unknown = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: [source({ accountLast4: "9999" })],
    })[0]!;
    expect(unknown.accountId).toBe("");

    const ambiguous = structuredClone(household);
    const another = ambiguous.accounts.find((account) => account.id !== "ACC-CHEQUING" && account.active)!;
    another.last4 = "4821";
    expect(prepareImportRows({
      household: ambiguous,
      memberId: "MEM-002",
      view: "household",
      rows: [source({ accountLast4: "4821" })],
    })[0]!.accountId).toBe("");
  });
});
