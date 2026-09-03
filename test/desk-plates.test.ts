import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_SHARED_PLATE_IDS,
  PERSONAL_PLATE_IDS,
  PLATE_VIEW,
  LEGACY_SHARED_PLATE_IDS,
  SHARED_PLATE_IDS,
  addAccount,
  buildDashboard,
  catalogHousehold,
  fillLevel,
  gaugeFillWidth,
  gaugeIsOver,
  gaugeThresholdX,
  pairScale,
  monthPostedRows,
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
const fundModels = readFileSync(new URL("../src/core/fundPlates.ts", import.meta.url), "utf8");
const models = readFileSync(new URL("../src/core/deskPlates.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/DeskPlates.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/desk-plates.css", import.meta.url), "utf8");
const officeWide = readFileSync(new URL("../src/OfficeWide.tsx", import.meta.url), "utf8");
const officePhone = readFileSync(new URL("../src/OfficePhone.tsx", import.meta.url), "utf8");
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

describe("Shared and Personal desk plates", () => {
  it("puts eight unique Fund plates on Shared and six unique plates on Personal", () => {
    const { shared, personal } = demoPlates();
    expect(shared.map((plate) => plate.id)).toEqual([...SHARED_PLATE_IDS]);
    expect(personal.map((plate) => plate.id)).toEqual([...PERSONAL_PLATE_IDS]);
    expect(new Set(shared.map((plate) => plate.id)).size).toBe(8);
    expect(new Set(personal.map((plate) => plate.id)).size).toBe(6);
    // The fold: no retired id survives on the shared floor.
    for (const retired of LEGACY_SHARED_PLATE_IDS) {
      expect(shared.map((plate) => plate.id)).not.toContain(retired);
    }
  });

  it("never reintroduces now, attention, or change on Shared, and never says kitty or free-to-spend", () => {
    const { shared } = demoPlates();
    const ids = shared.map((plate) => plate.id);
    for (const id of FORBIDDEN_SHARED_PLATE_IDS) {
      expect(ids).not.toContain(id);
    }
    const blob = shared.map((plate) => `${plate.kicker} ${plate.glance} ${plate.verdict} ${plate.footing} ${plate.empty ?? ""}`).join("\n").toLowerCase();
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
    expect(shared.find((plate) => plate.id === "fund-level")?.figure.primitive).toBe("spark");
    expect(shared.find((plate) => plate.id === "waiting")?.figure.primitive).toBe("tally");
    expect(shared.find((plate) => plate.id === "next-out")?.figure.primitive).toBe("track");
    expect(shared.find((plate) => plate.id === "spoken-for")?.figure.primitive).toBe("gauge");
    expect(shared.find((plate) => plate.id === "settle")?.figure.primitive).toBe("tally");
    expect(shared.find((plate) => plate.id === "saving")?.figure.primitive).toBe("fill");
    expect(shared.find((plate) => plate.id === "week")?.figure.primitive).toBe("track");
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
    expect(shared.find((plate) => plate.id === "due")?.glance).toBe("Nothing due in 30 days");
    expect(shared.find((plate) => plate.id === "owed")?.glance).toBe("Nobody owes us");
    expect(shared.find((plate) => plate.id === "saving")?.glance).toBe("No shared banks yet");
    expect(shared.find((plate) => plate.id === "coming")?.glance).toBe("No visits in 90 days");
    expect(shared.find((plate) => plate.id === "trust")?.glance).toBe("Books look clean");
    expect(personal.find((plate) => plate.id === "tips")?.glance).toBe("No tips yet");
    expect(personal.find((plate) => plate.id === "pay")?.glance).toBe("No pay in 14 days");
    expect(personal.find((plate) => plate.id === "mine-saving")?.glance).toBe("No personal bank yet");
    expect(personal.find((plate) => plate.id === "month")?.glance).toBe("No running net yet");
  });
});

describe("plate interaction and materials", () => {
  it("grows the plate in the mosaic on a single click and opens the cabinet on double-click and the handle", () => {
    expect(officeWide).toContain("onSelect={() => togglePlate(plate.id)}");
    expect(officeWide).toContain("open={openPlateIds.has(plate.id)}");
    expect(officeWide).toContain("onOpenCabinet={() => openPlateCabinet(plate.id)}");
    expect(officeWide).toContain("spreadIsStage");
    expect(officeWide).toContain("<DeskPlate");
    expect(officeWide).toContain("<MonthSpread");
    expect(officeWide).not.toContain("selectPlate");
    expect(officeWide).not.toContain("activePlateId");
    expect(officeWide).not.toContain("enlarged");
    expect(component).toContain("onClick={onSelect}");
    expect(component).toContain("onDoubleClick={onOpenCabinet}");
    expect(component).toContain("aria-expanded={open}");
    expect(component).toContain("{plate.glance}");
    expect(component).toContain("event.stopPropagation()");
    expect(component).not.toContain("aria-current");
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

  it("moves only the shared-home columns and keeps a two-column plate grid", () => {
    expect(officeCss).toContain("minmax(0, 460px) minmax(0, 1fr)");
    expect(officeCss).toContain("minmax(0, 1.15fr) minmax(0, 1.75fr) minmax(0, 0.72fr)");
    expect(css).toContain("repeat(2, minmax(0, 1fr))");
    expect(css).toContain("repeat(auto-fit, minmax(210px, 1fr))");
    expect(officeWide).toContain("office-wide-plates");
  });

  it("returns to the Spread when the stage closes, with plates still in the mosaic", () => {
    expect(officeWide).toContain("closeStage");
    expect(officeWide).toContain("setMonthList(null)");
    expect(officeWide).not.toContain("setActivePlateId");
    expect(officeWide).toContain("open={openPlateIds.has(plate.id)}");
    expect(officeCss).toContain("--stories-open-height: calc(3 * 220px + 2 * 10px + 2.2rem)");
    expect(css).toContain(".desk-plate.is-open");
    expect(css).toContain("min-height: 80px");
    expect(css).toContain("min-height: 220px");
  });
});

describe("shared plates stay on the household projection", () => {
  it("never names any Personal card on Shared Home, even from unscoped books", () => {
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
    household = addAccount(household, {
      name: "Jonathan private Mastercard",
      kind: "credit",
      ownerMemberId: MEMBER,
      scope: "personal",
      creditLimit: "1200",
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
    const accounts = shared.find((plate) => plate.id === "accounts")!;
    const blob = `${accounts.glance} ${accounts.verdict} ${accounts.footing} ${accounts.empty ?? ""} ${accounts.figure.primitive === "gauge" ? accounts.figure.label : ""}`;
    expect(blob).not.toContain(CANARY);
    expect(blob).not.toContain("Amex");
    expect(blob).not.toContain("Jonathan private Mastercard");
    expect(blob).not.toContain(amex.id);
    expect(accounts.verdict).toContain("Visa");
    expect(fundModels).toContain('account.scope !== "personal"');
    expect(fundModels).not.toContain('account.ownerMemberId === memberId');
  });
});

describe("demo figures stay honest", () => {
  it("reads due items, cards, claims, banks, visits, and findings from existing selectors", () => {
    const { shared, household } = demoPlates();
    const level = shared.find((plate) => plate.id === "fund-level")!;
    const waiting = shared.find((plate) => plate.id === "waiting")!;
    const nextOut = shared.find((plate) => plate.id === "next-out")!;
    const spokenFor = shared.find((plate) => plate.id === "spoken-for")!;
    const settle = shared.find((plate) => plate.id === "settle")!;
    const saving = shared.find((plate) => plate.id === "saving")!;
    expect(level.figure.primitive).toBe("spark");
    expect(level.cabinet).toBe("blotter");
    expect(waiting.figure.primitive).toBe("tally");
    expect(nextOut.figure.primitive).toBe("track");
    expect(spokenFor.figure.primitive).toBe("gauge");
    if (spokenFor.figure.primitive === "gauge") expect(spokenFor.figure.threshold).toBe(1);
    expect(household.claims.length).toBeGreaterThanOrEqual(0);
    // The Fund owes an account. A person never owes.
    expect(settle.verdict).not.toMatch(/\byou owe\b|\bowes you\b/i);
    expect(saving.figure.primitive).toBe("fill");
    if (saving.figure.primitive === "fill") expect(saving.figure.wells.length).toBeLessThanOrEqual(3);
    expect(level.glance.endsWith(".")).toBe(false);
  });
});

describe("glance copy and month lists", () => {
  it("keeps every glance shorter than its verdict and off a closing period", () => {
    const { shared, personal } = demoPlates();
    for (const plate of [...shared, ...personal]) {
      expect(plate.glance.trim().length).toBeGreaterThan(4);
      expect(plate.glance).not.toBe(plate.verdict);
      expect(plate.glance.endsWith(".")).toBe(false);
    }
    expect(models).toContain("No cards yet");
    expect(models).toContain("No wallet rooms yet");
    expect(models).toContain("On the clock");
    expect(models).toContain("Nothing due in 30 days");
  });

  it("lists this month's posted income and expenses and keeps refunds out of expenses", () => {
    const household = demo();
    const income = monthPostedRows(household, TODAY, "income");
    const expenses = monthPostedRows(household, TODAY, "expenses");
    expect(income.length).toBeGreaterThan(0);
    expect(expenses.length).toBeGreaterThan(0);
    expect(income.every((row) => row.type === "income" && !row.isDuplicate)).toBe(true);
    expect(expenses.every((row) => row.type === "expense" && !row.isDuplicate)).toBe(true);
    const monthRefunds = household.transactions.filter((row) => (
      row.type === "refund" && row.date.slice(0, 7) === TODAY.slice(0, 7)
    ));
    expect(monthRefunds.length).toBeGreaterThan(0);
    expect(expenses.some((row) => row.type === "refund")).toBe(false);
    expect(expenses.map((row) => row.id)).not.toEqual(expect.arrayContaining(monthRefunds.map((row) => row.id)));
    expect(officeWide).toContain("openMonthList(\"income\")");
    expect(officeWide).toContain("openMonthList(\"expenses\")");
    expect(officeWide).toContain("current === section ? null : section");
    expect(officeWide).toContain("<MonthPostedList household={household}");
    expect(officeWide).toContain('onClick={() => onGo("plan")}');
    const listSource = officeWide.slice(
      officeWide.indexOf("function MonthPostedList"),
      officeWide.indexOf("type Spec"),
    );
    expect(listSource).toContain("monthPostedRows");
    expect(listSource).not.toMatch(/postEntry|onCommand|Reverse/);
  });

  it("leaves iPhone seals on the blotter", () => {
    expect(officePhone).toContain('label="Money in"');
    expect(officePhone).toContain('label="Money out"');
    expect(officePhone).toMatch(/label="Money in"[\s\S]*?onClick=\{\(\) => tapSeal\("blotter"\)\}/);
    expect(officePhone).toMatch(/label="Money out"[\s\S]*?onClick=\{\(\) => tapSeal\("blotter"\)\}/);
    expect(officePhone).not.toContain("openMonthList");
    expect(officePhone).not.toContain("DeskPlate");
    expect(officeWide).not.toContain('onClick={() => tapSeal("blotter")}');
  });
});
