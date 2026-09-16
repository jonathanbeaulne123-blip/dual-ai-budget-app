// @vitest-environment jsdom
// Since #466 money reaches a bank through its Kitty Bank room, not the retired phone jar.
// These tests keep the old Fill safeguards on that room: exact CAD, nothing posts before
// review and Final Confirm, Personal stays private, and a shared bank is never funded
// straight from a cash account (only Fund surplus, confirmed by the custodian).
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KittyBanks } from "../src/KittyBanks.tsx";
import { fillDraftCents } from "../src/GoalFill.tsx";
import { type CommitResult, type Household, type LedgerView } from "../src/core/index.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

type Fn = (h: Household) => CommitResult;
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("button")];
const button = (text: string) => buttons().find(b => b.textContent?.trim() === text);
async function click(node: HTMLElement) { await act(async () => node.click()); }
async function setValue(node: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function openRoom(view: LedgerView, createdBy = "MEM-001") {
  const h = planLifeFixture(view);
  const goal = h.goals.find(g => g.name === "A slower week away")!;
  const queued: Fn[] = [];
  const onCommand = vi.fn((fn: Fn) => { queued.push(fn); return fn(h); });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const props = { household: h, booksHousehold: h, view, createdBy, environment: "development" as const, surface: "plan" as const, onCommand };
  await act(async () => root.render(createElement(KittyBanks, props)));
  await click(document.querySelector<HTMLButtonElement>('.nest-bank[data-bank-id="plan:everyday"]')!);
  await click(document.querySelector<HTMLButtonElement>(`.kitty-room .nest-bank[data-bank-id="goal:${goal.id}"]`)!);
  await click(button("Use money")!);
  const action = document.querySelector<HTMLElement>(".kitty-money-action")!;
  return { h, goal, host, root, props, queued, onCommand, action,
    amount: action.querySelector<HTMLInputElement>("input")!,
    close: async () => { await act(async () => root.unmount()); host.remove(); } };
}

describe("Kitty Bank room funding (formerly Claude's Fill)", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
  });
  afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

  it("preserves exact CAD and only posts a private transfer after review and Final Confirm", async () => {
    const m = await openRoom("personal");
    try {
      await setValue(m.amount, "12.51");
      await setValue(m.action.querySelector("select")!, "ACC-CHEQUING");
      await click(button("Review contribution")!);
      const dialog = document.querySelector('.sheet.guard[role="dialog"]')!;
      expect(dialog.textContent).toContain("Fund this bank");
      expect(dialog.textContent).toContain("$12.51");
      expect(dialog.textContent).toContain("Goals savings");
      expect(dialog.textContent).toContain("Personal · only you");
      expect(m.onCommand).not.toHaveBeenCalled();
      await click(button("Final Confirm")!);
      expect(m.onCommand).toHaveBeenCalledTimes(1);
      const funded = m.queued[0]!(m.h).household;
      const before = m.h.goals.find(g => g.id === m.goal.id)!.savedCents;
      expect(funded.goals.find(g => g.id === m.goal.id)!.savedCents).toBe(before + 1251);
      const transfers = funded.transactions.filter(tx => tx.type === "transfer" && !m.h.transactions.some(old => old.id === tx.id));
      expect(transfers.length).toBeGreaterThan(0);
      expect(transfers.every(tx => tx.visibility === "personal")).toBe(true);
    } finally { await m.close(); }
  });

  it("keeps invalid and unsafe sums, and a missing source, out of review", async () => {
    const m = await openRoom("personal");
    try {
      const review = () => button("Review contribution")!;
      await setValue(m.amount, "25");
      expect(review().disabled).toBe(true); // no source chosen yet
      await setValue(m.action.querySelector("select")!, "ACC-CHEQUING");
      expect(review().disabled).toBe(false);
      for (const value of ["", "0", "-1", "1.001", "Infinity", "900719925474099.99"]) {
        await setValue(m.amount, value);
        expect(review().disabled, value).toBe(true);
      }
      expect(m.onCommand).not.toHaveBeenCalled();
    } finally { await m.close(); }
  });

  it("refuses a reviewed contribution once the books have changed", async () => {
    const m = await openRoom("personal");
    try {
      await setValue(m.amount, "25");
      await setValue(m.action.querySelector("select")!, "ACC-CHEQUING");
      await click(button("Review contribution")!);
      await click(button("Final Confirm")!);
      const changed = structuredClone(m.h);
      changed.goals.find(g => g.id === m.goal.id)!.targetCents += 10000;
      expect(() => m.queued[0]!(changed)).toThrow(/changed/);
    } finally { await m.close(); }
  });

  it("never funds a shared bank from a cash account; only the custodian can reserve Fund money", async () => {
    const custodian = await openRoom("household", "MEM-001");
    try {
      expect(button("Review contribution")).toBeUndefined();
      expect(custodian.action.querySelector("select")).toBeNull();
      expect(custodian.action.textContent).toContain("Fund surplus available to allocate");
      await setValue(custodian.amount, "25");
      expect(button("Review Fund assignment")!.disabled).toBe(false);
    } finally { await custodian.close(); }
    const partner = await openRoom("household", "MEM-002");
    try {
      await setValue(partner.amount, "25");
      expect(button("Review Fund assignment")!.disabled).toBe(true);
      expect(partner.action.textContent).toContain("The Fund custodian confirms shared assignments.");
    } finally { await partner.close(); }
  });
});

describe("exact Fill draft parsing", () => {
  it("keeps cents and refuses precision loss", () => {
    expect(fillDraftCents("12.51")).toBe(1251); expect(fillDraftCents("0")).toBe(0);
    expect(fillDraftCents("12.5")).toBe(1250); expect(fillDraftCents("12.511")).toBeNull();
    expect(fillDraftCents("900719925474099.99")).toBeNull();
    expect(fillDraftCents("90071992547409.90")).toBeNull(); // canonical floating parser would change this by one cent
    expect(fillDraftCents("1.")).toBeNull();
  });
});
