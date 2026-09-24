// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import { fundSnapshot } from "../src/core/fundModel.ts";
import { companionFor, commitCompanion } from "../src/core/herculesCompanion.ts";
import { discoverySelection, discoveryState } from "../src/core/herculesDiscovery.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { Household } from "../src/core/types.ts";
import { buildHarbourReading, type HarbourReading } from "../src/harbour/data/reading.ts";
import { DeskShell, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";
import { engravedCents } from "../src/harbour/desk/engraved.ts";
import { DESK_PAGES } from "../src/harbour/desk/pages.ts";
import { readSitdown } from "../src/harbour/desk/todayModel.ts";
import { NO_BAR_BADGES, compactCents, publishBarBadges, readBarBadges } from "../src/harbour/nav/barBadges.ts";
import { Compass, EditionFlip, useEditionFlipKey, type CompassProps } from "../src/harbour/nav/Compass.tsx";
import { pageTurnAllowed, pageTurnFor, PAGE_TURN_MS } from "../src/harbour/nav/pageTurn.ts";
import { MOTION_KEY, chooseMotionEdition } from "../src/harbour/nav/QuickSheet.tsx";
import { VillageHUD } from "../src/harbour/village/VillageHUD.tsx";
import { TARGET_NAMES, houseTabForRoute, houseTargetRoute } from "../src/house/navigation.ts";

/**
 * The Desk's little things (SIMPLE_VIEW_DESK S7): the flip wears the Everyday
 * figure, All tools wears a pawprint for a fresh Hercules suggestion, Today's
 * corner dog-ears while the month's Sitdown waits, the personal Desk's chips
 * say "my folio" rather than "the Fund", Shifts has a heading, and the flip
 * between worlds is a page-turn that is a plain cut under reduced motion.
 * Fictional demo data only.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const reading = buildHarbourReading(household, memberId, today, "current");

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  try { window.localStorage.clear(); } catch { /* optional */ }
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  publishBarBadges(NO_BAR_BADGES);
  document.querySelectorAll("[data-page-turn]").forEach(node => node.remove());
  vi.useRealTimers(); vi.unstubAllGlobals();
  try { window.localStorage.clear(); } catch { /* optional */ }
});

const fab: CompassProps["fab"] = { actions: fabActionsFor("household", "home"), closedLabel: fabClosedLabel("household"), onOpenChange: () => undefined, onPick: () => undefined, onGo: () => undefined };
const flip = () => host.querySelector<HTMLButtonElement>(".edition-flip")!;
const describedBy = (button: HTMLElement) => button.getAttribute("aria-describedby") ? document.getElementById(button.getAttribute("aria-describedby")!) : null;

/** Snooze the top card while it is a fresh one — "Not now", as the Hercules panel writes it. */
function snoozeFresh(start: Household): Household {
  let next = start;
  for (let i = 0; i < 40; i += 1) {
    const input = { household: next, memberId, view: "household" as const, tab: "home" as const, today };
    const top = discoverySelection(input).now[0];
    if (!top || top.tier > 1) return next;
    const row = discoveryState(input, top, "snooze");
    next = commitCompanion(next, { version: 1, id: crypto.randomUUID(), scope: companionFor(next, memberId).scope, operation: { kind: "suggestion.set", state: row, expectedRevision: row.revision, expectedState: next.companionProfile?.suggestions.find(old => old.issueId === row.issueId && old.view === row.view) ?? null } }).household;
  }
  return next;
}

describe("the flip wears the Everyday figure at rest", () => {
  it("reads the household's Everyday Now — the Desk's own figure — and nothing in personal scope", () => {
    const badges = readBarBadges(household, memberId, "household", today);
    expect(badges.scope).toBe("household");
    expect(badges.everydayCents).toBe(fundSnapshot(household, { memberId, view: "household", today }).now);
    expect(readBarBadges(household, memberId, "personal", today)).toEqual({ scope: "personal", everydayCents: null, suggestion: false });
  });

  it("compacts honestly: truncated, never more than the books hold; unknown is the engraved dash", () => {
    expect(compactCents(null)).toBe("—");
    expect(compactCents(0)).toBe("$0");
    expect(compactCents(83_499)).toBe("$834");
    expect(compactCents(129_999)).toBe("$1.2k");
    expect(compactCents(100_000)).toBe("$1k");
    expect(compactCents(1_234_567)).toBe("$12k");
    expect(compactCents(-5_640)).toBe("−$56");
    expect(compactCents(250_000_000)).toBe("$2.5M");
  });

  it("shows the compact figure in household with a stable name and the full figure as the description", async () => {
    publishBarBadges({ scope: "household", everydayCents: 123_456, suggestion: false });
    await act(async () => root.render(createElement(Compass, { fab, onQuickSheet: () => undefined })));
    const button = flip();
    expect(button.getAttribute("aria-label")).toBe("Switch to the simple view");
    expect(button.querySelector(".edition-flip__figure")!.textContent).toBe("$1.2k");
    expect(button.dataset.editionFigure).toBe("known");
    expect(describedBy(button)!.textContent).toBe(`Everyday, now: ${engravedCents(123_456)}`);
    expect(button.style.minHeight).toBe("44px");
    expect(button.style.minWidth).toBe("44px");
    // The figure follows the books.
    await act(async () => publishBarBadges({ scope: "household", everydayCents: null, suggestion: false }));
    expect(button.querySelector(".edition-flip__figure")!.textContent).toBe("—");
    expect(button.dataset.editionFigure).toBe("unknown");
    expect(button.getAttribute("aria-label")).toBe("Switch to the simple view");
  });

  it("wears nothing in personal scope, on the way back from the Desk, or on a bar the App has not dressed", async () => {
    await act(async () => root.render(createElement(EditionFlip, {})));
    expect(host.querySelector(".edition-flip__figure")).toBeNull();
    expect(flip().hasAttribute("aria-describedby")).toBe(false);
    await act(async () => publishBarBadges({ scope: "personal", everydayCents: 5_000, suggestion: false }));
    expect(host.querySelector(".edition-flip__figure")).toBeNull();
    await act(async () => publishBarBadges({ scope: "household", everydayCents: 5_000, suggestion: false }));
    await act(async () => root.render(createElement(EditionFlip, { world: "house" })));
    expect(host.querySelector(".edition-flip__figure")).toBeNull();
    await act(async () => root.render(createElement(EditionFlip, {})));
    expect(host.querySelector(".edition-flip__figure")!.textContent).toBe("$50");
    await act(async () => chooseMotionEdition("flat"));
    expect(flip().getAttribute("aria-label")).toBe("Switch to the illustrated harbour");
    expect(host.querySelector(".edition-flip__figure")).toBeNull();
  });

  it("keeps adding money two presses away: the + stands beside the dressed flip", async () => {
    publishBarBadges({ scope: "household", everydayCents: 1_000, suggestion: true });
    await act(async () => root.render(createElement(Compass, { fab, onQuickSheet: () => undefined })));
    const nav = host.querySelector("nav.compass")!;
    expect([...nav.children].map(node => node.className.split(" ")[0])).toEqual(["edition-flip", "fab-dial", "harbour-bar__tools"]);
    await act(async () => nav.querySelector<HTMLButtonElement>("button.fab")!.click());
    expect(host.querySelectorAll("[data-fab-action]").length).toBeGreaterThan(0);
  });

  it("is published by the App from the household it already holds", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).toMatch(/usePublishBarBadges\(HARBOUR_ENABLED && household && session \? \{ household, memberId: session\.memberId, scope: view, today \} : null\)/);
  });
});

describe("the pawprint on All tools", () => {
  it("is raised by a fresh suggestion — the Hercules corner's own top card — and not by the standing offers", () => {
    const top = discoverySelection({ household, memberId, view: "household", tab: "home", today }).now[0]!;
    expect(top.tier).toBeLessThanOrEqual(1);
    expect(readBarBadges(household, memberId, "household", today).suggestion).toBe(true);
    const quiet = { ...household, transactions: [], recurrences: [], claims: [] } as Household;
    expect(discoverySelection({ household: quiet, memberId, view: "household", tab: "home", today }).now.every(row => row.tier > 1)).toBe(true);
    expect(readBarBadges(quiet, memberId, "household", today).suggestion).toBe(false);
  });

  it("goes away once the fresh cards are snoozed", () => {
    const snoozed = snoozeFresh(household);
    expect(snoozed).not.toBe(household);
    expect(readBarBadges(snoozed, memberId, "household", today).suggestion).toBe(false);
  });

  it("marks the door edition's All tools with a labelled pawprint, keeping the name", async () => {
    publishBarBadges({ scope: "household", everydayCents: 0, suggestion: true });
    await act(async () => root.render(createElement(Compass, { fab, onQuickSheet: () => undefined })));
    const tools = host.querySelector<HTMLButtonElement>(".harbour-bar__tools")!;
    expect(tools.getAttribute("aria-label")).toBe("All tools");
    const paw = tools.querySelector<HTMLElement>("[data-bar-pawprint]")!;
    expect(paw.getAttribute("role")).toBe("img");
    expect(paw.getAttribute("aria-label")).toBe("Hercules has a suggestion");
    expect(tools.getAttribute("aria-describedby")).toBe(paw.id);
    await act(async () => publishBarBadges({ scope: "household", everydayCents: 0, suggestion: false }));
    expect(tools.querySelector("[data-bar-pawprint]")).toBeNull();
    expect(tools.hasAttribute("aria-describedby")).toBe(false);
  });

  it("marks the island bar's All tools the same way", async () => {
    publishBarBadges({ scope: "household", everydayCents: 0, suggestion: true });
    await act(async () => root.render(createElement(VillageHUD, { place: "court", travelling: null, onVisit: () => undefined, onView: () => undefined, fab, onQuickSheet: () => undefined, avatar: "bianca" })));
    const tools = host.querySelector<HTMLButtonElement>(".village-tools__all")!;
    expect(tools.getAttribute("aria-label")).toBe("All tools");
    expect(describedBy(tools)!.getAttribute("aria-label")).toBe("Hercules has a suggestion");
    await act(async () => publishBarBadges(NO_BAR_BADGES));
    expect(tools.querySelector("[data-bar-pawprint]")).toBeNull();
  });
});

describe("the dog-ear on Today", () => {
  const openChapter = (month: string) => ({ version: 1, id: "CH-1", foundationId: null, title: "See our shared life", meaning: "m", betterFeelsLike: "b", lessonId: "l", openedAt: `${month}-02T12:00:00Z`, openedByMemberId: memberId, openedAtSitdownId: null, closedAt: null, closedAtSitdownId: null, state: "open", carryForward: "", intendedMonth: month, updatedAt: `${month}-02T12:00:00Z` });
  const withChapter = (month: string) => ({ ...household, chapters: [openChapter(month)] }) as unknown as Household;

  async function mount(props: Partial<DeskShellProps>) {
    const opened: Array<[string, string | undefined]> = [];
    await act(async () => root.render(createElement(DeskShell, { household, memberId, scope: "household", today, reading, onOpen: (t, o) => opened.push([t, o]), ...props })));
    return opened;
  }

  it("reads the Campfire's own condition: a Chapter open past its month, or a close waiting on this seat", () => {
    expect(readSitdown(reading, household, memberId, "household", today)).toBeNull();
    const overdue = withChapter("2026-08");
    expect(readSitdown(buildHarbourReading(overdue, memberId, today, "current"), overdue, memberId, "household", today)).toMatchObject({ why: "overdue", month: "August" });
    // Without the harbour's reading the Desk reads the fire itself.
    expect(readSitdown(null, overdue, memberId, "household", today)?.why).toBe("overdue");
    const current = withChapter("2026-09");
    expect(readSitdown(null, current, memberId, "household", today)).toBeNull();
    const proposed = { ...reading, campfire: { ...reading.campfire, month: "2026-09", close: "proposed" } } as HarbourReading;
    expect(readSitdown(proposed, household, memberId, "household", today)?.why).toBe("proposed");
    expect(readSitdown(proposed, household, memberId, "personal", today)).toBeNull();
  });

  it("folds only while the Sitdown waits, and its press opens the Plan Studio — the Campfire's door", async () => {
    await mount({});
    expect(host.querySelector("[data-desk-dogear]")).toBeNull();
    expect(host.querySelector(".desk-today")!.hasAttribute("data-desk-sitdown")).toBe(false);

    const overdue = withChapter("2026-08");
    const opened = await mount({ household: overdue, reading: buildHarbourReading(overdue, memberId, today, "current") });
    const ear = host.querySelector<HTMLButtonElement>("[data-desk-dogear]")!;
    expect(ear.tagName).toBe("BUTTON");
    expect(ear.dataset.deskDogear).toBe("overdue");
    expect(ear.getAttribute("aria-label")).toMatch(/^The month’s Sitdown is waiting\. August’s Chapter is still open past its month; the Sitdown is waiting\. Pull out the Plan Studio\.$/);
    expect(host.querySelector(".desk-today")!.getAttribute("data-desk-sitdown")).toBe("overdue");
    await act(async () => ear.click());
    expect(opened).toEqual([["plan-studio", undefined]]);
  });

  it("never folds the personal Desk", async () => {
    const overdue = withChapter("2026-08");
    await mount({ household: overdue, scope: "personal", reading: null });
    expect(host.querySelector("[data-desk-dogear]")).toBeNull();
  });
});

describe("copy polish", () => {
  it("the personal Desk's chips speak of my folio, never the Fund", async () => {
    for (const page of DESK_PAGES) expect(page.subtitle({ reading: null, scope: "personal" }), page.id).not.toMatch(/Fund/);
    expect(DESK_PAGES[0]!.subtitle({ reading: null, scope: "personal" })).toBe("My folio, this month");
    expect(DESK_PAGES[0]!.subtitle({ reading: null, scope: "household" })).toBe("The Fund, this month");
    await act(async () => root.render(createElement(DeskShell, { household, memberId, scope: "personal", today, reading: null, onOpen: () => undefined })));
    expect(host.querySelector("[data-desk-sign]")!.textContent).toBe("My folio, this month");
  });

  it("gives Shifts a heading and opens it on the Shifts page from wherever it is asked for", () => {
    expect(TARGET_NAMES.shift).toBe("Open Shifts");
    const route = houseTargetRoute({ householdId: "HH-1", scope: "personal", room: "home", level: "middle" }, "shift");
    expect(route.surface).toBe("shift");
    expect(houseTabForRoute(route)).toBe("shift");
  });
});

describe("the page-turn", () => {
  function Listener() { useEditionFlipKey(true); return null; }
  const media = (reduce: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

  it("knows its direction and asks the reader's motion preference", () => {
    expect(pageTurnFor("illustrated", "flat")).toBe("to-desk");
    expect(pageTurnFor("flat", "illustrated")).toBe("to-world");
    expect(pageTurnFor("flat", "flat")).toBeNull();
    expect(pageTurnAllowed({ matchMedia: (() => ({ matches: true })) as unknown as Window["matchMedia"] })).toBe(false);
    expect(pageTurnAllowed({ matchMedia: (() => ({ matches: false })) as unknown as Window["matchMedia"] })).toBe(true);
    expect(pageTurnAllowed(undefined)).toBe(false);
    expect(PAGE_TURN_MS).toBeLessThan(600);
  });

  it("turns one leaf over the page — hidden, inert — and takes it away again", async () => {
    media(false);
    vi.useFakeTimers();
    await act(async () => root.render(createElement(Listener)));
    await act(async () => chooseMotionEdition("flat"));
    const overlay = document.querySelector<HTMLElement>("[data-page-turn]")!;
    expect(overlay.dataset.pageTurn).toBe("to-desk");
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    expect(overlay.querySelector(".page-turn__leaf")).not.toBeNull();
    expect(overlay.contains(document.activeElement)).toBe(false);
    await act(async () => { vi.advanceTimersByTime(PAGE_TURN_MS + 100); });
    expect(document.querySelector("[data-page-turn]")).toBeNull();
    // The same edition written again turns nothing; going back turns the other way.
    await act(async () => chooseMotionEdition("flat"));
    expect(document.querySelector("[data-page-turn]")).toBeNull();
    await act(async () => window.dispatchEvent(new CustomEvent(MOTION_KEY, { detail: "illustrated" })));
    expect(document.querySelector<HTMLElement>("[data-page-turn]")!.dataset.pageTurn).toBe("to-world");
  });

  it("is a plain cut under prefers-reduced-motion: no overlay, no animation", async () => {
    media(true);
    await act(async () => root.render(createElement(Listener)));
    await act(async () => chooseMotionEdition("flat"));
    expect(document.querySelector("[data-page-turn]")).toBeNull();
    expect(document.querySelector(".page-turn, .page-turn__leaf")).toBeNull();
    await act(async () => chooseMotionEdition("illustrated"));
    expect(document.querySelector("[data-page-turn]")).toBeNull();
  });
});
