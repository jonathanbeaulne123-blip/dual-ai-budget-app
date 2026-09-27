import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_CARD_MARK,
  BOOK_GATE_X,
  PLATE_VIEW,
  accountRowEdge,
  accountRowFigure,
  accountRows,
  binderDividers,
  bookHeadState,
  bookmarkStance,
  categoryRowEdge,
  categoryRowFigure,
  categoryRowHasShape,
  categoryRowVerdict,
  categoryShape,
  concertinaCornerX,
  concertinaPanels,
  concertinaView,
  figureFlags,
  flagHue,
  floorRulings,
  foreEdgeIsFlush,
  formatCad,
  fundPlates,
  fundStandingBookEnabled,
  gateIndex,
  gateShift,
  openPage,
  PAGED_SECTIONS,
  pocketCards,
  registerStrip,
  sectionIsPaged,
  ribbonHeights,
  seedDemoHousehold,
  sparkHeights,
  trackPeakCents,
  trackX,
  wellColumns,
  wellWater,
  type AccountRow,
  type CategoryShape,
  type FundWidgetId,
  type PlateEdge,
} from "../src/core/index.ts";

const TODAY = "2026-09-12";
const leafSource = readFileSync(new URL("../src/core/bookLeaf.ts", import.meta.url), "utf8");
const bookSource = readFileSync(new URL("../src/FundStandingBook.tsx", import.meta.url), "utf8");
const featureSource = readFileSync(new URL("../src/core/planFeature.ts", import.meta.url), "utf8");
const officeSource = readFileSync(new URL("../src/OfficeWide.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/fund-standing-book.css", import.meta.url), "utf8");

/** Every `fn(` call in the stylesheet with the text between its parentheses, brackets balanced. */
function cssCalls(source: string, names: readonly string[]): { name: string; args: string; line: number }[] {
  const calls: { name: string; args: string; line: number }[] = [];
  const pattern = new RegExp(`(${names.join("|")})\\(`, "g");
  for (const match of source.matchAll(pattern)) {
    let depth = 1;
    let index = match.index! + match[0].length;
    const start = index;
    while (depth && index < source.length) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") depth -= 1;
      index += 1;
    }
    calls.push({ name: match[1]!, args: source.slice(start, index - 1), line: source.slice(0, match.index).split("\n").length });
  }
  return calls;
}

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

  it("stands the book in place of the board only when the flag is on, and leaves the stage alone (the phone Fund ledge is retired, K1)", () => {
    for (const source of [officeSource]) {
      expect(source).toContain("fundStandingBookEnabled()");
      expect(source).toContain("<FundStandingBook");
      expect(source).toContain("<FundBoard");
      expect(source).toContain("<FundStage");
    }
    // The book and the board receive the identical props at each host.
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

describe("the binder's two levels", () => {
  it("pages a section by name, never by the shape of its figure, and offers flags only off a list the plate already carries", () => {
    expect([...PAGED_SECTIONS].sort()).toEqual(["accounts", "next-out", "shape", "waiting"]);
    for (const id of ["level", "week", "settle", "streams", "shelf", "spoken-for", "swipe", "contribute"] as FundWidgetId[]) expect(sectionIsPaged(id)).toBe(false);
    // A strip offers one flag per mark, in the strip's order; a countable pocket one per card; everything else is one page.
    const marks = figureFlags({ primitive: "track", days: 31, room: 28, marks: [{ day: 18, cents: 14230, label: "Hydro" }, { day: 25, cents: 185000, label: "Rent" }] });
    expect(marks).toEqual([{ id: "mark-0", name: "Hydro", detail: "day 18" }, { id: "mark-1", name: "Rent", detail: "day 25" }]);
    expect(figureFlags({ primitive: "tally", count: 3 }).map((flag) => flag.name)).toEqual(["Card 1 of 3", "Card 2 of 3", "Card 3 of 3"]);
    expect(figureFlags({ primitive: "tally", count: 0 })).toEqual([]);
    expect(figureFlags({ primitive: "tally", count: 40 })).toEqual([]);
    expect(figureFlags({ primitive: "spark", points: [1, 2, 3], room: 28 })).toEqual([]);
    expect(figureFlags({ primitive: "gauge", pct: .5, threshold: .3, label: "x" })).toEqual([]);
    expect(figureFlags({ primitive: "fill", wells: [{ savedCents: 1, targetCents: 2, name: "w" }] })).toEqual([]);
    expect(figureFlags({ primitive: "pair", upCents: 1, downCents: 2, upLabel: "a", downLabel: "b", room: 28 })).toEqual([]);
    // No flag carries a figure or a state of its own: the marks' cents stay on the strip.
    for (const flag of marks) expect(JSON.stringify(flag)).not.toMatch(/cents|edge|\$/);
  });

  it("opens a section never visited on its first page, reopens a visited one on the page it was left on, and clamps onto the flags there are", () => {
    expect(openPage({}, "accounts", 12)).toBe(0);
    expect(openPage({ accounts: 4 }, "accounts", 12)).toBe(4);
    // Another section's page is never this section's: next-out opens on its first page whatever the accounts left open.
    expect(openPage({ accounts: 4 }, "next-out", 6)).toBe(0);
    expect(openPage({ accounts: 4, "next-out": 2 }, "next-out", 6)).toBe(2);
    expect(openPage({ accounts: 4, "next-out": 2 }, "accounts", 12)).toBe(4);
    // Clamped onto the flags the section has now, never past the end.
    expect(openPage({ "next-out": 9 }, "next-out", 6)).toBe(5);
    expect(openPage({ "next-out": -1 }, "next-out", 6)).toBe(0);
    expect(openPage({ "next-out": 2 }, "next-out", 0)).toBe(0);
    // Position in the sequence, one to six, round and round; never a meaning.
    expect([0, 1, 2, 3, 4, 5, 6, 7, 11, 12].map(flagHue)).toEqual([1, 2, 3, 4, 5, 6, 1, 2, 6, 1]);
    expect(flagHue(-1)).toBe(6);
    expect(flagHue(Number.NaN)).toBe(1);
  });

  it("binds a divider for every permitted section: the rail's slots first in rail order, then the rest of the library, nothing twice", () => {
    const permitted: FundWidgetId[] = ["level", "swipe", "contribute", "waiting", "next-out", "spoken-for", "week", "shape", "streams", "seven-days", "shelf", "record", "minutes", "accounts", "settle"];
    const slots: FundWidgetId[] = ["level", "swipe", "waiting", "settle", "next-out", "spoken-for"];
    const dividers = binderDividers(slots, permitted);
    expect(dividers.slice(0, 6)).toEqual(slots);
    expect(dividers.slice(6)).toEqual(["contribute", "week", "shape", "streams", "seven-days", "shelf", "record", "minutes", "accounts"]);
    expect(new Set(dividers).size).toBe(dividers.length);
    expect(dividers).not.toContain("ask");
    expect(binderDividers([], permitted)).toEqual(permitted);
    expect(binderDividers(["level", "level"], ["level"])).toEqual(["level"]);
  });

  it("gives a category flag the shape plate's own edge, figure and sentence, never a second threshold", () => {
    const row = (verdict: CategoryShape["verdict"], extra: Partial<CategoryShape> = {}): CategoryShape => ({
      subcategoryId: "CAT-RENT", label: "Rent", monthToDateCents: 330000, bandLowCents: 185000, bandHighCents: 185000, deltaCents: 145000, verdict, monthsSeen: 3, ...extra,
    });
    expect(categoryRowEdge(row("above"))).toBe("attention");
    for (const verdict of ["in-shape", "quiet", "one-off", "unknown"] as const) expect(categoryRowEdge(row(verdict))).toBe("clear");
    expect(categoryRowFigure(row("above"))).toEqual({ primitive: "spark", points: [185000, 185000, 330000], room: 28 });
    expect(categoryRowFigure(row("quiet", { monthToDateCents: 1000 }))).toEqual({ primitive: "spark", points: [185000, 185000, 1000], room: 28 });
    expect(categoryRowFigure(row("unknown", { monthsSeen: 1 }))).toEqual({ primitive: "spark", points: [], room: 28 });
    expect(categoryRowHasShape(row("one-off"))).toBe(false);
    expect(categoryRowVerdict(row("above"))).toBe(`Rent has run ${formatCad(145000)} over its own trailing shape.`);
    expect(categoryRowVerdict(row("unknown"))).toBe("Rent has not enough history yet to draw a shape.");
    // The plate and the flags read one rule: the seeded shape plate's edge, figure and verdict are its worst row's.
    const household = seedDemoHousehold({ today: TODAY, environment: "development" });
    const plate = fundPlates({ household, memberId: "MEM-001", today: TODAY }).find((item) => item.id === "shape")!;
    const rows = categoryShape(household, "2026-09", TODAY);
    const worst = rows.find((item) => item.verdict === "above")!;
    expect(categoryRowEdge(worst)).toBe(plate.edge);
    expect(categoryRowFigure(worst)).toEqual(plate.figure);
    expect(categoryRowVerdict(worst)).toBe(plate.verdict);
  });
});

describe("the stylesheet's fences", () => {
  it("never stands a token a dressing may paint as an image where a colour belongs", () => {
    // The tokens at risk are read from the stylesheet itself: any --fund-book-* that some rule sets to a gradient.
    const imageTokens = [...new Set([...cssSource.matchAll(/(--fund-book-[a-z-]+):\s*[^;]*gradient\(/g)].map((match) => match[1]!))];
    expect(imageTokens).toEqual(expect.arrayContaining(["--fund-book-stage", "--fund-book-cover", "--fund-book-mark-bg", "--fund-book-edge", "--fund-book-rulings"]));
    const colourPositions = cssCalls(cssSource, ["linear-gradient", "radial-gradient", "repeating-linear-gradient", "repeating-radial-gradient", "conic-gradient", "color-mix", "rgb", "rgba", "hsl", "oklch"]);
    expect(colourPositions.length).toBeGreaterThan(40);
    const offences = colourPositions.flatMap((call) => imageTokens
      .filter((token) => new RegExp(`var\\(${token}\\s*[,)]`).test(call.args))
      .map((token) => `line ${call.line}: ${call.name}(… var(${token}) …)`));
    expect(offences).toEqual([]);
  });

  it("fades the head strip by mask, cuts every dog-ear out of its paper, and mixes the Classic spine from a colour", () => {
    // The fade needs no colour at all, so it paints under any dressing and degrades to an un-faded strip, never to nothing.
    for (const more of ["start", "end", "both"]) {
      const rule = cssSource.slice(cssSource.indexOf(`.fund-book-head-shelf[data-head-more="${more}"] .fund-book-head-edge {`));
      expect(rule.slice(0, rule.indexOf("}"))).toMatch(/\n\s+mask-image: linear-gradient\(/);
      expect(rule.slice(0, rule.indexOf("}"))).toContain("-webkit-mask-image: linear-gradient(");
    }
    expect(cssSource).not.toMatch(/\.fund-book-head-shelf::(before|after)/);
    // A dog-ear is a real cut in the bookmark, the sticky and the cover, so the stage shows through it whatever it is painted with.
    for (const selector of ["\n.fund-book-mark.is-dogeared {", '\n.fund-book-sticky[data-sticky-state="attention"] {', '\n.fund-book[data-fund-book-edge="proud"] .fund-book-cover {']) {
      expect(cssSource.indexOf(selector), selector).toBeGreaterThan(0);
      const rule = cssSource.slice(cssSource.indexOf(selector));
      expect(rule.slice(0, rule.indexOf("}"))).toContain("clip-path: polygon(");
    }
    for (const flap of [".fund-book-mark.is-dogeared::after {", '.fund-book-sticky[data-sticky-state="attention"]::after {']) {
      const rule = cssSource.slice(cssSource.indexOf(flap));
      expect(rule.slice(0, rule.indexOf("}"))).toContain("background: var(--fund-book-paper-deep);");
    }
    expect(cssSource).toContain("--fund-book-cover-tone: color-mix(in srgb, var(--pine-2) 78%, var(--ink));");
    expect(cssSource).toContain("var(--fund-book-spine), var(--fund-book-cover-tone) 45%, var(--fund-book-spine)");
    // Every colour token the fade and the dog-ears lean on is defined once on the bare .fund-book as a colour, not an image.
    const base = cssSource.slice(cssSource.indexOf(".fund-book {"), cssSource.indexOf("/* ---- the fore-edge"));
    for (const token of ["--fund-book-paper-deep", "--fund-book-paper-shade", "--fund-book-paper", "--fund-book-cover-tone"]) {
      const declaration = base.match(new RegExp(`${token}: ([^;]+);`));
      expect(declaration, token).toBeTruthy();
      expect(declaration![1]).not.toMatch(/gradient\(|url\(/);
    }
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

  it("keeps the flags a second tablist on the open section's top edge, a sibling of the fore-edge, with no deep link, no new id and no persisted value", () => {
    expect(bookSource).toContain('role="tablist" aria-label={`Pages in ${sectionName}`}');
    expect(bookSource).toContain('role="tabpanel" aria-labelledby={flags.length ? `${bookId}-flag-${page}` : dividerId(section)}');
    // The page left open in each section is remembered by section and derived in the same render, so a change of section never shows another section's page.
    expect(bookSource).toContain("const page = openPage(remembered, section, flags.length);");
    expect(bookSource).toContain("const [remembered, setRemembered] = useState<OpenPages>({});");
    expect(bookSource).toContain("const focusedRow = section === \"accounts\" ? rows[page] ?? null : null;");
    // A flag never asks the host to move, and a library divider opens on the book itself: the only onSelect is a rail divider's.
    expect(bookSource.match(/onSelect\(/g)).toHaveLength(1);
    expect(bookSource).toContain("if (onRail) { setPicked(null); onSelect(id); } else { setPicked({ section: id, host: selected }); }");
    expect(bookSource).toContain("binderDividers(slots, FUND_WIDGETS.filter((id) => widgetAllowedFor(id, household, memberId)))");
    expect(bookSource).not.toMatch(/onSelect\("accounts"\)|accountsOnRail|focusedAccountId|aria-pressed=\{pressed\}|fundRail\s*[:=]|setRail|storeRail|saveRail/);
    expect(bookSource).toContain("booksPresentationFloor(household, memberId, \"household\")");
    expect(bookSource).toContain("accountRegister(books, accountId)");
    expect(bookSource).toContain("{ recognizedOnly: false }");
    expect(bookSource).toContain("categoryShape(household, monthKey, today)");
    expect(bookSource).not.toMatch(/reduce\(|accountBookBalance|creditCardView\(|householdWallet|trialBalance|householdFundContributionMotions|fundWalk\(/);
    // The flags borrow nothing from the fore-edge's contract: no host panel id, no widget id, no plate id.
    const strip = bookSource.slice(bookSource.indexOf("function PageFlags"), bookSource.indexOf("/** The running head"));
    expect(strip).toContain('role="tab"');
    expect(strip).toContain("aria-controls={pageId}");
    expect(strip).toContain("aria-selected={index === page}");
    expect(strip).toContain("tabIndex={index === page ? 0 : -1}");
    expect(strip).toContain("onKeyDown={navigate}");
    expect(strip).not.toMatch(/panelId|data-fund-widget|data-plate-id|fund-rail-tab|aria-pressed|DeskPlateId/);
    // The fore-edge keeps FundBoard's ids, aria-controls and roving tabindex on the rail's dividers; a library divider controls the book's own page.
    expect(bookSource).toContain('const dividerId = (id: FundWidgetId) => presentation === "desk" ? `fund-rail-tab-${byId.get(id)?.id ?? id}` : `${panelId}-tab-${id}`;');
    const edge = bookSource.slice(bookSource.indexOf('role="tablist" aria-label="Fund board"'));
    expect(edge).toContain("id={dividerId(id)}");
    expect(edge).toContain("aria-controls={onRail ? panelId : pageId}");
    expect(edge).toContain("aria-selected={section === id}");
    expect(edge).toContain("tabIndex={section === id ? 0 : -1}");
    expect(edge).toContain("onKeyDown={navigate}");
    // Every flag is a 44px hit target by rule: the stylesheet sets it on the button, and the drawn paper is only its lower part.
    const sticky = cssSource.slice(cssSource.indexOf(".fund-book .fund-book-sticky, :root[data-theme] .fund-book .fund-book-sticky {"));
    expect(sticky.slice(0, sticky.indexOf("}"))).toContain("min-height: 44px;");
    expect(sticky.slice(0, sticky.indexOf("}"))).toMatch(/transparent 0 18px/);
    const mark = cssSource.slice(cssSource.indexOf(".fund-book .fund-book-mark, :root[data-theme] .fund-book .fund-book-mark {"));
    expect(mark.slice(0, mark.indexOf("}"))).toContain("min-height: 44px;");
    // A divider is a sheet bound into the block: flat cloth, the name printed on it, cut corners, no chip, no rounding, no sideways stagger.
    expect(mark.slice(0, mark.indexOf("}"))).toContain("border-radius: 0;");
    expect(mark.slice(0, mark.indexOf("}"))).toContain("clip-path: polygon(-12px 0, calc(100% - 5px) 0, 100% 5px,");
    expect(mark.slice(0, mark.indexOf("}"))).toContain("padding: 4px 8px 4px calc(var(--fund-book-tuck) + 10px);");
    expect(cssSource).not.toMatch(/--fund-book-slot\) \* 3px|fund-book-mark-sheet|--fund-book-mark-label/);
    expect(cssSource).toContain("margin-left: calc(-1 * var(--fund-book-tuck));");
    expect(cssSource).toContain(".fund-book.is-desk .fund-book-room { grid-area: room; z-index: 1; align-self: stretch; }");
    // Colour on a divider or a flag is the theme's sequence of six; copper is never among them.
    const hues = [1, 2, 3, 4, 5, 6].map((n) => cssSource.match(new RegExp(`--fund-book-hue-${n}: ([^;]+);`))?.[1] ?? "");
    expect(hues.every(Boolean)).toBe(true);
    expect(hues.join(" ")).not.toContain("--copper");
    expect(new Set(hues).size).toBe(6);
  });
});
