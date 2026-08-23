import { describe, expect, it } from "vitest";
import {
  addGoal,
  adoptSitDownStandingOrders,
  bumpLayoutForExpand,
  catalogHousehold,
  collapseExpandedLayout,
  confidenceFromScore,
  defaultLayout,
  describeDeviceLabel,
  duplicateContrastPairs,
  expandShellFor,
  firstRunLesson,
  fundGoal,
  herculesUsefulness,
  householdWallet,
  loadSeenLessons,
  markLessonSeen,
  parseOfficeLayout,
  parseOfficeLook,
  postEntry,
  postOneRecurrence,
  refreshDuplicateFlags,
  saveSitDownSession,
  touchDevicePresence,
  todayKey,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("hercules usefulness and lessons", () => {
  it("scores a traffic light without inventing CAD", () => {
    const household = catalogHousehold();
    const useful = herculesUsefulness(household, today);
    expect(["red", "yellow", "green"]).toContain(useful.light);
    expect(useful.score).toBeGreaterThanOrEqual(0);
    expect(useful.score).toBeLessThanOrEqual(100);
    expect(useful.spoken.length).toBeGreaterThan(8);
  });

  it("shows instrument lessons only on first run", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    };
    expect(firstRunLesson("instrument:wallet", "Wallet never posts.", storage)).toBe("Wallet never posts.");
    expect(loadSeenLessons(storage).has("instrument:wallet")).toBe(true);
    expect(firstRunLesson("instrument:wallet", "Wallet never posts.", storage)).toBeNull();
    markLessonSeen("instrument:calendar", storage);
    expect(firstRunLesson("instrument:calendar", "Calendar lesson", storage)).toBeNull();
  });
});

describe("expand shells and bump physics", () => {
  it("picks square / circle / list shells", () => {
    expect(expandShellFor("calendar")).toBe("square");
    expect(expandShellFor("timesheet")).toBe("circle");
    expect(expandShellFor("accounts")).toBe("list");
  });

  it("keeps the expander fixed and bumps neighbors, then resets on close", () => {
    let layout = defaultLayout();
    layout = {
      ...layout,
      items: layout.items.map((item, index) => (
        item.id === "calendar" || item.id === "wallet"
          ? { ...item, x: 16, y: 16 + index }
          : item
      )),
    };
    const expanded = bumpLayoutForExpand(layout, "calendar", 900);
    expect(expanded.expanded).toBe("calendar");
    expect(expanded.v).toBe(2);
    const calendar = expanded.items.find((item) => item.id === "calendar");
    const before = layout.items.find((item) => item.id === "calendar");
    expect(calendar?.x).toBe(before?.x);
    expect(calendar?.y).toBe(before?.y);
    expect(Object.keys(expanded.restPositions).length).toBeGreaterThan(0);
    const closed = collapseExpandedLayout(expanded);
    expect(closed.expanded).toBeNull();
    expect(Object.keys(closed.restPositions)).toHaveLength(0);
  });

  it("migrates v1 layouts to v2 with pins and large density", () => {
    const parsed = parseOfficeLayout({
      v: 1,
      items: [{ id: "calculator" }, { id: "calendar" }],
      expanded: null,
      minimized: [],
      windowMinimized: false,
      pinned: ["calendar"],
    });
    expect(parsed.v).toBe(2);
    expect(parsed.pinned).toEqual(["calendar"]);
    expect(parsed.restPositions).toEqual({});
    expect(parseOfficeLook({ stock: "cream", density: "large" }).density).toBe("large");
  });
});

describe("duplicate contrast confidence", () => {
  it("maps score to 0–100 without loosening the scorer", () => {
    expect(confidenceFromScore(1)).toBe(1);
    expect(confidenceFromScore(15)).toBe(100);
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      place: "No Frills",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      place: "No Frills",
      confirmDuplicate: true,
    }).household;
    const txs = refreshDuplicateFlags(household.transactions);
    const pairs = duplicateContrastPairs(txs);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0]!.confidence).toBeGreaterThan(0);
    expect(pairs[0]!.confidence).toBeLessThanOrEqual(100);
  });
});

describe("books story order and funded jars", () => {
  it("puts Goals vault first among savings tiles", () => {
    const wallet = householdWallet(catalogHousehold(), today);
    const savings = wallet.story.find((group) => group.kind === "savings");
    expect(savings?.tiles[0]?.account.savings?.purpose).toBe("goals");
  });

  it("funds a jar with a real vault transfer and marks it open", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "100",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = addGoal(household, { name: "Lamp", target: 40, arrivalDate: "2026-12-01", shared: true }).household;
    const goal = household.goals.find((row) => row.name === "Lamp")!;
    expect(goal.status).toBe("unfunded");
    expect(goal.arrivalDate).toBe("2026-12-01");
    const funded = fundGoal(household, {
      goalId: goal.id,
      amount: 40,
      fromAccountId: "ACC-CHEQUING",
      createdBy: "MEM-001",
      date: today,
    });
    const live = funded.household.goals.find((row) => row.id === goal.id)!;
    expect(live.funded).toBe(true);
    expect(live.status).toBe("open");
    expect(live.savedCents).toBe(4000);
    expect(funded.household.transactions.some((tx) => tx.type === "transfer" && tx.note.includes("Fund jar"))).toBe(true);
  });
});

describe("devices and sit-down standing orders", () => {
  it("records soft device presence", () => {
    const devices = touchDevicePresence({
      devices: [],
      deviceId: "DEV-TEST",
      label: describeDeviceLabel() || "Test",
      memberId: "MEM-001",
      environment: "development",
      at: "2026-08-21T12:00:00.000Z",
    });
    expect(devices[0]?.id).toBe("DEV-TEST");
  });

  it("turns sit-down weights into transfer standing orders for next month", () => {
    let household = catalogHousehold();
    household = addGoal(household, { name: "Emergency", target: 500, shared: true }).household;
    const goalId = household.goals[0]!.id;
    household = saveSitDownSession(household, {
      monthKey: "2026-07",
      act: 3,
      slices: [
        {
          id: "SLICE-1",
          label: "Emergency",
          kind: "goal",
          targetId: goalId,
          mode: "weight",
          value: 2,
        },
        {
          id: "SLICE-2",
          label: "Savings",
          kind: "account",
          targetId: "ACC-SAVINGS",
          mode: "weight",
          value: 1,
        },
      ],
      createdBy: "MEM-001",
    }).household;
    const result = adoptSitDownStandingOrders(household, {
      monthKey: "2026-07",
      createdBy: "MEM-001",
    });
    expect(result.postedIds.length).toBeGreaterThan(0);
    expect(result.household.recurrences.some((row) => row.type === "transfer" && row.nextDate.startsWith("2026-08"))).toBe(true);
    const transfer = result.household.recurrences.find((row) => row.type === "transfer" && row.goalId)!;
    const posted = postOneRecurrence(result.household, transfer.id, "2026-08-01" as ReturnType<typeof todayKey>);
    expect(posted.household.transactions.some((tx) => tx.type === "transfer")).toBe(true);
  });
});
