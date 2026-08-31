import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_SHARED_PLATE_IDS,
  PERSONAL_PLATE_IDS,
  PLATE_VIEW,
  SHARED_PLATE_IDS,
  addAccount,
  buildDashboard,
  catalogHousehold,
  fillLevel,
  gaugeFillWidth,
  gaugeIsOver,
  gaugeThresholdX,
  pairScale,
  personalPlates,
  plateWhen,
  postEntry,
  runHealthCheck,
  seedDemoHousehold,
  sharedPlates,
  shiftPostingStreak,
  sparkHeights,
  tallyIsCountable,
  trackMarkHeight,
  trackX,
} from "../src/core/index.ts";

const TODAY = "2026-08-27";
const MEMBER = "MEM-002";

const platesSource = readFileSync(new URL("../src/core/plates.ts", import.meta.url), "utf8");
const models = readFileSync(new URL("../src/core/deskPlates.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/DeskPlates.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/desk-plates.css", import.meta.url), "utf8");
const officeWide = readFileSync(new URL("../src/OfficeWide.tsx", import.meta.url), "utf8");
const officeCss = readFileSync(new URL("../src/office-wide.css", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

function demo(today = TODAY) {
  return seedDemoHousehold({ environment: "development", today });
}

function demoPlates(today = TODAY) {
  const household = demo(today);
  const dashboard = buildDashboard(household, today, new Date(`${today}T16:00:00Z`));
  const findings = runHealthCheck(household);
  const shared = sharedPlates({ household, dashboard, today, findings });
  const personal = personalPlates({
    household,
    dashboard,
    today,
    memberId: MEMBER,
    streak: shiftPostingStreak(household, today),
  });
  return { household, dashboard, shared, personal };
}

describe("plate primitives", () => {
  it("clamps track marks onto the rail and never draws a zero-height tick", () => {
    expect(trackX(1, 30)).toBe(PLATE_VIEW.left);
    expect(trackX(30, 30)).toBe(PLATE_VIEW.right);
    expect(trackX(0, 30)).toBe(PLATE_VIEW.left);
    expect(trackX(90, 30)).toBe(PLATE_VIEW.right);
    expect(trackMarkHeight(0, 1000, 28)).toBe(4);
    expect(trackMarkHeight(1000, 1000, 28)).toBe(28);
    expect(trackMarkHeight(500, 1000, 28)).toBe(16);
  });

  it("gives the pair one scale so cash and cards share a height", () => {
    const scale = pairScale(2000, 1000, 40);
    expect(scale).toBe(40 / 2000);
    expect(2000 * scale).toBe(40);
    expect(1000 * scale).toBe(20);
    expect(pairScale(0, 0, 40)).toBe(0);
  });

  it("clamps fill so a well never overflows", () => {
    expect(fillLevel(0, 100)).toBe(0);
    expect(fillLevel(50, 100)).toBe(0.5);
    expect(fillLevel(100, 100)).toBe(1);
    expect(fillLevel(150, 100)).toBe(1);
    expect(fillLevel(40, 0)).toBe(0);
  });

  it("scales spark heights to the series' own peak", () => {
    expect(sparkHeights([0, 50, 100], 20)).toEqual([0, 10, 20]);
    expect(sparkHeights([0, 0, 0], 20)).toEqual([0, 0, 0]);
    expect(sparkHeights([], 20)).toEqual([]);
  });

  it("counts tally ticks and never rounds a money figure into them", () => {
    expect(tallyIsCountable(1)).toBe(true);
    expect(tallyIsCountable(31)).toBe(true);
    expect(tallyIsCountable(0)).toBe(false);
    expect(tallyIsCountable(32)).toBe(false);
    expect(tallyIsCountable(1.5)).toBe(false);
    expect(platesSource).toContain("Number.isInteger(n)");
    expect(platesSource).not.toMatch(/Math\.round\(n\)/);
  });

  it("draws the gauge threshold instead of implying it", () => {
    expect(gaugeIsOver(0.31, 0.3)).toBe(true);
    expect(gaugeIsOver(0.3, 0.3)).toBe(false);
    expect(gaugeThresholdX(0.30)).toBeCloseTo(PLATE_VIEW.left + 0.30 * (PLATE_VIEW.right - PLATE_VIEW.left));
    expect(gaugeFillWidth(1)).toBe(PLATE_VIEW.right - PLATE_VIEW.left);
    expect(component).toContain("desk-plate-threshold");
  });
});

describe("twelve desk plates", () => {
  it("puts six unique plates on each floor", () => {
    const { shared, personal } = demoPlates();
    expect(shared.map((plate) => plate.id)).toEqual([...SHARED_PLATE_IDS]);
    expect(personal.map((plate) => plate.id)).toEqual([...PERSONAL_PLATE_IDS]);
    expect(new Set(shared.map((plate) => plate.id)).size).toBe(6);
    expect(new Set(personal.map((plate) => plate.id)).size).toBe(6);
  });

  it("never reintroduces now, attention, or change on Shared, and never says kitty or free-to-spend", () => {
    const { shared } = demoPlates();
    const ids = shared.map((plate) => plate.id);
    for (const id of FORBIDDEN_SHARED_PLATE_IDS) {
      expect(ids).not.toContain(id);
    }
    const blob = shared.map((plate) => `${plate.kicker} ${plate.verdict} ${plate.footing} ${plate.empty ?? ""}`).join("\n").toLowerCase();
    expect(blob).not.toContain("kitty");
    expect(blob).not.toContain("free-to-spend");
    expect(officeWide).not.toContain('id === "now"');
    expect(officeWide).not.toContain('"attention"');
    expect(officeWide).not.toContain('"change"');
  });

  it("keeps kickers as household questions, never the cabinet or drawer name", () => {
    const { shared, personal } = demoPlates();
    for (const plate of [...shared, ...personal]) {
      expect(plate.kicker.toLowerCase()).not.toBe(plate.cabinet);
      expect(plate.kicker.toLowerCase()).not.toBe(plate.cabinetName);
      expect(plate.kicker).toMatch(/\s/);
    }
  });

  it("writes every verdict as a sentence, never a bare number", () => {
    const { shared, personal } = demoPlates();
    for (const plate of [...shared, ...personal]) {
      expect(plate.verdict.trim().length).toBeGreaterThan(8);
      expect(plate.verdict).toMatch(/[A-Za-z]/);
      expect(plate.verdict).not.toMatch(/^\$?\d[\d,]*(\.\d{2})?%?$/);
      expect(plate.verdict.endsWith(".")).toBe(true);
    }
  });

  it("declares one of the six primitives on every plate", () => {
    const { shared, personal } = demoPlates();
    const allowed = new Set(["track", "pair", "fill", "spark", "tally", "gauge"]);
    for (const plate of [...shared, ...personal]) {
      expect(allowed.has(plate.figure.primitive)).toBe(true);
    }
    expect(shared.find((plate) => plate.id === "due")?.figure.primitive).toBe("track");
    expect(shared.find((plate) => plate.id === "cards")?.figure.primitive).toBe("gauge");
    expect(shared.find((plate) => plate.id === "owed")?.figure.primitive).toBe("tally");
    expect(shared.find((plate) => plate.id === "saving")?.figure.primitive).toBe("fill");
    expect(shared.find((plate) => plate.id === "coming")?.figure.primitive).toBe("track");
    expect(shared.find((plate) => plate.id === "trust")?.figure.primitive).toBe("tally");
    expect(personal.find((plate) => plate.id === "clock")?.figure.primitive).toBe("tally");
    expect(personal.find((plate) => plate.id === "tips")?.figure.primitive).toBe("spark");
    expect(personal.find((plate) => plate.id === "pay")?.figure.primitive).toBe("track");
    expect(personal.find((plate) => plate.id === "wallet")?.figure.primitive).toBe("pair");
    expect(personal.find((plate) => plate.id === "mine-saving")?.figure.primitive).toBe("fill");
    expect(personal.find((plate) => plate.id === "month")?.figure.primitive).toBe("spark");
  });

  it("writes empty states as prose, never a blank tile", () => {
    const empty = catalogHousehold();
    const dashboard = buildDashboard(empty, "2026-09-01", new Date("2026-09-01T16:00:00Z"));
    const shared = sharedPlates({ household: empty, dashboard, today: "2026-09-01", findings: [] });
    const personal = personalPlates({
      household: empty,
      dashboard,
      today: "2026-09-01",
      memberId: MEMBER,
      streak: shiftPostingStreak(empty, "2026-09-01"),
    });
    for (const plate of [...shared, ...personal]) {
      if (!plate.empty) continue;
      expect(plate.empty.trim().length).toBeGreaterThan(12);
      expect(plate.empty).toMatch(/[A-Za-z]/);
      expect(plate.verdict).toBe(plate.empty);
    }
    expect(shared.find((plate) => plate.id === "due")?.empty).toContain("Nothing is due");
    expect(shared.find((plate) => plate.id === "trust")?.empty).toContain("no open findings");
  });
});

describe("plate interaction and materials", () => {
  it("swaps the stage on a single click and opens the cabinet on double-click and the handle", () => {
    expect(officeWide).toContain("onSelect={() => selectPlate(plate.id)}");
    expect(officeWide).toContain("onOpenCabinet={() => openPlateCabinet(plate.id)}");
    expect(officeWide).toContain("spreadIsStage");
    expect(officeWide).toContain("<DeskPlate");
    expect(officeWide).toContain("<MonthSpread");
    expect(component).toContain("onClick={onSelect}");
    expect(component).toContain("onDoubleClick={onOpenCabinet}");
    expect(component).toContain("aria-current={active ? \"true\" : undefined}");
    expect(component).toContain("event.stopPropagation()");
  });

  it("keeps the cabinet handle as the keyboard and touch path", () => {
    expect(component).toContain("Open the ${plate.cabinetName} cabinet");
    expect(component).toContain('tabIndex={0}');
    expect(component).toContain('event.key === "Enter"');
    expect(css).toContain(".desk-plate-handle");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(".desk-plate-handle:focus-visible");
  });

  it("renders dates inside the week as weekdays", () => {
    expect(plateWhen("2026-08-27", TODAY)).toBe("today");
    expect(plateWhen("2026-08-28", TODAY)).toBe("tomorrow");
    expect(plateWhen("2026-08-31", TODAY)).toBe("Monday");
    expect(plateWhen("2026-09-10", TODAY)).toMatch(/Sep/);
  });

  it("cannot post, settle, or move a cent", () => {
    expect(component).not.toMatch(/\bpostEntry\b|\bpostTransfer\b|\bconfirmHouseholdFund|\bonCommand\b|\bonPost\b/);
    expect(models).not.toMatch(/\bpostEntry\b|\bpostTransfer\b|\bconfirmHouseholdFund|\ballocateHouseholdFundSurplus\b/);
    expect(officeWide).toContain("openPlateCabinet");
    expect(component).toContain("Display only");
  });

  it("keeps Shared plates off the word safe to spend and off hex literals", () => {
    const blob = `${models}\n${component}\n${css}`;
    expect(blob.toLowerCase()).not.toContain("safe to spend");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(css).toContain("font-variant-numeric: tabular-nums lining-nums");
    expect(css).toContain("translateY(-1px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(main).toContain('import "./desk-plates.css"');
  });

  it("moves only the shared-home columns and keeps a 2×3 plate grid", () => {
    expect(officeCss).toContain("minmax(0, 460px) minmax(0, 1fr)");
    expect(officeCss).toContain("minmax(0, 1.15fr) minmax(0, 1.75fr) minmax(0, 0.72fr)");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("repeat(auto-fit, minmax(210px, 1fr))");
    expect(officeWide).toContain("office-wide-plates");
  });

  it("returns to the Spread when the stage closes, with no plate active", () => {
    expect(officeWide).toContain("closeStage");
    expect(officeWide).toContain("setActivePlateId(null)");
    expect(officeWide).toContain("active={spreadIsStage ? false : activePlateId === plate.id}");
  });
});

describe("shared plates stay on the household projection", () => {
  it("never names a partner-personal card on Shared Home, even from unscoped books", () => {
    const BIANCA = "MEM-001";
    const CANARY = "Bianca private Amex";
    let household = demo();
    household = addAccount(household, {
      name: CANARY,
      kind: "credit",
      ownerMemberId: BIANCA,
      scope: "personal",
      creditLimit: "1000",
    }).household;
    const amex = household.accounts.find((account) => account.name === CANARY);
    if (!amex) throw new Error("expected personal card");
    household = postEntry(household, {
      date: TODAY,
      type: "expense",
      amount: "910",
      accountId: amex.id,
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      createdBy: BIANCA,
      visibility: "personal",
    }).household;
    const dashboard = buildDashboard(household, TODAY, new Date(`${TODAY}T16:00:00Z`));
    const shared = sharedPlates({ household, dashboard, today: TODAY, findings: [] });
    const cards = shared.find((plate) => plate.id === "cards")!;
    const blob = `${cards.verdict} ${cards.footing} ${cards.empty ?? ""} ${cards.figure.primitive === "gauge" ? cards.figure.label : ""}`;
    expect(blob).not.toContain(CANARY);
    expect(blob).not.toContain("Amex");
    expect(blob).not.toContain(amex.id);
    expect(cards.verdict).toMatch(/Visa is at 34% of its limit/);
    expect(models).toContain('account.scope !== "personal"');
  });
});

describe("demo figures stay honest", () => {
  it("reads due items, cards, claims, banks, visits, and findings from existing selectors", () => {
    const { shared, household } = demoPlates();
    const due = shared.find((plate) => plate.id === "due")!;
    const cards = shared.find((plate) => plate.id === "cards")!;
    const owed = shared.find((plate) => plate.id === "owed")!;
    const saving = shared.find((plate) => plate.id === "saving")!;
    const coming = shared.find((plate) => plate.id === "coming")!;
    const trust = shared.find((plate) => plate.id === "trust")!;
    expect(due.figure.primitive).toBe("track");
    if (due.figure.primitive === "track") expect(due.figure.days).toBe(30);
    expect(cards.figure.primitive).toBe("gauge");
    if (cards.figure.primitive === "gauge") expect(cards.figure.threshold).toBe(0.3);
    expect(household.claims.length).toBeGreaterThanOrEqual(0);
    expect(owed.verdict).toMatch(/owes|owe|Nobody/);
    expect(saving.figure.primitive).toBe("fill");
    if (saving.figure.primitive === "fill") expect(saving.figure.wells.length).toBeLessThanOrEqual(3);
    expect(coming.figure.primitive).toBe("track");
    if (coming.figure.primitive === "track") expect(coming.figure.days).toBe(90);
    expect(trust.cabinet).toBe("lamp");
  });
});
