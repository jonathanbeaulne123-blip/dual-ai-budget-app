// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BatchImportCard } from "../src/BatchImport.tsx";
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
});
