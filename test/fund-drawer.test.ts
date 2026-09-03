// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FUND_DRAWER_INTRO, FUND_WIDGET_CARD, FundDrawer, fundDrawerCards } from "../src/FundDrawer.tsx";
import {
  FUND_WIDGETS,
  catalogHousehold,
  configureHouseholdFund,
  railFor,
  setFundRailSlot,
  type CommitResult,
  type Household,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const drawerSource = readFileSync(resolve(process.cwd(), "src/FundDrawer.tsx"), "utf8");

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

let root: Root;
let container: HTMLDivElement;

function renderDrawer(household: Household, handlers: {
  memberId?: string;
  busy?: boolean;
  onKitchen?: (fn: (current: Household) => CommitResult) => void;
  onClose?: () => void;
} = {}) {
  act(() => {
    root.render(createElement(FundDrawer, {
      household,
      memberId: handlers.memberId ?? BIANCA,
      busy: handlers.busy ?? false,
      onKitchen: handlers.onKitchen ?? (() => undefined),
      onClose: handlers.onClose ?? (() => undefined),
    }));
  });
}

function cardButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll(".fund-drawer-card"));
}

function cardButton(name: string): HTMLButtonElement {
  const button = cardButtons().find((row) => row.querySelector(".fund-drawer-card-name")?.textContent === name);
  if (!button) throw new Error(`Missing drawer card ${name}`);
  return button;
}

function slotButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll(".fund-drawer-slot"));
}

describe("fundDrawerCards", () => {
  it("scopes the Ask to the member it computes for and leaves every other widget in view", () => {
    const household = configuredFund();
    const custodian = fundDrawerCards(household, BIANCA);
    const contributor = fundDrawerCards(household, JONATHAN);
    expect(custodian).toHaveLength(FUND_WIDGETS.length - 1);
    expect(contributor).toHaveLength(FUND_WIDGETS.length);
    expect(custodian.some((row) => row.id === "ask")).toBe(false);
    expect(contributor.some((row) => row.id === "ask")).toBe(true);
    // The Level stays visible — it refuses a move at the command layer, not by being hidden.
    expect(custodian.some((row) => row.id === "level" && row.onRail)).toBe(true);
    expect(custodian.filter((row) => row.onRail)).toHaveLength(8);
    expect(contributor.filter((row) => row.onRail)).toHaveLength(8);
  });

  it("carries a name and a one-line description for every widget in the library", () => {
    for (const id of FUND_WIDGETS) {
      expect(FUND_WIDGET_CARD[id].name.length).toBeGreaterThan(0);
      expect(FUND_WIDGET_CARD[id].line.length).toBeGreaterThan(0);
    }
  });
});

describe("the Fund drawer", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("opens on the card list with the exact first line, never locked or earned", () => {
    renderDrawer(configuredFund());
    expect(container.querySelector(".fund-drawer-intro")?.textContent).toBe(FUND_DRAWER_INTRO);
    expect(cardButtons()).toHaveLength(FUND_WIDGETS.length - 1);
  });

  it("marks the Ask 'your desk only' for the contributor and tags the rail for everyone else", () => {
    renderDrawer(configuredFund(), { memberId: JONATHAN });
    const ask = cardButton("The Ask");
    expect(ask.querySelector(".fund-drawer-card-tag")?.textContent).toBe("your desk only");
    const level = cardButton("The Level");
    expect(level.querySelector(".fund-drawer-card-tag")?.textContent).toBe("on the rail");
    expect(level.className).toContain("is-on-rail");
  });

  it("picks a card, then a slot, and arranges through onKitchen exactly once", () => {
    const results: Household[] = [];
    const household = configuredFund();
    renderDrawer(household, {
      onKitchen: (fn) => { results.push(fn(household).household); },
    });
    act(() => { cardButton("The accounts").click(); });
    expect(container.querySelector(".fund-drawer-slots-lede")?.textContent).toContain("The accounts");
    const slots = slotButtons();
    expect(slots).toHaveLength(8);
    expect(slots[0]?.textContent).toContain("pinned");
    act(() => { slots[2]!.click(); });
    expect(results).toHaveLength(1);
    expect(railFor(results[0]!, BIANCA)[2]).toBe("accounts");
    // Two taps, then back to the library — no lingering slot picker.
    expect(container.querySelector(".fund-drawer-slots-lede")).toBeNull();
  });

  it("lets 'choose a different widget' return to the card list without touching the household", () => {
    let calls = 0;
    renderDrawer(configuredFund(), { onKitchen: () => { calls += 1; } });
    act(() => { cardButton("This week").click(); });
    const cancel = container.querySelector(".fund-drawer-slots-cancel") as HTMLButtonElement;
    act(() => { cancel.click(); });
    expect(calls).toBe(0);
    expect(cardButtons().length).toBeGreaterThan(0);
  });

  it("returns to the board on 'Back to the board'", () => {
    let closed = false;
    renderDrawer(configuredFund(), { onClose: () => { closed = true; } });
    const back = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Back to the board");
    act(() => { back?.click(); });
    expect(closed).toBe(true);
  });

  it("disables every button while busy", () => {
    renderDrawer(configuredFund(), { busy: true });
    expect(cardButtons().every((button) => button.disabled)).toBe(true);
  });

  it("offers slot one, and the pinned Level refuses it through the real command", () => {
    // The drawer forwards every slot tap to the same command the rail uses —
    // it does not duplicate the refusal itself.
    const household = configuredFund();
    expect(() => setFundRailSlot(household, {
      memberId: BIANCA, createdBy: BIANCA, slot: 1, widgetId: "accounts",
    })).toThrow("The Fund stays at the top of the board.");
  });

  it("reflects the member's actual rail order in the slot picker", () => {
    const household = configuredFund();
    renderDrawer(household, { memberId: JONATHAN });
    act(() => { cardButton("The shape").click(); });
    const names = slotButtons().map((button) => button.querySelector(".fund-drawer-slot-name")?.textContent ?? "");
    const rail = railFor(household, JONATHAN);
    expect(names.map((name) => name.replace(" · pinned", ""))).toEqual(rail.map((id) => FUND_WIDGET_CARD[id].name));
  });
});

describe("the drawer's fences", () => {
  it("never posts or settles, and every arrangement goes through onKitchen", () => {
    expect(drawerSource).not.toMatch(/\b(postEntry|postTransfer|confirmHouseholdFundSettlement|confirmHouseholdFundContribution)\s*\(/);
    // The only write this component can make is arranging its own caller's board,
    // and it always goes through the injected onKitchen — never a bare call.
    expect(drawerSource).toContain("onKitchen((current) => setFundRailSlot(current,");
    expect(drawerSource.match(/setFundRailSlot\s*\(/g) ?? []).toHaveLength(1);
  });

  it("gates nothing — no premium, unlock, or paywall vocabulary", () => {
    expect(drawerSource).not.toMatch(/premium|unlock|paywall|subscription|\bgated\b/i);
  });

  it("uses real buttons everywhere, so the whole flow is keyboard-operable", () => {
    const interactive = drawerSource.match(/<(button|a|div)\b[^>]*onClick/g) ?? [];
    expect(interactive.every((tag) => tag.startsWith("<button"))).toBe(true);
  });
});
