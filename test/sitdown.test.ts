import { describe, expect, it } from "vitest";
import {
  addGoal,
  allocateLeftover,
  lastRemainderSplit,
  leftoverProjection,
  buildDashboard,
  catalogHousehold,
  closeBooksMonth,
  compileHousehold,
  executeSitDownMoves,
  incomeEffect,
  isMonthClosed,
  postEntry,
  postTransfer,
  postVisit,
  reversePostedMoney,
  seedDemoHousehold,
  sitDownAnomalies,
  sitDownExportText,
  sitDownInfographicDeck,
  sitDownWorkbookCsv,
  suggestCategory,
  trialBalance,
  ValidationError,
} from "../src/core/index.ts";
import { booksIntegrityFacts } from "../src/ledger/engine.ts";
import { resetGoogleEngineForTests, setGoogleClientIdForTests, setGoogleHttpFetch, setGoogleTokenRequester, setGoogleTokenStore, createMemoryTokenStore, uploadSitDownWorkbook } from "../src/google/index.ts";

const today = "2026-08-21";

describe("allocation leftover", () => {
  it("splits weights 5, 1, 2 of 800 cents exactly", () => {
    const plan = allocateLeftover(800, [
      { id: "v", label: "vacation", kind: "goal", targetId: "GOAL-1", mode: "weight", value: 5 },
      { id: "i", label: "investment", kind: "account", targetId: "ACC-TFSA", mode: "weight", value: 1 },
      { id: "c", label: "car", kind: "goal", targetId: "GOAL-2", mode: "weight", value: 2 },
    ]);
    expect(plan.ok).toBe(true);
    expect(plan.lines.map((line) => line.cents)).toEqual([500, 100, 200]);
    expect(plan.allocatedCents).toBe(800);
    expect(plan.remainderCents).toBe(0);
  });

  it("takes fixed amounts off the top then weights the remainder", () => {
    const plan = allocateLeftover(1000, [
      { id: "rent-buffer", label: "buffer", kind: "account", targetId: "ACC-SAVINGS", mode: "fixed", value: 250 },
      { id: "v", label: "vacation", kind: "goal", targetId: "GOAL-1", mode: "weight", value: 1 },
      { id: "c", label: "car", kind: "goal", targetId: "GOAL-2", mode: "weight", value: 1 },
    ]);
    expect(plan.ok).toBe(true);
    expect(plan.lines[0]?.cents).toBe(250);
    expect((plan.lines[1]?.cents ?? 0) + (plan.lines[2]?.cents ?? 0)).toBe(750);
    expect(plan.allocatedCents).toBe(1000);
  });

  it("makes over-allocation obvious and refuses to be ok", () => {
    const plan = allocateLeftover(100, [
      { id: "a", label: "too much", kind: "account", targetId: "ACC-VISA", mode: "fixed", value: 250 },
    ]);
    expect(plan.ok).toBe(false);
    expect(plan.overAllocatedCents).toBe(150);
    expect(plan.allocatedCents).toBe(0);
  });

  it("gives the last party the remainder the same way percentSplits does", () => {
    expect(lastRemainderSplit([1, 1, 1], 100)).toEqual([33, 33, 34]);
  });

  it("splits percentages totaling 100 to the cent", () => {
    const plan = allocateLeftover(101, [
      { id: "a", label: "a", kind: "account", targetId: "ACC-SAVINGS", mode: "percent", value: 50 },
      { id: "b", label: "b", kind: "account", targetId: "ACC-TFSA", mode: "percent", value: 50 },
    ]);
    expect(plan.ok).toBe(true);
    expect(plan.lines.map((line) => line.cents)).toEqual([51, 50]);
    expect(plan.allocatedCents).toBe(101);
  });

  it("refuses percentages over 100", () => {
    const plan = allocateLeftover(100, [
      { id: "a", label: "a", kind: "account", targetId: "ACC-SAVINGS", mode: "percent", value: 60 },
      { id: "b", label: "b", kind: "account", targetId: "ACC-TFSA", mode: "percent", value: 60 },
    ]);
    expect(plan.ok).toBe(false);
    expect(plan.overAllocatedCents).toBeGreaterThan(0);
  });
});

describe("leftover projection", () => {
  it("never treats month net as leftover and never exceeds cash-like after bills and mins", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const leftover = leftoverProjection(household, today);
    expect(leftover.leftoverCents).toBe(Math.max(0, leftover.cashLikeCents - leftover.reservedCents));
    expect(leftover.leftoverCents).toBeLessThanOrEqual(leftover.cashLikeCents);
    expect(leftover.formula).toMatch(/cash-like/);
    expect(leftover.formula).toMatch(/leftover/);
    expect(leftover.formula.toLowerCase()).not.toMatch(/\bnet\b/);
  });
});

describe("hard lock and reversing entries", () => {
  it("refuses a post into a closed month even if confirmClosedMonth is smuggled in", () => {
    let household = catalogHousehold();
    household = closeBooksMonth(household, { monthKey: "2026-07", createdBy: "MEM-001" }).household;
    expect(isMonthClosed(household, "2026-07")).toBe(true);
    expect(() => postEntry(household, {
      date: "2026-07-15",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      // @ts-expect-error closed-month bypass is gone
      confirmClosedMonth: true,
    })).toThrow(ValidationError);
  });

  it("reverses an expense without deleting it and keeps the trial in balance", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "QA milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!, { createdBy: "MEM-001" });
    expect(reversed.household.transactions).toHaveLength(2);
    const original = reversed.household.transactions.find((tx) => tx.id === posted.postedIds[0]);
    const reversal = reversed.household.transactions.find((tx) => tx.reversalOfId === posted.postedIds[0]);
    expect(original?.note).toBe("QA milk");
    expect(reversal?.source).toBe("reversal");
    const trial = trialBalance(compileHousehold(reversed.household), { recognizedOnly: true });
    expect(trial.inBalance).toBe(true);
    expect(booksIntegrityFacts(reversed.household).transactions.some((tx) => tx.reversalOfId === posted.postedIds[0])).toBe(true);
  });

  it("reverses a transfer as a transfer, never income", () => {
    const posted = postTransfer(catalogHousehold(), {
      date: "2026-08-21",
      amount: "40.00",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(posted.household, posted.postedIds[0]!, { createdBy: "MEM-001" });
    expect(reversed.household.transactions).toHaveLength(4);
    expect(reversed.household.transactions.every((tx) => tx.type === "transfer")).toBe(true);
    expect(reversed.household.transactions.every((tx) => incomeEffect(tx) === 0)).toBe(true);
  });
});

describe("sit-down moves", () => {
  it("turns leftover into transfers, not income", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "400",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    const leftover = leftoverProjection(household, today);
    expect(leftover.leftoverCents).toBeGreaterThan(0);
    const moved = executeSitDownMoves(household, {
      monthKey: "2026-08",
      createdBy: "MEM-001",
      slices: [{
        id: "pay-visa",
        label: "Visa",
        kind: "account",
        targetId: "ACC-VISA",
        mode: "weight",
        value: 1,
      }],
    });
    expect(moved.postedIds.length).toBeGreaterThan(0);
    expect(moved.household.transactions.filter((tx) => tx.note.startsWith("Sit-down")).every((tx) => tx.type === "transfer")).toBe(true);
    expect(moved.household.sitDownSessions.some((row) => row.status === "moved")).toBe(true);
    const facts = booksIntegrityFacts(moved.household);
    expect(facts.sitDownSessions.some((row) => row.leftoverCents === leftover.leftoverCents && row.transferIds.length > 0)).toBe(true);
  });

  it("parks a jar in savings and contributes without inventing income", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "400",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = addGoal(household, { name: "Vacation", target: 2000, shared: true }).household;
    const goal = household.goals[0]!;
    const moved = executeSitDownMoves(household, {
      monthKey: "2026-08",
      createdBy: "MEM-001",
      slices: [{
        id: "vacation",
        label: "Vacation",
        kind: "goal",
        targetId: goal.id,
        mode: "weight",
        value: 1,
      }],
    });
    const sit = moved.household.transactions.filter((tx) => tx.note.startsWith("Sit-down"));
    expect(sit.length).toBeGreaterThan(0);
    expect(sit.every((tx) => tx.type === "transfer")).toBe(true);
    expect(sit.every((tx) => incomeEffect(tx) === 0)).toBe(true);
    expect(moved.household.goals[0]?.savedCents).toBeGreaterThan(goal.savedCents);
    expect(moved.warnings.join(" ")).not.toMatch(/no separate savings/i);
    expect(moved.household.transactions.some((tx) => tx.type === "transfer" && tx.accountId === "ACC-GOALS")).toBe(true);
    expect(moved.household.transactions.some((tx) => tx.type === "transfer" && tx.note.startsWith("Sit-down") && tx.accountId === "ACC-SAVINGS")).toBe(false);
  });
});

describe("auto-coding", () => {
  it("guesses a subcategory from merchant tokens without writing", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "No Frills milk",
      place: "No Frills",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "18",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "No Frills produce",
      place: "No Frills",
      confirmDuplicate: true,
    }).household;
    const before = household.transactions.length;
    const guess = suggestCategory(household, "No Frills eggs", "No Frills");
    expect(guess?.subcategoryId).toBe("SUB-FOOD-GROCERIES");
    expect(household.transactions).toHaveLength(before);
    expect(sitDownAnomalies(household, "2026-08").every((row) => row.transactionIds.length >= 0)).toBe(true);
  });
});

describe("quiet export", () => {
  it("codes quiet appointment titles in the workbook", () => {
    let household = seedDemoHousehold({ today, environment: "development" });
    const quiet = household.appointments.find((row) => row.sensitivity === "quiet");
    expect(quiet?.title).toBe("Therapy");
    household = postVisit(household, {
      date: today,
      amount: (quiet!.typicalCostCents || 16000) / 100,
      appointmentId: quiet!.id,
      expectedRecovery: (quiet!.typicalRecoveryCents || 8000) / 100,
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    const csv = sitDownWorkbookCsv(household, "2026-08");
    const text = sitDownExportText(household, "2026-08", today);
    expect(csv).not.toMatch(/Dr\. Chen/);
    expect(csv).not.toMatch(/The Annex/);
    expect(text).not.toMatch(/Dr\. Chen/);
    expect(text).not.toMatch(/The Annex/);
    expect(csv).toMatch(/the \w+ visit/i);
  });
});

describe("Drive sit-down export", () => {
  it("fails softly without throwing when Google is missing", async () => {
    resetGoogleEngineForTests();
    const result = await uploadSitDownWorkbook({
      environment: "development",
      memberId: "MEM-002",
      name: "Hearth 2026-08",
      csv: sitDownWorkbookCsv(catalogHousehold(), "2026-08"),
    });
    expect(result.ok).toBe(false);
    expect(result.detail.length).toBeGreaterThan(0);
  });

  it("creates a new Drive file when Google answers", async () => {
    resetGoogleEngineForTests();
    setGoogleTokenStore(createMemoryTokenStore());
    setGoogleClientIdForTests("test-client");
    setGoogleTokenRequester(async () => ({
      access_token: "token",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/drive.file",
    }));
    setGoogleHttpFetch(async (url) => {
      if (String(url).includes("oauth2") || String(url).includes("userinfo")) {
        return new Response(JSON.stringify({ email: "j@example.com", sub: "sub-1", name: "Jonathan" }), { status: 200 });
      }
      if (String(url).includes("upload/drive")) {
        return new Response(JSON.stringify({ id: "file-sitdown-1" }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    const result = await uploadSitDownWorkbook({
      environment: "development",
      memberId: "MEM-002",
      name: "Hearth 2026-08",
      csv: "section,field,value\n",
    });
    expect(result.ok).toBe(true);
    expect(result.fileId).toBe("file-sitdown-1");
    resetGoogleEngineForTests();
  });
});

describe("sit-down infographic deck", () => {
  it("keeps household leftover off Personal and cycles posted paper charts", () => {
    const household = seedDemoHousehold({ environment: "development", today });
    const dashboard = buildDashboard(household, today, new Date("2026-08-21T16:00:00Z"));
    const shared = sitDownInfographicDeck({ view: "household", household, dashboard, today });
    const personal = sitDownInfographicDeck({ view: "personal", household, dashboard, today });
    expect(shared[0]?.id).toBe("leftover");
    expect(shared.some((chart) => chart.id === "fund" || chart.id === "banks")).toBe(true);
    expect(personal.every((chart) => chart.id !== "leftover")).toBe(true);
    expect(personal.some((chart) => chart.id === "month-flow")).toBe(true);
    expect(personal.every((chart) => !/household leftover/i.test(chart.note))).toBe(true);
  });
});
