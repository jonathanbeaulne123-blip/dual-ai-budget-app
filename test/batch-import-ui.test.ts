// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BatchImportCard } from "../src/BatchImport.tsx";

vi.mock("../src/FlinksConnectPanel.tsx", () => ({
  FlinksConnectPanel: () => null,
}));
import { catalogHousehold, postEntry, type Household, type UndoToken } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD
<BANKACCTFROM><BANKID>004<ACCTID>4821</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260820<TRNAMT>-47.23<FITID>FIT-UI<NAME>No Frills<MEMO>Groceries</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_NEEDS_DETAILS = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD
<BANKACCTFROM><BANKID>004<ACCTID>9999</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260824<TRNAMT>-14.20<FITID>DETAIL-1<NAME>First Merchant<MEMO>Needs account</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260825<TRNAMT>-19.30<FITID>DETAIL-2<NAME>Second Merchant<MEMO>Needs account</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_AUTO_KEEP = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD
<BANKACCTFROM><BANKID>004<ACCTID>4821</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260825<TRNAMT>-987.65<FITID>AUTO-KEEP-1<NAME>Unique Test Merchant<MEMO>Unrelated purchase</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_AUTO_KEEP_CHEQUING_TRANSFER = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD
<BANKACCTFROM><BANKID>623<ACCTID>1190</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>XFER<DTPOSTED>20260825<TRNAMT>123.45<FITID>AUTO-XFER-1<NAME>Transfer from chequing<MEMO>Internal transfer</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_NOT_SURE = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD
<BANKACCTFROM><BANKID>004<ACCTID>4821</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260824<TRNAMT>-14.20<FITID>REVIEW-1<NAME>First Merchant<MEMO>First Merchant</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260825<TRNAMT>-19.30<FITID>REVIEW-2<NAME>Second Merchant<MEMO>Second Merchant</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

let container: HTMLDivElement;
let root: Root;
let scrollIntoView: ReturnType<typeof vi.fn>;

async function settleUntil(predicate: () => boolean, message: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
    if (predicate()) return;
  }
  throw new Error(`${message}\n${container.textContent}`);
}

function button(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((item) => item.textContent?.trim().startsWith(text));
}

beforeEach(() => {
  document.body.innerHTML = "";
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
});

describe("batch import review UI", () => {
  it("opens the three confidence tabs after parsing, pre-cancels >90, and posts only after final Confirm", async () => {
    const household = postEntry(catalogHousehold(), {
      date: "2026-08-20", type: "expense", amount: 47.23, accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "No Frills · Groceries", place: "No Frills",
      source: "import", sourceId: "ofx:004:4821:FIT-UI", createdBy: "MEM-002",
    }).household;
    const onCommit = vi.fn(async (_next: Household, _undo: UndoToken) => ({ ok: true }));
    act(() => root.render(createElement(BatchImportCard, {
      household,
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
    const file = new File([OFX], "bank.ofx", { type: "application/x-ofx" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX).buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.querySelector(".import-review") != null, "Duplicate review did not open.");
    expect(container.textContent).toContain("Confident");
    expect(container.textContent).toContain("Not sure");
    expect(container.textContent).toContain("Probably not a duplicate");
    expect(container.textContent).toContain("100%");
    expect(container.textContent).toContain("Import cancelled");
    expect(onCommit).not.toHaveBeenCalled();

    act(() => button("Keep both")!.click());
    act(() => button("Review final Confirm")!.click());
    await settleUntil(() => container.textContent?.includes("Confirm batch import?") === true, "Final Confirm did not open.");
    expect(onCommit).not.toHaveBeenCalled();
    act(() => button("Confirm 1 import")!.click());
    await settleUntil(() => onCommit.mock.calls.length === 1, "Confirmed batch did not reach the write callback.");
    const posted = onCommit.mock.calls[0]![0];
    expect(posted.transactions).toHaveLength(2);
    expect(posted.transactions.at(-1)!.source).toBe("import");
  });

  it("turns the details count into a guided queue and advances focus until Confirm is ready", async () => {
    act(() => root.render(createElement(BatchImportCard, {
      household: catalogHousehold(),
      memberId: "MEM-002",
      view: "household",
      onCommit: vi.fn(),
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
    const file = new File([OFX_NEEDS_DETAILS], "needs-details.ofx", { type: "application/x-ofx" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX_NEEDS_DETAILS).buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.textContent?.includes("2 transactions need details") === true, "Details count did not appear.");
    act(() => button("2 transactions need details")!.click());
    await settleUntil(() => (document.activeElement as HTMLElement | null)?.dataset.importField === "account"
      && document.activeElement?.closest("article")?.getAttribute("aria-label")?.startsWith("First Merchant") === true, "First missing account was not focused.");
    expect(scrollIntoView).toHaveBeenCalled();
    act(() => button("Close")!.focus());
    expect(document.activeElement?.textContent).toContain("Close");
    act(() => button("2 transactions need details")!.click());
    await settleUntil(() => (document.activeElement as HTMLElement | null)?.dataset.importField === "account"
      && document.activeElement?.closest("article")?.getAttribute("aria-label")?.startsWith("First Merchant") === true, "Repeated activation did not refocus the first missing account.");

    const firstAccount = document.activeElement as HTMLSelectElement;
    act(() => {
      firstAccount.value = "ACC-CHEQUING";
      firstAccount.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settleUntil(() => (document.activeElement as HTMLElement | null)?.dataset.importField === "account"
      && document.activeElement?.closest("article")?.getAttribute("aria-label")?.startsWith("Second Merchant") === true, "Focus did not advance to the next missing account.");
    expect(container.textContent).toContain("1 transaction needs details");

    const secondAccount = document.activeElement as HTMLSelectElement;
    act(() => {
      secondAccount.value = "ACC-CHEQUING";
      secondAccount.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settleUntil(() => document.activeElement?.textContent?.includes("Review final Confirm") === true, "Confirm was not focused after the last required detail.");
    expect(button("Review final Confirm")!.disabled).toBe(false);
  });

  it("hides complete matches at 20% or below while keeping them in the final confirmed batch", async () => {
    const household = catalogHousehold();
    const onCommit = vi.fn(async (_next: Household, _undo: UndoToken) => ({ ok: true }));
    act(() => root.render(createElement(BatchImportCard, {
      household,
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
    const file = new File([OFX_AUTO_KEEP], "auto-keep.ofx", { type: "application/x-ofx" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX_AUTO_KEEP).buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.textContent?.includes("1 auto-kept without review") === true, "Auto-kept summary did not appear.");
    expect(container.querySelector(".import-pair")).toBeNull();
    expect(button("Review final Confirm")!.disabled).toBe(false);
    act(() => button("Review final Confirm")!.click());
    await settleUntil(() => container.textContent?.includes("Confirm batch import?") === true, "Final Confirm did not open.");
    act(() => button("Confirm 1 import")!.click());
    await settleUntil(() => onCommit.mock.calls.length === 1, "Auto-kept row did not reach the final batch write.");
    expect(onCommit.mock.calls[0]![0].transactions).toHaveLength(household.transactions.length + 1);
  });

  it("auto-keeps an obvious transfer from the unique chequing account", async () => {
    const household = catalogHousehold();
    const onCommit = vi.fn(async (_next: Household, _undo: UndoToken) => ({ ok: true }));
    act(() => root.render(createElement(BatchImportCard, {
      household,
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
    const file = new File([OFX_AUTO_KEEP_CHEQUING_TRANSFER], "auto-transfer.ofx", { type: "application/x-ofx" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX_AUTO_KEEP_CHEQUING_TRANSFER).buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.textContent?.includes("1 auto-kept without review") === true, "Obvious chequing transfer was not auto-kept.");
    expect(container.querySelector(".import-pair")).toBeNull();
    expect(button("Review final Confirm")!.disabled).toBe(false);
    act(() => button("Review final Confirm")!.click());
    await settleUntil(() => container.textContent?.includes("Confirm batch import?") === true, "Final Confirm did not open.");
    act(() => button("Confirm 1 import")!.click());
    await settleUntil(() => onCommit.mock.calls.length === 1, "Auto-kept transfer did not reach the final batch write.");
    const posted = onCommit.mock.calls[0]![0] as Household;
    expect(posted.transactions).toHaveLength(household.transactions.length + 2);
    expect(posted.transactions.slice(-2).every((transaction) => (
      transaction.type === "transfer"
      && transaction.transferFromAccountId === "ACC-CHEQUING"
      && transaction.transferToAccountId === "ACC-SAVINGS"
    ))).toBe(true);
  });

  it("keeps review open and shows the real acceptance failure", async () => {
    const onCommit = vi.fn(async () => ({
      ok: false,
      userMessage: "The last valid household is still here. This phone could not save the new snapshot.",
    }));
    act(() => root.render(createElement(BatchImportCard, {
      household: catalogHousehold(),
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
    const file = new File([OFX_AUTO_KEEP], "large-history.ofx", { type: "application/x-ofx" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX_AUTO_KEEP).buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.textContent?.includes("1 auto-kept without review") === true, "Review did not stage.");
    act(() => button("Review final Confirm")!.click());
    await settleUntil(() => container.textContent?.includes("Confirm batch import?") === true, "Final Confirm did not open.");
    act(() => button("Confirm 1 import")!.click());
    await settleUntil(() => container.textContent?.includes("This phone could not save the new snapshot") === true, "Real rejection reason was hidden.");
    expect(container.querySelector(".import-review")).not.toBeNull();
    expect(container.textContent).toContain("The staged review is still open");
  });

  it("centers the duplicate decision and advances after Keep both", async () => {
    let household = catalogHousehold();
    const categoryId = household.categories.find((category) => (
      category.active && category.recordType === "category" && category.transactionType === "expense"
    ))!.id;
    household = postEntry(household, {
      date: "2026-08-24", type: "expense", amount: 14.20, accountId: "ACC-CHEQUING",
      subcategoryId: categoryId, note: "First Merchant", place: "", createdBy: "MEM-002",
    }).household;
    household = postEntry(household, {
      date: "2026-08-25", type: "expense", amount: 19.30, accountId: "ACC-CHEQUING",
      subcategoryId: categoryId, note: "Second Merchant", place: "", createdBy: "MEM-002",
    }).household;
    act(() => root.render(createElement(BatchImportCard, {
      household,
      memberId: "MEM-002",
      view: "household",
      onCommit: vi.fn(),
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
    const file = new File([OFX_NOT_SURE], "not-sure.ofx", { type: "application/x-ofx" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX_NOT_SURE).buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.textContent?.includes("2 transactions need a duplicate decision") === true, "Duplicate choices did not appear.");
    act(() => button("2 transactions need a duplicate decision")!.click());
    await settleUntil(() => (document.activeElement as HTMLElement | null)?.dataset.importAction === "keep"
      && document.activeElement?.closest("article")?.getAttribute("aria-label")?.startsWith("First Merchant") === true, "First Keep both decision was not focused.");
    expect(scrollIntoView).toHaveBeenCalled();
    act(() => (document.activeElement as HTMLButtonElement).click());
    await settleUntil(() => (document.activeElement as HTMLElement | null)?.dataset.importAction === "keep"
      && document.activeElement?.closest("article")?.getAttribute("aria-label")?.startsWith("Second Merchant") === true, "Keep both did not advance to the next duplicate decision.");
    act(() => (document.activeElement as HTMLButtonElement).click());
    await settleUntil(() => document.activeElement?.textContent?.includes("Review final Confirm") === true, "The queue did not finish at final Confirm.");
  });

  it("clears a total-only receipt against one exact posted payment without posting a second expense", async () => {
    const household = postEntry(catalogHousehold(), {
      date: "2026-08-24", type: "expense", amount: 16.95, accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "Market payment", place: "Market",
      createdBy: "MEM-002", visibility: "household", confirmDuplicate: true,
    }).household;
    const onCommit = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      provider: "workers-ai",
      sourceHash: "receipt-ui-hash",
      result: {
        documentKind: "receipt",
        currency: "CAD",
        accountLast4: "4821",
        rows: [{
          date: "2026-08-24", amountCents: 1695, direction: "debit", typeHint: "expense",
          merchant: "Market", description: "Receipt total", reference: "RCPT-UI", confidence: 96,
        }],
        receiptNumbers: {
          lineAmountsCents: [], subtotalCents: null, discountCents: 0,
          taxCents: 0, tipCents: 0, feeCents: 0, totalCents: 1695,
        },
        warnings: [],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    act(() => root.render(createElement(BatchImportCard, {
      household,
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept="image/jpeg,image/png,image/webp"]:not([capture])')!;
    const file = new File(["image"], "receipt.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("image").buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.textContent?.includes("Cleared to payment") === true, "Exact receipt payment was not selected.");
    expect(container.textContent).toContain("Items unreadable");
    expect(button("Review final Confirm")!.disabled).toBe(false);
    act(() => button("Review final Confirm")!.click());
    await settleUntil(() => container.textContent?.includes("1 receipt is cleared") === true, "Receipt clearance was absent from Confirm.");
    act(() => button("Confirm 0 imports")!.click());
    await settleUntil(() => container.querySelector(".import-review") == null, "Evidence-only review did not close.");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("discards staged rows when the environment, household, member, or ledger view changes", async () => {
    const firstHousehold = catalogHousehold();
    const onCommit = vi.fn();
    act(() => root.render(createElement(BatchImportCard, {
      household: firstHousehold,
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));
    const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
    const file = new File([OFX_AUTO_KEEP], "scoped.ofx", { type: "application/x-ofx" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX_AUTO_KEEP).buffer });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
    await settleUntil(() => container.querySelector(".import-review") != null, "Scoped review did not stage.");

    const nextHousehold = { ...catalogHousehold(), householdId: "HH-OTHER", environment: "production" as const };
    act(() => root.render(createElement(BatchImportCard, {
      household: nextHousehold,
      memberId: "MEM-001",
      view: "personal",
      onCommit,
    })));
    await settleUntil(() => container.querySelector(".import-review") == null, "Old scoped review survived a ledger switch.");
    expect(container.textContent).not.toContain("1 auto-kept without review");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("does not let an old async confirmation clear a newly staged A to B to A ledger scope", async () => {
    let acceptOldBatch!: (value: { ok: true }) => void;
    const onCommit = vi.fn(() => new Promise<{ ok: true }>((resolve) => { acceptOldBatch = resolve; }));
    const firstHousehold = catalogHousehold();
    act(() => root.render(createElement(BatchImportCard, {
      household: firstHousehold,
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));
    const stageBankFile = async (name: string) => {
      const input = container.querySelector<HTMLInputElement>('input[accept*=".ofx"]')!;
      const file = new File([OFX_AUTO_KEEP], name, { type: "application/x-ofx" });
      Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(OFX_AUTO_KEEP).buffer });
      Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file, [Symbol.iterator]: function* () { yield file; } } });
      act(() => input.dispatchEvent(new Event("change", { bubbles: true })));
      await settleUntil(() => container.querySelector(".import-review") != null, `${name} did not stage.`);
    };

    await stageBankFile("old-scope.ofx");
    act(() => button("Review final Confirm")!.click());
    await settleUntil(() => container.textContent?.includes("Confirm batch import?") === true, "Old final Confirm did not open.");
    act(() => button("Confirm 1 import")!.click());
    await settleUntil(() => onCommit.mock.calls.length === 1, "Old confirmation did not reach the write callback.");

    const nextHousehold = { ...catalogHousehold(), householdId: "HH-NEW-SCOPE" };
    act(() => root.render(createElement(BatchImportCard, {
      household: nextHousehold,
      memberId: "MEM-001",
      view: "personal",
      onCommit,
    })));
    await settleUntil(() => container.querySelector(".import-review") == null, "Old scope did not clear after the switch.");

    act(() => root.render(createElement(BatchImportCard, {
      household: firstHousehold,
      memberId: "MEM-002",
      view: "household",
      onCommit,
    })));
    await stageBankFile("new-scope.ofx");
    expect(container.textContent).toContain("1 auto-kept without review");

    await act(async () => { acceptOldBatch({ ok: true }); });
    await settleUntil(() => button("Review final Confirm")?.disabled === false, "New scope was changed by the old confirmation.");
    expect(container.querySelector(".import-review")).not.toBeNull();
    expect(container.textContent).toContain("1 auto-kept without review");
  });

  it("requires an explicit choice when one payment fits two receipts", async () => {
    const household = postEntry(catalogHousehold(), {
      date: "2026-08-24", type: "expense", amount: 16.95, accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "Receipt payment", place: "",
      createdBy: "MEM-002", visibility: "household", confirmDuplicate: true,
    }).household;
    let scan = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      const current = scan++;
      return new Response(JSON.stringify({
        ok: true,
        provider: "workers-ai",
        result: {
          documentKind: "receipt",
          currency: "CAD",
          accountLast4: "4821",
          rows: [{
            date: current === 0 ? "2026-08-23" : "2026-08-25",
            amountCents: 1695,
            direction: "debit",
            typeHint: "expense",
            merchant: current === 0 ? "Market North" : "Market South",
            description: "Receipt total",
            reference: "",
            confidence: 96,
          }],
          receiptNumbers: {
            lineAmountsCents: [1500], subtotalCents: 1500, discountCents: 0,
            taxCents: 195, tipCents: 0, feeCents: 0, totalCents: 1695,
          },
          warnings: [],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    act(() => root.render(createElement(BatchImportCard, {
      household,
      memberId: "MEM-002",
      view: "household",
      onCommit: vi.fn(),
    })));

    const input = container.querySelector<HTMLInputElement>('input[accept="image/jpeg,image/png,image/webp"]:not([capture])')!;
    const files = [
      new File(["receipt-a"], "receipt-a.jpg", { type: "image/jpeg" }),
      new File(["receipt-b"], "receipt-b.jpg", { type: "image/jpeg" }),
    ];
    files.forEach((file, index) => Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode(`receipt-${index}`).buffer,
    }));
    Object.defineProperty(input, "files", { configurable: true, value: { 0: files[0], 1: files[1], length: 2, item: (index: number) => files[index] ?? null, [Symbol.iterator]: function* () { yield* files; } } });
    act(() => input.dispatchEvent(new Event("change", { bubbles: true })));

    await settleUntil(() => container.querySelectorAll("button").length > 0 && button("Treat as new expense") != null, "Competing receipt choice did not appear.");
    expect(container.querySelectorAll(".import-check .pill")).toHaveLength(2);
    expect(button("Review final Confirm")!.disabled).toBe(true);
    act(() => button("Treat as new expense")!.click());
    expect(button("Review final Confirm")!.disabled).toBe(true);
    const unresolvedChoice = button("Treat as new expense")!.closest(".import-check")!;
    const payment = unresolvedChoice.querySelector<HTMLInputElement>(".import-payment-matches input")!;
    act(() => payment.click());
    await settleUntil(() => button("Review final Confirm")?.disabled === false, "Explicit receipt choices did not unlock final Confirm.");
    expect(container.textContent).toContain("Cleared to payment");
    expect(container.textContent).toContain("New expense");
  });
});
