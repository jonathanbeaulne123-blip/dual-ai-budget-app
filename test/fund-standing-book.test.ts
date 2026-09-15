import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_CARD_MARK,
  BOOK_GATE_X,
  PLATE_VIEW,
  accountRowEdge,
  accountRowFigure,
  accountRows,
  bookHeadState,
  bookmarkStance,
  concertinaCornerX,
  concertinaPanels,
  concertinaView,
  floorRulings,
  foreEdgeIsFlush,
  fundPlates,
  fundStandingBookEnabled,
  gateIndex,
  gateShift,
  pocketCards,
  registerStrip,
  ribbonHeights,
  seedDemoHousehold,
  sparkHeights,
  trackPeakCents,
  trackX,
  wellColumns,
  wellWater,
  type AccountRow,
  type PlateEdge,
} from "../src/core/index.ts";

const TODAY = "2026-09-12";
const leafSource = readFileSync(new URL("../src/core/bookLeaf.ts", import.meta.url), "utf8");
const bookSource = readFileSync(new URL("../src/FundStandingBook.tsx", import.meta.url), "utf8");
const featureSource = readFileSync(new URL("../src/core/planFeature.ts", import.meta.url), "utf8");
const ledgeSource = readFileSync(new URL("../src/FundLedge.tsx", import.meta.url), "utf8");
const officeSource = readFileSync(new URL("../src/OfficeWide.tsx", import.meta.url), "utf8");

describe("the Standing Book flag", () => {
  it("is off unless asked for, and cannot outlive the Household Home it presents", () => {
    expect(fundStandingBookEnabled(undefined, undefined, undefined)).toBe(false);
    expect(fundStandingBookEnabled("0", undefined, undefined)).toBe(false);
    expect(fundStandingBookEnabled("yes", undefined, undefined)).toBe(false);
    expect(fundStandingBookEnabled("1", undefined, undefined)).toBe(true);
    expect(fundStandingBookEnabled("true", undefined, undefined)).toBe(true);
    expect(fundStandingBookEnabled("1", "0", undefined)).toBe(false);
    expect(fundStandingBookEnabled("1", undefined, "false")).toBe(false);
    const fn = featureSource.slice(featureSource.indexOf("export function fundStandingBookEnabled"));
    expect(fn).toContain('(value === "1" || value === "true")');
    expect(fn).toContain("householdHomeV2Enabled(homeValue, planValue)");
    expect(fn).toContain("import.meta.env.VITE_FUND_STANDING_BOOK");
  });

  it("stands the book in place of the board only when the flag is on, in both hosts, and leaves the stage alone", () => {
    for (const source of [ledgeSource, officeSource]) {
      expect(source).toContain("fundStandingBookEnabled()");
      expect(source).toContain("<FundStandingBook");
      expect(source).toContain("<FundBoard");
      expect(source).toContain("<FundStage");
    }
    // The book and the board receive the identical props at each host.
    const ledgeBook = ledgeSource.slice(ledgeSource.indexOf("<FundStandingBook"), ledgeSource.indexOf("/>", ledgeSource.indexOf("<FundStandingBook")));
    const ledgeBoard = ledgeSource.slice(ledgeSource.indexOf("<FundBoard "), ledgeSource.indexOf("/>", ledgeSource.indexOf("<FundBoard ")));
    expect(ledgeBook.replace("<FundStandingBook", "").replace(/\s+/g, " ")).toBe(ledgeBoard.replace("<FundBoard", "").replace(/\s+/g, " "));
    const officeBook = officeSource.slice(officeSource.indexOf("<FundStandingBook"), officeSource.indexOf("/>", officeSource.indexOf("<FundStandingBook")));
    const officeBoard = officeSource.slice(officeSource.indexOf("<FundBoard "), officeSource.indexOf("/>", officeSource.indexOf("<FundBoard ")));
    expect(officeBook.replace("<FundStandingBook", "").replace(/\s+/g, " ")).toBe(officeBoard.replace("<FundBoard", "").replace(/\s+/g, " "));
  });
});

describe("the book's paper geometry", () => {
  it("lets only attention stand proud and dog-eared, and calls the fore-edge flush when nothing reaches", () => {
    expect(bookmarkStance("attention")).toEqual({ reach: 2, dogEar: true });
    expect(bookmarkStance("live")).toEqual({ reach: 1, dogEar: false });
    expect(bookmarkStance("quiet")).toEqual({ reach: 0, dogEar: false });
    expect(bookmarkStance("clear")).toEqual({ reach: 0, dogEar: false });
    expect(foreEdgeIsFlush(["clear", "clear", "clear"])).toBe(true);
    expect(foreEdgeIsFlush([])).toBe(true);
    expect(foreEdgeIsFlush(["clear", "live"])).toBe(false);
    expect(foreEdgeIsFlush(["clear", "attention"])).toBe(false);
  });

  it("names the running head's state from the Level's edge and never with a number", () => {
    const edges: PlateEdge[] = ["clear", "attention", "live", "quiet"];
    const words = edges.map(bookHeadState);
    expect(new Set(words).size).toBe(4);
    for (const word of words) expect(word).not.toMatch(/\d|\$/);
    expect(bookHeadState("clear")).toBe("Covered");
  });

  it("folds one strip once per point, stands only what happened, and lays the rest flat", () => {
    const points = [1000, 500, 1500, 250];
    const panels = concertinaPanels(points, 28, 2);
    expect(panels).toHaveLength(3);
    expect(panels.map((panel) => panel.standing)).toEqual([true, false, false]);
    expect(panels.map((panel) => panel.fold)).toEqual(["a", "b", "a"]);
    // Height is the only channel: the taller point sits higher on the page.
    const { base } = concertinaView(28);
    const heights = sparkHeights(points, 28);
    expect(panels[1]!.y1).toBe(base - heights[2]!);
    expect(panels[0]!.y0).toBe(base - heights[0]!);
    expect(base - panels[1]!.y1).toBeGreaterThan(base - panels[0]!.y0);
    // Without a boundary every point is a fact, every panel stands, and no corner is invented.
    expect(concertinaPanels(points, 28).every((panel) => panel.standing)).toBe(true);
    expect(concertinaCornerX(points.length)).toBeNull();
    expect(concertinaCornerX(points.length, 2)).toBe(panels[0]!.x1);
    expect(concertinaCornerX(points.length, 0)).toBe(PLATE_VIEW.left);
    expect(concertinaPanels([100], 28, 1)).toEqual([]);
    expect(concertinaPanels([], 28, 0)).toEqual([]);
  });

  it("keeps a negative point on the page, folded down from the same baseline", () => {
    const { base, height } = concertinaView(28);
    const panels = concertinaPanels([1000, -1000], 28, 2);
    expect(panels[0]!.y0).toBe(base - 28);
    expect(panels[0]!.y1).toBe(base + 28);
    expect(panels[0]!.y1).toBeLessThanOrEqual(height);
  });

  it("keeps the gate fixed and moves the strip so the chosen mark stands in it", () => {
    expect(gateIndex(-3, 5)).toBe(0);
    expect(gateIndex(9, 5)).toBe(4);
    expect(gateIndex(2.4, 5)).toBe(2);
    expect(gateIndex(1, 0)).toBe(0);
    expect(trackX(18, 31) + gateShift(18, 31)).toBeCloseTo(BOOK_GATE_X);
    expect(trackX(1, 7) + gateShift(1, 7)).toBeCloseTo(BOOK_GATE_X);
    expect(trackPeakCents([])).toBe(0);
    expect(trackPeakCents([200, 1400, 90])).toBe(1400);
  });

  it("sinks wells side by side on the page and never lets the water overflow", () => {
    const columns = wellColumns(3);
    expect(columns).toHaveLength(3);
    expect(columns[0]!.x).toBe(PLATE_VIEW.left);
    expect(columns[2]!.x + columns[2]!.width).toBeCloseTo(PLATE_VIEW.right);
    expect(wellColumns(0)).toEqual([]);
    expect(wellWater(50, 100, 40)).toBe(20);
    expect(wellWater(500, 100, 40)).toBe(40);
    expect(wellWater(10, 0, 40)).toBe(0);
  });

  it("stands as many cards in the pocket as the count, and shows an empty pocket for an uncountable tally", () => {
    expect(pocketCards(3)).toHaveLength(3);
    expect(pocketCards(0)).toEqual([]);
    expect(pocketCards(32)).toEqual([]);
    expect(pocketCards(1.5)).toEqual([]);
  });

  it("gives the two ribbons one scale and rules the floor evenly", () => {
    const heights = ribbonHeights(2000, 1000, 40);
    expect(heights.up).toBe(40);
    expect(heights.down).toBe(20);
    expect(ribbonHeights(0, 0, 40)).toEqual({ up: 0, down: 0 });
    expect(floorRulings(4)).toHaveLength(5);
    expect(floorRulings(4)[0]).toBe(PLATE_VIEW.left);
    expect(floorRulings(4)[4]).toBeCloseTo(PLATE_VIEW.right);
    expect(floorRulings(0)).toEqual([]);
  });

  it("turns the real Level walk into a concertina whose corner is today", () => {
    const household = seedDemoHousehold({ today: TODAY, environment: "development" });
    const before = JSON.stringify(household);
    const level = fundPlates({ household, memberId: "MEM-001", today: TODAY }).find((plate) => plate.id === "fund-level");
    expect(level).toBeTruthy();
    expect(level!.figure.primitive).toBe("spark");
    if (level!.figure.primitive !== "spark") return;
    const { points, room, actualCount } = level!.figure;
    expect(actualCount).toBeDefined();
    const panels = concertinaPanels(points, room, actualCount);
    expect(panels.filter((panel) => panel.standing)).toHaveLength(Math.max(0, Math.min(points.length, actualCount!) - 1));
    expect(panels.filter((panel) => !panel.standing)).toHaveLength(panels.length - Math.max(0, Math.min(points.length, actualCount!) - 1));
    expect(concertinaCornerX(points.length, actualCount)).not.toBeNull();
    expect(JSON.stringify(household)).toBe(before);
  });
});

describe("the register as a strip", () => {
  it("keeps the ink running line as written, folds where it stops, and lays one flat pencil panel per uncounted row level with the last ink point", () => {
    const strip = registerStrip([100, 250, -40, 900], 2);
    expect(strip.points).toEqual([100, 250, -40, 900, 900, 900]);
    expect(strip.actualCount).toBe(4);
    const panels = concertinaPanels(strip.points, 28, strip.actualCount);
    expect(panels.map((panel) => panel.standing)).toEqual([true, true, true, false, false]);
    // A flat pencil panel carries no height of its own: both ends sit on the last ink point.
    for (const panel of panels.filter((panel) => !panel.standing)) expect(panel.y0).toBe(panel.y1);
    expect(concertinaCornerX(strip.points.length, strip.actualCount)).toBe(panels[2]!.x1);
  });

  it("windows a long register to its newest points, keeps room for pencil, and lays nothing when there is no ink", () => {
    const long = Array.from({ length: 60 }, (_, index) => index * 10);
    const plain = registerStrip(long, 0);
    expect(plain.points).toHaveLength(24);
    expect(plain.points.at(-1)).toBe(590);
    expect(plain.actualCount).toBe(24);
    const withPencil = registerStrip(long, 5);
    expect(withPencil.actualCount).toBe(19);
    expect(withPencil.points).toHaveLength(24);
    expect(new Set(withPencil.points.slice(19))).toEqual(new Set([590]));
    // Pencil never crowds out the ink past half the room.
    const crowded = registerStrip(long, 40);
    expect(crowded.actualCount).toBe(12);
    expect(crowded.points).toHaveLength(24);
    expect(registerStrip([], 3)).toEqual({ points: [], actualCount: 0 });
    expect(registerStrip([500], 2).points).toEqual([500, 500, 500]);
    expect(registerStrip([500], 2).actualCount).toBe(1);
  });

  it("gives a sticky the accounts plate's own edge and figure, never a second threshold", () => {
    const base: AccountRow = {
      accountId: "A", name: "A", accessibilityName: "A", detailLabel: null, kind: "chequing", scope: "shared",
      balanceCents: 100, balanceLabel: "book balance", utilization: null, isFundCard: false, booksTarget: { tab: "ledger", accountId: "A" },
    };
    expect(accountRowEdge(base)).toBe("clear");
    expect(accountRowEdge({ ...base, balanceCents: -1 })).toBe("attention");
    const card: AccountRow = { ...base, kind: "credit", balanceLabel: "owed", utilization: 0.3 };
    expect(accountRowEdge(card)).toBe("clear");
    expect(accountRowEdge({ ...card, utilization: 0.31 })).toBe("attention");
    // A card below zero is not the non-card rule's business.
    expect(accountRowEdge({ ...card, balanceCents: -5, utilization: 0.1 })).toBe("clear");
    expect(accountRowFigure(card)).toEqual({ primitive: "gauge", pct: 0.3, threshold: ACCOUNT_CARD_MARK, label: "A" });
    expect(accountRowFigure(base)).toEqual({ primitive: "tally", count: 1 });
    // The plate and the stickies read one rule: the seeded accounts plate's edge is the chosen row's edge.
    const household = seedDemoHousehold({ today: TODAY, environment: "development" });
    const accounts = fundPlates({ household, memberId: "MEM-001", today: TODAY }).find((plate) => plate.id === "accounts")!;
    const rows = accountRows(household, "MEM-001", TODAY);
    const chosen = rows.find((row) => accounts.glance.startsWith(`${row.name} ·`))!;
    expect(accountRowEdge(chosen)).toBe(accounts.edge);
    expect(accountRowFigure(chosen)).toEqual(accounts.figure);
  });
});

describe("the book's fences", () => {
  it("keeps money, households and commands out of the geometry", () => {
    expect(leafSource).not.toMatch(/formatCad|Household|fundWalk|balanceCents|todayBalance/);
    expect(leafSource).not.toMatch(/\b(postEntry|postTransfer|confirmHouseholdFundSettlement|commit)\s*\(/);
    expect(leafSource).toContain('from "./plates.ts"');
  });

  it("keeps the component exhaustive over the six primitives, read-only, and free of the forbidden plate ids", () => {
    expect(bookSource).toContain("const never: never = figure;");
    expect(bookSource).toContain('switch (figure.primitive)');
    expect(bookSource).toContain('role="tablist" aria-label="Fund board"');
    expect(bookSource).toContain('role="tab"');
    expect(bookSource).toContain("onKeyDown={navigate}");
    expect(bookSource).not.toMatch(/postEntry|postTransfer|confirmHouseholdFundContribution|onKitchen|sessionStorage|localStorage/);
    expect(bookSource).not.toMatch(/id === "now"|"attention" as|"change"/);
    expect(bookSource).not.toMatch(/\bcents\s*[-+*/]\s*\w|\w\s*[-+*/]\s*cents\b/i);
  });

  it("keeps the stickies a separate group on the head, a deep link into the accounts chapter, and no new id or persisted value", () => {
    expect(bookSource).toContain('role="group" aria-label={`Accounts linked to the Fund, ${rows.length}`}');
    // The host is synced only when the accounts chapter is on the rail it gave us; the spread never waits for it.
    expect(bookSource).toContain('const accountsOnRail = slots.includes("accounts");');
    expect(bookSource).toContain('if (accountsOnRail) onSelect("accounts");');
    expect(bookSource).toContain('const focusedRow = focusedAccountId ? rows.find(');
    expect(bookSource).toContain("booksPresentationFloor(household, memberId, \"household\")");
    expect(bookSource).toContain("accountRegister(books, accountId)");
    expect(bookSource).toContain("{ recognizedOnly: false }");
    expect(bookSource).not.toMatch(/reduce\(|accountBookBalance|creditCardView\(|householdWallet|trialBalance/);
    // The sticky group never borrows the tablist's vocabulary.
    const stickies = bookSource.slice(bookSource.indexOf("function Stickies"), bookSource.indexOf("/** The running head"));
    expect(stickies).not.toMatch(/role="tab"|aria-selected|aria-controls|FundWidgetId|DeskPlateId/);
    expect(stickies).toContain("aria-pressed={pressed}");
  });
});
