// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { KittyBanks } from "../src/KittyBanks.tsx";
import { fillDraftCents } from "../src/GoalFill.tsx";
import { addGoal, formatCad, catalogHousehold, type CommitResult, type Household } from "../src/core/index.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function mount() {
  Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  const h = addGoal(catalogHousehold(), { name: "Newfoundland", target: 3000, shared: true }).household;
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const queued: ((h: Household) => CommitResult)[] = [];
  const props = { household: h, booksHousehold: h, view: "household" as const, createdBy: "MEM-001", environment: "development" as const, onCommand: (fn: (h: Household) => CommitResult) => queued.push(fn) };
  await act(async () => root.render(createElement(KittyBanks, props)));
  return { h, host, root, props, queued, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === text)!;
async function click(text: string) { await act(async () => button(text).click()); }
async function input(node: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function key(node: Element, name: string) { await act(async () => node.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: name }))); }
function pointer(node: Element, type: string, y: number) { const e = new Event(type, { bubbles: true }); Object.defineProperties(e, { pointerId: { value: 1 }, isPrimary: { value: true }, button: { value: 0 }, clientY: { value: y } }); node.dispatchEvent(e); }
describe("Claude's Fill", () => {
  it("starts with zero, preserves exact CAD and only posts after source review and Confirm", async () => {
    const m = await mount();
    try {
      expect(m.host.querySelector('[role="slider"]')!.getAttribute("aria-valuenow")).toBe("0");
      expect(m.host.querySelector('input[aria-label^="Contribution"]')).toBeNull();
      await click("Type it instead"); await input(m.host.querySelector<HTMLInputElement>('input[aria-label^="Contribution"]')!, "12.51");
      expect(m.host.querySelector(".fill-total")!.textContent).toBe("$12.51");
      expect(button("Review contribution").disabled).toBe(true);
      await input(m.host.querySelector("select")!, "ACC-CHEQUING");
      await click("Review contribution"); expect(m.queued).toHaveLength(0);
      expect(document.body.textContent).toContain("Scope: Shared"); await click("Confirm");
      expect(m.queued).toHaveLength(1);
      const result = m.queued[0]!(m.h);
      expect(result.household.goals[0]!.savedCents).toBe(1251);
      expect(result.household.transactions.filter(t => t.type === "transfer")).toHaveLength(2);
    } finally { await m.close(); }
  });
  it("funds a Personal goal from scoped display with the Shared vault only in accepted books", async () => {
    const m = await mount();
    try {
      let h = addGoal(m.h, { name: "Own journey", shared: false, ownerMemberId: "MEM-001", target: 100 }).household;
      h = { ...h, accounts: [...h.accounts, { ...h.accounts.find(a => a.id === "ACC-CHEQUING")!, id: "OWN-CASH", name: "Own cash", scope: "personal", ownerMemberId: "MEM-001" }] };
      const scoped = { ...h, accounts: h.accounts.filter(a => a.id === "OWN-CASH"), goals: h.goals.filter(g => !g.shared), transactions: [] };
      await act(async () => m.root.render(createElement(KittyBanks, { ...m.props, household: scoped, booksHousehold: h, view: "personal" })));
      await click(formatCad(2500)); await input(m.host.querySelector("select")!, "OWN-CASH"); await click("Review contribution");
      expect(document.body.textContent).toContain("Goals savings"); expect(document.body.textContent).toContain("Personal · only you");
      await click("Confirm"); const funded = m.queued[0]!(h).household;
      expect(funded.goals.find(g => !g.shared)!.savedCents).toBe(2500);
      expect(funded.transactions.filter(tx => tx.type === "transfer").every(tx => tx.visibility === "personal")).toBe(true);
    } finally { await m.close(); }
  });
  it("cancels pointer drafts exactly, traps Escape locally, and retains a typed value beyond the visual range", async () => {
    const m = await mount();
    try {
      await click("Type it instead"); await input(m.host.querySelector<HTMLInputElement>('input[aria-label^="Contribution"]')!, "1234.56");
      const jar = m.host.querySelector("svg")!;
      await act(async () => { pointer(jar, "pointerdown", 100); pointer(jar, "pointerup", 100); });
      expect(jar.getAttribute("aria-valuenow")).toBe("1234.56");
      await act(async () => { pointer(jar, "pointerdown", 100); pointer(jar, "pointermove", 150); });
      await act(async () => pointer(jar, "pointermove", 100)); expect(jar.getAttribute("aria-valuenow")).toBe("1234.56");
      await key(jar, "Escape"); expect(jar.getAttribute("aria-valuenow")).toBe("1234.56");
      await act(async () => { pointer(jar, "pointerdown", 100); pointer(jar, "pointermove", 150); pointer(jar, "pointercancel", 150); });
      expect(jar.getAttribute("aria-valuenow")).toBe("1234.56");
      await key(jar, "ArrowDown"); expect(jar.getAttribute("aria-valuenow")).toBe("1209.56");
      expect(m.queued).toHaveLength(0);
    } finally { await m.close(); }
  });
  it("drops stale review and rejects an already queued callback after a room switch", async () => {
    const m = await mount();
    try {
      await click(formatCad(2500)); await input(m.host.querySelector("select")!, "ACC-CHEQUING"); await click("Review contribution");
      const changed = structuredClone(m.h); changed.goals[0]!.name = "Changed goal";
      await act(async () => m.root.render(createElement(KittyBanks, { ...m.props, household: changed, booksHousehold: changed })));
      expect(button("Confirm")).toBeUndefined();
      await click(formatCad(2500)); await click("Review contribution"); await click("Confirm"); expect(m.queued).toHaveLength(1);
      await act(async () => m.root.render(createElement(KittyBanks, { ...m.props, view: "personal" })));
      expect(() => m.queued[0]!(changed)).toThrow(/changed/);
      expect(m.host.textContent).not.toContain("Changed goal");
    } finally { await m.close(); }
  });
  it("discards an active pointer when accepted goal facts change", async () => {
    const m = await mount();
    try {
      await click(formatCad(2500));
      const oldJar = m.host.querySelector("svg")!;
      await act(async () => { pointer(oldJar, "pointerdown", 100); pointer(oldJar, "pointermove", 60); });
      const changed = structuredClone(m.h); changed.goals[0]!.targetCents += 10000;
      await act(async () => m.root.render(createElement(KittyBanks, { ...m.props, household: changed, booksHousehold: changed })));
      const newJar = m.host.querySelector("svg")!;
      expect(newJar).not.toBe(oldJar); expect(newJar.getAttribute("aria-valuenow")).toBe("0");
      await act(async () => pointer(oldJar, "pointercancel", 60));
      expect(newJar.getAttribute("aria-valuenow")).toBe("0"); expect(m.queued).toHaveLength(0);
    } finally { await m.close(); }
  });
  it("keeps invalid and unsafe sums out of Confirm and preserves the desktop face", async () => {
    const m = await mount();
    try {
      await click("Type it instead");
      for (const value of ["", "-1", "1.001", "Infinity", "900719925474099.99"]) {
        await input(m.host.querySelector<HTMLInputElement>('input[aria-label^="Contribution"]')!, value);
        expect(button("Review contribution").closest("fieldset")!.disabled).toBe(true);
      }
      await act(async () => { Object.defineProperty(window, "innerWidth", { value: 720, configurable: true }); window.dispatchEvent(new Event("resize")); });
      expect(m.host.querySelector(".fill-jar")).toBeNull(); expect(m.host.querySelector(".paper-bank")).not.toBeNull();
    } finally { await m.close(); }
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
