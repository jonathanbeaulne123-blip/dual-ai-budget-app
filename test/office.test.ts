import { describe, expect, it, vi, afterEach } from "vitest";
import {
  allRoomCombinations,
  attackTarget,
  auditOpinion,
  BLOTTER_EMPTY,
  BOARD_EMPTY,
  buildDashboard,
  cacheIsFresh,
  catalogHousehold,
  COOK_EMPTY,
  cookOffEmpty,
  cookOffScore,
  defaultLayout,
  dollarsFromCentsDigits,
  emptyHousehold,
  fallbackWeather,
  formatCad,
  glassFromOpenMeteo,
  JARS_EMPTY,
  CLAIMS_EMPTY,
  lampIsDark,
  loadOfficeLayout,
  loadOfficeRings,
  MAIL_EMPTY,
  officeLayoutKey,
  parseOfficeLayout,
  parseOfficeRings,
  perchTarget,
  attackStand,
  furnitureUnderCat,
  walkHits,
  walkPath,
  postcardEmpty,
  POSTCARD_EMPTY,
  promoteRail,
  readTorontoWeather,
  resolveRoom,
  RING_TTL_MS,
  runHealthCheck,
  saveOfficeLayout,
  saveOfficeRings,
  shiftPostingStreak,
  sitDownPostcard,
  splitForSync,
  tapCentsDigits,
  TIMESHEET_EMPTY,
  timesheetEmpty,
  WEATHER_TTL_MS,
  blotterFacts,
  type Furniture,
} from "../src/core/index.ts";

const memoryStore = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
};

describe("Toronto weather window", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls back to clock and season without throwing", async () => {
    const reading = await readTorontoWeather({
      environment: "development",
      today: "2026-08-21",
      now: new Date("2026-08-21T21:00:00-04:00"),
      fetchImpl: async () => { throw new Error("offline"); },
      timeoutMs: 20,
    });
    expect(reading.source).toBe("fallback");
    expect(reading.sentence).not.toMatch(/\$/);
    expect(["clear", "rain", "snow", "night", "humid"]).toContain(reading.glass);
  });

  it("times out and uses fallback instead of hanging", async () => {
    const reading = await readTorontoWeather({
      environment: "development",
      today: "2026-01-12",
      now: new Date("2026-01-12T08:00:00-05:00"),
      timeoutMs: 15,
      fetchImpl: () => new Promise(() => { /* never settles */ }),
    });
    expect(reading.source).toBe("fallback");
    expect(reading.glass).toBe("snow");
  });

  it("respects a 30-minute cache TTL", async () => {
    const storage = memoryStore();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      current: { temperature_2m: 19, precipitation: 1.2, weather_code: 61, is_day: 1 },
    }), { status: 200 }));
    const first = await readTorontoWeather({
      environment: "development",
      today: "2026-08-21",
      now: new Date("2026-08-21T10:00:00-04:00"),
      fetchImpl,
      storage,
    });
    expect(first.glass).toBe("rain");
    expect(first.celsius).toBe(19);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const second = await readTorontoWeather({
      environment: "development",
      today: "2026-08-21",
      now: new Date("2026-08-21T10:10:00-04:00"),
      fetchImpl,
      storage,
    });
    expect(second.glass).toBe("rain");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cacheIsFresh(Date.now() - (WEATHER_TTL_MS - 1000))).toBe(true);
    expect(cacheIsFresh(Date.now() - (WEATHER_TTL_MS + 1000))).toBe(false);
  });

  it("never puts CAD in a weather sentence", () => {
    const live = glassFromOpenMeteo({ temperature_2m: 19, precipitation: 0, weather_code: 0, is_day: 1 }, "2026-08-21");
    const night = fallbackWeather("2026-08-21", new Date("2026-08-21T22:00:00-04:00"));
    expect(live.sentence).not.toMatch(/\$|CAD|spent/i);
    expect(night.sentence).not.toMatch(/\$|CAD|spent/i);
  });
});

describe("office layout cosmetics", () => {
  it("round-trips a saved desk and drops unknown widgets", () => {
    const parsed = parseOfficeLayout({
      v: 1,
      items: [
        { id: "wallet" },
        { id: "not-a-widget" },
        { id: "blotter", x: 16, y: 40 },
      ],
      expanded: "wallet",
      minimized: ["cookoff"],
      windowMinimized: false,
    });
    expect(parsed.items[0]?.id).toBe("wallet");
    expect(parsed.items.some((item) => item.id === "calculator")).toBe(true);
    expect(parsed.items.some((item) => (item as { id: string }).id === "not-a-widget")).toBe(false);
    expect(parsed.expanded).toBe("wallet");
  });

  it("resets corrupt JSON to the default desk", () => {
    const storage = memoryStore();
    storage.setItem(officeLayoutKey("development", "phone"), "{nope");
    expect(loadOfficeLayout("development", "phone", storage).items.map((item) => item.id)).toEqual(defaultLayout().items.map((item) => item.id));
  });

  it("keeps development and production, phone and wide, on separate keys", () => {
    const storage = memoryStore();
    saveOfficeLayout("development", "phone", { ...defaultLayout(), expanded: "blotter" }, storage);
    saveOfficeLayout("production", "phone", { ...defaultLayout(), expanded: "wallet" }, storage);
    saveOfficeLayout("development", "wide", { ...defaultLayout(), expanded: "mail" }, storage);
    expect(loadOfficeLayout("development", "phone", storage).expanded).toBe("blotter");
    expect(loadOfficeLayout("production", "phone", storage).expanded).toBe("wallet");
    expect(loadOfficeLayout("development", "wide", storage).expanded).toBe("mail");
    expect(officeLayoutKey("development", "phone")).not.toBe(officeLayoutKey("development", "wide"));
  });

  it("does not put layout on the shared household envelope", () => {
    const { shared } = splitForSync(catalogHousehold(), "MEM-001");
    const keys = Object.keys(shared);
    expect(keys.some((key) => key.toLowerCase().includes("office"))).toBe(false);
    expect(keys.some((key) => key.toLowerCase().includes("layout"))).toBe(false);
    expect(JSON.stringify(shared)).not.toMatch(/hearth\.office/);
  });
});

describe("room atmosphere", () => {
  it("returns a valid room state for every kettlePhase × glass combination", () => {
    const rows = allRoomCombinations();
    expect(rows).toHaveLength(20);
    for (const row of rows) {
      const mood = resolveRoom(row.phase, row.glass);
      expect(mood.glass).toBe(row.glass);
      expect(mood.roomDim).toBeGreaterThanOrEqual(0);
      expect(mood.roomDim).toBeLessThanOrEqual(0.06);
      expect(mood.roomCool).toBeGreaterThanOrEqual(0);
      expect(mood.promoted).toMatch(/calculator|timesheet|postcard|blotter/);
    }
  });

  it("promotes the lamp without dropping the calculator", () => {
    const next = promoteRail(["calculator", "blotter", "wallet", "lamp"], "calculator", true);
    expect(next[0]).toBe("calculator");
    expect(next[1]).toBe("lamp");
  });
});

describe("Hercules furniture physics", () => {
  const desk: Furniture[] = [
    { id: "window", rect: { x: 0, y: 0, w: 390, h: 120 }, perchable: true, warn: false, kind: "sill" },
    { id: "wallet", rect: { x: 20, y: 200, w: 160, h: 80 }, perchable: true, warn: false, kind: "tray" },
    { id: "mail", rect: { x: 200, y: 200, w: 140, h: 70 }, perchable: true, warn: true, kind: "envelope" },
  ];

  it("keeps perchTarget inside the viewport", () => {
    const viewport = { w: 390, h: 800 };
    for (let i = 0; i < 80; i += 1) {
      const land = perchTarget(desk, "content", "evening", false, viewport, null, () => i / 80);
      expect(land.x).toBeGreaterThanOrEqual(0);
      expect(land.y).toBeGreaterThanOrEqual(0);
      expect(land.x).toBeLessThanOrEqual(viewport.w - 96);
      expect(land.y).toBeLessThanOrEqual(viewport.h - 76);
    }
  });

  it("never lands on the Post button across random desks", () => {
    const viewport = { w: 390, h: 844 };
    const post = { x: 40, y: 520, w: 310, h: 56 };
    for (let i = 0; i < 1000; i += 1) {
      const furniture: Furniture[] = [
        { id: "calculator", rect: { x: 12, y: 400, w: 360, h: 220 }, perchable: true, warn: false, kind: "pad" },
        { id: "window", rect: { x: 0, y: 40, w: 390, h: 100 }, perchable: true, warn: false, kind: "sill" },
        { id: "blotter", rect: { x: 8 + (i % 40), y: 160 + (i % 30), w: 180, h: 90 }, perchable: true, warn: false, kind: "card" },
      ];
      const land = perchTarget(furniture, "content", "morning", false, viewport, post, () => (i % 17) / 17);
      const cat = { x: land.x, y: land.y, w: 96, h: 96 };
      const hits = cat.x < post.x + post.w && cat.x + cat.w > post.x && cat.y < post.y + post.h && cat.y + cat.h > post.y;
      expect(hits).toBe(false);
    }
  });

  it("returns no attack when nothing is in warn", () => {
    expect(attackTarget(desk.map((item) => ({ ...item, warn: false })))).toBeNull();
    expect(attackTarget(desk)?.id).toBe("mail");
  });

  it("forces the corner loaf while adding", () => {
    const land = perchTarget(desk, "restless", "morning", true, { w: 390, h: 800 });
    expect(land).toMatchObject({ x: 6, y: 6, on: null, pose: "loaf", faceRight: false });
  });

  it("perches the sill in profile, not as if he were looking out the glass", () => {
    const land = perchTarget(
      [desk[0]!],
      "content",
      "morning",
      false,
      { w: 390, h: 800 },
      null,
      () => 0.2,
    );
    expect(land.on).toBe("window");
    expect(land.faceRight === true || land.faceRight === false).toBe(true);
    const center = desk[0]!.rect.x + desk[0]!.rect.w / 2;
    expect(Math.abs(land.x + 48 - center)).toBeGreaterThan(40);
  });

  it("stands beside a warning instrument to attack, facing it", () => {
    const mail = desk[2]!;
    const left = attackStand(mail, { x: 10, y: 200 }, { w: 390, h: 800 });
    expect(left.faceRight).toBe(true);
    expect(left.x).toBeLessThan(mail.rect.x + mail.rect.w / 2);
    const right = attackStand(mail, { x: 320, y: 200 }, { w: 390, h: 800 });
    expect(right.faceRight).toBe(false);
  });

  it("names the furniture a walk actually crosses", () => {
    const hits = walkHits({ x: 0, y: 180 }, { x: 300, y: 220 }, desk);
    expect(hits.some((item) => item.id === "wallet" || item.id === "mail")).toBe(true);
    expect(hits.some((item) => item.kind === "sill")).toBe(false);
  });

  it("ignores the Post button when the cat is hauled across the desk", () => {
    const post = { id: "calculator-post", rect: { x: 40, y: 520, w: 310, h: 56 }, perchable: false, warn: false, kind: "pad" as const };
    const wallet = desk[1]!;
    expect(furnitureUnderCat({ x: 50, y: 510 }, [post, wallet])?.id).not.toBe("calculator-post");
    expect(furnitureUnderCat({ x: 30, y: 190 }, [post, wallet])?.id).toBe("wallet");
  });

  it("walks around furniture in at most three points", () => {
    const path = walkPath({ x: 0, y: 0 }, { x: 300, y: 300 }, desk);
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path.length).toBeLessThanOrEqual(3);
  });
});

describe("office projections stay honest", () => {
  it("blotter net is dashboard month net, and lamp is dark only when Health is empty", () => {
    const catalog = catalogHousehold();
    const empty = emptyHousehold();
    const today = "2026-08-21";
    const dash = buildDashboard(catalog, today);
    const emptyDash = buildDashboard(empty, today);
    const opinion = auditOpinion(catalog);
    const facts = blotterFacts(dash, opinion, 0);
    expect(facts.netCents).toBe(dash.month.netActualCents);
    expect(facts.stamp).toBe(opinion.kind === "unmodified" ? "clean" : opinion.kind);
    expect(blotterFacts(dash, { ...opinion, kind: "unmodified" }, 0).stamp).toBe("clean");
    expect(blotterFacts(dash, { ...opinion, kind: "qualified" }, 0).stamp).toBe("qualified");
    expect(facts.glance === BLOTTER_EMPTY || facts.glance === formatCad(dash.month.netActualCents)).toBe(true);
    expect(emptyDash.month.netActualCents).toBe(0);
    expect(blotterFacts(emptyDash, auditOpinion(empty), runHealthCheck(empty).length).empty).toBe(true);
    expect(lampIsDark(runHealthCheck(catalog))).toBe(runHealthCheck(catalog).length === 0);
    expect(lampIsDark([])).toBe(true);
    expect(lampIsDark([{ section: "Accounts", message: "No active account exists." }])).toBe(false);
  });

  it("empty instruments use the specified copy, never a fake achievement", () => {
    const empty = emptyHousehold();
    const today = "2026-08-21";
    const dash = buildDashboard(empty, today);
    expect(dash.upcoming).toEqual([]);
    expect(dash.goals).toEqual([]);
    expect(timesheetEmpty(shiftPostingStreak(empty, today))).toBe(true);
    expect(cookOffEmpty(cookOffScore(empty, today))).toBe(true);
    expect(postcardEmpty(sitDownPostcard(empty))).toBe(true);
    expect(BLOTTER_EMPTY).toMatch(/Nothing posted this month yet/);
    expect(MAIL_EMPTY).toMatch(/No money dates/);
    expect(TIMESHEET_EMPTY).toMatch(/No shifts posted yet/);
    expect(POSTCARD_EMPTY).toMatch(/Next sit-down/);
    expect(COOK_EMPTY).toMatch(/Nothing cooked, nothing bought/);
    expect(JARS_EMPTY).toMatch(/No goals yet/);
    expect(CLAIMS_EMPTY).toMatch(/Nothing owed to this household/);
    expect(BOARD_EMPTY).toMatch(/Nothing on the board/);
  });

  it("desk pad 1-2-5-0 is $12.50, same helper as the sheet", () => {
    const digits = ["1", "2", "5", "0"].reduce((current, key) => tapCentsDigits(current, key), "");
    expect(digits).toBe("1250");
    expect(dollarsFromCentsDigits(digits)).toBe("12.50");
    expect(formatCad(Number(digits))).toMatch(/12\.50/);
  });

  it("rings stay on this phone and decay after a day", () => {
    const storage = memoryStore();
    saveOfficeRings("development", [{ id: "blotter", x: 8, y: 16, at: Date.now() }], storage);
    expect(loadOfficeRings("development", storage)).toHaveLength(1);
    expect(loadOfficeRings("production", storage)).toHaveLength(0);
    expect(parseOfficeRings([{ id: "blotter", x: 1, y: 1, at: Date.now() - RING_TTL_MS - 10 }])).toHaveLength(0);
  });
});
