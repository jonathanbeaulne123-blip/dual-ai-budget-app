// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooksPage } from "../src/Books.tsx";
import { addAccount, catalogHousehold, configureHouseholdFund, formatCad, postEntry, projectHouseholdFund, type Household } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let props: ComponentProps<typeof BooksPage>;
let serial = 0;
const write = vi.fn(() => { throw Error("Navigation must not write"); });
function scenario(): Household {
  let h = catalogHousehold();
  h.householdId = `BOOKS-UI-${++serial}`;
  h = configureHouseholdFund(h, { custodianMemberId: "MEM-001", openedOn: "2026-09-01", createdBy: "MEM-001" }).household;
  h = postEntry(h, { date: "2026-09-02", type: "expense", amount: "12.34", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note: "Shared coffee", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true }).household;
  h = postEntry(h, { date: "2026-08-02", type: "income", amount: "50", accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Shared income", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true }).household;
  return h;
}
async function render(changes: Partial<typeof props> = {}) { props = { ...props, ...changes }; await act(async () => root.render(createElement(BooksPage, props))); }
async function click(text: string, selector = "button") {
  const button = [...host.querySelectorAll<HTMLButtonElement>(selector)].find(el => el.textContent?.trim() === text);
  expect(button, text).toBeTruthy();
  await act(async () => button!.click());
}
async function change(label: string, value: string) {
  const field = [...host.querySelectorAll("label")].find(el => el.childNodes[0]?.textContent === label)?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement;
  expect(field, label).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(field.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event(field.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
const rows = () => [...host.querySelectorAll(".ledger-entries [data-ledger-row-id]")].map(el => el.textContent);
beforeEach(() => {
  host = document.createElement("div"); host.style.overflowY = "auto"; document.body.append(host); root = createRoot(host);
  const household = scenario();
  props = { household, booksHousehold: household, memberId: "MEM-001", view: "household", booksStatus: null, focusedAccountId: null, sourceFocus: null,
    onFocusAccount: () => {}, onClearSource: () => {}, onChange: write, onRemove: write, onPayAccount: write, onAddToAccount: write, onCommand: write };
  write.mockClear();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.documentElement.removeAttribute("data-theme"); vi.restoreAllMocks(); expect(write).not.toHaveBeenCalled(); });

describe("Household table", () => {
  it.each(["classic", "taylor", "newfoundland"])("has one shared navigation and accepted overview in %s", async theme => {
    document.documentElement.dataset.theme = theme;
    const accepted = JSON.stringify(props.booksHousehold);
    const optimistic = { ...props.household, transactions: [...props.household.transactions, { ...props.household.transactions[0]!, id: "UNACCEPTED", note: "Pending canary", amountCents: 990000 }] };
    await render({ household: optimistic });
    expect([...host.querySelectorAll(".household-books-nav button")].map(el => el.textContent)).toEqual(["Overview", "Fund", "Accounts", "Activity"]);
    expect(host.querySelector(".household-books-nav [aria-current]")?.textContent).toBe("Overview");
    expect(host.querySelector(".hero, .hearth-story-strip, .hearth-pane-seals, [data-books-tabs=table]")).toBeNull();
    expect(host.querySelector(".household-books-reading")?.textContent).toContain(formatCad(projectHouseholdFund(props.booksHousehold, "2026-09-08").operatingBalanceCents));
    expect(host.textContent).toContain("Shared savings");
    expect(host.textContent).toContain("Obligations");
    expect(host.textContent).toContain("Shared coffee");
    expect(host.textContent).not.toContain("Pending canary");
    expect(JSON.stringify(props.booksHousehold)).toBe(accepted);
    await click("Fund", ".household-books-nav button");
    expect([...host.querySelectorAll(".household-fund-tabs button")].map(el => el.textContent)).toEqual(["Overview", "Register"]);
    await click("Register", ".household-fund-tabs button");
    expect(host.querySelector(".register")).not.toBeNull();
    await click("Accounts", ".household-books-nav button");
    expect(host.querySelector(".wallet-strip")).not.toBeNull();
  });

  it("searches and combines month, account and type while restoring filters and scroll across remounts", async () => {
    await render(); await click("Activity", ".household-books-nav button");
    expect(rows()).toHaveLength(2);
    expect(host.querySelector('option[value="opening"]')?.textContent).toBe("Opening balance");
    await change("Search activity", "coffee"); await change("Month", "2026-09"); await change("Account", "ACC-CHEQUING"); await change("Type", "expense");
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain("Shared coffee");
    // Let the initial restoration finish before simulating a user's scroll.
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    host.scrollTop = 370; host.dispatchEvent(new Event("scroll"));
    await click("Overview", ".household-books-nav button"); host.scrollTop = 0;
    await click("Activity", ".household-books-nav button");
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    expect(host.scrollTop).toBe(370);
    expect(host.querySelector("input[type=search]")?.getAttribute("value")).toBe("coffee");
    expect([...host.querySelectorAll<HTMLSelectElement>(".household-activity-filters select")].map(el => el.value)).toEqual(["2026-09", "ACC-CHEQUING", "expense"]);
    // App unmounts Books when leaving the board entirely.
    await act(async () => root.render(null)); await render(); await click("Activity", ".household-books-nav button");
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain("Shared coffee");
    await render({ memberId: "MEM-002" }); await click("Activity", ".household-books-nav button");
    expect((host.querySelector("input[type=search]") as HTMLInputElement).value).toBe(""); expect(rows()).toHaveLength(2);
  });

  it("keeps pending rows separate from accepted activity and filters both", async () => {
    const pending = { ...props.household.transactions.find(tx => tx.type === "expense")!, id: "PENDING-COFFEE", note: "Coffee pending" };
    await render({ pendingRows: [{ commandId: "CMD-COFFEE", rows: [pending], submittedAt: "2026-09-08T12:00:00Z" }] });
    await click("Activity", ".household-books-nav button"); await change("Search activity", "coffee");
    expect(rows()).toHaveLength(1);
    expect(host.querySelectorAll(".ledger-pending [data-ledger-phase=pending]")).toHaveLength(1);
    expect(host.querySelector(".household-activity-filters")?.textContent).toContain("1 accepted entry");
    await change("Type", "income"); expect(rows()).toHaveLength(0);
    expect(host.querySelectorAll(".ledger-pending [data-ledger-phase=pending]")).toHaveLength(0);
  });

  it("opens a recent source despite old filters, then returns to those filters", async () => {
    await render(); await click("Activity", ".household-books-nav button"); await change("Type", "income");
    await click("Overview", ".household-books-nav button");
    await act(async () => host.querySelector<HTMLButtonElement>(".household-books-activity-link")!.click());
    expect(rows()).toHaveLength(1); expect(rows()[0]).toContain("Shared coffee");
    await click("Show all activity"); expect(rows()).toHaveLength(1); expect(rows()[0]).toContain("Shared income");
  });

  it("retains every tools destination, requested pane and shared account link", async () => {
    await render();
    expect([...host.querySelectorAll("[data-books-tabs=audit] button")].map(el => el.textContent)).toEqual(["Import", "Journal", "Trial balance", "Statements", "Reconcile", "Close pack", "Chart", "Ask"]);
    for (const [label, selector] of [["Journal", ".journal-head"], ["Trial balance", ".books-table"], ["Statements", ".statement-note"], ["Reconcile", "select"], ["Close pack", ".card"], ["Chart", ".books-table"], ["Ask", ".ask-log"]]) {
      await click(label!, "[data-books-tabs=audit] button"); expect(host.querySelector(selector!)).not.toBeNull();
    }
    const consume = vi.fn();
    for (const pane of ["fund", "fund-register", "wallet", "opening", "register"] as const) {
      await render({ requestedPane: pane, onConsumeRequestedPane: consume });
      expect(consume).toHaveBeenCalledTimes(["fund", "fund-register", "wallet", "opening", "register"].indexOf(pane) + 1);
      expect(host.querySelector(".household-books-nav [aria-current]")?.textContent).toBe(pane.startsWith("fund") ? "Fund" : pane === "register" ? "Activity" : "Accounts");
    }
    await render({ requestedPane: null, focusedAccountId: "ACC-CHEQUING" });
    expect(host.querySelector(".account-room")).not.toBeNull();
    await click("Overview", ".household-books-nav button");
    await render({ booksHousehold: structuredClone(props.booksHousehold) });
    expect(host.querySelector(".household-books-nav [aria-current]")?.textContent).toBe("Overview");
  });

  it("never exposes private accounts or rows on Shared, and preserves the Personal floor", async () => {
    let h = addAccount(props.household, { name: "Private account canary", kind: "savings", scope: "personal", ownerMemberId: "MEM-002" }).household;
    const privateId = h.accounts.find(a => a.name === "Private account canary")!.id;
    h = postEntry(h, { date: "2026-09-03", type: "expense", amount: "98.76", accountId: privateId, subcategoryId: "SUB-LIFE-FUN", note: "Private row canary", createdBy: "MEM-002", visibility: "personal", confirmDuplicate: true }).household;
    await render({ household: h, booksHousehold: h, focusedAccountId: privateId });
    for (const nav of ["Overview", "Accounts", "Activity"]) { await click(nav, ".household-books-nav button"); expect(host.textContent).not.toMatch(/Private account canary|Private row canary/); }
    await render({ view: "personal", memberId: "MEM-001", focusedAccountId: null });
    expect(host.querySelector(".household-books-nav")).toBeNull(); expect(host.querySelector("[data-books-tabs=table]")).not.toBeNull();
    expect(host.textContent).not.toMatch(/Private account canary|Private row canary/);
    await render({ view: "personal", memberId: "MEM-002" }); expect(host.textContent).toContain("Private account canary");
  });
});
