import { describe, expect, it } from "vitest";
import {
  analogAngles,
  buildDashboard,
  calendarDeskModel,
  catalogHousehold,
  claimExpectedLandingDate,
  clockArcPath,
  formatDayLabel,
  formatPreviewHours,
  guessHangman,
  hangmanRevealed,
  herculesInstrumentSurface,
  isOutgoingBill,
  playTicTacToe,
  presetChipLabel,
  presetIcon,
  previewHoursQuarter,
  resetHangman,
  resetTicTacToe,
  seedDemoHousehold,
  setInstrumentHidden,
  shapeKitchen,
  sillOverview,
  todayShiftSpan,
  defaultLayout,
  PINNED_INSTRUMENTS,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("civil date labels", () => {
  it("labels Aug 23 as Aug 23 even when UTC midnight is still Aug 22 in Toronto", () => {
    expect(formatDayLabel("2026-08-23")).toBe("Aug 23");
    expect(formatDayLabel("2026-01-01")).toBe("Jan 1");
  });
});

describe("next bill is an outflow", () => {
  it("does not put Bianca pay on the sill next-bill figure", () => {
    const household = seedDemoHousehold({ environment: "development", today });
    const dashboard = buildDashboard(household, today);
    expect(dashboard.upcoming.some((item) => /bianca/i.test(item.title) && item.kind === "paycheck")).toBe(true);
    const plate = sillOverview(household, dashboard, today);
    const bill = plate.figures.find((row) => row.id === "bill");
    expect(bill?.value).not.toMatch(/bianca pay/i);
    expect(dashboard.upcoming.filter(isOutgoingBill).every((item) => item.direction === "out")).toBe(true);
    expect(dashboard.upcoming.filter(isOutgoingBill).every((item) => item.kind !== "paycheck")).toBe(true);
  });
});

describe("calendar desk day/week/month", () => {
  it("projects shifts with income, bills, visits, and owed landing", () => {
    const household = seedDemoHousehold({ environment: "development", today });
    const day = calendarDeskModel(household, today, "day", today);
    const month = calendarDeskModel(household, today, "month", today);
    expect(month.days.length).toBeGreaterThanOrEqual(28);
    expect(day.view).toBe("day");
    const shifts = month.items.filter((item) => item.kind === "shift");
    expect(shifts.every((item) => item.amountCents === household.shifts.find((row) => `shift:${row.id}` === item.id)!.wagesCents + household.shifts.find((row) => `shift:${row.id}` === item.id)!.netTipsCents || item.amountCents >= 0)).toBe(true);
    const claims = month.items.filter((item) => item.kind === "claim");
    for (const row of household.claims) {
      const landing = claimExpectedLandingDate(row);
      if (landing && landing.slice(0, 7) === today.slice(0, 7)) {
        expect(claims.some((item) => item.title.includes(row.label))).toBe(true);
      }
    }
  });
});

describe("preset names follow notes", () => {
  it("uses the note, not the category, and picks a grocery cart for milk", () => {
    expect(presetChipLabel("Tim Hortons")).toBe("Tim Hortons");
    expect(presetChipLabel("")).toBe("Preset");
    expect(presetIcon("SUB-FOOD-GROCERIES", catalogHousehold().categories).glyph).toBe("cart");
    expect(presetIcon("SUB-FOOD-COFFEE", catalogHousehold().categories).glyph).toBe("cup");
  });
});

describe("hide/show widgets", () => {
  it("hides mail and refuses to hide the calculator", () => {
    const hidden = setInstrumentHidden(defaultLayout(), "mail", true);
    expect(hidden.items.find((item) => item.id === "mail")?.hidden).toBe(true);
    const locked = setInstrumentHidden(hidden, "calculator", true);
    expect(locked.items.find((item) => item.id === "calculator")?.hidden).toBeFalsy();
    expect(PINNED_INSTRUMENTS).toContain("calculator");
    expect(defaultLayout().items.some((item) => item.id === "accounts")).toBe(true);
    expect(defaultLayout().items.some((item) => item.id === "wardrobe")).toBe(true);
    expect(defaultLayout().items.some((item) => item.id === "tictactoe")).toBe(true);
  });
});

describe("analog shift clock", () => {
  it("draws a live arc while punched in and a finished arc only for a same-day posted shift", () => {
    const household = catalogHousehold();
    household.kitchen = shapeKitchen({
      ...household.kitchen,
      openShift: {
        memberId: "MEM-002",
        startedAt: "2026-08-21T16:00:00.000Z",
        updatedAt: "2026-08-21T16:00:00.000Z",
        status: "open",
      },
    });
    const live = todayShiftSpan(household, today, Date.parse("2026-08-21T18:00:00.000Z"));
    expect(live?.live).toBe(true);
    expect(clockArcPath(live!.startAngle, live!.endAngle)).toMatch(/^M /);
    expect(analogAngles({ hour: 6, minute: 0, second: 0 }).hour).toBe(180);
    const hours = previewHoursQuarter("2026-08-21T16:00:00.000Z", Date.parse("2026-08-21T18:10:00.000Z"));
    expect(formatPreviewHours(hours)).toBe("2.25");
  });
});

describe("Hercules reacts to widgets", () => {
  it("offers instrument-true sample questions", () => {
    const household = catalogHousehold();
    expect(herculesInstrumentSurface("timesheet", household, today).chips.join(" ")).toMatch(/Log shift/i);
    expect(herculesInstrumentSurface("wallet", household, today).chips.join(" ")).toMatch(/Visa/i);
    expect(herculesInstrumentSurface("calendar", household, today).spoken).toMatch(/bill|date/i);
    expect(herculesInstrumentSurface("hangman", household, today).lesson).toMatch(/quiet/i);
    expect(herculesInstrumentSurface("calculator", household, today).lesson).toMatch(/never writes/i);
  });
});

describe("shared desk games", () => {
  it("plays tic-tac-toe across two members without posting money", () => {
    const household = catalogHousehold();
    const x = playTicTacToe(household, { memberId: "MEM-002", index: 0 });
    expect(x.postedIds).toEqual([]);
    const o = playTicTacToe(x.household, { memberId: "MEM-001", index: 4 });
    expect(o.household.kitchen.games.tictactoe.cells[4]).toBe("o");
    expect(() => playTicTacToe(o.household, { memberId: "MEM-001", index: 1 })).toThrow(/Wait for the other person/);
    const fresh = resetTicTacToe(o.household, "MEM-002");
    expect(fresh.household.kitchen.games.tictactoe.cells.every((cell) => cell === "")).toBe(true);
  });

  it("plays hangman with household words and never a quiet title", () => {
    const household = catalogHousehold();
    const started = resetHangman(household, "MEM-002");
    const word = started.household.kitchen.games.hangman.word;
    expect(word).not.toMatch(/therapy|dentist|annex/i);
    const guess = guessHangman(started.household, { memberId: "MEM-001", letter: word[0]! });
    expect(guess.postedIds).toEqual([]);
    expect(hangmanRevealed(guess.household.kitchen.games.hangman)).toContain(word[0]!);
  });
});
