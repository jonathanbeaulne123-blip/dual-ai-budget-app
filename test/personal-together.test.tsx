// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { PersonalTogether } from "../src/house/PersonalTogether.tsx";
import type { Household } from "../src/core/types.ts";
import type { KitchenCommand } from "../src/kitchenCommand.ts";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const privateFolio = {
  version: 1 as const, ownerMemberId: "MEM-001", wishes: [{ version: 1 as const, id: "WISH-ONE", revision: 1, title: "Read by the window", intention: "An unhurried afternoon.", horizon: "season" as const, createdBy: "MEM-001", archived: false, references: [] }],
  experiences: [{ version: 1 as const, id: "EXPERIENCE-ONE", revision: 1, title: "Paint a small bowl", intention: "Take a class.", state: "dreaming" as const, horizon: "someday" as const, createdBy: "MEM-001", wishId: null, livedOn: null, references: [] }],
  notes: [], memories: [], placements: [], designs: [], shareReceipts: [],
};

function render(command: KitchenCommand) {
  const household = { ...catalogHousehold(), personalLife: privateFolio } as Household;
  return act(async () => root.render(createElement(PersonalTogether, {
    household, memberId: "MEM-001", identity: "ME", today: "2026-09-19", route: { room: "home", level: "middle", householdId: household.householdId, scope: "personal" }, busy: false,
    onCommand: command, onNavigate: vi.fn(), onOpenPlan: vi.fn(), onOpenCalendar: vi.fn(),
  })));
}

describe("PersonalTogether", () => {
  it("keeps a private save intent when no acknowledgement is supplied", async () => {
    const command = vi.fn<KitchenCommand>().mockReturnValue(undefined);
    await render(command);
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Save private page")!.click());
    expect(command).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Original intent retained");
    expect(host.textContent).not.toContain("Synchronized.");
    expect([...Object.keys(localStorage)].some(key => key.includes(":personal:intent"))).toBe(true);
  });

  it("requires a reviewed share copy and makes its local boundary visible", async () => {
    const command = vi.fn<KitchenCommand>().mockReturnValue({ kind: "accepted-local", ok: true } as any);
    await render(command);
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Review Share with Our Home")!.click());
    expect(host.textContent).toContain("This is the exact reviewed copy");
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Share this reviewed copy")!.click());
    expect(command).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Saved locally. Synchronization has not been confirmed.");
  });
});
