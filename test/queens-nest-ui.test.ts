// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdHome } from "../src/HouseholdHome.tsx";
import { catalogHousehold, offerMove, openChapter, recordHouseholdFundReconciliation, recordRitualHeld, recordWin, respondToMove, type CommitResult, type Household } from "../src/core/index.ts";
import { movesForChapter, openChapterFor } from "../src/core/chapters.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

vi.mock("../src/kitty/KittyStage.tsx", () => ({ KittyStage: () => null }));
vi.mock("../src/kitty/studio/flat.tsx", () => ({ KittyFlat: () => createElement("svg", { "data-flat-kitty": true }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); delete (window as { matchMedia?: unknown }).matchMedia; });

const memberId = "MEM-001";
const REGIONS = ["crown", "vine", "face", "hands", "body", "belly", "protect", "build"] as const;

function seeded(): Household {
  let h = planLifeFixture("household");
  // Tie the Fund so the pulse can speak past "Checking" (fictional $4,000 in the shared savings, nothing personal).
  h = recordHouseholdFundReconciliation(h, { memberId, date: "2026-09-12", bankTotal: "4000", personalRemainder: "0" }).household;
  h = openChapter(h, { memberId, foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
  const ritual = h.rituals![0]!;
  h = recordRitualHeld(h, { memberId, ritualId: ritual.id, onDate: "2026-09-04" }).household;
  const opening = movesForChapter(h, openChapterFor(h)!.id)[0];
  if (opening) h = respondToMove(h, { memberId, moveId: opening.id, response: "decline" }).household;
  h = offerMove(h, { memberId: "MEM-002", chapterId: openChapterFor(h)!.id, text: "Confirm which payday the pre-rent check belongs to", needsAcknowledgment: true }).household;
  return h;
}

function wide(matches: boolean) {
  (window as { matchMedia?: unknown }).matchMedia = (query: string) => ({ matches: matches && query.includes("min-width: 720px"), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false });
}

async function render(household: Household, overrides: Partial<{ freshness: "current" | "stale" | "offline"; busy: boolean; onGo: ReturnType<typeof vi.fn>; onCommand: ReturnType<typeof vi.fn>; onOpenSetup: ReturnType<typeof vi.fn>; composition: "panels" | "queen" }> = {}) {
  const onGo = overrides.onGo ?? vi.fn();
  const onCommand = overrides.onCommand ?? vi.fn(async (fn: (h: Household) => CommitResult) => ({ ok: true, household: fn(household).household }));
  const onOpenSetup = overrides.onOpenSetup ?? vi.fn();
  await act(async () => root.render(createElement(HouseholdHome, {
    household, memberId, today: "2026-09-12", freshness: overrides.freshness ?? "current", busy: overrides.busy ?? false,
    onCommand, onGo, onOpenSetup, composition: overrides.composition ?? "queen",
  })));
  return { onGo, onCommand, onOpenSetup };
}
const region = (name: string) => host.querySelector<HTMLButtonElement>(`.queen-region--${name}`)!;

describe("The Queen's Nest — one body on Home", () => {
  it("keeps the approved panel Home when the flag is off", async () => {
    await act(async () => root.render(createElement(HouseholdHome, { household: seeded(), memberId, today: "2026-09-12", freshness: "current", busy: false, onCommand: vi.fn(), onGo: vi.fn(), onOpenSetup: vi.fn() })));
    expect(host.querySelector(".fund-pulse__button")).not.toBeNull();
    expect(host.querySelector(".queen-home")).toBeNull();
  });

  it("gives every region an accessible name, a real button, and keyboard focus", async () => {
    await render(seeded());
    expect(host.querySelector(".queen-home")).not.toBeNull();
    expect(host.querySelector(".fund-pulse__button")).toBeNull();
    expect(host.querySelector(".chapter-moment")).toBeNull();
    for (const name of REGIONS) {
      const button = region(name);
      expect(button, name).not.toBeNull();
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("aria-label") ?? "", name).toMatch(/\S/);
      expect(button.tabIndex, name).toBeGreaterThanOrEqual(0);
      button.focus();
      expect(document.activeElement, name).toBe(button);
    }
    for (const button of host.querySelectorAll<HTMLButtonElement>(".queen-bud, .queen-stone, .queen-move")) {
      expect(button.getAttribute("aria-label") ?? "").toMatch(/\S/);
      button.focus();
      expect(document.activeElement).toBe(button);
    }
    // The still is legible without motion: the face carries the pose in words.
    const face = region("face");
    const described = document.getElementById(face.getAttribute("aria-describedby")!)!;
    expect(described.textContent).toMatch(/eyes (open|closed)/);
    expect(face.getAttribute("aria-label")).toMatch(/^Face — /);
    expect(host.querySelector(".queen-caption")?.textContent).toMatch(/\S/);
  });

  it("routes every region to today's destinations and never invents one", async () => {
    const { onGo } = await render(seeded());
    await act(async () => region("crown").click());
    await act(async () => region("vine").click());
    await act(async () => region("body").click());
    await act(async () => region("hands").click());
    expect(onGo.mock.calls.map((call) => call[0])).toEqual(["together", "plan", "ledger", "plan"]);
    onGo.mockClear();
    await act(async () => host.querySelector<HTMLButtonElement>(".queen-stone")!.click());
    expect(onGo).toHaveBeenCalledWith("calendar");
    onGo.mockClear();
    await act(async () => region("face").click());
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(["ledger", "plan", "together", "more"]).toContain(onGo.mock.calls[0]![0]);
  });

  it("opens the existing gallery at the belly, the doors and a bud, with focus returning to the region", async () => {
    const h = seeded();
    await render(h);
    const belly = region("belly");
    belly.focus();
    await act(async () => belly.click());
    expect(document.querySelector(".kitty-room")).not.toBeNull();
    expect(document.querySelector(".nest-detail h2")?.textContent).toBe("Everyday");
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === "← Back to Home")!.click());
    expect(document.querySelector(".kitty-room")).toBeNull();
    expect(document.activeElement).toBe(belly);
    await act(async () => region("protect").click());
    expect(document.querySelector(".nest-detail h2")?.textContent).toBe("Protect");
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === "← Back to Home")!.click());
    await act(async () => region("build").click());
    expect(document.querySelector(".nest-detail h2")?.textContent).toBe("Build");
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === "← Back to Home")!.click());
    const bud = host.querySelector<HTMLButtonElement>(".queen-bud")!;
    const goal = h.goals.find((row) => `goal:${row.id}` === bud.dataset.bankId)!;
    await act(async () => bud.click());
    expect(document.querySelector(".kitty-bank-tabs [aria-pressed='true']")?.textContent).toContain(goal.name);
  });

  it("holds the one Move in her hands and lets it be done in one tap", async () => {
    const h = seeded();
    const { onCommand } = await render(h);
    const acknowledge = host.querySelector<HTMLButtonElement>(".queen-move")!;
    expect(acknowledge.textContent).toContain("I acknowledge this");
    await act(async () => acknowledge.click());
    expect(onCommand).toHaveBeenCalledTimes(1);
    const acknowledged = (onCommand.mock.calls[0]![0] as (current: Household) => CommitResult)(h).household;
    expect(acknowledged.moves!.find((row) => row.state === "offered")!.acknowledgedByMemberIds).toContain(memberId);
    await render(acknowledged, { onCommand });
    const done = host.querySelector<HTMLButtonElement>(".queen-move")!;
    expect(done.textContent).toContain("Done");
    await act(async () => done.click());
    const completed = (onCommand.mock.calls[1]![0] as (current: Household) => CommitResult)(acknowledged).household;
    expect(completed.moves!.some((row) => row.state === "done")).toBe(true);
  });

  it("shows empty hands, not placeholder content, when nothing needs doing", async () => {
    let h = openChapter(planLifeFixture("household"), { memberId, foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
    const opening = movesForChapter(h, openChapterFor(h)!.id)[0];
    if (opening) h = respondToMove(h, { memberId, moveId: opening.id, response: "decline" }).household;
    await render(h);
    expect(host.querySelector(".queen-move")).toBeNull();
    expect(host.querySelector(".queen-move-object")).toBeNull();
    expect(region("hands").getAttribute("aria-label")).toMatch(/empty/i);
    expect(host.querySelector(".queen-home")?.getAttribute("data-hands")).toBe("empty");
    await render(catalogHousehold());
    expect(host.querySelector(".queen-move")).toBeNull();
    expect(region("vine").getAttribute("aria-label")).toMatch(/no Chapter is open/i);
  });

  it("opens the setup doors from the first Chapter's Move without writing", async () => {
    const h = openChapter(catalogHousehold(), { memberId, foundationId: "see-our-shared-life" }).household;
    const { onOpenSetup, onCommand } = await render(h);
    await act(async () => host.querySelector<HTMLButtonElement>(".queen-move")!.click());
    expect(onOpenSetup).toHaveBeenCalledWith(h.charter ? "fund" : "charter");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("carries the still into the pose data: matte when stale, open eyes when something waits", async () => {
    const h = seeded();
    await render(h, { freshness: "stale" });
    const home = () => host.querySelector<HTMLElement>(".queen-home")!;
    expect(home().dataset.pulse).toBe("checking");
    expect(home().dataset.glaze).toBe("matte");
    expect(home().dataset.eyes).toBe("closed");
    await render(h);
    expect(home().dataset.pulse).toBe("needs-us");
    expect(home().dataset.eyes).toBe("open");
    expect(home().dataset.gaze).toBe("crown");
    expect(home().dataset.grave).toBe("false");
    expect(region("crown").getAttribute("aria-label")).toMatch(/waiting/);
  });

  it("shows fewer buds and stones on the phone and more with room in the office", async () => {
    wide(false);
    let h = seeded();
    await render(h);
    expect(host.querySelectorAll(".queen-bud").length).toBeLessThanOrEqual(2);
    expect(host.querySelectorAll(".queen-stone").length).toBeLessThanOrEqual(2);
    expect(host.querySelector(".queen-aside")).toBeNull();
    expect(host.querySelector(".queen-home--phone")).not.toBeNull();
    wide(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(h);
    expect(host.querySelector(".queen-home--wide")).not.toBeNull();
    expect(host.querySelectorAll(".queen-aside")).toHaveLength(2);
    expect(host.querySelector(".queen-presence")).not.toBeNull();
    h = recordWin(h, { memberId, level: "shared-win", title: "We chose the rent payday", at: "2026-09-12T10:00:00.000Z" }).household;
    await render(h);
    const bloom = host.querySelector<HTMLButtonElement>(".queen-bloom")!;
    expect(bloom.getAttribute("aria-label")).toContain("Keep as a Memory");
  });

  it("never opens with a figure: amounts sit inside accessible names as confirmation", async () => {
    await render(seeded());
    const opening = host.querySelector(".queen-identity")!.textContent ?? "";
    expect(opening).not.toMatch(/\$\d/);
    expect(host.querySelector(".queen-caption")?.textContent).not.toMatch(/\$\d/);
    expect(region("body").getAttribute("aria-label")).toMatch(/\$\d/);
    expect(region("protect").getAttribute("aria-label")).toMatch(/Protect \$[\d,.]+, Prepare \$[\d,.]+/);
  });
});
