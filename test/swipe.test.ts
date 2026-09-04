// @vitest-environment jsdom
import { Fragment, act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Swipe } from "../src/Swipe.tsx";
import {
  HOUSEHOLD_FUND_ID,
  SWIPE_COPY,
  addAccount,
  archiveAccount,
  cashFlowStatement,
  catalogHousehold,
  confirmHouseholdFundContribution,
  configureHouseholdFund,
  fundedMoneyUndoTarget,
  incomeStatement,
  monthSummary,
  observedSwipeCategories,
  postEntry,
  postHouseholdFundDirectDebit,
  proposeHouseholdFundContribution,
  projectHouseholdFund,
  projectLedgerExperience,
  resolveSwipeCardAccount,
  reversePostedMoney,
  setFundCardAccount,
  setGlanceAccount,
  undoLedgerConfirm,
  swipeBelongsOnSharedHome,
  swipeCategoryAccessibleName,
  swipeUndoScopeMatches,
  weekSummary,
  type Account,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";
const swipeSource = readFileSync(resolve(process.cwd(), "src/Swipe.tsx"), "utf8");
const swipeCore = readFileSync(resolve(process.cwd(), "src/core/swipe.ts"), "utf8");
const commandsSource = readFileSync(resolve(process.cwd(), "src/core/commands.ts"), "utf8");

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

function scoped(household: Household, memberId = BIANCA): Household {
  const experience = projectLedgerExperience(household, memberId, "household", TODAY);
  if (!experience.ok) throw new Error(experience.spoken);
  return experience.scopedHousehold;
}

function buy(
  household: Household,
  input: { date: string; amount: string; subcategoryId: string; createdBy?: string; accountId?: string },
): Household {
  return postEntry(household, {
    date: input.date,
    type: "expense",
    amount: input.amount,
    accountId: input.accountId ?? "ACC-VISA",
    subcategoryId: input.subcategoryId,
    createdBy: input.createdBy ?? BIANCA,
    visibility: "household",
    confirmDuplicate: true,
    funding: {
      fundId: HOUSEHOLD_FUND_ID,
      fundedCents: Math.round(Number(input.amount) * 100),
      destinationAccountId: input.accountId ?? "ACC-VISA",
    },
  }).household;
}

let root: Root;
let container: HTMLDivElement;

function renderSwipe(household: Household, handlers: {
  onPostCategory?: (input: { amount: string; subcategoryId: string }) => void;
  onMore?: (amount: string) => void;
  onClose?: () => void;
  error?: string;
  busy?: boolean;
} = {}) {
  act(() => {
    root.render(createElement(Swipe, {
      household: scoped(household),
      memberId: BIANCA,
      today: TODAY,
      busy: handlers.busy ?? false,
      error: handlers.error ?? "",
      onClose: handlers.onClose ?? (() => undefined),
      onPostCategory: handlers.onPostCategory ?? (() => undefined),
      onMore: handlers.onMore ?? (() => undefined),
    }));
  });
}

function padKey(label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll(".cad-pad-keys button"))
    .find((key) => key.getAttribute("aria-label") === label) as HTMLButtonElement | undefined;
  if (!button) throw new Error(`Missing pad key ${label}`);
  return button;
}

function enterButton(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button"))
    .find((key) => key.textContent === "Enter") as HTMLButtonElement | undefined;
  if (!button) throw new Error("Missing Enter");
  return button;
}

function tapPad(...labels: string[]) {
  for (const label of labels) {
    act(() => { padKey(label).click(); });
  }
}

describe("swipe selectors", () => {
  it("ranks observed purchase-funded categories by use, recency, then id", () => {
    let household = configuredFund();
    household = buy(household, { date: "2026-09-02", amount: "10", subcategoryId: "SUB-FOOD-GROCERIES" });
    household = buy(household, { date: "2026-09-03", amount: "11", subcategoryId: "SUB-TRANSPORT-FUEL" });
    household = buy(household, { date: "2026-09-04", amount: "12", subcategoryId: "SUB-FOOD-GROCERIES" });
    household = buy(household, { date: "2026-09-05", amount: "13", subcategoryId: "SUB-LIFE-PHONE" });
    const rows = observedSwipeCategories(scoped(household), BIANCA, TODAY);
    expect(rows[0]?.subcategoryId).toBe("SUB-FOOD-GROCERIES");
    expect(rows[0]?.useCount).toBe(2);
    expect(rows.map((row) => row.subcategoryId)).toContain("SUB-TRANSPORT-FUEL");
  });

  it("ignores refunds, reversals, duplicates, inactive categories, and partner-Personal history", () => {
    let household = configuredFund();
    household = buy(household, { date: "2026-09-02", amount: "20", subcategoryId: "SUB-FOOD-GROCERIES" });
    const grocery = household.transactions.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES")!;
    household = reversePostedMoney(household, grocery.id, { createdBy: BIANCA }).household;
    household = postEntry(household, {
      date: "2026-09-06",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      createdBy: JONATHAN,
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-09-07",
      type: "expense",
      amount: "9",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = buy(household, { date: "2026-09-08", amount: "15", subcategoryId: "SUB-LIFE-FUN" });
    household = {
      ...household,
      categories: household.categories.map((row) => row.id === "SUB-LIFE-FUN" ? { ...row, active: false } : row),
    };
    const rows = observedSwipeCategories(scoped(household, BIANCA), BIANCA, TODAY);
    expect(rows.every((row) => row.subcategoryId !== "SUB-FOOD-COFFEE")).toBe(true);
    expect(rows.every((row) => row.subcategoryId !== "SUB-LIFE-FUN")).toBe(true);
    expect(rows.find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES")?.useCount).toBe(1);
  });

  it("returns fewer than six and an empty list without inventing placeholders", () => {
    expect(observedSwipeCategories(scoped(configuredFund()), BIANCA, TODAY)).toEqual([]);
    let household = configuredFund();
    household = buy(household, { date: "2026-09-02", amount: "10", subcategoryId: "SUB-FOOD-GROCERIES" });
    household = buy(household, { date: "2026-09-03", amount: "11", subcategoryId: "SUB-TRANSPORT-FUEL" });
    expect(observedSwipeCategories(scoped(household), BIANCA, TODAY)).toHaveLength(2);
  });

  it("resolves a remembered card, a single visible credit, and refuses guesses", () => {
    const catalog = configuredFund();
    expect(resolveSwipeCardAccount(scoped(catalog), BIANCA).kind).toBe("ambiguous");
    const oneCard = archiveAccount(catalog, "ACC-MC").household;
    expect(resolveSwipeCardAccount(scoped(oneCard), BIANCA)).toEqual({ kind: "ready", accountId: "ACC-VISA" });
    const remembered = buy(catalog, { date: "2026-09-02", amount: "10", subcategoryId: "SUB-FOOD-GROCERIES", accountId: "ACC-MC" });
    expect(resolveSwipeCardAccount(scoped(remembered), BIANCA)).toEqual({ kind: "ready", accountId: "ACC-MC" });
    const stale = archiveAccount(remembered, "ACC-MC").household;
    expect(resolveSwipeCardAccount(scoped(stale), BIANCA)).toEqual({ kind: "ready", accountId: "ACC-VISA" });
  });

  it("uses the member's explicit Shared card choice before guessing among cards", () => {
    const glanceOnly = setGlanceAccount(configuredFund(), {
      memberId: BIANCA,
      accountId: "ACC-MC",
      createdBy: BIANCA,
    }).household;
    expect(resolveSwipeCardAccount(scoped(glanceOnly), BIANCA).kind).toBe("ambiguous");
    const household = setFundCardAccount(glanceOnly, {
      memberId: BIANCA,
      accountId: "ACC-MC",
      createdBy: BIANCA,
    }).household;
    expect(resolveSwipeCardAccount(scoped(household), BIANCA)).toEqual({ kind: "ready", accountId: "ACC-MC" });
  });

  it("ignores non-CAD and partner-Personal credit candidates", () => {
    let household = addAccount(configuredFund(), {
      name: "Jonathan card",
      kind: "credit",
      ownerMemberId: JONATHAN,
      scope: "personal",
    }).household;
    household = {
      ...household,
      accounts: household.accounts.map((account) => (
        account.id === "ACC-MC" ? { ...account, currency: "USD" as Account["currency"] } : account
      )),
    };
    expect(resolveSwipeCardAccount(scoped(household, BIANCA), BIANCA)).toEqual({ kind: "ready", accountId: "ACC-VISA" });
    expect(swipeBelongsOnSharedHome(BIANCA, BIANCA)).toBe(true);
    expect(swipeBelongsOnSharedHome(JONATHAN, BIANCA)).toBe(false);
  });
});

describe("swipe sheet", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("opens CadPad, refuses blank Enter, and posts through the callback once", () => {
    let household = archiveAccount(configuredFund(), "ACC-MC").household;
    household = buy(household, { date: "2026-09-02", amount: "10", subcategoryId: "SUB-FOOD-GROCERIES" });
    const posts: Array<{ amount: string; subcategoryId: string }> = [];
    renderSwipe(household, { onPostCategory: (input) => posts.push(input) });
    expect(enterButton().disabled).toBe(true);
    tapPad("1", "Add 00");
    expect(enterButton().disabled).toBe(false);
    act(() => { enterButton().click(); });
    const grocery = Array.from(container.querySelectorAll(".swipe-cat"))
      .find((button) => button.textContent === "Groceries") as HTMLButtonElement | undefined;
    if (!grocery) throw new Error("Missing Groceries");
    expect(grocery.getAttribute("aria-label")).toContain(swipeCategoryAccessibleName("$1.00", "Groceries").slice(0, 12));
    act(() => { grocery.click(); });
    expect(posts).toEqual([{ amount: "1.00", subcategoryId: "SUB-FOOD-GROCERIES" }]);
  });

  it("keeps More usable with zero history and does not invent categories", () => {
    const moreCalls: string[] = [];
    renderSwipe(archiveAccount(configuredFund(), "ACC-MC").household, { onMore: (amount) => moreCalls.push(amount) });
    tapPad("5", "Add 00");
    act(() => { enterButton().click(); });
    const labels = Array.from(container.querySelectorAll(".swipe-cat")).map((button) => button.textContent);
    expect(labels).toEqual([SWIPE_COPY.more]);
    act(() => {
      const more = Array.from(container.querySelectorAll(".swipe-cat"))
        .find((button) => button.textContent === SWIPE_COPY.more) as HTMLButtonElement | undefined;
      more?.click();
    });
    expect(moreCalls[0]).toBe("5.00");
  });

  it("closes on Escape without posting", () => {
    const closes: number[] = [];
    act(() => {
      root.render(createElement(Swipe, {
        household: scoped(configuredFund()),
        memberId: BIANCA,
        today: TODAY,
        busy: false,
        onClose: () => closes.push(1),
        onPostCategory: () => undefined,
        onMore: () => undefined,
      }));
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(closes).toEqual([1]);
  });

  it("lets a focused Close button own Enter instead of advancing the pad", () => {
    const closes: number[] = [];
    renderSwipe(configuredFund(), { onClose: () => closes.push(1) });
    tapPad("5", "Add 00");
    const close = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Close") as HTMLButtonElement | undefined;
    if (!close) throw new Error("Missing Close");
    close.focus();
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => { close.dispatchEvent(enter); });
    expect(enter.defaultPrevented).toBe(false);
    expect(container.querySelector(".swipe-grid")).toBeNull();
    act(() => { close.click(); });
    expect(closes).toEqual([1]);
  });

  it("keeps a rejected post visible and announced inside the active sheet", () => {
    renderSwipe(archiveAccount(configuredFund(), "ACC-MC").household, {
      error: "The local journal must finish validating before anything can change.",
    });
    const alert = container.querySelector<HTMLElement>("[role='alert']");
    expect(alert?.textContent).toContain("Nothing was posted.");
    expect(alert?.textContent).toContain("local journal");
    expect(alert?.textContent).toContain("try the category again");
    expect(container.querySelector(".cad-pad-label")?.textContent).toBe("Amount");
    expect([...container.querySelectorAll("h2, .cad-pad-label")]
      .filter((node) => node.textContent === SWIPE_COPY.title)).toHaveLength(1);
    expect(document.activeElement?.closest(".swipe-sheet")).not.toBeNull();
  });

  it("makes the background inert while open and restores it on close", () => {
    const props = {
      household: scoped(configuredFund()),
      memberId: BIANCA,
      today: TODAY as typeof TODAY,
      busy: false,
      onClose: () => undefined,
      onPostCategory: () => undefined,
      onMore: () => undefined,
    };
    act(() => {
      root.render(createElement(Fragment, null,
        createElement("button", { key: "behind", "data-behind": "true" }, "Behind"),
        createElement(Swipe, { key: "swipe", ...props }),
      ));
    });
    expect(container.querySelector("[data-behind]")?.hasAttribute("inert")).toBe(true);
    act(() => {
      root.render(createElement("button", { key: "behind", "data-behind": "true" }, "Behind"));
    });
    expect(container.querySelector("[data-behind]")?.hasAttribute("inert")).toBe(false);
  });
});

describe("swipe posting contract", () => {
  it("posts one purchase-funded claim without moving the Fund operating balance", () => {
    let household = archiveAccount(configuredFund(), "ACC-MC").household;
    const before = projectHouseholdFund(household, TODAY).operatingBalanceCents;
    const posted = postEntry(household, {
      date: TODAY,
      type: "expense",
      amount: "84.20",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 8420, destinationAccountId: "ACC-VISA" },
    });
    expect(posted.household.fundEvents?.at(-1)?.kind).toBe("purchase-funded");
    expect(projectHouseholdFund(posted.household, TODAY).operatingBalanceCents).toBe(before);
    expect(() => postEntry(household, {
      date: TODAY,
      type: "expense",
      amount: "84.20",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: JONATHAN,
      visibility: "household",
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 8420, destinationAccountId: "ACC-VISA" },
    })).toThrow(SWIPE_COPY.refusal);
  });

  it("reverses a funded post instead of deleting its append-only Fund claim", () => {
    const household = archiveAccount(configuredFund(), "ACC-MC").household;
    const before = projectHouseholdFund(household, TODAY);
    const posted = postEntry(household, {
      date: TODAY,
      type: "expense",
      amount: "84.20",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 8420, destinationAccountId: "ACC-VISA" },
    });
    const afterPost = projectHouseholdFund(posted.household, TODAY);
    expect(afterPost.transferDueCents).toBe(before.transferDueCents + 8420);
    expect(projectHouseholdFund(undoLedgerConfirm(posted.household, posted.undo).household, TODAY).transferDueCents)
      .toBe(afterPost.transferDueCents);

    const target = fundedMoneyUndoTarget(posted.household, posted.undo);
    expect(target).toMatch(/^TXN-/);
    const reversed = reversePostedMoney(posted.household, target!, { createdBy: BIANCA, reversalDate: TODAY });
    expect(projectHouseholdFund(reversed.household, TODAY).transferDueCents).toBe(before.transferDueCents);
    expect(reversed.household.fundEvents?.at(-1)?.kind).toBe("refund-funded");
    expect(monthSummary(reversed.household, "2026-09").expenseActualCents).toBe(0);
    expect(monthSummary(reversed.household, "2026-09").categories
      .find((row) => row.subcategoryId === "SUB-FOOD-GROCERIES")?.actualCents).toBe(0);
    expect(incomeStatement(reversed.household, "2026-09")).toMatchObject({
      expenseCents: 0,
      netCents: 0,
    });
    expect(cashFlowStatement(reversed.household, "2026-09").cardSpendCents).toBe(0);
    expect(weekSummary(reversed.household, TODAY)).toMatchObject({
      expenseCents: 0,
      byParty: [],
    });

    const reversalId = reversed.household.transactions.find((tx) => tx.reversalOfId === target)?.id;
    if (!reversalId) throw new Error("Missing funded reversal row");
    const reinstated = reversePostedMoney(reversed.household, reversalId, { createdBy: BIANCA, reversalDate: TODAY });
    expect(monthSummary(reinstated.household, "2026-09").expenseActualCents).toBe(8420);
    expect(cashFlowStatement(reinstated.household, "2026-09").cardSpendCents).toBe(8420);
  });

  it("nets refund and income reversals in reports and cash flow", () => {
    let household = archiveAccount(configuredFund(), "ACC-MC").household;
    const refund = postEntry(household, {
      date: TODAY,
      type: "refund",
      amount: "12.34",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    });
    const refundId = refund.postedIds.find((id) => id.startsWith("TXN-"));
    if (!refundId) throw new Error("Missing refund row");
    household = reversePostedMoney(refund.household, refundId, { createdBy: BIANCA }).household;

    const income = postEntry(household, {
      date: TODAY,
      type: "income",
      amount: "50",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    });
    const incomeId = income.postedIds.find((id) => id.startsWith("TXN-"));
    if (!incomeId) throw new Error("Missing income row");
    household = reversePostedMoney(income.household, incomeId, { createdBy: BIANCA }).household;

    expect(monthSummary(household, "2026-09")).toMatchObject({
      expenseActualCents: 0,
      incomeActualCents: 0,
      netActualCents: 0,
    });
    expect(cashFlowStatement(household, "2026-09")).toMatchObject({
      cardSpendCents: 0,
      operatingInCents: 0,
      netCashCents: 0,
    });
  });

  it("binds the ten-second Undo strip to one environment, household, and member", () => {
    const household = configuredFund();
    const strip = {
      token: {
        id: "ACT-swipe",
        label: "Swipe",
        snapshot: household,
        postedIds: ["TXN-swipe"],
        commandKind: "postEntry",
      },
      environment: "development" as const,
      householdId: household.householdId,
      memberId: BIANCA,
    };
    expect(swipeUndoScopeMatches(strip, "development", household.householdId, BIANCA)).toBe(true);
    expect(swipeUndoScopeMatches(strip, "production", household.householdId, BIANCA)).toBe(false);
    expect(swipeUndoScopeMatches(strip, "development", "HH-other", BIANCA)).toBe(false);
    expect(swipeUndoScopeMatches(strip, "development", household.householdId, JONATHAN)).toBe(false);
  });

  it("bounds funded Undo by command kind and preserves the explicit direct-debit route", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: BIANCA,
      contributorMemberId: BIANCA,
      amount: "100",
      date: TODAY,
    });
    household = confirmHouseholdFundContribution(proposal.household, {
      memberId: BIANCA,
      proposalEventId: proposal.postedIds[0]!,
    }).household;
    household = addAccount(household, {
      name: "Bianca debit savings",
      kind: "savings",
      scope: "personal",
      ownerMemberId: BIANCA,
    }).household;
    const source = household.accounts.find((account) => account.name === "Bianca debit savings")!;
    const direct = postHouseholdFundDirectDebit(household, {
      memberId: BIANCA,
      date: TODAY,
      amount: "25",
      accountId: source.id,
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    });
    const target = fundedMoneyUndoTarget(direct.household, direct.undo);
    expect(target).toMatch(/^TXN-/);
    const reversed = reversePostedMoney(direct.household, target!, { createdBy: BIANCA });
    expect(reversed.household.fundEvents?.at(-1)?.kind).toBe("refund-funded");
    expect(projectHouseholdFund(reversed.household, TODAY).transferCreditCents).toBe(2500);

    expect(() => fundedMoneyUndoTarget(direct.household, {
      ...direct.undo,
      commandKind: "futureFundCommand",
    })).toThrow("needs its recorded correction path");
    expect(fundedMoneyUndoTarget(household, {
      id: "ordinary",
      label: "ordinary",
      snapshot: household,
      postedIds: [],
      commandKind: "postEntry",
    })).toBeNull();
  });

  it("fences camera, files, OCR, writers, and a second Fund fold", () => {
    expect(swipeSource).not.toMatch(/camera|ocr|postEntry|commitHousehold|outbox|pglite|indexedDB/i);
    expect(swipeCore).not.toMatch(/\b(percent|ratio|share|camera|ocr)\b/i);
    expect(swipeSource).toContain("CadPad");
    expect(commandsSource).toContain("requireFundCustodian");
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const tillSource = readFileSync(resolve(process.cwd(), "src/Till.tsx"), "utf8");
    const swipeMount = appSource.slice(appSource.indexOf("{swipeOpen"), appSource.indexOf("{adding &&"));
    expect(tillSource).toContain("SWIPE_COPY.action");
    expect(appSource).toContain("submitSwipePurchase");
    expect(appSource).toContain("SWIPE_COPY.success");
    expect(appSource).toContain("<Till");
    expect(swipeMount).toContain("<Swipe");
    expect(swipeMount).toContain("error={swipeError}");
    expect(appSource).toContain("onError: (message)");
    expect(swipeMount).not.toMatch(/camera|ocr|file input|image/i);
    expect(appSource).toContain("adding={adding || swipeOpen}");
    const applyUndo = appSource.slice(appSource.indexOf("function applyUndo"), appSource.indexOf("async function runRestorePoint"));
    expect(applyUndo).toContain("fundedMoneyUndoTarget");
    expect(applyUndo).toContain("reversePostedMoney");
    expect(applyUndo).toContain("suppressUndo: Boolean(fundedTransactionId)");
    expect(applyUndo).toContain("swipeUndoScopeMatches");
    expect(appSource).toContain("!options?.suppressUndo");
    expect(appSource).toContain("activityBlocked={Boolean(adding || swipeOpen || confirm || guard || commandOpen)}");
    expect(readFileSync(resolve(process.cwd(), "src/swipe.css"), "utf8")).toContain("z-index: 32");
  });
});
