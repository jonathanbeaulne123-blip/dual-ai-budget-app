// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdHome } from "../src/HouseholdHome.tsx";
import { addGoal, openChapter, catalogHousehold, type Household, type CommitResult } from "../src/core/index.ts";
import { defaultGoalEnvelope } from "../src/core/goalEnvelopes.ts";
import type { KittyCommandOptions } from "../src/kitty/KittyBankRoom.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";
vi.mock("../src/kitty/KittyStage.tsx", () => ({ KittyStage: () => null }));
vi.mock("../src/kitty/studio/flat.tsx", () => ({ KittyFlat: () => createElement("svg", { "data-flat-kitty": true }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); sessionStorage.clear(); vi.restoreAllMocks(); });
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(row => row.textContent?.trim() === text)!;
const command = vi.fn(async (_fn: (h: Household) => CommitResult, _options?: KittyCommandOptions) => ({ ok: false, userMessage: "Synthetic rejected write" }));
async function render(household: Household, onOpenSetup = vi.fn(), busy = false) {
  await act(async () => root.render(createElement(HouseholdHome, { household, memberId: "MEM-001", today: "2026-09-12", freshness: "current", busy, onCommand: command, onGo: vi.fn(), onOpenSetup })));
}
async function click(text: string) { await act(async () => button(text).click()); }

describe("F-014 and F-015 Home actions", () => {
  it("opens each first Chapter setup destination without completing or writing anything", async () => {
    const h = openChapter(catalogHousehold(), { memberId: "MEM-001", foundationId: "see-our-shared-life" }).household;
    const snapshot = JSON.stringify(h), onOpenSetup = vi.fn(); command.mockClear();
    await render(h, onOpenSetup);
    const steps = [...host.querySelectorAll<HTMLButtonElement>(".chapter-setup button")];
    expect(steps).toHaveLength(2);
    await act(async () => { steps[0]!.click(); steps[1]!.click(); });
    expect(onOpenSetup.mock.calls).toEqual([["charter"], ["fund"]]);
    expect(command).not.toHaveBeenCalled(); expect(JSON.stringify(h)).toBe(snapshot);
    h.moves![0]!.text = "A custom question for our next conversation";
    await render(h, onOpenSetup);
    expect(host.querySelector(".chapter-setup")).toBeNull();
  });

  it("opens the exact second shared bank and restores focus to its Home portrait", async () => {
    const h = planLifeFixture("household"); command.mockClear(); await render(h);
    const banks = h.goals.map(goal => host.querySelector<HTMLButtonElement>(`[data-bank-id="goal:${goal.id}"]`)!); expect(banks.every(Boolean)).toBe(true);
    banks[1]!.focus(); await act(async () => banks[1]!.click());
    expect(document.querySelector(".kitty-bank-tabs [aria-pressed='true']")?.textContent).toContain("A slower week away");
    expect(button("← Back to Home")).toBeTruthy(); expect(command).not.toHaveBeenCalled();
    await click("← Back to Home"); expect(document.querySelector(".kitty-room")).toBeNull(); expect(document.activeElement).toBe(banks[1]);
  });

  it("keeps Personal and archived banks off Home and makes empty creation reachable", async () => {
    let h = addGoal(catalogHousehold(), { name: "Private bank", target: "500", shared: false, ownerMemberId: "MEM-001" }).household;
    await render(h); expect(host.textContent).not.toContain("Private bank");
    await click("Build your King"); expect(button("＋ New bank")).toBeTruthy(); await click("＋ New bank");
    expect(document.querySelector("form.kitty-folio h2")?.textContent).toBe("What are we making room for?");
    await click("← Back to Home");
    h = planLifeFixture("household"); h.goals.forEach(g => { g.envelope = { ...defaultGoalEnvelope(), archivedAt: "2026-09-12T10:00:00Z" }; });
    await render(h); expect(host.querySelectorAll(".nest-children .nest-bank--goal")).toHaveLength(0);
  });

  it("carries Final Confirm command identity through the Home gallery and keeps rejected review", async () => {
    command.mockClear(); await render(planLifeFixture("household"));
    await act(async () => host.querySelector<HTMLButtonElement>(".nest-children .nest-bank--goal")!.click()); await click("Use money");
    const label = [...document.querySelectorAll("label")].find(row => row.textContent?.trim() === "Amount (CAD)")!;
    const input = label.querySelector("input")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "25"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await click("Review Fund assignment"); expect(command).not.toHaveBeenCalled();
    await click("Final Confirm"); expect(command).toHaveBeenCalledTimes(1);
    expect(command.mock.calls[0]?.[1]).toMatchObject({ confirmationId: expect.any(String) });
    expect(document.body.textContent).toContain("Synthetic rejected write"); expect(button("Final Confirm")).toBeTruthy();
  });

  it("allows returning Home while global books validation locks money controls", async () => {
    await render(planLifeFixture("household"), vi.fn(), true);
    await click("Build your King");
    expect(button("＋ New bank").disabled).toBe(true);
    expect(button("← Back to Home").disabled).toBe(false);
    await click("← Back to Home"); expect(document.querySelector(".kitty-room")).toBeNull();
  });

  it("closes the old gallery when household identity changes", async () => {
    const h = planLifeFixture("household"); await render(h); await click("Build your King");
    await render({ ...h, householdId: "another-household" }); expect(document.querySelector(".kitty-room")).toBeNull();
  });
});
