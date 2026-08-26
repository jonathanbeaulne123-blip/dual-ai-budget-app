import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  parseFlinksInbox,
  postEntry,
  prepareImportRows,
  type FlinksInboxPayload,
} from "../src/core/index.ts";

const PULL_DIGEST = `fpull_${"a".repeat(64)}`;
const REPEATED_PULL_DIGEST = `fpull_${"b".repeat(64)}`;
const CHEQUING_DIGEST = `fac_${"c".repeat(64)}`;
const SAVINGS_DIGEST = `fac_${"d".repeat(64)}`;
const DEBIT_DIGEST = `ftx_${"e".repeat(64)}`;
const CREDIT_DIGEST = `ftx_${"f".repeat(64)}`;
const PENDING_DIGEST = `ftx_${"1".repeat(64)}`;

function payload(overrides: Partial<FlinksInboxPayload> = {}): FlinksInboxPayload {
  return {
    provider: "flinks",
    sourceName: "Flinks Capital ••••1190",
    sourceHash: PULL_DIGEST,
    transactions: [
      {
        stableTransactionId: DEBIT_DIGEST,
        status: "posted",
        accountRef: CHEQUING_DIGEST,
        accountLast4: "1190",
        accountKind: "bank",
        currency: "cad",
        date: "2026-08-24",
        debit: "47.20",
        credit: null,
        code: "debit",
        description: "No Frills groceries",
        merchant: "No Frills",
      },
      {
        stableTransactionId: CREDIT_DIGEST,
        status: "posted",
        accountRef: CHEQUING_DIGEST,
        accountLast4: "1190",
        accountKind: "bank",
        currency: "CAD",
        date: "2026-08-25",
        debit: 0,
        credit: 1500.4,
        code: "directdep",
        description: "Payroll",
        merchant: "Employer",
      },
      {
        stableTransactionId: PENDING_DIGEST,
        status: "pending",
        accountRef: CHEQUING_DIGEST,
        accountLast4: "1190",
        accountKind: "bank",
        currency: "CAD",
        date: "2026-08-26",
        debit: "12.00",
        credit: null,
      },
    ],
    ...overrides,
  };
}

describe("Flinks Bank Inbox normalization", () => {
  it("stages posted CAD debits and credits in exact cents and leaves pending rows out", () => {
    const parsed = parseFlinksInbox(payload());
    expect(parsed.sourceKind).toBe("flinks");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual(expect.objectContaining({
      sourceKind: "flinks",
      amountCents: 4720,
      signedAmountCents: -4720,
      suggestedType: "expense",
      provenanceId: `flinks:${CHEQUING_DIGEST}:${DEBIT_DIGEST}`,
      accountLast4: "1190",
    }));
    expect(parsed.rows[1]).toEqual(expect.objectContaining({
      amountCents: 150040,
      signedAmountCents: 150040,
      suggestedType: "income",
    }));
    expect(parsed.warnings).toEqual(["1 pending Flinks transaction was left out until posted."]);
  });

  it("keeps stable provenance across repeated pulls so exact duplicates start cancelled", () => {
    const first = parseFlinksInbox(payload());
    const repeated = parseFlinksInbox(payload({ sourceHash: REPEATED_PULL_DIGEST }));
    expect(repeated.rows[0]?.id).toBe(first.rows[0]?.id);
    expect(repeated.rows[0]?.provenanceId).toBe(first.rows[0]?.provenanceId);

    const household = postEntry(catalogHousehold(), {
      date: "2026-08-24",
      type: "expense",
      amount: 47.2,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "No Frills groceries",
      place: "No Frills",
      source: "import",
      sourceId: first.rows[0]!.provenanceId,
      createdBy: "MEM-002",
    }).household;
    const staged = prepareImportRows({ household, memberId: "MEM-002", view: "household", rows: repeated.rows });
    expect(staged[0]).toEqual(expect.objectContaining({ duplicateConfidence: 100, resolution: "cancel-import" }));
  });

  it("fails closed on non-CAD, fractional-cent, ambiguous, or identifying provider data", () => {
    const base = payload().transactions[0]!;
    expect(() => parseFlinksInbox(payload({ transactions: [{ ...base, currency: "USD" }] }))).toThrow(/CAD only/);
    expect(() => parseFlinksInbox(payload({ transactions: [{ ...base, debit: "1.001" }] }))).toThrow(/exact to CAD cents/);
    expect(() => parseFlinksInbox(payload({ transactions: [{ ...base, credit: "2.00" }] }))).toThrow(/exactly one non-zero/);
    expect(() => parseFlinksInbox(payload({ transactions: [{ ...base, stableTransactionId: "raw id with spaces" }] }))).toThrow(/transaction digest/);
    expect(() => parseFlinksInbox(payload({ transactions: [{ ...base, stableTransactionId: "ftx_1234567890123456" }] }))).toThrow(/transaction digest/);
  });

  it("does not turn a pending-only pull into a postable proposal", () => {
    const pending = payload().transactions[2]!;
    expect(() => parseFlinksInbox(payload({ transactions: [pending] }))).toThrow(/only pending transactions/);
  });

  it("does not guess that an ordinary bank payment is an internal transfer", () => {
    const base = payload().transactions[0]!;
    const bankPayment = parseFlinksInbox(payload({ transactions: [{ ...base, code: "payment" }] }));
    const cardPayment = parseFlinksInbox(payload({ transactions: [{ ...base, accountKind: "credit-card", code: "payment" }] }));
    expect(bankPayment.rows[0]?.suggestedType).toBe("unknown");
    expect(cardPayment.rows[0]?.suggestedType).toBe("transfer");
  });

  it("scopes provider transaction identity to the account digest", () => {
    const base = payload().transactions[0]!;
    const parsed = parseFlinksInbox(payload({ transactions: [
      base,
      { ...base, accountRef: SAVINGS_DIGEST, accountLast4: "2211" },
    ] }));
    expect(new Set(parsed.rows.map((row) => row.id)).size).toBe(2);
    expect(new Set(parsed.rows.map((row) => row.provenanceId)).size).toBe(2);
    expect(parsed.rows.map((row) => row.provenanceId)).toEqual(expect.arrayContaining([
      `flinks:${CHEQUING_DIGEST}:${DEBIT_DIGEST}`,
      `flinks:${SAVINGS_DIGEST}:${DEBIT_DIGEST}`,
    ]));
  });
});
