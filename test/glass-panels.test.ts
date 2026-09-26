// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HarbourReading } from "../src/harbour/data/reading.ts";
import { HostPanel, PANEL_DOORS } from "../src/harbour/panels/HostPanel.tsx";
import { campfirePanel, cellarPanel, daysToMonthEnd, fundBankPanel, fundExtrasFromBasin, glasshousePanel, libraryPanel, loftPanel, signedCents, type PanelHost } from "../src/harbour/panels/panelModel.ts";

/**
 * The compact panels (Tool Atlas brief §3.2 right-hand column, A12): pure
 * readings over `HarbourReading`, a dialog each with a Step in, and never a
 * command import. Fictional household: Jonathan and Bianca, CAD.
 */
const dir = join(process.cwd(), "src", "harbour", "panels");
const files = readdirSync(dir).filter((name) => /\.(ts|tsx)$/.test(name));
const importsOf = (source: string) => [...source.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map((m) => m[1]!);

describe("the panels import no command (A12)", () => {
  it("reads selectors and calls callbacks: no core/commands, no core index, no kitchen, no ledger writer", () => {
    expect(files.sort()).toEqual(["CompactPanel.tsx", "HostPanel.tsx", "panelModel.ts"]);
    const offences: string[] = [];
    for (const name of files) {
      const source = readFileSync(join(dir, name), "utf8");
      for (const specifier of importsOf(source)) {
        if (/\/core\/commands|\/core\/index|\/core$|kitchenCommand|\/ledger\/|ledgerSync|storage|continuity|supabase|\/App(\.tsx)?$/.test(specifier)) offences.push(`${name} → ${specifier}`);
      }
      if (/captureCommand|postEntry|postOneRecurrence|postTransfer|runKitchen|commitCommand/.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) offences.push(`${name} names a writer`);
    }
    expect(offences).toEqual([]);
  });
});

const reading = {
  everyday: 128_450,
  freshness: "current",
  cellar: { jars: [
    { key: "cellar:b1", label: "Hydro", umbrella: null, amountCents: 14_200, fill: 0.5, state: "planned", size: 2, due: "2026-09-27", missingMark: false },
    { key: "cellar:b0", label: "Rent", umbrella: null, amountCents: 180_000, fill: 1, state: "paid", size: 5, due: "2026-09-01", missingMark: false },
    { key: "cellar:b2", label: "Phone", umbrella: null, amountCents: 6_500, fill: 0, state: "planned", size: 1, due: "2026-09-26", missingMark: false },
    { key: "cellar:b3", label: "Internet", umbrella: null, amountCents: 8_000, fill: 0, state: "short", size: 1, due: "2026-09-29", missingMark: false },
    { key: "cellar:b4", label: "Gym", umbrella: null, amountCents: 4_500, fill: 0, state: "planned", size: 1, due: "2026-09-30", missingMark: false },
  ], days: [], todayIndex: 0, prepareCents: null, scaleCents: 0 },
  tower: { shelves: [{ id: "s", share: 1, cutoff: 0, full: false, banks: [{ key: "bank/g1", goalId: "g1", name: "Lisbon trip", cents: 120_000, targetCents: 300_000, step: 4, category: "travel", sculptSeed: "x" }] }], jug: { safeCents: 0, custodian: false, holder: null }, gun: { available: false }, largestTargetCents: 0, smallestTargetCents: 0 },
  glasshouse: { pots: [
    { key: "task/1", title: "Call the bank", state: "seed", dry: false, thread: "mine", bench: 0, staked: false, cat: false, date: null },
    { key: "task/2", title: "Book flights", state: "sprout", dry: true, thread: "both", bench: 0, staked: false, cat: false, date: "2026-09-20" },
  ], mine: { seed: 1, sprout: 0, bloom: 0 }, harvested: 3, perennials: [], dry: 1, overflow: 0 },
  kitchen: { cards: [{ key: "line/1", what: "Groceries", amountCents: 60_000, when: null, pot: "prepare", who: "both" }], monthKey: "2026-09", state: "proposed", waiting: true, overflow: 0 },
  campfire: { month: "2026-09", title: "September", close: "awaiting-partner", seats: [{ memberId: "m-j", name: "Jonathan", seated: true }, { memberId: "m-b", name: "Bianca", seated: false }], seated: 1, stones: 4, lit: true, lastClosedOn: null, sinceClose: null, seal: 0, overdue: false },
  boathouse: { wishes: 2, memories: 14, letters: 1, encounters: 0, hung: 0 },
  atlas: { era: { key: "era:e1", name: "The small flat", index: 1, months: 7, home: "flat", homeLabel: "a small flat", finishLine: "Married", plans: 2 }, eras: 2, crossed: 0, gate: { kind: "banks", met: false, lit: 3, lanterns: 8, words: "3 of 8 lit" }, crossing: false, next: null, stones: 7, keptPrivate: 0 },
  cottage: { name: "Hercules", worn: 1, looks: 3, keepsakes: 5 },
} as unknown as HarbourReading;

describe("the readings", () => {
  it("reads the Fund bank's accepted balance, as-of and last three moves; unknown is —", () => {
    const fund = fundBankPanel(reading, { fund: { acceptedCents: 471_680, asOf: "2026-09-25", moves: [
      { key: "a", label: "Groceries", cents: -1_240, date: "2026-09-24" }, { key: "b", label: "Bianca's contribution", cents: 120_000, date: "2026-09-20" },
      { key: "c", label: "Hydro", cents: -14_200, date: "2026-09-18" }, { key: "d", label: "Older", cents: -100, date: "2026-09-01" },
    ] } });
    expect(fund.everyday).toBe("$1,284.50");
    expect(fund.accepted).toBe("$4,716.80");
    expect(fund.asOf).toBe("Sep 25");
    expect(fund.moves.map((m) => m.amount)).toEqual(["−$12.40", "+$1,200.00", "−$142.00"]);
    expect(fundBankPanel(null).accepted).toBe("—");
    expect(signedCents(null)).toBe("—");
  });

  it("lists the next three unpaid bills, soonest first", () => {
    const cellar = cellarPanel(reading, { today: "2026-09-25" });
    expect(cellar.bills.map((b) => `${b.label} ${b.amount} ${b.due}`)).toEqual(["Phone $65.00 Sep 26", "Hydro $142.00 Sep 27", "Internet $80.00 Sep 29"]);
    expect(cellar.total).toBe(4);
    expect(cellar.bills[0]!.recurrenceId).toBeNull();
    const named = cellarPanel(reading, { today: "2026-09-25", bills: [{ key: "r-hydro", label: "Hydro", cents: 14_200, due: "2026-09-27", recurrenceId: "r-hydro" }] });
    expect(named.bills[0]!.recurrenceId).toBe("r-hydro");
  });

  it("reads banks, books, steps and the Campfire in the brief's words", () => {
    expect(loftPanel(reading).banks[0]).toMatchObject({ name: "Lisbon trip", line: "$1,200.00 of $3,000.00", step: 4 });
    expect(libraryPanel(reading, { books: { inCents: 612_000, outCents: 498_750, leftoverCents: 113_250, monthKey: "2026-09" } }).rows.map((r) => r.amount)).toEqual(["$6,120.00", "$4,987.50", "$1,132.50"]);
    expect(libraryPanel(reading).rows.map((r) => r.amount)).toEqual(["—", "—", "—"]);
    expect(glasshousePanel(reading).rows).toEqual([{ state: "To start", count: 1 }, { state: "Under way", count: 1 }, { state: "Done this week", count: 3 }]);
    expect(daysToMonthEnd("2026-09", "2026-09-25")).toBe(5);
    // Jonathan has sat; his phone says who the fire is waiting for.
    expect(campfirePanel(reading, { today: "2026-09-25", memberId: "m-j" }).line).toBe("Chapter closes in 5 days · waiting for Bianca");
    // Bianca has not; hers counts what needs her.
    expect(campfirePanel(reading, { today: "2026-09-25", memberId: "m-b", needsYou: 1 }).line).toBe("Chapter closes in 5 days · 1 card needs you");
  });
});

let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe("each panel", () => {
  const hosts: PanelHost[] = ["bank", "cellar", "tower", "kitchen", "library", "glasshouse", "campfire", "boathouse", "atlas", "cottage", "hercules"];

  it("is a named dialog with its one Open door and a Step in (Hercules: Talk and Visit)", async () => {
    for (const panelHost of hosts) {
      const opened: string[] = [];
      const stepped: string[] = [];
      await act(async () => root.render(createElement(HostPanel, { key: panelHost, host: panelHost, reading, extras: { today: "2026-09-25", memberId: "m-j" }, onClose: () => undefined, onOpen: (t) => opened.push(t), onStepIn: (h) => stepped.push(h) })));
      const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.dataset.compactPanel).toBe(panelHost);
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent!.length).toBeGreaterThan(0);
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(host.querySelector("[data-panel-close]")!.textContent).toContain("Put it back");
      if (panelHost === "hercules") {
        expect(host.querySelector("[data-panel-step-in]")).toBeNull();
        await act(async () => host.querySelector<HTMLButtonElement>("[data-panel-talk]")!.click());
        expect(opened).toEqual(["hercules"]);
        continue;
      }
      const door = host.querySelector<HTMLButtonElement>("[data-panel-door]")!;
      expect(door.textContent).toBe(PANEL_DOORS[panelHost].words);
      await act(async () => door.click());
      expect(opened).toEqual([PANEL_DOORS[panelHost].target]);
      await act(async () => host.querySelector<HTMLButtonElement>("[data-panel-step-in]")!.click());
      expect(stepped).toEqual([panelHost]);
    }
  });

  it("says the Open words the brief gives", () => {
    expect(Object.fromEntries(Object.entries(PANEL_DOORS).map(([k, v]) => [k, v.words]))).toEqual({
      bank: "Open the bank", cellar: "Open the Cellar", tower: "Open the banks", kitchen: "Open the table", library: "Open the books",
      glasshouse: "Open the steps", campfire: "Open the Campfire", boathouse: "Open the Boathouse", atlas: "Open the Atlas", cottage: "Visit",
    });
  });

  it("hands Mark paid a recurrence, and says why when it cannot", async () => {
    const paid: string[] = [];
    await act(async () => root.render(createElement(HostPanel, { host: "cellar", reading, extras: { today: "2026-09-25", bills: [
      { key: "r-hydro", label: "Hydro", cents: 14_200, due: "2026-09-27", recurrenceId: "r-hydro" },
      { key: "one-off", label: "Parking", cents: 2_000, due: "2026-09-28", recurrenceId: null },
    ] }, onClose: () => undefined, onOpen: () => undefined, onMarkPaid: (id) => paid.push(id) })));
    const marks = [...host.querySelectorAll<HTMLButtonElement>("[data-panel-mark-paid]")];
    expect(marks.map((m) => m.textContent)).toEqual(["Mark paid", "Mark paid"]);
    expect(marks[0]!.getAttribute("aria-label")).toBe("Mark paid: Hydro, $142.00");
    await act(async () => marks[0]!.click());
    await act(async () => marks[1]!.click());
    expect(paid).toEqual(["r-hydro"]);
    expect(marks[1]!.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(marks[1]!.getAttribute("aria-describedby")!)!.textContent).toMatch(/Open the Cellar/);
  });

  it("offers Record in the Fund bank, closes on Escape and returns focus", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const calls: string[] = [];
    let open = true;
    const render = () => root.render(open ? createElement(HostPanel, { host: "bank", reading, onClose: () => { open = false; calls.push("close"); }, onOpen: () => undefined, onRecord: () => calls.push("record") }) : null);
    await act(async () => render());
    await act(async () => host.querySelector<HTMLButtonElement>("[data-panel-record]")!.click());
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    await act(async () => { dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await act(async () => render());
    expect(calls).toEqual(["record", "close"]);
    expect(document.activeElement).toBe(opener);
    // Step in without a world is shown, disabled, with its reason.
    opener.remove();
  });

  it("reads the Fund bank from the shared-Fund basin reading, and says the shared Fund in Mine", async () => {
    const basin = { identity: "x", revision: 1, asOf: "2026-09-25", known: true, balanceCents: 471_680, kittyCents: 0, freeCents: 0, pendingCents: 0, targetCents: 0, flows: [
      { id: "e1", cents: 120_000, kind: "inlet" as const, label: "Confirmed Fund contribution", date: "2026-09-01" },
      { id: "e2", cents: 14_200, kind: "outlet" as const, label: "Confirmed Fund settlement", date: "2026-09-18" },
      { id: "e3", cents: 5_000, kind: "reserve-out" as const, label: "Moved into Kitty reserves", date: "2026-09-20" },
      { id: "e4", cents: 2_000, kind: "reserve-in" as const, label: "Released from Kitty reserves", date: "2026-09-24" },
    ] };
    const fund = fundExtrasFromBasin(basin, 128_450);
    expect(fund.acceptedCents).toBe(471_680);
    expect(fund.asOf).toBe("2026-09-25");
    expect(fund.moves.map((m) => m.cents)).toEqual([2_000, -5_000, -14_200]);
    expect(fundExtrasFromBasin({ ...basin, known: false, balanceCents: null })).toEqual({ acceptedCents: null, asOf: null, moves: [] });
    expect(fundBankPanel(null, { fund }).everyday).toBe("$1,284.50");
    await act(async () => root.render(createElement(HostPanel, { host: "bank", reading, extras: { fund, space: "mine" }, onClose: () => undefined, onOpen: () => undefined })));
    expect(host.textContent).toContain("the shared Fund · Everyday · now $1,284.50");
    expect(host.textContent).toContain("$4,716.80");
    expect(host.textContent).not.toMatch(/my Fund/i);
    await act(async () => root.render(createElement(HostPanel, { host: "bank", reading, extras: { fund, space: "ours" }, onClose: () => undefined, onOpen: () => undefined })));
    expect(host.textContent).not.toContain("the shared Fund");
  });

  it("keeps an overdue bill the App hands in, so Mark paid can reach it", () => {
    const cellar = cellarPanel(reading, { today: "2026-09-25", bills: [{ key: "late", label: "Water", cents: 4_000, due: "2026-09-20", recurrenceId: "r-water" }] });
    expect(cellar.bills.map((b) => b.recurrenceId)).toEqual(["r-water"]);
  });
});
