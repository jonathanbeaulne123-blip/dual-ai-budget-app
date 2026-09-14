// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdHome } from "../src/HouseholdHome.tsx";
import type { QueenShell } from "../src/queen/QueenHome.tsx";
import { addGoal, addRecurrence, catalogHousehold, offerMove, openChapter, postEntry, recordHouseholdFundReconciliation, recordRitualHeld, respondToMove, type CommitResult, type Household } from "../src/core/index.ts";
import { movesForChapter, openChapterFor } from "../src/core/chapters.ts";
import { saveKittyNestDesign } from "../src/core/kittyNestDesigns.ts";
import { queenCharmKindsEarned } from "../src/core/queenCharms.ts";
import { guardQueenDesignSave } from "../src/queen/world/queenAuthoring.ts";
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

async function render(household: Household, overrides: Partial<{ freshness: "current" | "stale" | "offline"; busy: boolean; onGo: ReturnType<typeof vi.fn>; onCommand: ReturnType<typeof vi.fn>; onOpenSetup: ReturnType<typeof vi.fn>; composition: "panels" | "queen"; shell: QueenShell }> = {}) {
  const onGo = overrides.onGo ?? vi.fn();
  const onCommand = overrides.onCommand ?? vi.fn(async (fn: (h: Household) => CommitResult) => ({ ok: true, household: fn(household).household }));
  const onOpenSetup = overrides.onOpenSetup ?? vi.fn();
  await act(async () => root.render(createElement(HouseholdHome, {
    household, memberId, today: "2026-09-12", freshness: overrides.freshness ?? "current", busy: overrides.busy ?? false,
    onCommand, onGo, onOpenSetup, composition: overrides.composition ?? "queen", shell: overrides.shell,
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

describe("The Queen's world page — the App's shell readings behind her Status door", () => {
  const shell = (attention: boolean): QueenShell & { sync: QueenShell["sync"] & { onAction: ReturnType<typeof vi.fn>; onOpenDetails: ReturnType<typeof vi.fn> }; onOpenOffice: ReturnType<typeof vi.fn>; onSwitchEnvironment: ReturnType<typeof vi.fn> } => ({
    member: "Alex (fictional)", household: "Fictional household", time: "Sep 12, 2026, 12:00 p.m.", timeIso: "2026-09-12T16:00:00.000Z", environment: "development",
    onSwitchEnvironment: vi.fn(),
    sync: { visible: true, transportPrimary: "Live", revisionLine: "rev 14", updatedLine: "Updated 3 hours ago", tone: attention ? "warning" : "neutral", attentionLabel: attention ? "Needs attention" : null, attentionDetail: attention ? "Sign in again to keep the household in step." : null, actionLabel: attention ? "Reconnect" : null, onAction: vi.fn(), onOpenDetails: vi.fn() },
    households: createElement("details", { className: "ledger-switcher" }, createElement("summary", null, "Switch household")),
    onOpenOffice: vi.fn(),
  });

  it("keeps the field exactly as it was when the App passes no shell", async () => {
    await render(seeded());
    expect($(".queen-door--status").dataset.attention).toBeUndefined();
    expect(host.querySelector(".queen-door__badge")).toBeNull();
    await click($(".queen-door--status"));
    expect(host.querySelector(".queen-shell")).toBeNull();
  });

  it("wears the App's 'Needs attention' on the Status door and opens its explanation and recovery in one tap", async () => {
    const s = shell(true);
    await render(seeded(), { shell: s });
    const door = $(".queen-door--status");
    expect(door.dataset.attention).toBe("true");
    expect(door.getAttribute("aria-label")).toMatch(/Needs attention/);
    expect($(".queen-door__badge").textContent).toBe("Needs attention");
    const order = [...host.querySelectorAll<HTMLButtonElement>(".queen-field button")].filter((button) => !button.closest("[inert]")).map((button) => button.className.split(" ")[0]);
    expect(order).toEqual(["queen-door", "queen-figure", "queen-move", "queen-door"]);
    await click(door);
    const panel = $(".queen-shell");
    expect(panel.dataset.attention).toBe("true");
    expect(panel.textContent).toMatch(/Needs attention\. Sign in again to keep the household in step\./);
    expect(panel.textContent).toMatch(/Alex \(fictional\) · Fictional household/);
    expect(panel.textContent).toMatch(/Live · rev 14 · Updated 3 hours ago/);
    expect(panel.textContent).toMatch(/Development/);
    expect(panel.querySelector(".ledger-switcher summary")?.textContent).toBe("Switch household");
    await click([...panel.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Reconnect")!);
    expect(s.sync.onAction).toHaveBeenCalledTimes(1);
    await click([...panel.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Sync help")!);
    expect(s.sync.onOpenDetails).toHaveBeenCalledTimes(1);
    await click(panel.querySelector<HTMLButtonElement>(".queen-shell__office")!);
    expect(s.onOpenOffice).toHaveBeenCalledTimes(1);
    await click([...panel.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Switch environment")!);
    expect(s.onSwitchEnvironment).toHaveBeenCalledTimes(1);
  });

  it("keeps the door quiet when nothing needs attention, with the readings still one tap away", async () => {
    await render(seeded(), { shell: shell(false) });
    expect($(".queen-door--status").dataset.attention).toBeUndefined();
    expect(host.querySelector(".queen-door__badge")).toBeNull();
    await click($(".queen-door--status"));
    expect($(".queen-shell").dataset.attention).toBe("false");
    expect(host.querySelector(".queen-shell__attention")).toBeNull();
    expect($(".queen-shell").textContent).toMatch(/Fictional household/);
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

describe("The Queen's charms — pressed on from Status, without a pointer, kept as you go", () => {
  const statusOpen = async (h: Household, overrides: Parameters<typeof render>[1] = {}) => { const handles = await render(h, overrides); await click($(".queen-door--status")); return handles; };
  const bin = () => [...host.querySelectorAll<HTMLButtonElement>(".queen-charm-pick")];
  const rows = () => [...host.querySelectorAll<HTMLButtonElement>(".queen-charm-row__pick")];
  const bench = (label: string) => [...host.querySelectorAll<HTMLButtonElement>(".queen-charm-bench button")].find((row) => (row.getAttribute("aria-label") ?? row.textContent)?.startsWith(label))!;
  const drawn = () => [...host.querySelectorAll<SVGGElement>(".queen-svg .queen-charm")];
  const still = () => document.getElementById($(".queen-figure").getAttribute("aria-describedby")!)!.textContent ?? "";

  it("offers the whole bin with earned and not-yet charms named as such, and an empty bench to begin", async () => {
    await statusOpen(seeded());
    expect($(".queen-charms-tool")).not.toBeNull();
    expect(bin()).toHaveLength(12);
    const earned = bin().filter((row) => !row.getAttribute("aria-disabled"));
    const notYet = bin().filter((row) => row.getAttribute("aria-disabled") === "true");
    // This fixture has done none of the earning acts yet, so the starters are the whole bin and each earned charm says what earns it.
    expect(earned.map((row) => row.textContent)).toEqual(["Cat", "Teapot", "Mushroom", "Boat", "Bird", "Die"]);
    expect(notYet.map((row) => row.getAttribute("aria-label"))).toEqual([
      "A paper airplane — not yet: earned by a travel goal filled and bought",
      "A coffee mug — not yet: earned by one Ritual held ten times",
      "A snail — not yet: earned by a Chapter closed after a hard month",
      "A key — not yet: earned by the Charter signed by both of you",
      "A bell — not yet: earned by the first Sitdown completed",
      "A spool of thread — not yet: earned by a correction mended — a gold seam",
    ]);
    expect($(".queen-charm-empty").textContent).toMatch(/Nothing on her yet/);
    expect(drawn()).toHaveLength(0);
    expect(still()).not.toMatch(/She wears/);
    // A not-yet charm does nothing when pressed: no bench, nothing on her.
    await click(notYet[3]!);
    expect(rows()).toHaveLength(0);
  });

  it("presses a charm onto a free seat from the keyboard, walks it with the arrows, and keeps it on the King's draft with the presser's name", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const h = seeded();
    const { onCommand } = await statusOpen(h);
    await click(bin().find((row) => row.textContent === "Cat")!);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.getAttribute("aria-label")).toBe("A sitting cat on her left flank, pressed on by Alex (fictional); selected, press her to move it");
    expect(rows()[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(drawn().map((el) => el.dataset.charm)).toEqual(["sitting-cat"]);
    expect(still()).toMatch(/She wears 1 charm: a sitting cat on her left flank\./);
    expect(home().dataset.charms).toBe("1");
    // The bench is real controls in a sensible order: Move · Turn · − · + · Lean · colours · Take off.
    const controls = [...host.querySelectorAll<HTMLButtonElement>(".queen-charm-bench > button")].map((row) => row.textContent);
    expect(controls).toEqual(["Move", "Turn", "−", "+", "Lean", "Take off"]);
    const before = drawn()[0]!.getAttribute("transform")!;
    const move = bench("Move with the arrow keys");
    move.focus();
    await act(async () => { move.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    const after = drawn()[0]!.getAttribute("transform")!;
    expect(after).not.toBe(before);
    expect(parseFloat(after.slice("translate(".length))).toBeGreaterThan(parseFloat(before.slice("translate(".length)));
    await click(bench("Turn"));
    expect(drawn()[0]!.getAttribute("transform")).toMatch(/rotate\(-30\)/);
    await click(bench("Bigger"));
    await click([...host.querySelectorAll<HTMLButtonElement>(".queen-charm-bench .queen-swatch")].find((row) => row.getAttribute("aria-label") === "Dory blue")!);
    expect(drawn()[0]!.querySelector<SVGPathElement>(".queen-charm__body")!.style.fill).toMatch(/#3f6fa3|rgb\(63, 111, 163\)/);
    // Kept as you go: one write after the last press, through the guard, to the household King.
    expect(onCommand).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(onCommand).toHaveBeenCalledTimes(1);
    const next = (onCommand.mock.calls[0]![0] as (current: Household) => CommitResult)(h).household;
    const king = next.kittyNestDesigns!.find((row) => row.bankKey === "king" && row.visibility === "household")!;
    expect(king.studio?.draft?.charms).toHaveLength(1);
    expect(king.studio?.draft?.charms?.[0]).toMatchObject({ kind: "sitting-cat", part: "body", spin: 30, scale: 1.2, color: "#3f6fa3", by: memberId });
    expect(king.studio?.draft?.firedAt).toBeNull();
    expect(king.studio?.draft?.charms?.[0]?.u).toBeGreaterThan(0.62);
    // Taking it off is one press and empties her.
    await click(bench("Take off"));
    expect(rows()).toHaveLength(0);
    expect(drawn()).toHaveLength(0);
    expect(still()).not.toMatch(/She wears/);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(onCommand).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("moves a picked-up charm to where she is pressed, and a press on a reserved zone leaves it where it can sit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await statusOpen(seeded());
    await click(bin().find((row) => row.textContent === "Bird")!);
    const target = $<HTMLButtonElement>(".queen-charm-target");
    expect(target.getAttribute("aria-label")).toBe("Press to move a small bird here; Enter moves it to the next free seat");
    expect(home().dataset.charmSelected).toBe("true");
    target.getBoundingClientRect = () => ({ x: 0, y: 0, width: 240, height: 340, top: 0, left: 0, right: 240, bottom: 340, toJSON() { return {}; } });
    const press = async (x: number, y: number) => act(async () => { target.dispatchEvent(new MouseEvent("pointerdown", { clientX: x, clientY: y, bubbles: true })); });
    await press(176, 250); // her right flank
    expect(rows()[0]!.getAttribute("aria-label")).toMatch(/A small bird on her right flank/);
    await press(120, 112); // her eye: it will not take; the bird stays on the flank
    expect(rows()[0]!.getAttribute("aria-label")).toMatch(/A small bird on her right flank/);
    await press(120, 60); // her crown: nothing there to press onto
    expect(rows()[0]!.getAttribute("aria-label")).toMatch(/A small bird on her right flank/);
    await press(90, 128); // her left cheek
    expect(rows()[0]!.getAttribute("aria-label")).toMatch(/A small bird on her left cheek/);
    // Enter on the target walks it to the next free keyboard seat; tapping the field puts the bin down.
    await act(async () => { target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 })); });
    expect(rows()[0]!.getAttribute("aria-label")).not.toMatch(/left cheek/);
    await click($(".queen-field"));
    expect(host.querySelector(".queen-charm-target")).toBeNull();
    expect(home().dataset.charmSelected).toBe("false");
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    vi.useRealTimers();
  });

  it("wears what the King's draft already carries, from both members, and says so", async () => {
    let h = seeded();
    const design = h.kittyNestDesigns?.find((row) => row.bankKey === "king" && row.visibility === "household");
    h = saveKittyNestDesign(h, guardQueenDesignSave({
      memberId: "MEM-002", view: "household", bankKey: "king", expectedRevision: design?.revision ?? 0, name: "Our Queen", glaze: "cream", category: null,
      studio: { version: 1, draft: { id: "queen", createdAt: "2026-09-01T00:00:00.000Z", firedAt: null, sculpt: { body: "round", profile: [1, 1, 1, 1], head: "round", ears: "none", eyes: "closed", mouth: "serene", whiskers: "none", tail: "none", nose: "tiny" }, paint: { base: "cream", parts: {}, strokes: [], stamps: [] },
        charms: [
          { id: "a", kind: "teapot", part: "body", u: 0.88, v: 0.45, spin: 0, tilt: 0, scale: 1, color: "#e3a534", by: "MEM-002" },
          { id: "b", kind: "die", part: "head", u: 0.3, v: 0.5, spin: 0, tilt: 0, scale: 1, color: "#3f6fa3", by: "MEM-001" },
          { id: "c", kind: "key", part: "body", u: 0.62, v: 0.45, spin: 0, tilt: 0, scale: 1, color: "#3f6fa3", by: "MEM-001" },
        ] }, fired: [] },
    }, { earned: queenCharmKindsEarned(h) })).household;
    await statusOpen(h);
    // The key was not earned, so the guard dropped it; the other two are hers, each with its author.
    expect(rows().map((row) => row.getAttribute("aria-label"))).toEqual(["A teapot on her right flank, pressed on by Sam (fictional)", "A die on her left cheek, pressed on by Alex (fictional)"]);
    expect(drawn().map((el) => el.dataset.charm)).toEqual(["teapot", "die"]);
    expect(still()).toMatch(/She wears 2 charms: a teapot on her right flank, a die on her left cheek\./);
    expect($(".queen-charms-tool").textContent).toMatch(/2 charms kept; each says who pressed it on/);
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
    expect(cellar.querySelector(".queen-jar.is-outlier")?.getAttribute("aria-label")).toMatch(/^June 2026 — swelled/);
    // The beat that stepped out leaves a dotted hole where it should have been.
    expect(cellar.querySelector(".queen-jar-ghost")).not.toBeNull();
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
