// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { fundWalk } from "../src/core/fundWalk.ts";
import { nextOut, spokenFor } from "../src/core/nextOut.ts";
import { formatCad } from "../src/core/money.ts";
import { buildMonthBoard } from "../src/core/board.ts";
import { calendarWeight } from "../src/core/calendarWeight.ts";
import { calendarPresentation } from "../src/core/ledgerExperience.ts";
import type { Household } from "../src/core/types.ts";
import { buildHarbourReading, type CellarJarReading, type HarbourReading } from "../src/harbour/data/reading.ts";
import { DeskShell, type DeskShellProps } from "../src/harbour/desk/DeskShell.tsx";
import { readJars, readLeaving, readRail } from "../src/harbour/desk/leavingModel.ts";

/**
 * The Desk's Leaving page (SIMPLE_VIEW_DESK S3 §2): the next outflow and the
 * spoken-for read from the Fund walk, the next-out table, the calendar-weight
 * rail with posted (ink) and scheduled (copper) told apart, and the bill jars
 * in the Cellar's own states. Fictional demo data only.
 */
const today = "2026-09-20";
const seeded = seedDemoHousehold({ today });
const memberId = seeded.members[0]!.id;

/** The demo month plus one cash bill still to come on the 24th, so the rail has copper to draw. */
function withScheduledBill(household: Household): Household {
  const rent = household.recurrences.find(row => row.note === "Rent")!;
  return { ...household, recurrences: [...household.recurrences, { ...rent, id: "REC-DESK-FIXTURE", nextDate: "2026-09-24", amountCents: 4321, note: "Desk fixture bill" }] };
}
const household = withScheduledBill(seeded);
const reading = buildHarbourReading(household, memberId, today, "current");

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

async function mount(props: Partial<DeskShellProps> = {}) {
  const opened: Array<[string, string | undefined]> = [];
  const all: DeskShellProps = { household, memberId, scope: "household", today, reading, initialPage: "leaving", onOpen: (t, o) => opened.push([t, o]), ...props };
  await act(async () => root.render(createElement(DeskShell, all)));
  return { opened };
}
const q = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
const qa = <T extends Element = HTMLElement>(selector: string) => [...host.querySelectorAll<T>(selector)];

describe("Leaving, household scope", () => {
  it("leads with the walk's next outflow and the spoken-for read, and tables every row nextOut has", async () => {
    await mount();
    expect(q("[data-desk]").dataset.deskPage).toBe("leaving");
    expect(host.querySelector("[data-desk-coming]")).toBeNull();
    const walk = fundWalk(household, "2026-09", today);
    const table = nextOut(walk);
    const first = table.rows[0]!;
    const next = q("[data-desk-next]");
    expect(next.dataset.deskNext).toBe("dated");
    expect(next.textContent).toContain(first.label);
    expect(next.querySelector(".desk-figure")!.textContent).toBe(formatCad(first.amountCents));

    const claim = spokenFor(walk, today);
    const spoken = q("[data-desk-spoken]");
    expect(spoken.dataset.deskSpoken).toBe(claim.overCents > 0 ? "over" : "free");
    expect(spoken.querySelector(".desk-figure")!.textContent).toBe(claim.overCents > 0 ? `${formatCad(claim.overCents)} over` : `${formatCad(claim.freeCents)} free`);
    expect(spoken.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe(`${formatCad(claim.claimedCents)} claimed of ${formatCad(claim.poolCents)} in the pool`);

    const rows = qa("[data-desk-out-row]");
    expect(rows.map(row => row.dataset.deskOutRow)).toEqual(table.rows.map(row => row.id));
    expect(rows[0]!.querySelectorAll("td")[2]!.textContent).toBe(formatCad(first.amountCents));
    expect(rows[0]!.querySelectorAll("td")[3]!.textContent).toBe(formatCad(first.leavesCents));
  });

  it("draws the Calendar's own weight rail — ink for posted, copper for scheduled — and a press reads the day", async () => {
    await mount();
    const presented = calendarPresentation(household, memberId, "household");
    const days = calendarWeight(presented, buildMonthBoard(presented, "2026-09", today), today);
    const bars = qa("[data-rail-date]");
    expect(bars.map(bar => bar.dataset.railDate)).toEqual(days.map(day => day.date));
    const posted = days.filter(day => day.postedOutCents > 0).map(day => day.date);
    const scheduled = days.filter(day => day.outstandingOutCents > 0).map(day => day.date);
    expect(posted.length).toBeGreaterThan(0);
    expect(scheduled).toContain("2026-09-24");
    expect(bars.filter(bar => bar.hasAttribute("data-rail-posted")).map(bar => bar.dataset.railDate)).toEqual(posted);
    expect(bars.filter(bar => bar.hasAttribute("data-rail-scheduled")).map(bar => bar.dataset.railDate)).toEqual(scheduled);
    expect(q('[data-rail-date="2026-09-24"] .desk-rail__seg--scheduled')).toBeTruthy();
    expect(q('[data-rail-date="2026-09-24"] .desk-rail__seg--posted')).toBeNull();
    expect(q(`[data-rail-date="${posted[0]}"] .desk-rail__seg--posted`)).toBeTruthy();

    // It opens on today; the keyboard walks it to the scheduled bill.
    const slider = q('[role="slider"]');
    expect(q("[data-rail-slip]").dataset.railSlip).toBe(today);
    const key = (k: string) => act(async () => { slider.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); });
    for (let i = 0; i < 4; i += 1) await key("ArrowRight");
    const slip = q("[data-rail-slip]");
    expect(slip.dataset.railSlip).toBe("2026-09-24");
    expect(slider.getAttribute("aria-valuenow")).toBe("24");
    expect(slip.textContent).toContain(`${formatCad(4321)} scheduled`);
    expect(q('[data-rail-item="scheduled-out"]').textContent).toContain("Desk fixture bill");

    // The step buttons are the fine touch; Home goes to the 1st, where Rent was posted.
    await key("Home");
    expect(q("[data-rail-slip]").dataset.railSlip).toBe("2026-09-01");
    expect(qa('[data-rail-item="posted-out"]').length).toBeGreaterThan(0);
    await act(async () => q<HTMLButtonElement>('[aria-label="Next day"]').click());
    expect(q("[data-rail-slip]").dataset.railSlip).toBe("2026-09-02");
  });

  it("keeps a horizontal drag on the rail from turning the Desk's page", async () => {
    await mount();
    const slider = q('[role="slider"]');
    const pointer = (type: string, x: number) => act(async () => {
      slider.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 40 }), { pointerType: "touch", isPrimary: true, pointerId: 3 }));
    });
    await pointer("pointerdown", 300); await pointer("pointerup", 120);
    expect(q("[data-desk]").dataset.deskPage).toBe("leaving");
  });

  it("stands the bill jars exactly as the Cellar reads them, and opens the Cellar at a jar", async () => {
    const { opened } = await mount();
    const jars = qa<HTMLButtonElement>("[data-jar-state]");
    expect(jars.map(jar => jar.querySelector(".desk-jar__label")!.textContent)).toEqual(reading.cellar.jars.map(jar => jar.label));
    expect(jars.map(jar => jar.dataset.jarState)).toEqual(reading.cellar.jars.map(jar => jar.state));
    expect(jars.map(jar => jar.querySelector(".desk-jar__cents")!.textContent)).toEqual(reading.cellar.jars.map(jar => formatCad(jar.amountCents)));
    await act(async () => jars[0]!.click());
    expect(opened).toEqual([["cellar-bills", `jar/${reading.cellar.jars[0]!.key}`]]);
  });

  it("reads the same jars before the harbour's reading arrives", () => {
    expect(readJars(household, memberId, "household", today, null)).toEqual(readJars(household, memberId, "household", today, reading));
  });

  it("words every jar state — planned, set aside, paid, short — and the missing-payment mark", async () => {
    const base = reading.cellar.jars[0]!;
    const jar = (key: string, label: string, state: CellarJarReading["state"], missingMark = false): CellarJarReading => ({ ...base, key, label, state, missingMark });
    const fixture: HarbourReading = { ...reading, cellar: { ...reading.cellar, jars: [
      jar("j-planned", "Water", "planned"), jar("j-set", "Phone", "set-aside"), jar("j-paid", "Hydro", "paid"),
      jar("j-short", "Insurance", "short"), jar("j-missing", "Streaming", "planned", true),
    ] } };
    await mount({ reading: fixture });
    const jars = qa("[data-jar-state]");
    expect(jars.map(row => row.querySelector(".desk-jar__state")!.textContent)).toEqual(["Planned", "Set aside", "Paid", "Short", "Planned"]);
    expect(jars[3]!.dataset.jarState).toBe("short");
    expect(jars[4]!.hasAttribute("data-jar-missing")).toBe(true);
    expect(jars[4]!.textContent).toContain("Missing a payment");
    expect(jars[4]!.getAttribute("aria-label")).toMatch(/missing a payment/);
  });

  it("engraves an unknown jar amount —, never $0", async () => {
    const fixture: HarbourReading = { ...reading, cellar: { ...reading.cellar, jars: [{ ...reading.cellar.jars[0]!, amountCents: Number.NaN }] } };
    await mount({ reading: fixture });
    const cents = q("[data-jar-state] .desk-jar__cents").textContent;
    expect(cents).toBe("—");
  });

  it("keeps both doors: the bill jars and the Calendar", async () => {
    const { opened } = await mount();
    await act(async () => { q<HTMLButtonElement>('[data-desk-door="cellar-bills"]').click(); q<HTMLButtonElement>('[data-desk-door="calendar"]').click(); });
    expect(opened).toEqual([["cellar-bills", undefined], ["calendar", undefined]]);
  });
});

describe("Leaving, personal scope", () => {
  it("renders without a Fund: the personal Calendar's rail, no pool, no cellar, and says so", async () => {
    const { opened } = await mount({ scope: "personal" });
    expect(q("[data-desk-leaving]").dataset.deskLeaving).toBe("calendar");
    expect(q("[data-desk-spoken]").dataset.deskSpoken).toBe("none");
    expect(q("[data-desk-spoken]").textContent).toMatch(/switch to Shared/i);
    expect(host.querySelector("[data-jar-state]")).toBeNull();
    expect(q(".desk-leaving__jars").textContent).toMatch(/shared Fund’s cellar/);
    expect(host.querySelector('[data-desk-door="cellar-bills"]')).toBeNull();
    expect(qa("[data-rail-date]").length).toBe(30);
    // No pool is unknown, not empty: the spoken-for card engraves —, never $0.
    expect(q("[data-desk-spoken] .desk-figure").textContent).toBe("—");
    expect(q("[data-desk-spoken]").textContent).not.toMatch(/\$0/);
    await act(async () => q<HTMLButtonElement>('[data-desk-door="calendar"]').click());
    expect(opened).toEqual([["calendar", undefined]]);
  });

  it("reads the rail's scheduled cash out as the table when there is no Fund walk", () => {
    const leaving = readLeaving(household, memberId, "personal", today, reading);
    const rail = readRail(household, memberId, "personal", today)!;
    const expected = rail.days.filter(day => day.date >= today).flatMap(day => day.items.filter(item => item.kind === "scheduled-out").map(item => item.id));
    expect(leaving.fund).toBe(false);
    expect(leaving.spoken).toBeNull();
    expect(leaving.jars).toBeNull();
    expect(leaving.table.rows.map(row => row.id)).toEqual(expected);
    expect(leaving.table.rows.every(row => row.leavesCents === null)).toBe(true);
  });
});
