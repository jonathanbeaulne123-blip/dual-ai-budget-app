// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { buildMonthBoard } from "../src/core/board.ts";
import { fundWeek } from "../src/core/fundWeek.ts";
import { projectHouseholdFund } from "../src/core/householdFund.ts";
import { calendarPresentation } from "../src/core/ledgerExperience.ts";
import { categoryShape } from "../src/core/categoryShape.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { formatCad } from "../src/core/money.ts";
import { binderyDivisionFor } from "../src/house/bindery.ts";
import { buildHarbourReading } from "../src/harbour/data/reading.ts";
import { DeskShell, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";
import { BOOK_DOORS, readContributions, readWaterline } from "../src/harbour/desk/booksModel.ts";
import { readMonth, readWeek } from "../src/harbour/desk/calendarModel.ts";

/**
 * The Desk's Calendar and Books pages (SIMPLE_VIEW_DESK S4): the week strip is
 * the Fund's own week, the mini month carries the Calendar's own heat, and the
 * Books rows print the selectors' own figures with a door into their own
 * division of the Standing Book. Both scopes; unknowns engrave "—".
 * Fictional demo data only.
 */
const today = "2026-09-20";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const partner = household.members[1]!;
const reading = buildHarbourReading(household, memberId, today, "current");

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function mount(props: Partial<DeskShellProps> = {}) {
  const opened: Array<[string, string | undefined]> = [];
  const all: DeskShellProps = { household, memberId, scope: "household", today, reading, onOpen: (t, o) => opened.push([t, o]), ...props };
  await act(async () => root.render(createElement(DeskShell, all)));
  return { desk: host.querySelector<HTMLElement>("[data-desk]")!, opened };
}
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const qa = <T extends Element = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];

describe("Calendar, the Desk's light calendar", () => {
  it("strips this week as seven days, today marked, with the Fund week's own chips", async () => {
    const { desk } = await mount({ initialPage: "calendar" });
    expect(desk.dataset.deskPage).toBe("calendar");
    expect(host.querySelector("[data-desk-coming]")).toBeNull();
    const days = qa("[data-desk-week-day]");
    expect(days).toHaveLength(7);
    const week = fundWeek(household, today);
    expect(days.map(day => day.dataset.deskWeekDay)).toEqual(week.days.map(day => day.date));
    const marked = days.filter(day => day.hasAttribute("data-today"));
    expect(marked.map(day => day.dataset.deskWeekDay)).toEqual([today]);
    expect(marked[0]!.getAttribute("aria-current")).toBe("date");
    expect(marked[0]!.textContent).toContain("today");
    // Each day's chips are exactly the Fund week's entries, kind for kind.
    days.forEach((day, i) => expect(qa(`[data-desk-week-day="${day.dataset.deskWeekDay}"] [data-chip-kind]`).map(chip => chip.dataset.chipKind)).toEqual(week.days[i]!.entries.map(entry => entry.kind)));
    const kinds = new Set(qa(".desk-week__days [data-chip-kind]").map(chip => chip.dataset.chipKind));
    expect(["due", "payday", "shift", "sitdown"].filter(kind => kinds.has(kind)).length).toBeGreaterThanOrEqual(2);
    // Meaning is in words too, not colour alone.
    const due = q(`[data-desk-week-day="${today}"] [data-chip-kind="due"]`);
    expect(due.textContent).toMatch(/Due: Internet · \$92\.00/);
  });

  it("tints the heavy day in copper, says so, and lists a pressed day's items", async () => {
    const { opened } = await mount({ initialPage: "calendar" });
    const board = buildMonthBoard(calendarPresentation(household, memberId, "household"), "2026-09", today);
    const heavy = board.days.find(day => day.inMonth && day.heat > 0.55)!;
    expect(heavy).toBeTruthy();
    const cell = q<HTMLButtonElement>(`[data-desk-day="${heavy.date}"]`);
    expect(cell.dataset.deskHeat).toBe("hot");
    expect(cell.style.getPropertyValue("--desk-heat")).not.toBe("");
    expect(cell.getAttribute("aria-label")).toMatch(/heavy day/);
    const quiet = board.days.find(day => day.inMonth && day.items.length === 0)!;
    expect(q(`[data-desk-day="${quiet.date}"]`).hasAttribute("data-desk-heat")).toBe(false);
    // Kind glyphs from the registry sit on days that have items.
    expect(cell.querySelector(".desk-month__glyphs")!.textContent).toContain("▣");
    // Today is pressed at rest; pressing the heavy day lists its own items.
    expect(q(`[data-desk-day="${today}"]`).getAttribute("aria-pressed")).toBe("true");
    await act(async () => cell.click());
    expect(cell.getAttribute("aria-pressed")).toBe("true");
    const detail = q("[data-desk-day-detail]");
    expect(detail.dataset.deskDayDetail).toBe(heavy.date);
    const titles = qa("[data-desk-day-item] .desk-month__item-title").map(item => item.textContent);
    expect(titles).toHaveLength(heavy.items.length);
    heavy.items.forEach((item, i) => expect(titles[i]).toContain(item.title));
    expect(detail.textContent).toContain(formatCad(heavy.items[0]!.amountCents));
    expect(qa("[data-desk-day-item] .desk-month__item-owner").every(owner => owner.textContent!.length > 3)).toBe(true);
    // The arrow keys rove the month.
    cell.focus();
    await act(async () => { cell.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    const next = `2026-09-${String(Number(heavy.date.slice(8)) + 1).padStart(2, "0")}`;
    expect((document.activeElement as HTMLElement).dataset.deskDay).toBe(next);
    expect(q("[data-desk-day-detail]").dataset.deskDayDetail).toBe(next);
    await act(async () => q<HTMLButtonElement>('[data-desk-door="calendar"]').click());
    expect(opened).toEqual([["calendar", undefined]]);
  });

  it("reads Personal off the member's own calendar, same seven days, never the Fund's week", async () => {
    const { desk } = await mount({ initialPage: "calendar", scope: "personal" });
    expect(desk.dataset.deskPage).toBe("calendar");
    expect(q("[data-desk-week]").dataset.deskWeek).toBe("calendar");
    expect(qa("[data-desk-week-day]")).toHaveLength(7);
    expect(qa("[data-desk-week-day][data-today]")).toHaveLength(1);
    const week = readWeek(household, memberId, "personal", today);
    expect(week.source).toBe("calendar");
    expect(week.days.flatMap(day => day.chips).length).toBeGreaterThan(0);
    // The personal month reads the personal calendar (its own things appear on it).
    const month = readMonth(household, memberId, "personal", today);
    const personalBoard = buildMonthBoard(calendarPresentation(household, memberId, "personal"), "2026-09", today);
    expect(month.days.flatMap(day => day.items).length).toBe(personalBoard.days.filter(day => day.inMonth).flatMap(day => day.items).length);
    expect(q(".desk-month h2").textContent).toContain("your calendar");
  });

  it("reads an empty week and month — never a throw — for someone the ledger does not know", async () => {
    await mount({ initialPage: "calendar", memberId: "not-a-member" });
    expect(qa("[data-desk-week-day]")).toHaveLength(7);
    expect(qa(".desk-week__days [data-chip-kind]")).toHaveLength(0);
    expect(q("[data-desk-week]").textContent).toMatch(/could not be read/);
    expect(qa("[data-desk-day]")).toHaveLength(30);
    expect(host.textContent).not.toMatch(/\$0\.00/);
  });
});

describe("Books, the Standing Book's divisions as live rows", () => {
  it("prints the Fund's own waterline and makes every division one button into its own division", async () => {
    const { opened } = await mount({ initialPage: "books" });
    const rows = qa<HTMLButtonElement>("[data-desk-book]");
    expect(rows.map(row => row.dataset.deskBook)).toEqual(["today", "spending", "goals", "contributions", "record"]);
    expect(rows.every(row => row.tagName === "BUTTON" && row.type === "button")).toBe(true);
    const fund = projectHouseholdFund(household, today);
    expect(fund.configured).toBe(true);
    const today$ = rows[0]!;
    expect(today$.querySelector('[data-desk-figure="lead"]')!.textContent).toBe(formatCad(fund.operatingBalanceCents));
    const pairs = Object.fromEntries([...today$.querySelectorAll<HTMLElement>("[data-desk-pair]")].map(pair => [pair.dataset.deskPair, pair.querySelector(".desk-book__pair-value")!.textContent]));
    expect(pairs).toEqual({ "Reserved for upcoming": formatCad(fund.upcomingReserveCents), "Free to spend": formatCad(fund.freeToSpendCents), "Last reconciled": "Sep 16" });
    expect(today$.getAttribute("aria-label")).toMatch(/Open the books at Today\.$/);

    // Spending: the shape's own verdicts, what is above first.
    const shape = categoryShape(household, "2026-09", today);
    const above = shape.filter(row => row.verdict === "above");
    expect(rows[1]!.querySelector(".desk-book__headline")!.textContent).toBe(`${above.length} above shape`);
    const shapeRows = [...rows[1]!.querySelectorAll<HTMLElement>("[data-desk-shape]")];
    expect(shapeRows.length).toBeLessThanOrEqual(4);
    expect(shapeRows[0]!.dataset.deskShape).toBe("above");
    expect(shapeRows[0]!.querySelector(".desk-shape__name")!.textContent).toBe(above[0]!.label);
    expect(shapeRows.map(row => row.querySelector(".desk-shape__word")!.textContent)).toEqual(expect.arrayContaining(["above", "quiet"]));

    // Goals: the open goal banks against their targets.
    const nest = projectKittyNest(household, memberId, "household", today);
    const goals = nest.categories.flatMap(c => c.children).filter(bank => bank.state === "open" && bank.tier === "goal");
    const put = goals.reduce((sum, goal) => sum + (goal.amountCents ?? 0), 0);
    expect(rows[2]!.querySelector('[data-desk-figure="goals"]')!.textContent).toBe(`${goals.length} goals · ${formatCad(put)} put by`);
    expect(rows[2]!.querySelectorAll("[data-desk-goal]").length).toBe(Math.min(3, goals.length));

    // Contributions: each member's own confirmed sources this month, with their own rhythm.
    const streams = [...rows[3]!.querySelectorAll<HTMLElement>("[data-desk-stream]")];
    expect(streams.map(row => row.querySelector(".desk-streams__name")!.textContent)).toEqual(["Bianca", "Jonathan"]);
    expect(streams[0]!.querySelector(".desk-streams__figure")!.textContent).toBe("$1960.00");

    // Record: this month's entries and the newest.
    expect(rows[4]!.querySelector('[data-desk-figure="record"]')!.textContent).toMatch(/^\d+ entries in September$/);
    expect(rows[4]!.textContent).toContain("Last entry · ");

    for (const row of rows) await act(async () => row.click());
    expect(opened).toEqual((["today", "spending", "goals", "contributions", "record"] as const).map(id => ["books", BOOK_DOORS[id].object]));
    // Each address is one the Standing Book already turns to on arrival.
    for (const [, object] of opened) expect(binderyDivisionFor(object)).toBe(Object.values(BOOK_DOORS).find(door => door.object === object)!.division);
  });

  it("renders in Personal with the member's own books — no Fund waterline, no partner's contributions", async () => {
    const { desk } = await mount({ initialPage: "books", scope: "personal" });
    expect(desk.dataset.deskPage).toBe("books");
    const rows = qa<HTMLButtonElement>("[data-desk-book]");
    expect(rows).toHaveLength(5);
    const nest = projectKittyNest(household, memberId, "personal", today);
    const lead = rows[0]!;
    expect(lead.querySelector(".desk-book__lead-label")!.textContent).toBe(nest.sourceLabel);
    expect(lead.querySelector('[data-desk-figure="lead"]')!.textContent).toBe(formatCad(nest.totalCents));
    expect(lead.querySelectorAll("[data-desk-pair]")).toHaveLength(0);
    expect(rows[1]!.querySelector(".desk-card__kicker")!.textContent).toMatch(/my books against the plan/);
    const streams = [...rows[3]!.querySelectorAll<HTMLElement>("[data-desk-stream]")];
    expect(streams.map(row => row.dataset.deskStream)).toEqual([memberId]);
    expect(rows[3]!.textContent).not.toContain(partner.name);
    expect(rows[2]!.querySelector('[data-desk-figure="goals"]')!.textContent).toMatch(/^1 goal · /);
  });

  it("engraves — for everything it cannot read, never $0", async () => {
    await mount({ initialPage: "books", memberId: "not-a-member" });
    const rows = qa<HTMLButtonElement>("[data-desk-book]");
    expect(rows).toHaveLength(5);
    expect(q('[data-desk-figure="lead"]').textContent).toBe("—");
    expect(rows.slice(1).map(row => row.querySelector(".desk-book__headline")!.textContent)).toEqual(["—", "—", "—", "—"]);
    expect(host.textContent).not.toMatch(/\$0(\.00)?\b/);

    // A household with no Fund yet: the book's accepted shared cash leads, and nothing is pretended as reserved.
    const unfunded = { ...household, householdFund: undefined } as unknown as typeof household;
    const waterline = readWaterline(unfunded, memberId, "household", today);
    expect(waterline.kind).toBe("shared-cash");
    expect(waterline.reservedCents).toBeNull();
    expect(waterline.freeCents).toBeNull();
    expect(readContributions(unfunded, memberId, "household", today)).toMatchObject({ configured: false, members: [] });
    await act(async () => root.render(createElement(DeskShell, { household: unfunded, memberId, scope: "household", today, reading: null, onOpen: () => undefined, initialPage: "books" })));
    const pairs = [...host.querySelectorAll<HTMLElement>("[data-desk-pair] .desk-book__pair-value")].map(pair => pair.textContent);
    expect(pairs).toEqual(["—", "—", "—"]);
    expect(q('[data-desk-book="contributions"] .desk-book__headline').textContent).toBe("No shared Fund yet");
  });
});
