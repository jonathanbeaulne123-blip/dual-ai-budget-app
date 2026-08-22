import { describe, expect, it } from "vitest";
import {
  applySitDown,
  askHercules,
  chatHercules,
  catalogHousehold,
  cookOffScore,
  describeCompanion,
  equipCosmetic,
  formatHerculesBriefing,
  groceryHighFive,
  herculesBriefing,
  herculesNeedsCheck,
  herculesPageBrief,
  hourInToronto,
  isCosmeticUnlocked,
  localHerculesChat,
  memoryLabelForModel,
  memoryLabelsForModel,
  planHerculesTurn,
  postEntry,
  postTransfer,
  recordHerculesTalk,
  sanitizeHerculesReply,
  scribbleChalk,
  seedDemoHousehold,
  shapeKitchen,
  shiftForecastDisplay,
  sitDownPostcard,
  talkHercules,
  weekRecap,
  HERCULES_REFUSE_SQL,
  HERCULES_REFUSE_WRITE,
  HERCULES_REFUSE_SHAME,
} from "../src/core/index.ts";
import { COSMETIC_BY_ID } from "../src/core/companion.ts";

const today = "2026-08-21";

describe("The Hercules Update", () => {
  it("defaults the companion to Hercules the Maine Coon and migrates Ember snapshots", () => {
    const fresh = catalogHousehold();
    expect(fresh.kitchen.companion.name).toBe("Hercules");
    expect(fresh.kitchen.companion.species).toBe("maine-coon");
    expect(fresh.kitchen.companion.equipped.collar).toBeNull();

    const migrated = shapeKitchen({
      chalkboard: [],
      companion: {
        name: "Ember",
        species: "ember",
        equipped: { hat: null, chain: null, house: null, collar: null },
        updatedAt: "",
      },
    });
    expect(migrated.companion.name).toBe("Hercules");
    expect(migrated.companion.species).toBe("maine-coon");
    expect(migrated.hercules.chats).toEqual([]);
    expect(migrated.hercules.memories).toEqual([]);
  });

  it("keeps a custom name and never posts from chat", () => {
    const household = catalogHousehold();
    household.kitchen.companion.name = "Kettle";
    const asked = askHercules(household, "who are you", today);
    expect(asked.kind).toBe("answer");
    expect(asked.sentence).toMatch(/Kettle/);
    expect(asked.sentence).toMatch(/don['’]?t write/);
    expect(household.transactions).toHaveLength(0);
  });

  it("high-fives only when both people posted groceries today", () => {
    let household = catalogHousehold();
    expect(groceryHighFive(household, today).yes).toBe(false);
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    expect(groceryHighFive(household, today).yes).toBe(false);
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "9",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    const five = groceryHighFive(household, today);
    expect(five.yes).toBe(true);
    expect(five.names).toHaveLength(2);
  });

  it("unlocks collar cosmetics from transfers, chalkboard, and shifts — never from chat", () => {
    let household = catalogHousehold();
    expect(COSMETIC_BY_ID.get("bell")?.slot).toBe("collar");
    household = postTransfer(household, {
      date: today,
      amount: "20",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      confirmDuplicate: true,
    }).household;
    const bell = equipCosmetic(household, { slot: "collar", itemId: "bell", today });
    expect(bell.postedIds).toEqual([]);
    expect(bell.household.kitchen.companion.equipped.collar).toBe("bell");
    expect(bell.household.transactions.filter((tx) => tx.type === "transfer").length).toBe(
      household.transactions.filter((tx) => tx.type === "transfer").length,
    );

    household = scribbleChalk(bell.household, { text: "one", author: "MEM-001" }).household;
    household = scribbleChalk(household, { text: "two", author: "MEM-001" }).household;
    household = scribbleChalk(household, { text: "three", author: "MEM-001" }).household;
    const yarn = equipCosmetic(household, { slot: "collar", itemId: "yarn", today });
    expect(yarn.household.kitchen.companion.equipped.collar).toBe("yarn");

    const demo = seedDemoHousehold({ today, environment: "development" });
    expect(demo.shifts.length).toBeGreaterThan(0);
    const fish = equipCosmetic(demo, { slot: "collar", itemId: "fish", today });
    expect(fish.postedIds).toEqual([]);
    expect(fish.household.kitchen.companion.equipped.collar).toBe("fish");
  });

  it("coaches and answers tips without inventing a write", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const coach = askHercules(household, "what should I do", today);
    expect(coach.kind).toBe("answer");
    expect(coach.sentence.length).toBeGreaterThan(8);
    const tips = askHercules(household, "tips this week", today);
    expect(tips.kind).toBe("answer");
    const skip = askHercules(household, "safe to skip", today);
    expect(skip.kind).toBe("answer");
    expect(herculesPageBrief(household, "calendar", today)).toMatch(/remind|paid/i);
    expect(describeCompanion(household, today).name).toBe("Hercules");
  });

  it("uses America/Toronto hours for greetings", () => {
    const hour = hourInToronto(new Date("2026-08-21T12:00:00Z"));
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThan(24);
  });

  it("unlocks the July patio in August and keeps winter ruff locked until a cold-month post", () => {
    const empty = catalogHousehold();
    expect(isCosmeticUnlocked(empty, COSMETIC_BY_ID.get("patio")!, today)).toBe(true);
    expect(isCosmeticUnlocked(empty, COSMETIC_BY_ID.get("ruff")!, today)).toBe(false);
    const winter = postEntry(empty, {
      date: "2026-01-15",
      type: "expense",
      amount: "8",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    }).household;
    expect(isCosmeticUnlocked(winter, COSMETIC_BY_ID.get("ruff")!, today)).toBe(true);
    const patio = equipCosmetic(empty, { slot: "house", itemId: "patio", today });
    expect(patio.postedIds).toEqual([]);
    expect(patio.household.kitchen.companion.equipped.house).toBe("patio");
  });

  it("cooks off household groceries vs coffee without naming a person", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: "12",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    const cook = cookOffScore(household, today);
    expect(cook.winner).toBe("kitchen");
    expect(cook.sentence).not.toMatch(/Bianca|Jonathan/);
    const asked = askHercules(household, "Cook-off", today);
    expect(asked.sentence).toMatch(/kitchen is winning/i);
  });

  it("prints a sit-down postcard and never treats forecast as a post", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const closed = applySitDown(household, "2026-08", {});
    const card = sitDownPostcard(closed.household);
    expect(card.ready).toBe(true);
    expect(card.text.length).toBeLessThanOrEqual(80);
    expect(closed.postedIds).toEqual([]);

    const forecast = shiftForecastDisplay(household);
    expect(forecast.unlocked).toBe(true);
    expect(forecast.weeksPosted).toBeGreaterThanOrEqual(8);
    const asked = askHercules(household, "forecast", today);
    expect(asked.kind).toBe("answer");
    expect(asked.sentence).toMatch(/Display only|will not post/i);

    const recap = weekRecap(household, "2026-08-23");
    expect(recap.isSunday).toBe(true);
    expect(recap.rows.length).toBeGreaterThan(2);
  });

  it("talks in a short line with two or three replies, never a lecture", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const talk = talkHercules(household, "who are you", today, "home");
    expect(talk.spoken.length).toBeLessThanOrEqual(120);
    expect(talk.replies.length).toBeGreaterThan(0);
    expect(talk.replies.length).toBeLessThanOrEqual(3);
    expect(talk.spoken).toMatch(/don't write/i);
    const idle = talkHercules(household, "", today, "home");
    expect(idle.spoken.length).toBeGreaterThan(4);
    expect(idle.spoken.length).toBeLessThanOrEqual(120);
    const empty = catalogHousehold();
    expect(herculesNeedsCheck(empty, today)).toBe(true);
  });

  it("keeps a compact purrsonality briefing without a transaction dump or a who-spent board", () => {
    const empty = catalogHousehold();
    const demo = seedDemoHousehold({ today, environment: "development" });
    const emptyBlob = formatHerculesBriefing(herculesBriefing(empty, "home", today, new Date("2026-08-21T16:00:00Z")));
    expect(emptyBlob).toMatch(/Hercules/);
    expect(emptyBlob).toMatch(/CAD/);
    expect(emptyBlob).toMatch(/opinion:/);
    expect(emptyBlob).toMatch(/trial in balance:/);
    expect(emptyBlob).toMatch(/going-concern watch:/);
    expect(emptyBlob).toMatch(/working capital:/);
    expect(emptyBlob).not.toMatch(/Bianca|Jonathan/);
    expect(emptyBlob).not.toMatch(/INSERT|SELECT/i);

    const demoBrief = herculesBriefing(demo, "home", today, new Date("2026-08-21T16:00:00Z"));
    const demoBlob = formatHerculesBriefing(demoBrief);
    expect(demoBlob).toMatch(/net this month:/);
    expect(demoBlob).not.toMatch(/No Frills|Farm Boy|Visa payment/);
    expect(demoBlob).not.toMatch(/who spent/i);
    expect(demoBrief.healthFindings).toBeGreaterThanOrEqual(0);
    expect(["kitchen", "takeout", "tie"]).toContain(demoBrief.cookOff);
  });

  it("sanitizes writes, SQL, and name-shame before a line can leave Hercules's mouth", () => {
    expect(sanitizeHerculesReply("INSERT INTO journal_lines VALUES (1)")).toBe(HERCULES_REFUSE_SQL);
    expect(sanitizeHerculesReply("Sure — ```sql\nDELETE FROM transactions```")).toBe(HERCULES_REFUSE_SQL);
    expect(sanitizeHerculesReply("I posted $40.00 to groceries.")).toBe(HERCULES_REFUSE_WRITE);
    expect(sanitizeHerculesReply("I posted $40.00 to groceries.", "Groceries this month $40.00.")).toMatch(/don't post/i);
    expect(sanitizeHerculesReply("Bianca spent more this week.")).toBe(HERCULES_REFUSE_SHAME);
    expect(sanitizeHerculesReply("As an AI, I think you should skip rent.")).toMatch(/I'm a cat/i);
    expect(sanitizeHerculesReply("")).toMatch(/don't write/i);
  });

  it("falls back to local purrsonality and never claims a chat write", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const grounded = talkHercules(household, "we good?", today, "home");
    const briefing = herculesBriefing(household, "home", today);
    const local = localHerculesChat("post this $40 grocery for me", briefing, grounded);
    expect(local).toBe(HERCULES_REFUSE_WRITE);
    expect(localHerculesChat("who spent more", briefing, grounded)).toBe(HERCULES_REFUSE_SHAME);
    const flavored = localHerculesChat("we good?", briefing, grounded);
    expect(flavored.length).toBeGreaterThan(8);
    expect(flavored).not.toMatch(/I posted|INSERT/i);
    expect(household.transactions.length).toBe(seedDemoHousehold({ today, environment: "development" }).transactions.length);
  });

  it("uses a journal-safe worker reply and falls back when the kitchen AI is quiet", async () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const grounded = talkHercules(household, "we good?", today, "home");
    const briefing = herculesBriefing(household, "home", today);
    const ai = await chatHercules(
      { message: "we good?", briefing, grounded, memories: [] },
      {
        fetch: async () =>
          new Response(JSON.stringify({ ok: true, reply: "mrrp. The books look honest." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      },
    );
    expect(ai.source).toBe("ai");
    expect(ai.text).toMatch(/books look honest/i);

    const posted = await chatHercules(
      { message: "log milk", briefing, grounded, memories: [] },
      {
        fetch: async () =>
          new Response(JSON.stringify({ ok: true, reply: "I posted $8.00 to groceries." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      },
    );
    expect(posted.source).toBe("ai");
    expect(posted.text).toMatch(/don't post/i);

    const quiet = await chatHercules(
      { message: "we good?", briefing, grounded, memories: [] },
      { fetch: async () => { throw new Error("offline"); } },
    );
    expect(quiet.source).toBe("local");
    expect(quiet.text.length).toBeGreaterThan(4);
  });

  it("answers money from the journal and keeps chat in the kitchen ledger", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const plan = planHerculesTurn(household, "what's on the Visa?", today, "home");
    expect(plan.skipModel).toBe(true);
    expect(plan.source).toBe("journal");
    expect(plan.talk.spoken).toMatch(/\$|CAD|Visa|owed|paydown/i);

    const remembered = planHerculesTurn(household, "remember payday is Thursday", today, "home");
    expect(remembered.skipModel).toBe(true);
    expect(remembered.memory?.label).toMatch(/payday/i);
    expect(remembered.memory?.label).not.toMatch(/\$\d/);

    const shame = planHerculesTurn(household, "who spent more", today, "home");
    expect(shame.skipModel).toBe(true);
    expect(shame.talk.spoken).toBe(HERCULES_REFUSE_SHAME);

    const draft = planHerculesTurn(household, "add milk", today, "home");
    expect(draft.draft?.note).toBe("Milk");
    expect(draft.draft?.subcategoryId).toBe("SUB-FOOD-GROCERIES");
    expect(draft.talk.spoken).toBe(HERCULES_REFUSE_WRITE);

    const unmatched = planHerculesTurn(household, "tell me a kitchen joke", today, "home");
    expect(unmatched.skipModel).toBe(false);
    expect(unmatched.draft).toBeNull();
    expect(unmatched.memory).toBeNull();
  });

  it("does not send chat history or transaction dumps to a model", async () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const grounded = talkHercules(household, "we good?", today, "home");
    const briefing = herculesBriefing(household, "home", today);
    const kept = recordHerculesTalk(household, {
      author: "MEM-001",
      userText: "No Frills was eighty four dollars and Bianca spent more",
      herculesText: "Not a scoreboard.",
      source: "local",
      memory: { kind: "note", text: "No Frills was $84.12", label: memoryLabelForModel("No Frills was $84.12") },
    });
    expect(kept.postedIds).toEqual([]);
    expect(kept.household.transactions.length).toBe(household.transactions.length);
    const labels = memoryLabelsForModel(kept.household);
    expect(labels.join(" ")).toMatch(/CAD/);
    expect(labels.join(" ")).not.toMatch(/84\.12/);

    let body = "";
    await chatHercules(
      { message: "we good?", briefing, grounded, memories: labels },
      {
        fetch: async (_url, init) => {
          body = String(init?.body || "");
          return new Response(JSON.stringify({ ok: true, reply: "mrrp." }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );
    expect(body).not.toMatch(/84\.12/);
    expect(body).not.toMatch(/history/);
    expect(body).not.toMatch(/Bianca spent more/);
    expect(body).toMatch(/memories/);
    expect(body).toMatch(/CAD/);
  });
});
