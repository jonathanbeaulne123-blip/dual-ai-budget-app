// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Swipe } from "../src/Swipe.tsx";
import {
  HOUSEHOLD_FUND_ID,
  HOUSEHOLD_PURCHASE_CUSTODY_REFUSAL,
  SWIPE_COPY,
  addAccount,
  archiveAccount,
  catalogHousehold,
  configureHouseholdFund,
  observedSwipeCategories,
  postEntry,
  projectHouseholdFund,
  projectLedgerExperience,
  resolveSwipeCardAccount,
  reversePostedMoney,
  swipeBelongsOnSharedHome,
  swipeCategoryAccessibleName,
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
} = {}) {
  act(() => {
    root.render(createElement(Swipe, {
      household: scoped(household),
      memberId: BIANCA,
      today: TODAY,
      busy: false,
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

  it("ignores non-CAD and partner-Personal credit candidates", () => {
    let household = addAccount(configuredFund(), {
      name: "Jonathan card",
      kind: "credit",
      ownerMemberId: JONATHAN,
      scope: "personal",
    }).household;
    household = {
      ...household,
      accounts: household.accounts.map((account) => account.id === "ACC-MC" ? { ...account, currency: "USD" } : account),
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
      Array.from(container.querySelectorAll(".swipe-cat")).find((button) => button.textContent === SWIPE_COPY.more)?.click();
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
    })).toThrow(HOUSEHOLD_PURCHASE_CUSTODY_REFUSAL);
  });

  it("fences camera, files, OCR, writers, and a second Fund fold", () => {
    expect(swipeSource).not.toMatch(/camera|ocr|postEntry|commitHousehold|outbox|pglite|indexedDB/i);
    expect(swipeCore).not.toMatch(/\b(percent|ratio|share|camera|ocr)\b/i);
    expect(swipeSource).toContain("CadPad");
    expect(commandsSource).toContain("requireFundCustodian");
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const swipeMount = appSource.slice(appSource.indexOf("{swipeOpen"), appSource.indexOf("{adding &&"));
    expect(appSource).toContain("SWIPE_COPY.action");
    expect(appSource).toContain("submitSwipePurchase");
    expect(appSource).toContain("SWIPE_COPY.success");
    expect(swipeMount).toContain("<Swipe");
    expect(swipeMount).not.toMatch(/camera|ocr|file input|image/i);
  });
});
