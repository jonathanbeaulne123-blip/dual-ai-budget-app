// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, splitForSync, assembleHousehold, type CommandOutcome, type Household } from "../src/core/index.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import type { KitchenCommand } from "../src/kitchenCommand.ts";
vi.mock("../src/StatementSetup.tsx", () => ({ StatementSetup: () => createElement("div", null, "Statement draft") }));
import { AccountHistorySetup } from "../src/AccountHistorySetup.tsx";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { document.body.innerHTML = ""; localStorage.clear(); });
const memberId = "MEM-001";
function fixture() { const h = catalogHousehold("development"); h.accounts = h.accounts.filter(a => a.id === "ACC-CHEQUING"); return h; }
function button(host: HTMLElement, text: string) { const b = [...host.querySelectorAll("button")].find(b => b.textContent === text); expect(b, text).toBeDefined(); return b!; }
async function change(input: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); });
}
async function enterZero(host: HTMLElement) {
  await change(host.querySelector("select")!, "ACC-CHEQUING");
  await change(host.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!, "0");
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => button(host, "Review opening balance").click());
}
describe("reviewed history UI authority integration", () => {
  it("uses the persisted Final Confirm UUID through real v2 replay and recognizes its accepted zero receipt", async () => {
    let household = fixture(); const split = splitForSync(household, memberId);
    let state: AuthorityState = { sequence: 0, shared: split.shared, personal: new Map([[memberId, split.personal]]) };
    const scope: Scope = { environment: "development", householdId: household.householdId, memberId, subject: "auth-a", role: "owner", expires: Date.now() + 60000, aclEpoch: 1 };
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    let usedId = "";
    const onCommand: KitchenCommand = async (fn, options) => {
      usedId = options?.confirmationId ?? ""; expect(usedId).toMatch(/^[a-f0-9-]{36}$/);
      const preview = fn(household); const capture = capturedIntent(preview.household)!;
      expect((capture.steps[0]!.args[0] as { confirmationId: string }).confirmationId).toBe(usedId);
      const command = await commandFromCapture(capture, scope, usedId);
      const accepted = await prepareCommand(state, command, scope, () => {});
      state = { sequence: accepted.receipt.sequence, shared: accepted.shared, personal: new Map([[memberId, accepted.personal]]) };
      household = assembleHousehold(state.shared, state.personal.get(memberId) ?? null);
      render(); return { ok: true, household } as CommandOutcome;
    };
    function render() { root.render(createElement(AccountHistorySetup, { household, memberId, authUserId: "auth-a", view: "household", today: "2026-09-08", busy: false, onCommand })); }
    await act(async () => render()); await enterZero(host);
    expect(document.activeElement?.id).toBe("history-review-title");
    expect(host.querySelector("fieldset")?.disabled).toBe(true);
    const reviewStored = Object.keys(localStorage).find(k => k.startsWith("hearth:account-history-review:"))!;
    const beforeId = JSON.parse(localStorage.getItem(reviewStored)!).confirmationId;
    await act(async () => button(host, "Final Confirm — accept these books").click());
    for (let i = 0; i < 100 && !household.accountOpeningCheckpoints?.length && !host.querySelector('[role="alert"]'); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(host.querySelector('[role="alert"]')?.textContent).toBeUndefined();
    expect(usedId).toBe(beforeId);
    expect(household.transactions).toHaveLength(0);
    expect(household.accountOpeningCheckpoints?.[0]?.confirmationId).toBe(beforeId);
    expect(host.textContent).toContain("Accepted. These openings and reviewed movements are now in the books.");
    expect(host.textContent).not.toContain("Review changed.");
    act(() => root.unmount());
  });
  it("retains the same confirmation identity after a lost acknowledgement and reload", async () => {
    const household = fixture(); const host = document.createElement("div"); document.body.append(host); let root = createRoot(host);
    const ids: string[] = [];
    const onCommand: KitchenCommand = async (_fn, options) => { ids.push(options!.confirmationId!); return null; };
    const props = { household, memberId, authUserId: "auth-a", view: "household" as const, today: "2026-09-08", busy: false, onCommand };
    await act(async () => root.render(createElement(AccountHistorySetup, props))); await enterZero(host);
    await act(async () => button(host, "Final Confirm — accept these books").click());
    expect(host.textContent).toContain("Acceptance is not confirmed yet");
    act(() => root.unmount()); root = createRoot(host);
    await act(async () => root.render(createElement(AccountHistorySetup, props)));
    await act(async () => button(host, "Final Confirm — accept these books").click());
    expect(ids).toHaveLength(2); expect(ids[1]).toBe(ids[0]);
    act(() => root.unmount());
  });
  it("does not load another principal's saved review", async () => {
    const household: Household = fixture(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const props = { household, memberId, authUserId: "auth-a", view: "household" as const, today: "2026-09-08", busy: false, onCommand: async () => null };
    await act(async () => root.render(createElement(AccountHistorySetup, props))); await enterZero(host);
    await act(async () => root.render(createElement(AccountHistorySetup, { ...props, authUserId: "different-principal" })));
    expect(host.querySelector("#history-review-title")).toBeNull();
    act(() => root.unmount());
  });
});
