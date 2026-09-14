// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdHome } from "../src/HouseholdHome.tsx";
import { addGoal, addRecurrence, catalogHousehold, offerMove, openChapter, postEntry, recordHouseholdFundReconciliation, recordRitualHeld, respondToMove, type CommitResult, type Household } from "../src/core/index.ts";
import { movesForChapter, openChapterFor } from "../src/core/chapters.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

vi.mock("../src/kitty/KittyStage.tsx", () => ({ KittyStage: () => null }));
vi.mock("../src/kitty/studio/flat.tsx", () => ({ KittyFlat: () => createElement("svg", { "data-flat-kitty": true }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); sessionStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as { matchMedia?: unknown }).matchMedia; });

const memberId = "MEM-001";

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
  // Six fictional months of rent on the card, one that swelled, and a lidded Build bill plus an open goal for the loft.
  const rent = h.recurrences.find((row) => row.note === "Fictional rent")!;
  for (const [month, amount] of [["03", "900"], ["04", "900"], ["05", "900"], ["06", "1380"], ["07", "900"], ["08", "900"]] as const) {
    h = postEntry(h, { type: "expense", date: `2026-${month}-20`, amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional rent", createdBy: memberId, visibility: "household", source: "recurring", sourceId: rent.id, confirmDuplicate: true }).household;
  }
  h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-26", type: "expense", amount: "60", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional date night" }).household;
  h = addGoal(h, { name: "Fictional trip to the shore", target: "2000", shared: true, ownerMemberId: memberId }).household;
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
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const home = () => $(".queen-home");
const click = async (element: HTMLElement) => act(async () => { element.click(); });
const settle = async () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

describe("The Still Queen — emptiness and stillness", () => {
  it("keeps the approved panel Home when the flag is off", async () => {
    await act(async () => root.render(createElement(HouseholdHome, { household: seeded(), memberId, today: "2026-09-12", freshness: "current", busy: false, onCommand: vi.fn(), onGo: vi.fn(), onOpenSetup: vi.fn() })));
    expect(host.querySelector(".fund-pulse__button")).not.toBeNull();
    expect(host.querySelector(".queen-home")).toBeNull();
  });

  it("shows only her, one quiet line and the Move at rest — no tiles, no text on her body, no amounts", async () => {
    await render(seeded());
    expect(host.querySelector(".fund-pulse__button")).toBeNull();
    expect(host.querySelector(".home-doors")).toBeNull();
    const figure = $<HTMLButtonElement>(".queen-figure");
    expect(figure.tagName).toBe("BUTTON");
    expect(figure.getAttribute("aria-expanded")).toBe("false");
    expect(figure.querySelector("text")).toBeNull();
    expect(figure.textContent?.trim()).toBe("");
    const line = $(".queen-line");
    expect(line.textContent).toContain("Make Rent Boring");
    expect(line.querySelector(".queen-line__word")?.textContent).toMatch(/\S/);
    expect(host.querySelector(".queen-move")).not.toBeNull();
    // Nothing visible carries a dollar figure at rest; amounts live in accessible names as confirmation.
    const visible = [...host.querySelectorAll<HTMLElement>(".queen-field *:not(.sr-only)")].filter((el) => !el.closest(".sr-only") && !el.closest("[inert]")).map((el) => el.childNodes.length ? [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("") : "").join(" ");
    expect(visible).not.toMatch(/\$\d/);
    expect($(".queen-bank--protect .queen-bank__button").getAttribute("aria-label")).toMatch(/Protect \$[\d,.]+, Prepare \$[\d,.]+/);
    // The bank buttons are not on screen at rest: Protect and Build sit behind inert; What now is not rendered.
    expect($(".queen-bank--protect").hasAttribute("inert")).toBe(true);
    expect($(".queen-bank--build").hasAttribute("inert")).toBe(true);
    expect(host.querySelector(".queen-bank--queen .queen-bank__button")).toBeNull();
  });

  it("gives every door a real button, an accessible name and keyboard focus, in a sensible order", async () => {
    await render(seeded());
    const order = [...host.querySelectorAll<HTMLButtonElement>(".queen-field button")].filter((button) => !button.closest("[inert]"));
    expect(order.map((button) => button.className.split(" ")[0])).toEqual(["queen-door", "queen-figure", "queen-move", "queen-door"]);
    for (const button of order) {
      expect(button.getAttribute("aria-label") ?? "").toMatch(/\S/);
      button.focus();
      expect(document.activeElement).toBe(button);
    }
    expect($(".queen-door--together").getAttribute("aria-label")).toMatch(/^Together — /);
    expect($(".queen-door--status").getAttribute("aria-label")).toMatch(/^Status — /);
    // The still is legible without motion: the Queen is described in words, channel by channel.
    const described = document.getElementById($(".queen-figure").getAttribute("aria-describedby")!)!;
    expect(described.textContent).toMatch(/eyes (open|closed)/);
    expect(described.textContent).toMatch(/Crown/);
    expect(described.textContent).toMatch(/at her feet|Nothing dated/);
    expect(described.textContent).toMatch(/one Move|hands are empty/);
  });

  it("breathes the doors in when the empty field is tapped, then lets them fade", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await render(seeded());
    expect(home().classList.contains("is-revealed")).toBe(false);
    await click($(".queen-rings"));
    expect(home().classList.contains("is-revealed")).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1900); });
    expect(home().classList.contains("is-revealed")).toBe(false);
  });

  it("carries the still into the pose data: matte when stale, open eyes toward Together when something waits", async () => {
    const h = seeded();
    await render(h, { freshness: "stale" });
    expect(home().dataset.pulse).toBe("checking");
    expect(home().dataset.glaze).toBe("matte");
    expect(home().dataset.eyes).toBe("closed");
    expect($(".queen-line__word").textContent).toBe("checking");
    await render(h);
    expect(home().dataset.pulse).toBe("needs-us");
    expect(home().dataset.eyes).toBe("open");
    expect(home().dataset.gaze).toBe("crown");
    expect(home().dataset.grave).toBe("false");
    expect($(".queen-line__word").textContent).toBe("one thing needs us");
  });

  it("shows empty hands, not placeholder content, when nothing needs doing", async () => {
    let h = openChapter(planLifeFixture("household"), { memberId, foundationId: "make-rent-boring", at: "2026-09-01T12:00:00.000Z" }).household;
    const opening = movesForChapter(h, openChapterFor(h)!.id)[0];
    if (opening) h = respondToMove(h, { memberId, moveId: opening.id, response: "decline" }).household;
    await render(h);
    expect(host.querySelector(".queen-move")).toBeNull();
    expect(home().dataset.hands).toBe("empty");
    expect(document.getElementById($(".queen-figure").getAttribute("aria-describedby")!)!.textContent).toMatch(/hands are empty/i);
    expect([...host.querySelectorAll(".queen-field button")].filter((button) => !button.closest("[inert]"))).toHaveLength(3);
    await render(catalogHousehold());
    expect(host.querySelector(".queen-move")).toBeNull();
    expect($(".queen-line__chapter").textContent).toMatch(/\S/);
  });
});

describe("The Queen's world — the flat path is the whole reading", () => {
  it("renders every bank as the studio's own flat piece when there is no WebGL, and never shows an error or an empty box", async () => {
    // jsdom has no WebGL: `auto` must try, fail silently and leave the drawn figure and the flat portraits in place.
    await render(seeded());
    await settle();
    await settle();
    expect(home().dataset.world).toBe("flat");
    expect(host.querySelector(".queen-world")?.getAttribute("data-live")).toBe("false");
    expect(host.querySelector(".queen-render-note, .queen-error, [role=alert]")).toBeNull();
    expect(host.querySelector(".queen-svg")).not.toBeNull();
    await click($(".queen-figure"));
    const portraits = [...host.querySelectorAll<HTMLElement>(".queen-bank-portrait")];
    expect(portraits.map((el) => el.dataset.worldBank)).toEqual(expect.arrayContaining(["protect", "build"]));
    for (const portrait of portraits) {
      expect(portrait.querySelector("svg"), portrait.dataset.worldBank).not.toBeNull(); // KittyFlat is mocked to a bare svg in this file
      expect(["true", "false"]).toContain(portrait.dataset.fired);
    }
    expect(portraits.some((el) => el.dataset.worldBank?.startsWith("goal:"))).toBe(true);
    expect($(".queen-bank--build .queen-bank__button").getAttribute("aria-label")).toMatch(/Goals: Fictional trip to the shore/);
    expect(host.querySelector(".nest-prop")).toBeNull();
  });

  it("keeps the drawn figure as the flat still with every channel, and the 3D still only when the world is live", async () => {
    await render(seeded(), { });
    const described = document.getElementById($(".queen-figure").getAttribute("aria-describedby")!)!;
    expect(described.textContent).not.toMatch(/In the world:/);
    expect(described.textContent).toMatch(/Glazed|Matte/);
    expect(described.textContent).toMatch(/gold seam|No gold seams/);
    expect(described.textContent).toMatch(/vine/);
  });

  it("lets the couple dress her from Status and keeps the look without a kiln, on the shared King design", async () => {
    const h = seeded();
    const { onCommand } = await render(h);
    await click($(".queen-door--status"));
    expect($(".queen-look")).not.toBeNull();
    expect($(".queen-look").textContent).toMatch(/never fired/);
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-swatch")].find((row) => row.getAttribute("aria-label") === "Clay: rose")!);
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-look .queen-pick")].find((row) => row.textContent === "star")!);
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-look .queen-act")].find((row) => row.textContent === "Keep her look")!);
    expect(onCommand).toHaveBeenCalledTimes(1);
    const next = (onCommand.mock.calls[0]![0] as (current: Household) => CommitResult)(h).household;
    const king = next.kittyNestDesigns!.find((row) => row.bankKey === "king" && row.visibility === "household")!;
    expect(king.glaze).toBe("rose");
    expect(king.studio?.draft?.firedAt).toBeNull();
    expect(king.studio?.draft?.paint.base).toBe("rose");
    expect(king.studio?.draft?.paint.stamps.map((row) => `${row.part}:${row.kind}`)).toEqual(["body:star"]);
    expect(king.studio?.fired ?? []).toHaveLength(0);
    expect(king.setupCompletedAt).toBeNull();
    // No kiln control exists on her.
    expect([...host.querySelectorAll("button")].some((row) => /fire|kiln/i.test(row.textContent ?? ""))).toBe(false);
  });
});

describe("The Still Queen — two interactions, and they are different", () => {
  it("expands into three banks with a button above each, and collapses again", async () => {
    await render(seeded());
    await click($(".queen-figure"));
    expect(home().classList.contains("is-expanded")).toBe(true);
    expect($(".queen-figure").getAttribute("aria-expanded")).toBe("true");
    const buttons = [...host.querySelectorAll<HTMLButtonElement>(".queen-bank__button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["Protect", "What now", "Build"]);
    for (const button of buttons) {
      expect(button.closest("[inert]")).toBeNull();
      expect(button.getAttribute("aria-label") ?? "").toMatch(/\S/);
      button.focus();
      expect(document.activeElement).toBe(button);
    }
    expect(buttons[0]!.getAttribute("aria-label")).toMatch(/Protect \$[\d,.]+, Prepare \$[\d,.]+/);
    expect(buttons[1]!.getAttribute("aria-label")).toMatch(/Everyday \$[\d,.]+/);
    expect(buttons[2]!.getAttribute("aria-label")).toMatch(/Build \$[\d,.]+/);
    await click($(".queen-figure"));
    expect(home().classList.contains("is-expanded")).toBe(false);
    expect(host.querySelector(".queen-bank--queen .queen-bank__button")).toBeNull();
  });

  it("opens a peek from each bank button, and the same door again goes all the way in; the stair is the way back", async () => {
    await render(seeded());
    await click($(".queen-figure"));
    const protect = $<HTMLButtonElement>(".queen-bank--protect .queen-bank__button");
    await click(protect);
    const panel = $(".queen-panel");
    expect(home().dataset.open).toBe("protect");
    expect(panel.hasAttribute("inert")).toBe(false);
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.querySelector(".queen-panel__title")?.textContent).toBe("What arrives");
    expect(protect.getAttribute("aria-expanded")).toBe("true");
    expect(panel.textContent).toMatch(/Fictional rent/);
    // One gesture, two depths.
    await click(protect);
    expect(home().dataset.scene).toBe("cellar");
    expect(home().dataset.open).toBe("none");
    expect($(".queen-field").hasAttribute("inert")).toBe(true);
    const cellar = $(".queen-room--cellar");
    expect(cellar.hasAttribute("inert")).toBe(false);
    expect(cellar.querySelectorAll(".queen-jar-seat")).toHaveLength(12);
    expect(cellar.querySelector(".queen-jar.is-outlier")?.getAttribute("aria-label")).toMatch(/^Jun — swelled/);
    expect(cellar.querySelector(".queen-jar--ghost")).not.toBeNull();
    expect(cellar.textContent).not.toMatch(/\$\d/);
    await settle();
    expect(document.activeElement).toBe($(".queen-stair--up"));
    await click($(".queen-stair--up"));
    expect(home().dataset.scene).toBe("home");
    expect(home().classList.contains("is-expanded")).toBe(true);
    await settle();
    expect(document.activeElement).toBe($(".queen-bank--protect .queen-bank__button"));

    const build = $<HTMLButtonElement>(".queen-bank--build .queen-bank__button");
    await click(build);
    expect($(".queen-panel__title").textContent).toBe("What we chose");
    await click($(".queen-panel .queen-go--primary"));
    expect(home().dataset.scene).toBe("loft");
    const loft = $(".queen-room--loft");
    const goals = [...loft.querySelectorAll<HTMLButtonElement>(".queen-goal")];
    expect(goals.map((goal) => goal.className.includes("queen-goal--open") ? "open" : "lidded")).toEqual(["open", "lidded"]);
    await click(goals[1]!);
    expect(loft.querySelector(".queen-room__line")?.textContent).toMatch(/Lidded/);
    expect(loft.querySelector(".queen-go--primary")).toBeNull();
    await click(goals[0]!);
    expect(loft.querySelector(".queen-room__line")?.textContent).toMatch(/Open-mouthed/);
    expect(loft.querySelector(".queen-go--primary")?.textContent).toMatch(/Fictional trip to the shore/);
    await click($(".queen-stair--down"));
    expect(home().dataset.scene).toBe("home");

    await click($(".queen-bank--queen .queen-bank__button"));
    expect($(".queen-panel__title").textContent).toBe("What now");
    await click($(".queen-bank--queen .queen-bank__button"));
    expect(home().dataset.open).toBe("none");
    expect(home().dataset.scene).toBe("home");
  });

  it("keeps the money door: the peeks and rooms open the existing gallery at the same banks", async () => {
    const h = seeded();
    await render(h);
    await click($(".queen-figure"));
    await click($(".queen-bank--protect .queen-bank__button"));
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-panel .queen-go")].find((row) => row.textContent === "Open Protect in the banks")!);
    expect(document.querySelector(".kitty-room")).not.toBeNull();
    expect(document.querySelector(".nest-detail h2")?.textContent).toBe("Protect");
    await click([...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === "← Back to Home")!);
    expect(document.querySelector(".kitty-room")).toBeNull();
    await click($(".queen-bank--queen .queen-bank__button"));
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-panel .queen-go")].find((row) => row.textContent === "Open What now in the banks")!);
    expect(document.querySelector(".nest-detail h2")?.textContent).toBe("Everyday");
    await click([...document.querySelectorAll<HTMLButtonElement>("button")].find((row) => row.textContent?.trim() === "← Back to Home")!);
    await click($(".queen-bank--build .queen-bank__button"));
    await click($(".queen-panel .queen-go--primary"));
    await click($(".queen-room--loft .queen-goal--open"));
    await click($(".queen-room--loft .queen-go--primary"));
    const goal = h.goals.find((row) => row.name === "Fictional trip to the shore")!;
    expect(document.querySelector(".kitty-bank-tabs [aria-pressed='true']")?.textContent).toContain(goal.name);
  });

  it("holds the one Move at her hands and acts on it from Together, in one visible step", async () => {
    const h = seeded();
    const { onCommand } = await render(h);
    const move = $<HTMLButtonElement>(".queen-move");
    expect(move.getAttribute("aria-label")).toMatch(/^A Move is waiting: Confirm which payday/);
    await click(move);
    expect(home().dataset.open).toBe("together");
    const act1 = $<HTMLButtonElement>(".queen-panel .queen-act--primary");
    expect(act1.textContent).toBe("I acknowledge this");
    await click(act1);
    expect(onCommand).toHaveBeenCalledTimes(1);
    const acknowledged = (onCommand.mock.calls[0]![0] as (current: Household) => CommitResult)(h).household;
    expect(acknowledged.moves!.find((row) => row.state === "offered")!.acknowledgedByMemberIds).toContain(memberId);
    await render(acknowledged, { onCommand });
    expect($(".queen-panel .queen-act--primary").textContent).toBe("Done");
    await click($(".queen-panel .queen-act--primary"));
    const completed = (onCommand.mock.calls[1]![0] as (current: Household) => CommitResult)(acknowledged).household;
    expect(completed.moves!.some((row) => row.state === "done")).toBe(true);
    await render(completed, { onCommand });
    expect(host.querySelector(".queen-move")).toBeNull();
    expect(home().dataset.hands).toBe("empty");
  });

  it("opens the setup doors from the first Chapter's Move without writing", async () => {
    const h = openChapter(catalogHousehold(), { memberId, foundationId: "see-our-shared-life" }).household;
    const { onOpenSetup, onCommand } = await render(h);
    await click($(".queen-move"));
    await click($(".queen-panel .queen-act--primary"));
    expect(onOpenSetup).toHaveBeenCalledWith(h.charter ? "fund" : "charter");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("peeks Together and Status from the field doors and leads on to their rooms; Escape closes and collapses", async () => {
    const { onGo } = await render(seeded());
    await click($(".queen-door--together"));
    expect($(".queen-panel__title").textContent).toBe("Waiting on both of you");
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-panel .queen-go")].find((row) => row.textContent === "Go to Together")!);
    expect(onGo).toHaveBeenCalledWith("together");
    await click($(".queen-door--status"));
    expect(home().dataset.open).toBe("status");
    expect($(".queen-panel").textContent).toMatch(/Glazed|Matte/);
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-panel .queen-go")].find((row) => row.textContent === "Open the Status Centre")!);
    expect(onGo).toHaveBeenCalledWith("more");
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(home().dataset.open).toBe("none");
    await click($(".queen-figure"));
    expect(home().classList.contains("is-expanded")).toBe(true);
    await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(home().classList.contains("is-expanded")).toBe(false);
  });

  it("uses a sheet below 720 and a glass panel at or above it, from the edge opposite the door", async () => {
    wide(false);
    await render(seeded());
    expect(home().dataset.mode).toBe("sheet");
    expect(host.querySelector(".queen-home--phone")).not.toBeNull();
    await click($(".queen-door--together"));
    expect($(".queen-panel").getAttribute("aria-modal")).toBe("true");
    wide(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(seeded());
    expect(home().dataset.mode).toBe("panel");
    await click($(".queen-figure"));
    await click($(".queen-bank--build .queen-bank__button"));
    expect(home().dataset.side).toBe("left");
    await click($(".queen-bank--protect .queen-bank__button"));
    expect(home().dataset.side).toBe("right");
  });
});
