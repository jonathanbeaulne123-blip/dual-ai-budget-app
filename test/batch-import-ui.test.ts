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

let container: HTMLDivElement;
let root: Root;

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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => act(() => root.unmount()));

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
});
