import { describe, expect, it } from "vitest";
import {
  addGoal,
  buildDeskSyncPayload,
  calendarEventIntent,
  catalogHousehold,
  collapseOfficeLayout,
  compileHousehold,
  contributeToGoal,
  defaultLayout,
  executeSitDownMoves,
  buildDashboard,
  goalLedger,
  goalsVaultAccount,
  helpCommands,
  helpIntro,
  matchHelpCommand,
  openHelpState,
  herculesBubbleBox,
  jarParkingAccountId,
  leftoverProjection,
  MAX_USER_PINS,
  parseDeskSyncPayload,
  parseOfficeLayout,
  perchOnFurniture,
  postEntry,
  postTransfer,
  purchaseGoal,
  retiredGoals,
  toggleInstrumentPin,
  trialBalance,
  ValidationError,
} from "../src/core/index.ts";
import { booksIntegrityFacts } from "../src/ledger/engine.ts";
import {
  createMemoryTokenStore,
  pullDeskAppearance,
  pushDeskAppearance,
  resetGoogleEngineForTests,
  setGoogleClientIdForTests,
  setGoogleHttpFetch,
  setGoogleTokenRequester,
  setGoogleTokenStore,
} from "../src/google/index.ts";

const today = "2026-08-21";

describe("goals vault leftover parking", () => {
  it("parks sit-down jar cash in the Goals vault, not everyday HIS", () => {
    const household = catalogHousehold();
    expect(goalsVaultAccount(household)?.id).toBe("ACC-GOALS");
    expect(jarParkingAccountId(household)).toBe("ACC-GOALS");
    expect(jarParkingAccountId(household)).not.toBe("ACC-SAVINGS");
    const leftover = leftoverProjection(household, today);
    expect(leftover.formula).toMatch(/leftover/);
    expect(leftover.formula.toLowerCase()).not.toMatch(/\bnet\b/);
  });

  it("posts a purchase expense from the vault, retires the jar, and keeps the contribution rows", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "80",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = addGoal(household, { name: "Rug", target: 50, shared: true }).household;
    const goal = household.goals[0]!;
    household = postTransfer(household, {
      date: today,
      amount: "50",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-GOALS",
      note: "Sit-down jar · Rug",
      confirmDuplicate: true,
    }).household;
    household = contributeToGoal(household, goal.id, 50, { createdBy: "MEM-001", date: today }).household;
    expect(household.goals[0]?.savedCents).toBe(5000);
    const bought = purchaseGoal(household, {
      goalId: goal.id,
      amount: "42.00",
      lines: [{ note: "Rug", amount: "42.00" }],
      createdBy: "MEM-001",
      date: today,
    });
    const retired = bought.household.goals.find((row) => row.id === goal.id);
    expect(retired?.status).toBe("retired");
    expect(retiredGoals(bought.household).some((row) => row.id === goal.id)).toBe(true);
    expect(bought.household.goalContributions.some((row) => row.goalId === goal.id)).toBe(true);
    expect(bought.household.goalPurchases).toHaveLength(1);
    expect(bought.household.transactions.some((tx) => tx.type === "expense" && tx.accountId === "ACC-GOALS" && tx.amountCents === 4200)).toBe(true);
    const books = compileHousehold(bought.household);
    expect(trialBalance(books).inBalance).toBe(true);
    const facts = booksIntegrityFacts(bought.household);
    expect(facts.goalPurchases.some((row) => row.spentCents === 4200)).toBe(true);
    expect(goalLedger(bought.household).some((row) => row.kind === "purchase")).toBe(true);
    expect(buildDashboard(bought.household, today).goals.every((row) => row.goal.status !== "retired")).toBe(true);
  });

  it("refuses a purchase that would raid other open jars", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: "50",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      confirmDuplicate: true,
    }).household;
    household = addGoal(household, { name: "Vacation", target: 40, shared: true }).household;
    const goal = household.goals[0]!;
    household = postTransfer(household, {
      date: today,
      amount: "40",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-GOALS",
      note: "Sit-down jar · Vacation",
      confirmDuplicate: true,
    }).household;
    household = contributeToGoal(household, goal.id, 40, { createdBy: "MEM-001", date: today }).household;
    expect(() => purchaseGoal(household, {
      goalId: goal.id,
      amount: "80",
      createdBy: "MEM-001",
      date: today,
    })).toThrow(ValidationError);
  });
});

describe("user pin-open vs calculator cannot-hide", () => {
  it("keeps pins when the desk collapses and caps at four", () => {
    let layout = parseOfficeLayout({
      v: 1,
      items: [{ id: "jars" }, { id: "calendar" }],
      expanded: "jars",
      pinned: ["jars"],
    });
    expect(layout.pinned).toEqual(["jars"]);
    layout = collapseOfficeLayout(layout);
    expect(layout.expanded).toBeNull();
    expect(layout.pinned).toEqual(["jars"]);
    layout = toggleInstrumentPin(layout, "calendar");
    layout = toggleInstrumentPin(layout, "wallet");
    layout = toggleInstrumentPin(layout, "blotter");
    layout = toggleInstrumentPin(layout, "mail");
    expect(layout.pinned).toHaveLength(MAX_USER_PINS);
    const blocked = toggleInstrumentPin(layout, "lamp");
    expect(blocked.pinned).toEqual(layout.pinned);
  });
});

describe("Hercules help desk and calendar intent", () => {
  it("sends event language to Calendar and reads the open jars surface", () => {
    expect(calendarEventIntent("when is the hydro bill")).toBe(true);
    expect(calendarEventIntent("our Netflix subscription")).toBe(true);
    expect(calendarEventIntent("Leftover?")).toBe(false);
    const household = catalogHousehold();
    const commands = helpCommands({ tab: "home", instrument: "jars", household, today });
    expect(commands.some((row) => /leftover|sit-down|jar/i.test(row.label))).toBe(true);
    const leftoverChip = matchHelpCommand(commands, commands.find((row) => /leftover/i.test(row.label))!.label);
    expect(leftoverChip?.go).toBe("plan");
    expect(leftoverChip?.expand).toBe("postcard");
    const intro = helpIntro("home", "jars", household, today);
    expect(intro.toLowerCase()).not.toMatch(/this is what i do/);
    expect(openHelpState({ tab: "calendar", instrument: "calendar", household, today }).replies.length).toBeGreaterThan(0);
  });

  it("keeps the chat bubble off an examined widget", () => {
    const box = herculesBubbleBox({
      catX: 40,
      catY: 40,
      catSize: 96,
      bubbleW: 220,
      bubbleH: 160,
      viewW: 900,
      viewH: 700,
      avoid: { x: 20, y: 20, w: 400, h: 300 },
    });
    const overlaps = box.left < 420 && box.left + 220 > 20 && box.top < 320 && box.top + 160 > 20;
    expect(overlaps).toBe(false);
  });

  it("perches on the top of an opened instrument", () => {
    const land = perchOnFurniture(
      { id: "calendar", rect: { x: 80, y: 120, w: 288, h: 88 }, perchable: true, warn: false, kind: "card" },
      { w: 900, h: 700 },
    );
    expect(land.on).toBe("calendar");
    expect(land.y).toBeLessThan(120);
  });
});

describe("Google desk appearance payload", () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      getItem(key: string) { return map.get(key) ?? null; },
      setItem(key: string, value: string) { map.set(key, value); },
    };
  };
  it("round-trips look and layout without a household id", () => {
    const payload = buildDeskSyncPayload({
      look: { stock: "graph", density: "glance" },
      phone: defaultLayout(),
      wide: { ...defaultLayout(), pinned: ["jars"], expanded: "jars" },
    });
    const parsed = parseDeskSyncPayload({ ...payload, householdId: "should-be-ignored" });
    expect(parsed?.look.stock).toBe("graph");
    expect(parsed?.wide.pinned).toEqual(["jars"]);
    expect(parsed?.wide.expanded).toBeNull();
    expect(JSON.stringify(parsed)).not.toMatch(/householdId/);
  });

  it("fails softly when Drive is off", async () => {
    resetGoogleEngineForTests();
    const result = await pushDeskAppearance({
      environment: "development",
      memberId: "MEM-002",
      payload: buildDeskSyncPayload({ look: { stock: "cream", density: "names" }, phone: defaultLayout(), wide: defaultLayout() }),
    });
    expect(result.ok).toBe(false);
  });

  it("creates a Hearth desk.json on Drive", async () => {
    resetGoogleEngineForTests();
    setGoogleTokenStore(createMemoryTokenStore());
    setGoogleClientIdForTests("test-client");
    setGoogleTokenRequester(async () => ({
      access_token: "token",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/drive.file",
    }));
    setGoogleHttpFetch(async (url, init) => {
      if (String(url).includes("oauth2") || String(url).includes("userinfo")) {
        return new Response(JSON.stringify({ email: "j@example.com", sub: "sub-1", name: "Jonathan" }), { status: 200 });
      }
      if (String(url).includes("upload/drive") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "file-desk-1" }), { status: 200 });
      }
      if (String(url).includes("alt=media")) {
        return new Response(JSON.stringify(buildDeskSyncPayload({
          look: { stock: "night", density: "names" },
          phone: defaultLayout(),
          wide: defaultLayout(),
        })), { status: 200 });
      }
      if (String(url).includes("drive/v3/files")) {
        return new Response(JSON.stringify({ files: [{ id: "file-desk-1" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
    const store = memory();
    const pushed = await pushDeskAppearance({
      environment: "development",
      memberId: "MEM-002",
      enabledServices: ["identity", "drive"],
      payload: buildDeskSyncPayload({ look: { stock: "night", density: "names" }, phone: defaultLayout(), wide: defaultLayout() }),
      storage: store,
    });
    expect(pushed.ok).toBe(true);
    const pulled = await pullDeskAppearance({
      environment: "development",
      memberId: "MEM-002",
      enabledServices: ["identity", "drive"],
      storage: store,
    });
    expect(pulled.ok).toBe(true);
    expect(pulled.payload?.look.stock).toBe("night");
    resetGoogleEngineForTests();
  });
});

describe("sit-down leftover still moves as transfers", () => {
  it("keeps leftover jobs as transfers after the vault exists", () => {
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
    const moved = executeSitDownMoves(household, {
      monthKey: "2026-08",
      createdBy: "MEM-001",
      slices: [{
        id: "vacation",
        label: "Vacation",
        kind: "goal",
        targetId: household.goals[0]!.id,
        mode: "weight",
        value: 1,
      }],
    });
    expect(moved.household.transactions.filter((tx) => tx.note.startsWith("Sit-down")).every((tx) => tx.type === "transfer")).toBe(true);
    expect(goalLedger(moved.household).some((row) => row.kind === "parking" && row.amountCents > 0)).toBe(true);
  });
});
