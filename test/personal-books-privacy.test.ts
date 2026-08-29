// @vitest-environment jsdom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { BooksPage } from "../src/Books.tsx";
import {
  addAccount,
  addGoal,
  askHercules,
  booksPresentationFloor,
  buildBatchImport,
  catalogHousehold,
  closePackageText,
  compileHousehold,
  postEntry,
  prepareImportRows,
  recordReconciliation,
  sitDownExportText,
  trialBalance,
  type ImportedSourceRow,
} from "../src/core/index.ts";
import { booksJournalCsv, booksSqlDump } from "../src/ledger/export.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";
const PARTNER_ACCOUNT = "BIANCA PRIVATE CANARY ACCOUNT";
const PARTNER_NOTE = "BIANCA PRIVATE CANARY NOTE 91827";
const PARTNER_GOAL = "BIANCA PRIVATE CANARY GOAL";
const OWN_ACCOUNT = "JONATHAN PERSONAL CANARY ACCOUNT";
const OWN_NOTE = "JONATHAN PERSONAL CANARY NOTE 48152";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function privacyScenario() {
  let household = catalogHousehold();
  household = addAccount(household, {
    name: PARTNER_ACCOUNT,
    kind: "savings",
    scope: "personal",
    ownerMemberId: BIANCA,
    institution: "Partner Private Institution",
    last4: "9182",
  }).household;
  household = addAccount(household, {
    name: OWN_ACCOUNT,
    kind: "savings",
    scope: "personal",
    ownerMemberId: JONATHAN,
  }).household;
  const partnerAccount = household.accounts.find((row) => row.name === PARTNER_ACCOUNT)!;
  const ownAccount = household.accounts.find((row) => row.name === OWN_ACCOUNT)!;
  household = postEntry(household, {
    date: DATE,
    type: "expense",
    amount: "91.82",
    accountId: partnerAccount.id,
    subcategoryId: "SUB-LIFE-FUN",
    note: PARTNER_NOTE,
    createdBy: BIANCA,
    visibility: "personal",
    confirmDuplicate: true,
  }).household;
  household = postEntry(household, {
    date: DATE,
    type: "expense",
    amount: "48.15",
    accountId: ownAccount.id,
    subcategoryId: "SUB-LIFE-FUN",
    note: OWN_NOTE,
    createdBy: JONATHAN,
    visibility: "personal",
    confirmDuplicate: true,
  }).household;
  household = recordReconciliation(household, {
    accountId: partnerAccount.id,
    statementDate: DATE,
    statementAmount: "918.27",
    createdBy: BIANCA,
  }).household;
  household = addGoal(household, {
    name: PARTNER_GOAL,
    target: "9182",
    shared: false,
    ownerMemberId: BIANCA,
  }).household;
  return { household, partnerAccount, ownAccount };
}

function exportPacket(household: ReturnType<typeof catalogHousehold>): string {
  const books = compileHousehold(household);
  const trial = trialBalance(books, { recognizedOnly: true });
  return [
    booksSqlDump(books),
    booksJournalCsv(books, trial),
    closePackageText(household, "2026-09", DATE),
    sitDownExportText(household, "2026-09", DATE),
  ].join("\n---\n");
}

function importedRow(): ImportedSourceRow {
  return {
    id: "IMP-BOOKS-FLOOR",
    sourceKind: "ofx",
    sourceName: "books-floor.ofx",
    sourceHash: "books-floor-hash",
    provenanceId: "ofx:books-floor:accepted-write",
    documentKind: "bank-statement",
    accountRef: "shared-chequing",
    accountLast4: "4821",
    currency: "CAD",
    date: DATE,
    amountCents: 1234,
    signedAmountCents: -1234,
    suggestedType: "expense",
    bankType: "DEBIT",
    note: "Scoped import accepted-write proof",
    place: "Fixture market",
    fitId: "books-floor-fit",
    extractionConfidence: null,
  };
}

describe("Books presentation privacy", () => {
  it("keeps partner-personal accounts, posts, goals, and reconciliations out of Personal Audit and exports", () => {
    const { household, partnerAccount, ownAccount } = privacyScenario();
    const floor = booksPresentationFloor(household, JONATHAN, "personal");
    const serialized = JSON.stringify(floor);
    expect(floor.accounts.some((row) => row.id === ownAccount.id)).toBe(true);
    expect(floor.accounts.some((row) => row.scope !== "personal")).toBe(true);
    expect(floor.accounts.some((row) => row.id === partnerAccount.id)).toBe(false);
    expect(floor.kitchen.books.reconciliations.some((row) => row.accountId === partnerAccount.id)).toBe(false);
    expect(serialized).toContain(OWN_ACCOUNT);
    expect(serialized).toContain(OWN_NOTE);
    expect(serialized).not.toContain(PARTNER_ACCOUNT);
    expect(serialized).not.toContain(PARTNER_NOTE);
    expect(serialized).not.toContain(PARTNER_GOAL);
    expect(serialized).not.toContain("Partner Private Institution");
    expect(serialized).not.toContain("91827");

    const exports = exportPacket(floor);
    expect(exports).toContain(OWN_ACCOUNT);
    expect(exports).toContain(OWN_NOTE);
    expect(exports).not.toContain(PARTNER_ACCOUNT);
    expect(exports).not.toContain(PARTNER_NOTE);
    expect(exports).not.toContain(PARTNER_GOAL);
    expect(JSON.stringify(askHercules(floor, "show the trial balance", DATE, { memberId: JONATHAN, view: "personal" })))
      .not.toMatch(/BIANCA PRIVATE CANARY|Partner Private Institution|918\.27/);
  });

  it("keeps every personal room out of Shared Audit and exports", () => {
    const { household } = privacyScenario();
    const floor = booksPresentationFloor(household, JONATHAN, "household");
    const serialized = JSON.stringify(floor);
    expect(floor.accounts.every((row) => row.scope !== "personal")).toBe(true);
    expect(serialized).not.toContain(PARTNER_ACCOUNT);
    expect(serialized).not.toContain(PARTNER_NOTE);
    expect(serialized).not.toContain(PARTNER_GOAL);
    expect(serialized).not.toContain(OWN_ACCOUNT);
    expect(serialized).not.toContain(OWN_NOTE);
    expect(exportPacket(floor)).not.toMatch(/BIANCA PRIVATE CANARY|JONATHAN PERSONAL CANARY/);
  });

  it("never renders a partner canary while opening each Personal Audit pane", () => {
    const { household } = privacyScenario();
    const floor = booksPresentationFloor(household, JONATHAN, "personal");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement(BooksPage, {
        household: floor,
        booksHousehold: household,
        memberId: JONATHAN,
        view: "personal",
        booksStatus: null,
        focusedAccountId: null,
        sourceFocus: null,
        onFocusAccount: () => undefined,
        onClearSource: () => undefined,
        onChange: () => undefined,
        onRemove: () => undefined,
        onPayAccount: () => undefined,
        onAddToAccount: () => undefined,
        onCommand: () => undefined,
      }));
    });
    const clickPane = (label: string) => {
      const button = [...host.querySelectorAll("button")].find((item) => item.textContent === label);
      expect(button, `missing ${label} pane`).toBeTruthy();
      act(() => button?.click());
      expect(host.textContent).not.toMatch(/BIANCA PRIVATE CANARY|Partner Private Institution|918\.27/);
    };
    for (const label of ["Journal", "Trial balance", "Statements", "Reconcile", "Close pack", "Chart", "Ask"]) {
      clickPane(label);
    }
    expect(host.textContent).toContain("Power SQL stays off scoped floors");
    act(() => root.unmount());
    host.remove();
  });

  it("uses the scoped floor for Import review and the accepted snapshot for Confirm", () => {
    for (const view of ["household", "personal"] as const) {
      const { household, partnerAccount } = privacyScenario();
      const floor = booksPresentationFloor(household, JONATHAN, view);
      const rows = prepareImportRows({ household: floor, memberId: JONATHAN, view, rows: [importedRow()] });
      rows[0]!.accountId = "ACC-CHEQUING";
      rows[0]!.subcategoryId = "SUB-FOOD-GROCERIES";
      const result = buildBatchImport({ household, memberId: JONATHAN, rows });
      expect(result.household.kitchen.books.reconciliations.some((row) => row.accountId === partnerAccount.id)).toBe(true);
      expect(result.household.transactions.some((row) => row.sourceId === "ofx:books-floor:accepted-write")).toBe(true);
    }
  });
});
