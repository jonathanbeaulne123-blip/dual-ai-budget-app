// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { ClerkReading, type ClerkRecordRef } from "../src/ClerkReading.tsx";
import {
  HOUSEHOLD_FUND_ID,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  postEntry,
  proposeHouseholdFundContribution,
} from "../src/core/index.ts";
import { clerkReading } from "../src/core/clerkReading.ts";
import type { ClerkReading as ClerkReadingRecord } from "../src/core/clerkReading.ts";
import type { Household } from "../src/core/types.ts";
import * as sharedLedgerStory from "../src/core/sharedLedgerStory.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const SINCE = "2026-09-01";
const TODAY = "2026-09-04";

function canonicalMonth() {
  let household = configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: SINCE,
    createdBy: BIANCA,
  }).household;
  const confirmed = proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "150",
    date: "2026-09-02",
  });
  const confirmation = confirmHouseholdFundContribution(confirmed.household, {
    memberId: BIANCA,
    proposalEventId: confirmed.postedIds[0]!,
  });
  household = confirmation.household;
  const expense = postEntry(household, {
    date: "2026-09-03",
    type: "expense",
    amount: "120",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: JONATHAN,
    visibility: "household",
    confirmDuplicate: true,
    funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 12000, destinationAccountId: "ACC-VISA" },
  });
  const waiting = proposeHouseholdFundContribution(expense.household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "40",
    date: TODAY,
  });
  return {
    household: waiting.household,
    expenseId: expense.postedIds[0]!,
    confirmationId: confirmation.postedIds[0]!,
    waitingId: waiting.postedIds[0]!,
  };
}

function mount(
  reading: ClerkReadingRecord,
  household: Household,
  onOpenRecord?: (target: ClerkRecordRef) => void,
) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(ClerkReading, { reading, household, onOpenRecord }));
  });
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function sentenceButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>("[data-clerk-sentence]")];
}

function disclosedIds(host: HTMLElement, sentenceId: string): { transactions: string[]; fundEvents: string[] } {
  const region = host.querySelector(`#clerk-rows-${sentenceId}`);
  const rows = [...(region?.querySelectorAll<HTMLElement>("[data-clerk-row]") ?? [])];
  return {
    transactions: rows.filter((row) => row.dataset.clerkKind === "transaction").map((row) => row.dataset.clerkRow!),
    fundEvents: rows.filter((row) => row.dataset.clerkKind === "fund-event").map((row) => row.dataset.clerkRow!),
  };
}

describe("clerk citations", () => {
  it("reaches every Slice 1 sentence in DOM order", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    const view = mount(reading, scenario.household);
    const buttons = sentenceButtons(view.host);
    expect(buttons.map((button) => button.dataset.clerkSentence)).toEqual(reading.sentences.map((row) => row.id));
    expect(buttons.map((button) => button.getAttribute("aria-expanded"))).toEqual(["false", "false", "false"]);
    expect(view.host.querySelector("[role='dialog']")).toBeNull();
    expect(view.host.querySelector("dialog")).toBeNull();
    view.unmount();
  });

  it("reveals the associated inline region from pointer, Enter, and Space", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    const view = mount(reading, scenario.household);
    const [pointer, enter, space] = sentenceButtons(view.host);
    expect(pointer && enter && space).toBeTruthy();
    expect([pointer, enter, space].every((button) => button!.type === "button")).toBe(true);

    act(() => { pointer!.click(); });
    expect(pointer!.getAttribute("aria-expanded")).toBe("true");
    expect(pointer!.getAttribute("aria-controls")).toBe(`clerk-rows-${pointer!.dataset.clerkSentence}`);
    expect(view.host.querySelector(`#${pointer!.getAttribute("aria-controls")}`)?.hasAttribute("hidden")).toBe(false);

    act(() => {
      enter!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      enter!.click();
    });
    expect(enter!.getAttribute("aria-expanded")).toBe("true");

    act(() => {
      space!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
      space!.click();
    });
    expect(space!.getAttribute("aria-expanded")).toBe("true");
    expect(view.host.querySelectorAll("[data-clerk-sentence][aria-expanded='true']")).toHaveLength(3);
    view.unmount();
  });

  it("reveals exactly the sentence citation ids, in order, with no extras", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    const opened: ClerkRecordRef[] = [];
    const view = mount(reading, scenario.household, (target) => opened.push(target));

    for (const sentence of reading.sentences) {
      const button = view.host.querySelector<HTMLButtonElement>(`[data-clerk-sentence="${sentence.id}"]`)!;
      act(() => { button.click(); });
      expect(disclosedIds(view.host, sentence.id)).toEqual({
        transactions: sentence.transactionIds,
        fundEvents: sentence.fundEventIds,
      });
    }

    const openButtons = [...view.host.querySelectorAll<HTMLButtonElement>(".clerk-open")];
    const names = openButtons.map((button) => button.getAttribute("aria-label"));
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);

    const expenseOpen = view.host.querySelector<HTMLButtonElement>(`[data-clerk-row="${scenario.expenseId}"] .clerk-open`);
    act(() => { expenseOpen?.click(); });
    expect(opened).toEqual([{ kind: "transaction", id: scenario.expenseId }]);
    view.unmount();
  });

  it("keeps focus on the sentence control while toggling and switching disclosures", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    const view = mount(reading, scenario.household);
    const [first, second] = sentenceButtons(view.host);
    act(() => { first!.focus(); first!.click(); });
    expect(document.activeElement).toBe(first);
    expect(first!.getAttribute("aria-expanded")).toBe("true");
    act(() => { second!.focus(); second!.click(); });
    expect(document.activeElement).toBe(second);
    expect(first!.getAttribute("aria-expanded")).toBe("true");
    expect(second!.getAttribute("aria-expanded")).toBe("true");
    act(() => { first!.focus(); first!.click(); });
    expect(document.activeElement).toBe(first);
    expect(first!.getAttribute("aria-expanded")).toBe("false");
    expect(second!.getAttribute("aria-expanded")).toBe("true");
    view.unmount();
  });

  it("drops a sentence that cites nothing", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    const view = mount({
      ...reading,
      sentences: [
        ...reading.sentences,
        { id: "empty-claim", text: "This claim has no rows.", transactionIds: [], fundEventIds: [] },
      ],
    }, scenario.household);
    expect(sentenceButtons(view.host).map((button) => button.dataset.clerkSentence)).toEqual(
      reading.sentences.map((row) => row.id),
    );
    expect(view.host.textContent).not.toContain("This claim has no rows.");
    view.unmount();
  });

  it("withholds a sentence with a missing citation without widening the supplied household", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    const expenses = reading.sentences.find((row) => row.id === "expenses")!;
    const supported = reading.sentences.find((row) => row.id !== "expenses")!;
    const view = mount({
      ...reading,
      sentences: [supported, { ...expenses, transactionIds: ["TXN-NOT-IN-SCOPE"] }],
    }, scenario.household);
    expect(sentenceButtons(view.host).map((button) => button.dataset.clerkSentence)).toEqual([supported.id]);
    expect(view.host.querySelector("[data-clerk-integrity]")?.textContent).toContain(
      "This citation isn't in the record I was given.",
    );
    expect(view.host.textContent).not.toContain(expenses.text);
    const narrower = { ...scenario.household, transactions: [], fundEvents: [] };
    const again = mount(reading, narrower);
    expect(sentenceButtons(again.host)).toEqual([]);
    expect(again.host.querySelector("[data-clerk-row]")).toBeNull();
    expect(again.host.querySelector("[data-clerk-state='integrity']")).not.toBeNull();
    expect(again.host.querySelectorAll("[data-clerk-integrity]")).toHaveLength(1);
    for (const sentence of reading.sentences) expect(again.host.textContent).not.toContain(sentence.text);
    view.unmount();
    again.unmount();
  });

  it("gives same-day duplicate transaction and Fund controls unique exact-row names", () => {
    const scenario = canonicalMonth();
    const duplicateExpense = postEntry(scenario.household, {
      date: "2026-09-03",
      type: "expense",
      amount: "120",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 12000, destinationAccountId: "ACC-VISA" },
    });
    const duplicateProposal = proposeHouseholdFundContribution(duplicateExpense.household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "40",
      date: TODAY,
    });
    const duplicateExpenseId = duplicateExpense.postedIds[0]!;
    const duplicateProposalId = duplicateProposal.postedIds[0]!;
    const reading: ClerkReadingRecord = {
      since: SINCE,
      today: TODAY,
      tiesToProjection: true,
      sentences: [{
        id: "same-day-records",
        text: "Two exact pairs of accepted rows are cited.",
        transactionIds: [scenario.expenseId, duplicateExpenseId],
        fundEventIds: [scenario.waitingId, duplicateProposalId],
      }],
    };
    const view = mount(reading, duplicateProposal.household, () => undefined);
    act(() => { sentenceButtons(view.host)[0]!.click(); });
    const openButtons = [...view.host.querySelectorAll<HTMLButtonElement>(".clerk-open")];
    const names = openButtons.map((button) => button.getAttribute("aria-label") ?? "");
    expect(openButtons).toHaveLength(4);
    expect(new Set(names).size).toBe(4);
    for (const id of [scenario.expenseId, duplicateExpenseId, scenario.waitingId, duplicateProposalId]) {
      expect(names.some((name) => name.includes(`record ${id}`))).toBe(true);
    }
    expect(names.every((name) => name.includes("$"))).toBe(true);
    view.unmount();
  });

  it("withholds an untied reading and keeps a tied empty reading calm", () => {
    const scenario = canonicalMonth();
    const guard = vi.spyOn(sharedLedgerStory, "sharedMonthCourse").mockReturnValue({
      tiesToProjection: false,
    } as ReturnType<typeof sharedLedgerStory.sharedMonthCourse>);
    const untied = clerkReading(scenario.household, SINCE, TODAY);
    guard.mockRestore();
    const withheld = mount(untied, scenario.household);
    expect(withheld.host.querySelector(".clerk-reading")?.getAttribute("data-clerk-state")).toBe("withheld");
    expect(sentenceButtons(withheld.host)).toEqual([]);
    expect(withheld.host.textContent).toContain("These rows don't tie to the ledger yet");
    expect(withheld.host.textContent).not.toContain("$120.00");
    withheld.unmount();

    const empty = mount(clerkReading(catalogHousehold(), SINCE, TODAY), catalogHousehold());
    expect(empty.host.querySelector(".clerk-reading")?.getAttribute("data-clerk-state")).toBe("empty");
    expect(sentenceButtons(empty.host)).toEqual([]);
    expect(empty.host.textContent).toContain("Nothing to read yet");
    empty.unmount();
  });

  it("opens a mixed-source disclosure from real canonical ids and stays a display-only leaf", () => {
    const scenario = canonicalMonth();
    const reading = clerkReading(scenario.household, SINCE, TODAY);
    const mixed: ClerkReadingRecord = {
      ...reading,
      sentences: [{
        id: "mixed-source",
        text: reading.sentences.map((row) => row.text).join(" "),
        transactionIds: reading.sentences.flatMap((row) => row.transactionIds),
        fundEventIds: reading.sentences.flatMap((row) => row.fundEventIds),
      }],
    };
    const view = mount(mixed, scenario.household);
    const button = sentenceButtons(view.host)[0]!;
    act(() => { button.click(); });
    expect(disclosedIds(view.host, "mixed-source")).toEqual({
      transactions: [scenario.expenseId],
      fundEvents: [scenario.confirmationId, scenario.waitingId],
    });
    expect(view.host.querySelector("[role='dialog']")).toBeNull();
    view.unmount();

    const component = readFileSync(join(process.cwd(), "src/ClerkReading.tsx"), "utf8");
    const styles = readFileSync(join(process.cwd(), "src/clerk-reading.css"), "utf8");
    expect(component).not.toMatch(/from ["'].*commands/);
    expect(component).not.toMatch(/core\/index/);
    for (const forbidden of [
      "postEntry",
      "fetch(",
      "localStorage",
      "indexedDB",
      "openai",
      "anthropic",
      "supabase",
      "XMLHttpRequest",
      "WebSocket",
      "should move",
      "you should",
      "work more",
    ]) {
      expect(component.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(component).toContain("the rows this came from");
  });
});
