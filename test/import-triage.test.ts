import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  defaultImportResolution,
  duplicateTier,
  postEntry,
  postTransfer,
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

  it("uses an internal account name or last-four to complete transfer coding", () => {
    const [visa, savings, tfsa] = prepareImportRows({
      household: catalogHousehold(),
      memberId: "MEM-002",
      view: "household",
      rows: [
        source({
          id: "VISA-PAYMENT",
          provenanceId: "visa-payment",
          accountLast4: "4821",
          suggestedType: "unknown",
          bankType: "PAYMENT",
          note: "ONLINE PAYMENT TO VISA 4412",
          place: "",
        }),
        source({
          id: "TO-SAVINGS",
          provenanceId: "to-savings",
          accountLast4: "4821",
          suggestedType: "transfer",
          bankType: "XFER",
          note: "Transfer to high-interest savings",
          place: "",
        }),
        source({
          id: "TFSA-CONTRIBUTION",
          provenanceId: "tfsa-contribution",
          accountLast4: "4821",
          suggestedType: "expense",
          bankType: "DEBIT",
          note: "TFSA contribution",
          place: "",
        }),
      ],
    });

    expect(visa).toEqual(expect.objectContaining({
      type: "transfer",
      accountId: "ACC-CHEQUING",
      transferAccountId: "ACC-VISA",
      subcategoryId: "",
    }));
    expect(savings).toEqual(expect.objectContaining({
      type: "transfer",
      accountId: "ACC-CHEQUING",
      transferAccountId: "ACC-SAVINGS",
    }));
    expect(tfsa).toEqual(expect.objectContaining({
      type: "transfer",
      accountId: "ACC-CHEQUING",
      transferAccountId: "ACC-TFSA",
    }));
  });

  it("uses a unique account kind for obvious transfers from or to chequing", () => {
    const [fromChequing, toChequing] = prepareImportRows({
      household: catalogHousehold(),
      memberId: "MEM-002",
      view: "household",
      rows: [
        source({
          id: "FROM-CHEQUING",
          provenanceId: "from-chequing",
          accountLast4: "1190",
          signedAmountCents: 4723,
          suggestedType: "transfer",
          bankType: "XFER",
          note: "Transfer from chequing",
          place: "",
        }),
        source({
          id: "TO-CHEQUING",
          provenanceId: "to-chequing",
          accountLast4: "1190",
          amountCents: 9321,
          signedAmountCents: -9321,
          suggestedType: "transfer",
          bankType: "XFER",
          note: "Transfer to chequing",
          place: "",
        }),
      ],
    });

    expect(fromChequing).toEqual(expect.objectContaining({
      accountId: "ACC-SAVINGS",
      transferAccountId: "ACC-CHEQUING",
      type: "transfer",
    }));
    expect(toChequing).toEqual(expect.objectContaining({
      accountId: "ACC-SAVINGS",
      transferAccountId: "ACC-CHEQUING",
      type: "transfer",
    }));
  });

  it("keeps account-kind wording unresolved when the other account is ambiguous or the same kind as the statement account", () => {
    const ambiguous = catalogHousehold();
    ambiguous.accounts.find((account) => account.id === "ACC-MC")!.kind = "chequing";
    const duplicateKind = prepareImportRows({
      household: ambiguous,
      memberId: "MEM-002",
      view: "household",
      rows: [source({
        accountLast4: "1190",
        suggestedType: "transfer",
        bankType: "XFER",
        note: "Transfer from chequing",
        place: "",
      })],
    })[0]!;
    const sameKind = prepareImportRows({
      household: catalogHousehold(),
      memberId: "MEM-002",
      view: "household",
      rows: [source({
        accountLast4: "1190",
        suggestedType: "transfer",
        bankType: "XFER",
        note: "Transfer to savings",
        place: "",
      })],
    })[0]!;

    expect(duplicateKind.transferAccountId).toBe("");
    expect(sameKind.transferAccountId).toBe("");
  });

  it("does not turn an external or ambiguous transfer description into an internal transfer", () => {
    let household = catalogHousehold();
    for (const [date, amount] of [["2026-07-01", 75], ["2026-07-15", 90]] as const) {
      household = postTransfer(household, {
        date,
        amount,
        fromAccountId: "ACC-CHEQUING",
        toAccountId: "ACC-SAVINGS",
        note: "John savings",
        createdBy: "MEM-002",
        visibility: "household",
      }).household;
    }
    const rows = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: [
        source({
          id: "INTERAC",
          provenanceId: "interac",
          accountLast4: "4821",
          suggestedType: "unknown",
          note: "INTERAC E-TRANSFER JOHN",
          place: "",
        }),
        source({
          id: "AMBIGUOUS-TD",
          provenanceId: "ambiguous-td",
          accountLast4: "4821",
          suggestedType: "unknown",
          note: "TD PAYMENT",
          place: "",
        }),
        source({
          id: "INTERAC-KIND",
          provenanceId: "interac-kind",
          accountLast4: "1190",
          suggestedType: "transfer",
          bankType: "XFER",
          note: "INTERAC E-TRANSFER FROM CHEQUING",
          place: "",
        }),
        source({
          id: "INTERAC-EXACT",
          provenanceId: "interac-exact",
          accountLast4: "4821",
          suggestedType: "unknown",
          bankType: "XFER",
          note: "INTERAC E-TRANSFER TO VISA 4412",
          place: "",
        }),
      ],
    });

    expect(rows[0]).toEqual(expect.objectContaining({ type: "unknown", transferAccountId: "" }));
    expect(rows[1]).toEqual(expect.objectContaining({ type: "unknown", transferAccountId: "" }));
    expect(rows[2]).toEqual(expect.objectContaining({
      type: "transfer",
      accountId: "ACC-SAVINGS",
      transferAccountId: "",
      duplicateConfidence: 0,
      resolution: "keep-import",
    }));
    expect(rows[3]).toEqual(expect.objectContaining({
      type: "transfer",
      accountId: "ACC-CHEQUING",
      transferAccountId: "ACC-VISA",
    }));
  });

  it("learns a repeated visible transfer description without exposing Personal history", () => {
    let household = catalogHousehold();
    for (const [date, amount] of [["2026-07-01", 75], ["2026-07-15", 90]] as const) {
      household = postTransfer(household, {
        date,
        amount,
        fromAccountId: "ACC-CHEQUING",
        toAccountId: "ACC-VISA",
        note: "Monthly card payment",
        createdBy: "MEM-002",
        visibility: "personal",
      }).household;
    }
    for (const [date, amount] of [["2026-06-01", 50], ["2026-06-08", 60], ["2026-06-15", 70]] as const) {
      household = postTransfer(household, {
        date,
        amount,
        fromAccountId: "ACC-CHEQUING",
        toAccountId: "ACC-SAVINGS",
        note: "Monthly transfer",
        createdBy: "MEM-002",
        visibility: "personal",
      }).household;
    }
    const visible = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "personal",
      rows: [source({
        accountLast4: "4821",
        suggestedType: "unknown",
        note: "Monthly card payment",
        place: "",
      })],
    })[0]!;
    const hidden = prepareImportRows({
      household,
      memberId: "MEM-001",
      view: "personal",
      rows: [source({
        accountLast4: "4821",
        suggestedType: "unknown",
        note: "Monthly card payment",
        place: "",
      })],
    })[0]!;

    expect(visible).toEqual(expect.objectContaining({ type: "transfer", transferAccountId: "ACC-VISA" }));
    expect(hidden).toEqual(expect.objectContaining({ type: "unknown", transferAccountId: "" }));
  });

  it("uses an unambiguous category name in the description before the legacy default", () => {
    const row = prepareImportRows({
      household: catalogHousehold(),
      memberId: "MEM-002",
      view: "household",
      rows: [source({
        accountLast4: "4821",
        note: "Monthly phone bill",
        place: "Rogers",
      })],
    })[0]!;

    expect(row.subcategoryId).toBe("SUB-LIFE-PHONE");
  });

  it("prefers category history on the mapped account before household-wide guesses", () => {
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
        note: "Tim Hortons coffee",
        place: "Tim Hortons",
        createdBy: "MEM-002",
      }).household;
    }
    const row = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: [source({
        accountLast4: "4412",
        note: "Tim Hortons coffee",
        place: "Tim Hortons",
      })],
    })[0]!;

    expect(row.accountId).toBe("ACC-VISA");
    expect(row.subcategoryId).toBe("SUB-FOOD-COFFEE");
  });

  it("learns category context only from transactions visible to the current member", () => {
    let household = catalogHousehold();
    for (const [date, amount] of [["2026-05-01", 71], ["2026-06-01", 72], ["2026-07-01", 73]] as const) {
      household = postEntry(household, {
        date,
        type: "expense",
        amount,
        accountId: "ACC-CHEQUING",
        subcategoryId: "SUB-LIFE-PHONE",
        note: "Zetatel wireless",
        createdBy: "MEM-002",
        visibility: "personal",
      }).household;
    }
    const visible = prepareImportRows({
      household,
      memberId: "MEM-002",
      view: "personal",
      rows: [source({ accountLast4: "4821", note: "Zetatel wireless", place: "" })],
    })[0]!;
    const hidden = prepareImportRows({
      household,
      memberId: "MEM-001",
      view: "personal",
      rows: [source({ accountLast4: "4821", note: "Zetatel wireless", place: "" })],
    })[0]!;

    expect(visible.subcategoryId).toBe("SUB-LIFE-PHONE");
    expect(hidden.subcategoryId).not.toBe("SUB-LIFE-PHONE");
  });
});
