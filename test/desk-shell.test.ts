// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { fundSnapshot } from "../src/core/fundModel.ts";
import { buildDashboard } from "../src/core/insights.ts";
import { projectLedgerExperience } from "../src/core/ledgerExperience.ts";
import { deskMonthSeals } from "../src/core/officeWide.ts";
import { formatCad } from "../src/core/money.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import { DeskShell, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";
import { DESK_PAGES } from "../src/harbour/desk/pages.ts";
import { deskPots } from "../src/harbour/desk/todayModel.ts";
import { engravedCents } from "../src/harbour/desk/engraved.ts";

/**
 * The Desk (SIMPLE_VIEW_DESK S2): the shell's chips rove like FundBoard's,
 * the Harbour flip writes the same `hearth:motion` switch the quick sheet
 * writes, and Today leads with Everyday "Now", the three pots beneath, and the
 * Office's own three seals. Fictional demo data only.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading = buildHarbourReading(household, memberId, today, "current");

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  try { window.localStorage.clear(); } catch { /* jsdom storage is optional */ }
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function mount(props: Partial<DeskShellProps> = {}) {
  const opened: Array<[string, string | undefined]> = [];
  const all: DeskShellProps = { household, memberId, scope: "household", today, reading, onOpen: (t, o) => opened.push([t, o]), ...props };
  await act(async () => root.render(createElement(DeskShell, all)));
  return { desk: host.querySelector<HTMLElement>("[data-desk]")!, opened };
}
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const qa = <T extends Element = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];

describe("Today, the Desk's front page", () => {
  it("leads with Everyday Now, big, and stands Prepare, Protect and Build beneath with their targets", async () => {
    const { desk, opened } = await mount();
    expect(desk.dataset.deskPage).toBe("today");
    const snapshot = fundSnapshot(household, { memberId, view: "household", today });
    const pots = qa("[data-desk-pot]");
    expect(pots.map(pot => pot.dataset.deskPot)).toEqual(["everyday", "prepare", "protect", "build"]);
    expect(pots[0]!.classList.contains("desk-now")).toBe(true);
    expect(pots[0]!.querySelector(".desk-figure--now")!.textContent).toBe(engravedCents(snapshot.now));
    expect(pots[1]!.querySelector(".desk-figure")!.textContent).toBe(engravedCents(snapshot.prepare.amountCents));
    expect(pots[2]!.querySelector(".desk-figure")!.textContent).toBe(engravedCents(snapshot.protect.amountCents));
    expect(pots[2]!.textContent).toContain(`of a ${formatCad(snapshot.protect.targetCents)} buffer`);
    expect(pots[3]!.querySelector(".desk-figure")!.textContent).toBe(engravedCents(snapshot.build.amountCents));
    expect(pots.every(pot => pot.tagName === "BUTTON" && (pot as HTMLButtonElement).type === "button")).toBe(true);
    await act(async () => { pots[0]!.click(); pots[2]!.click(); });
    expect(opened).toEqual([["queen", undefined], ["loft-banks", "bank/plan:protect"]]);
  });

  it("engraves an unknown pot as —, never $0, and a zero target as none agreed", () => {
    const pots = deskPots({ now: null, prepare: { amountCents: null, targetCents: 0, coveredThrough: null, bills: [], fundBills: [] }, protect: { amountCents: null, targetCents: 0, refills: [] }, build: { amountCents: null, targetCents: 0, goals: [] } }, engravedCents);
    for (const pot of Object.values(pots)) expect(engravedCents(pot.cents)).toBe("—");
    expect(pots.protect.line).toBe("No buffer agreed yet");
    expect(pots.build.line).not.toMatch(/\$0/);
  });

  it("presses the Office's own three seals — Money in, Money out, Leftover — and cracks the wax when the month is negative", async () => {
    await mount();
    const experience = projectLedgerExperience(household, memberId, "household", today);
    if (!experience.ok) throw new Error("demo member should read the ledger");
    const office = deskMonthSeals(buildDashboard(experience.scopedHousehold, today).month);
    const seals = qa("[data-desk-seal]");
    expect(seals.map(seal => seal.dataset.deskSeal)).toEqual(["in", "out", "leftover"]);
    expect(seals.map(seal => seal.querySelector(".desk-seal__label")!.textContent)).toEqual(["Money in", "Money out", "Leftover"]);
    expect(seals.map(seal => seal.querySelector(".desk-seal__figure")!.textContent)).toEqual([formatCad(office.inCents), formatCad(office.outCents), formatCad(office.leftoverCents)]);
    expect(seals[2]!.hasAttribute("data-seal-cracked")).toBe(office.leftoverCents < 0);
  });

  it("reads — on every seal for someone the ledger does not know", async () => {
    await mount({ memberId: "not-a-member" });
    expect(qa(".desk-seal__figure").map(figure => figure.textContent)).toEqual(["—", "—", "—"]);
  });

  it("stands the sundial on the walk's next row, unfolds the Level in place, and keeps Hercules's corner a door", async () => {
    const { opened } = await mount();
    const sundial = q<HTMLButtonElement>("[data-desk-sundial]");
    expect(sundial.dataset.deskSundial).toBe("dated");
    expect(sundial.getAttribute("aria-label")).toMatch(/^Sundial\. Next to leave the Fund: /);
    const level = q<HTMLButtonElement>(".desk-level__press");
    expect(level.getAttribute("aria-expanded")).toBe("false");
    await act(async () => level.click());
    expect(q<HTMLButtonElement>(".desk-level__press").getAttribute("aria-expanded")).toBe("true");
    expect(q("[data-desk-level]").dataset.deskLevel).toBe("tall");
    const talk = qa<HTMLButtonElement>(".desk-door--talk")[0]!;
    expect(talk.textContent).toBe("Talk with Hercules");
    await act(async () => { sundial.click(); talk.click(); });
    expect(opened).toEqual([["cellar-bills", undefined], ["hercules", undefined]]);
    expect(q("[data-desk-discovery]")).toBeTruthy();
  });
});

describe("the Desk shell", () => {
  it("roves the chip tablist with the arrow keys, Home and End, one tab stop at a time", async () => {
    await mount();
    const chips = () => qa<HTMLButtonElement>('[role="tab"]');
    expect(chips().map(chip => chip.textContent)).toEqual(DESK_PAGES.map(page => page.chip));
    expect(chips().map(chip => chip.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    chips()[0]!.focus();
    const key = (k: string) => act(async () => { (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); });
    await key("ArrowRight");
    expect(document.activeElement).toBe(chips()[1]);
    expect(chips()[1]!.getAttribute("aria-selected")).toBe("true");
    expect(chips().map(chip => chip.tabIndex)).toEqual([-1, 0, -1, -1, -1]);
    expect(q("[data-desk]").dataset.deskPage).toBe("leaving");
    expect(q('[role="tabpanel"]').getAttribute("aria-labelledby")).toBe(chips()[1]!.id);
    await key("End");
    expect(document.activeElement).toBe(chips()[4]);
    await key("ArrowRight");
    expect(document.activeElement).toBe(chips()[0]);
    await key("ArrowLeft");
    expect(document.activeElement).toBe(chips()[4]);
    await key("Home");
    expect(document.activeElement).toBe(chips()[0]);
    expect(q("[data-desk]").dataset.deskPage).toBe("today");
  });

  it("turns the page on a horizontal swipe and leaves a vertical drag to the scroll", async () => {
    await mount();
    const panel = q('[role="tabpanel"]');
    const pointer = (type: string, x: number, y: number) => act(async () => {
      panel.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }), { pointerType: "touch", isPrimary: true, pointerId: 7 }));
    });
    await pointer("pointerdown", 300, 200); await pointer("pointerup", 180, 210);
    expect(q("[data-desk]").dataset.deskPage).toBe("leaving");
    await pointer("pointerdown", 300, 200); await pointer("pointerup", 290, 20);
    expect(q("[data-desk]").dataset.deskPage).toBe("leaving");
    await pointer("pointerdown", 100, 200); await pointer("pointerup", 240, 200);
    expect(q("[data-desk]").dataset.deskPage).toBe("today");
  });

  it("says the door-sign sentence under the chips, and later pages keep their own door", async () => {
    const { opened } = await mount({ initialPage: "leaving" });
    expect(q("[data-desk-sign]").textContent).toMatch(/bill/);
    const door = q<HTMLButtonElement>("[data-desk-coming] button");
    await act(async () => door.click());
    expect(opened).toEqual([["cellar-bills", undefined]]);
  });

  it("flips back to the Harbour exactly like the quick sheet's switch: hearth:motion written and announced", async () => {
    window.localStorage.setItem("hearth:motion", "flat");
    const heard: unknown[] = [];
    const listen = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener("hearth:motion", listen);
    const onFlip = vi.fn();
    try {
      await mount({ onFlip });
      const flip = q<HTMLButtonElement>("[data-desk-flip]");
      expect(flip.textContent).toContain("Harbour");
      await act(async () => flip.click());
      expect(window.localStorage.getItem("hearth:motion")).toBe("");
      expect(heard).toEqual(["illustrated"]);
      expect(onFlip).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener("hearth:motion", listen); }
  });

  it("does not pretend to flip when the Harbour could not be drawn", async () => {
    window.localStorage.setItem("hearth:motion", "flat");
    const onFlip = vi.fn();
    await mount({ status: "fallback", onFlip });
    const flip = q<HTMLButtonElement>("[data-desk-flip]");
    expect(flip.getAttribute("aria-disabled")).toBe("true");
    await act(async () => flip.click());
    expect(window.localStorage.getItem("hearth:motion")).toBe("flat");
    expect(onFlip).not.toHaveBeenCalled();
    expect(q(".desk__undrawn").textContent).toMatch(/could not be drawn/);
  });

  it("opens the existing quick sheet from the All tools & places chip, and leaves the header room for the space switch", async () => {
    const onQuickSheet = vi.fn();
    await mount({ onQuickSheet, spaceSlot: createElement("span", { "data-test-space": "" }, "Shared") });
    const drawer = q<HTMLButtonElement>("[data-desk-drawer]");
    expect(drawer.closest('[role="tablist"]')).toBeNull();
    expect(drawer.textContent).toContain("All tools & places");
    await act(async () => drawer.click());
    expect(onQuickSheet).toHaveBeenCalledTimes(1);
    expect(q('[data-desk-slot="space"] [data-test-space]')).toBeTruthy();
  });

  it("has no drawer chip when no quick sheet is wired", async () => {
    await mount();
    expect(host.querySelector("[data-desk-drawer]")).toBeNull();
  });
});
