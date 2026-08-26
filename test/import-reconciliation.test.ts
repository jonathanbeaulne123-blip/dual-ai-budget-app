import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  conflictingReceiptSources,
  parseOfx,
  postEntry,
  prepareImportRows,
  receiptMathBlocks,
  reconcileImportSources,
  refreshImportTriage,
  selectedPaymentTotal,
  visionDocumentRows,
  type Household,
  type VisionDocumentResult,
} from "../src/core/index.ts";

function statement(opening = "100.00", closing = "85.00") {
  return parseOfx(`<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD
    <BANKACCTFROM><BANKID>004<ACCTID>4821</BANKACCTFROM><OPENBAL>${opening}
    <BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260824<TRNAMT>-15.00<FITID>R-1<NAME>Market</STMTTRN></BANKTRANLIST>
    <LEDGERBAL><BALAMT>${closing}<DTASOF>20260824</LEDGERBAL>
    </STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`, "statement.qfx");
}

function receiptRows(household: Household, totalCents = 1695, sourceHash = "receipt-hash") {
  const result: VisionDocumentResult = {
    documentKind: "receipt",
    currency: "CAD",
    accountLast4: "4821",
    rows: [{
      date: "2026-08-24",
      amountCents: totalCents,
      direction: "debit",
      typeHint: "expense",
      merchant: "Market",
      description: "Receipt total",
      reference: "RCPT-1",
      confidence: 97,
    }],
    receiptNumbers: {
      lineAmountsCents: [1000, 500],
      subtotalCents: 1500,
      discountCents: 0,
      taxCents: 195,
      tipCents: 0,
      feeCents: 0,
      totalCents,
    },
    warnings: [],
  };
  return prepareImportRows({
    household,
    memberId: "MEM-002",
    view: "household",
    rows: visionDocumentRows({ result, sourceName: `${sourceHash}.jpg`, sourceHash }).rows,
  });
}

function addExpense(household: Household, amount: number, note: string): Household {
  return postEntry(household, {
    date: "2026-08-24",
    type: "expense",
    amount,
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    place: note,
    createdBy: "MEM-002",
    visibility: "household",
    confirmDuplicate: true,
  }).household;
}

describe("import reconciliation engine", () => {
  it("checks opening balance plus signed transactions against the closing balance", () => {
    const parsed = statement();
    const rows = prepareImportRows({ household: catalogHousehold(), memberId: "MEM-002", view: "household", rows: parsed.rows });
    const check = reconcileImportSources({ household: catalogHousehold(), memberId: "MEM-002", view: "household", rows, accounts: parsed.accounts }).statements[0]!;
    expect(check).toEqual(expect.objectContaining({
      status: "balanced",
      openingBalanceCents: 10000,
      transactionNetCents: -1500,
      closingBalanceCents: 8500,
      differenceCents: 0,
    }));

    const mismatched = statement("100.00", "84.99");
    const mismatchRows = prepareImportRows({ household: catalogHousehold(), memberId: "MEM-002", view: "household", rows: mismatched.rows });
    expect(reconcileImportSources({ household: catalogHousehold(), memberId: "MEM-002", view: "household", rows: mismatchRows, accounts: mismatched.accounts }).statements[0])
      .toEqual(expect.objectContaining({ status: "mismatch", differenceCents: 1 }));
  });

  it("skips statement balance enforcement when an opening balance is unavailable", () => {
    const parsed = statement("", "85.00");
    const rows = prepareImportRows({ household: catalogHousehold(), memberId: "MEM-002", view: "household", rows: parsed.rows });
    expect(reconcileImportSources({ household: catalogHousehold(), memberId: "MEM-002", view: "household", rows, accounts: parsed.accounts }).statements[0]?.status).toBe("skipped");
  });

  it("validates item-number arithmetic and suggests one exact posted payment", () => {
    const household = addExpense(catalogHousehold(), 16.95, "Market payment");
    const rows = receiptRows(household);
    const check = reconcileImportSources({ household, memberId: "MEM-002", view: "household", rows, accounts: [] }).receipts[0]!;
    expect(receiptMathBlocks(check)).toBe(false);
    expect(check.lineSumCents).toBe(1500);
    expect(check.componentSumCents).toBe(1695);
    expect(check.suggestedMatchIds).toHaveLength(1);
    expect(selectedPaymentTotal(check, check.suggestedMatchIds)).toBe(1695);
  });

  it("treats an imported bank payment as receipt evidence, not as a duplicate receipt row", () => {
    const household = catalogHousehold();
    const bank = parseOfx(`<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD
      <BANKACCTFROM><BANKID>004<ACCTID>4821</BANKACCTFROM><BANKTRANLIST>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260824<TRNAMT>-16.95<FITID>PAY-1<NAME>Market</STMTTRN>
      </BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`, "bank.qfx");
    const bankRows = prepareImportRows({ household, memberId: "MEM-002", view: "household", rows: bank.rows });
    const rows = refreshImportTriage({ household, memberId: "MEM-002", view: "household", rows: [...bankRows, ...receiptRows(household)] });
    const receipt = rows.find((row) => row.documentKind === "receipt")!;
    expect(receipt.duplicateConfidence).toBe(0);
    expect(receipt.resolution).toBe("keep-import");
    const check = reconcileImportSources({ household, memberId: "MEM-002", view: "household", rows, accounts: bank.accounts }).receipts[0]!;
    expect(check.suggestedMatchIds).toEqual([`batch:${bankRows[0]!.id}`]);
    const transferRows = rows.map((row) => row.id === bankRows[0]!.id
      ? { ...row, type: "transfer" as const, transferAccountId: "ACC-SAVINGS" }
      : row);
    expect(reconcileImportSources({ household, memberId: "MEM-002", view: "household", rows: transferRows, accounts: bank.accounts }).receipts[0]?.suggestedMatchIds).toEqual([]);
  });

  it("supports a unique multi-payment total but never auto-selects an ambiguous subset", () => {
    let household = addExpense(catalogHousehold(), 10, "First payment");
    household = addExpense(household, 6.95, "Second payment");
    const rows = receiptRows(household);
    const unique = reconcileImportSources({ household, memberId: "MEM-002", view: "household", rows, accounts: [] }).receipts[0]!;
    expect(unique.suggestedMatchIds).toHaveLength(2);
    expect(selectedPaymentTotal(unique, unique.suggestedMatchIds)).toBe(1695);

    household = addExpense(household, 16.95, "Whole payment");
    const ambiguous = reconcileImportSources({ household, memberId: "MEM-002", view: "household", rows: receiptRows(household), accounts: [] }).receipts[0]!;
    expect(ambiguous.suggestedMatchIds).toEqual([]);
  });

  it("never auto-assigns one payment to two receipts and reports a manual double-claim", () => {
    const household = addExpense(catalogHousehold(), 16.95, "One payment");
    const rows = refreshImportTriage({
      household,
      memberId: "MEM-002",
      view: "household",
      rows: [...receiptRows(household, 1695, "receipt-a"), ...receiptRows(household, 1695, "receipt-b")],
    });
    const report = reconcileImportSources({ household, memberId: "MEM-002", view: "household", rows, accounts: [] });
    expect(report.receipts).toHaveLength(2);
    expect(report.receipts.every((check) => check.suggestedMatchIds.length === 0)).toBe(true);
    expect(report.receipts.every((check) => check.paymentAssignmentConflict)).toBe(true);
    const paymentId = report.receipts[0]!.candidates[0]!.id;
    expect([...conflictingReceiptSources(report.receipts, () => [paymentId])].sort()).toEqual(["receipt-a", "receipt-b"]);
  });

  it("marks a large nearby-payment set as truncated and keeps an exact single visible for human choice", () => {
    let household = catalogHousehold();
    for (let index = 0; index < 18; index += 1) household = addExpense(household, 20 + index, `Large candidate ${index}`);
    household = addExpense(household, 16.95, "Exact candidate outside the computational cap");
    const rows = receiptRows(household);
    const check = reconcileImportSources({ household, memberId: "MEM-002", view: "household", rows, accounts: [] }).receipts[0]!;
    expect(check.matchSearchStatus).toBe("truncated");
    expect(check.suggestedMatchIds).toEqual([]);
    const exact = check.candidates.find((candidate) => candidate.amountCents === 1695)!;
    expect(exact).toBeDefined();
    expect(selectedPaymentTotal(check, [exact.id])).toBe(1695);
  });

  it("blocks a one-cent receipt arithmetic mismatch", () => {
    const rows = receiptRows(catalogHousehold(), 1696);
    const check = reconcileImportSources({ household: catalogHousehold(), memberId: "MEM-002", view: "household", rows, accounts: [] }).receipts[0]!;
    expect(check.componentStatus).toBe("mismatch");
    expect(receiptMathBlocks(check)).toBe(true);
  });
});
