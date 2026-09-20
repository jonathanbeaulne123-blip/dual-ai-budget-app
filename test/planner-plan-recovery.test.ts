// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, type CommandOutcome, type CommitResult, type Household, type PlanVersion } from "../src/core/index.ts";
import type { KitchenCommand } from "../src/kitchenCommand.ts";
import { Planner, type PlannerProps } from "../src/planner/Planner.tsx";
import { plannerPlanChoices } from "../src/planner/planReferences.ts";

const B = "MEM-001", J = "MEM-002", TODAY = "2026-09-19";
const line = (id: string, label: string) => ({ id, lens: "build" as const, kind: "goal-contribution" as const, labelSnapshot: label, amountCents: 10000, cadence: "monthly" as const, dueDate: "2026-09-30", responsibility: { kind: "member" as const, memberId: B }, assumptionIds: [], createdBy: B });
const version = (id: string, scope: "personal" | "household", ownerMemberId: string | undefined, state: PlanVersion["state"], label: string): PlanVersion => ({ id, scope, ...(ownerMemberId ? { ownerMemberId } : {}), monthKey: "2026-09", sequence: 1, lines: [line(`LINE-${id}`, label)], assumptions: [], reason: "Test", digest: `digest-${id}`, state, createdBy: ownerMemberId ?? B, createdAt: "2026-09-19T12:00:00.000Z", activatedAt: "2026-09-19T12:00:00.000Z" });
const plans = () => [version("PERSONAL-B", "personal", B, "active", "Bianca journey"), version("PERSONAL-J", "personal", J, "active", "Jonathan private"), version("HOUSE", "household", undefined, "active", "Shared trip"), version("OLD", "personal", B, "superseded", "Old private")];

let household: Household, host: HTMLDivElement, root: Root;
const accepted = (next: Household, result: CommitResult): CommandOutcome => ({ kind: "accepted-local", ok: true, household: next, previous: null, postedIds: result.postedIds, confirmationId: crypto.randomUUID(), identityHash: null, revision: next.revision, sharingMode: "local", errorClass: null, userMessage: null, retryable: false, postedExactlyOnce: true, postedNothing: false, recoveryAvailable: false });
const rejected = (): CommandOutcome => ({ kind: "rejected-no-write", ok: false, household, previous: household, postedIds: [], confirmationId: crypto.randomUUID(), identityHash: null, revision: household.revision, sharingMode: "local", errorClass: "validation-rejected", userMessage: "That task changed. Review it again.", retryable: false, postedExactlyOnce: false, postedNothing: true, recoveryAvailable: false });
const command = (mode: "accepted" | "rejected" = "accepted"): KitchenCommand => (fn) => { if (mode === "rejected") return rejected(); const result = fn(household); household = result.household; return accepted(household, result); };
const props = (view: "personal" | "household", mode: "accepted" | "rejected" = "accepted"): PlannerProps => ({ household, memberId: B, view, today: TODAY, busy: false, onCommand: command(mode), onRecord: vi.fn() });
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === name || row.getAttribute("aria-label") === name)!;
const labelControl = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(name: string) => [...host.querySelectorAll<HTMLLabelElement>("label")].find((row) => row.textContent?.startsWith(name))!.querySelector<T>("input,textarea,select")!;
async function render(view: "personal" | "household", mode: "accepted" | "rejected" = "accepted") { await act(async () => root.render(createElement(Planner, props(view, mode)))); }
async function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string | boolean) { await act(async () => { if (element instanceof HTMLInputElement && element.type === "checkbox") { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")!.set!.call(element, value); element.dispatchEvent(new Event("change", { bubbles: true })); } else { const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); } }); }

beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); household = { ...catalogHousehold(), planVersions: plans() }; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Planner Plan links and local editor recovery", () => {
  it("offers only the active Plan for the task audience and clears the exact link on visibility change", async () => {
    expect(plannerPlanChoices(household, B, "personal").map((row) => row.label)).toEqual(["Bianca journey · 2026-09"]);
    expect(plannerPlanChoices(household, B, "household").map((row) => row.label)).toEqual(["Shared trip · 2026-09"]);
    await render("household");
    await act(async () => button("New task with details").click());
    const selector = labelControl<HTMLSelectElement>("Plan decision");
    expect([...selector.options].map((row) => row.text)).toEqual(["No Plan decision", "Shared trip · 2026-09"]);
    await change(selector, selector.options[1]!.value);
    expect(selector.value).not.toBe("");
    await act(async () => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((row) => row.parentElement?.textContent?.startsWith(" Just for me"))!.click());
    expect(labelControl<HTMLSelectElement>("Plan decision").value).toBe("");
    expect([...labelControl<HTMLSelectElement>("Plan decision").options].map((row) => row.text)).toEqual(["No Plan decision", "Bianca journey · 2026-09"]);
  });

  it("restores the exact task editor after reload and never opens it in another view", async () => {
    await render("household"); await act(async () => button("New task with details").click());
    await change(labelControl<HTMLInputElement>("Title"), "Book our ferry");
    await change(labelControl<HTMLTextAreaElement>("Notes"), "Call after the schedule opens");
    const selector = labelControl<HTMLSelectElement>("Plan decision"); await change(selector, selector.options[1]!.value);
    await act(async () => root.unmount()); host.replaceChildren(); root = createRoot(host);
    await render("household");
    expect(labelControl<HTMLInputElement>("Title").value).toBe("Book our ferry");
    expect(labelControl<HTMLTextAreaElement>("Notes").value).toBe("Call after the schedule opens");
    expect(labelControl<HTMLSelectElement>("Plan decision").value).not.toBe("");
    await render("personal");
    expect(host.querySelector('[aria-label="New task"]')).toBeNull();
    await render("household");
    expect(labelControl<HTMLInputElement>("Title").value).toBe("Book our ferry");
  });

  it("keeps fields and navigation after a rejected save, and labels an unavailable exact Plan link without rebinding", async () => {
    await render("personal", "rejected"); await act(async () => button("New task with details").click());
    await change(labelControl<HTMLInputElement>("Title"), "Keep this private journey step");
    const selector = labelControl<HTMLSelectElement>("Plan decision"); await change(selector, selector.options[1]!.value);
    await act(async () => button("Add task").click());
    expect(labelControl<HTMLInputElement>("Title").value).toBe("Keep this private journey step");
    expect(host.textContent).toContain("That task changed. Review it again.");
    await act(async () => root.unmount()); host.replaceChildren(); root = createRoot(host);
    household = { ...household, planVersions: household.planVersions!.map((row) => row.id === "PERSONAL-B" ? { ...row, state: "superseded" as const } : row) };
    await render("personal", "rejected");
    expect(labelControl<HTMLInputElement>("Title").value).toBe("Keep this private journey step");
    expect(labelControl<HTMLSelectElement>("Plan decision").selectedOptions[0]!.text).toContain("Unavailable Plan step");
    expect(host.textContent).toContain("It was not rebound to another decision.");
  });

  it("retries an interrupted quick capture with the same exact Task ID after reload", async () => {
    const attemptedIds: string[] = [];
    const interrupted: KitchenCommand = (fn) => { const preview = fn(household); attemptedIds.push(preview.household.tasks!.at(-1)!.id); return rejected(); };
    await act(async () => root.render(createElement(Planner, { ...props("personal"), onCommand: interrupted })));
    await change(host.querySelector<HTMLInputElement>("#planner-capture")!, "book the ferry friday");
    await act(async () => button("Add").click());
    expect(button("Retry same task")).toBeTruthy();
    await act(async () => root.unmount()); host.replaceChildren(); root = createRoot(host);
    await act(async () => root.render(createElement(Planner, { ...props("personal"), onCommand: interrupted })));
    expect(button("Retry same task")).toBeTruthy();
    await act(async () => button("Retry same task").click());
    expect(attemptedIds).toHaveLength(2);
    expect(attemptedIds[1]).toBe(attemptedIds[0]);
  });
});
