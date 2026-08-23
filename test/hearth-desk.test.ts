import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  collapseOfficeLayout,
  collapseSavedOffice,
  DESK_GRID,
  defaultLayout,
  herculesIdle,
  herculesPageSurface,
  parseOfficeLayout,
  seedDemoHousehold,
  sillOverview,
  snapGrid,
  tidyOfficeLayout,
  buildDashboard,
  officeLayoutKey,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("page-true Hercules", () => {
  it("changes sample questions with the page", () => {
    const household = catalogHousehold();
    const home = herculesPageSurface("home", household, today);
    const books = herculesPageSurface("ledger", household, today);
    const calendar = herculesPageSurface("calendar", household, today);
    const plan = herculesPageSurface("plan", household, today);
    expect(home.chips.join(" ")).not.toBe(books.chips.join(" "));
    expect(books.chips.join(" ")).toMatch(/Opinion|Working capital/i);
    expect(calendar.chips.join(" ")).toMatch(/bill|owed|jar/i);
    expect(plan.placeholder).toMatch(/plan/i);
    expect(plan.chips.join(" ")).toMatch(/Leftover/i);
    expect(herculesIdle(household, "ledger", today).spoken).toMatch(/fieldwork|journal/i);
    expect(herculesIdle(household, "plan", today).replies.join(" ")).toMatch(/Sit-down|Groceries/i);
  });
});

describe("office desk rewrite", () => {
  it("adds calendar and appointments instruments and tidies to the grid", () => {
    const parsed = parseOfficeLayout({
      v: 1,
      items: [{ id: "wallet", x: 13, y: 41 }],
      expanded: "wallet",
      minimized: [],
      windowMinimized: false,
    });
    expect(parsed.items.some((item) => item.id === "calendar")).toBe(true);
    expect(parsed.items.some((item) => item.id === "appointments")).toBe(true);
    expect(snapGrid(13)).toBe(16);
    expect(DESK_GRID).toBe(16);
    const tidied = tidyOfficeLayout(parsed, "wide");
    expect(tidied.expanded).toBeNull();
    expect(tidied.items.find((item) => item.id === "wallet")?.x).toBe(16);
    expect(collapseOfficeLayout(parsed).expanded).toBeNull();
    const storage = {
      map: new Map<string, string>(),
      getItem(key: string) { return this.map.get(key) ?? null; },
      setItem(key: string, value: string) { this.map.set(key, value); },
    };
    storage.setItem(officeLayoutKey("development", "phone"), JSON.stringify({ ...defaultLayout(), expanded: "wallet" }));
    collapseSavedOffice("development", storage);
    expect(JSON.parse(storage.getItem(officeLayoutKey("development", "phone"))!).expanded).toBeNull();
  });

  it("puts Mint/YNAB overview figures on the sill, never as a weather sentence", () => {
    const household = seedDemoHousehold({ environment: "development", today });
    const dashboard = buildDashboard(household, today);
    const plate = sillOverview(household, dashboard, today);
    expect(plate.figures.some((row) => row.id === "net")).toBe(true);
    expect(plate.figures.some((row) => row.id === "wallet")).toBe(true);
    expect(plate.figures.some((row) => row.id === "bill")).toBe(true);
    expect(plate.needsMe.length).toBeGreaterThan(0);
    expect(plate.figures.every((row) => row.instrument !== "window")).toBe(true);
  });
});
