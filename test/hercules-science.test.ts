import { describe, expect, it } from "vitest";
import {
  NeedsConfirmationError,
  acceptPresetNotice,
  addPreset,
  archivePreset,
  assembleHousehold,
  bubbleNotice,
  catalogHousehold,
  chatHercules,
  composeHerculesChatRequest,
  composeNotices,
  detectHabits,
  detectRhythms,
  dismissNotice,
  herculesBriefing,
  herculesModelPayload,
  mergeShared,
  payloadContainsQuietSecret,
  postEntry,
  postVisit,
  sanitizeHerculesReply,
  seedDemoHousehold,
  splitForSync,
  talkHercules,
  visitPostedDefaults,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("Hercules science (D-057–D-060)", () => {
  it("spots Tim Hortons as a habit, not a bill, on the demo kitchen", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const snapshot = household.transactions.length;
    const habits = detectHabits(household, today);
    const tims = habits.find((item) => /tim hortons/i.test(item.note));
    expect(tims).toBeTruthy();
    expect(tims?.amountCents).toBe(225);
    expect(tims?.count).toBeGreaterThanOrEqual(4);
    const bills = detectRhythms(household, today).filter((item) => item.status === "suggested");
    expect(bills.some((item) => /tim hortons|coffee/i.test(item.note))).toBe(false);
    expect(household.transactions).toHaveLength(snapshot);
  });

  it("offers one preset bubble and does not post money when the household accepts", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const bubble = bubbleNotice(household, today);
    expect(bubble?.kind).toBe("habit-preset");
    expect(bubble?.action).toBe("acceptPreset");
    expect(bubble?.habitKey).toMatch(/^preset:/);
    const before = household.transactions.length;
    const accepted = acceptPresetNotice(household, bubble!.habitKey!);
    expect(accepted.postedIds.length).toBe(1);
    expect(accepted.household.transactions).toHaveLength(before);
    expect(accepted.household.presets.some((item) => item.active && /tim hortons/i.test(item.note) && item.origin === "detected")).toBe(true);
    expect(bubbleNotice(accepted.household, today)?.habitKey).not.toBe(bubble?.habitKey);
  });

  it("hides a dismissed notice and does not recreate the bubble next week", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const bubble = bubbleNotice(household, today);
    expect(bubble).toBeTruthy();
    const hidden = dismissNotice(household, bubble!.key);
    expect(hidden.household.transactions).toHaveLength(household.transactions.length);
    expect(bubbleNotice(hidden.household, today)?.key).not.toBe(bubble!.key);
    expect(composeNotices(hidden.household, today).some((item) => item.key === bubble!.key)).toBe(false);
  });

  it("lets a human save a preset from Add without writing a transaction", () => {
    const household = catalogHousehold();
    const before = household.transactions.length;
    const saved = addPreset(household, {
      type: "expense",
      amount: 2.25,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Tim Hortons",
      origin: "manual",
    });
    expect(saved.household.transactions).toHaveLength(before);
    expect(saved.household.presets[0]?.amountCents).toBe(225);
    const forgotten = archivePreset(saved.household, saved.postedIds[0]!);
    expect(forgotten.household.presets[0]?.active).toBe(false);
  });

  it("stores a coded visit note for quiet appointments and keeps the title out of the model payload", async () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const therapy = household.appointments.find((item) => item.kind === "therapy" && item.sensitivity === "quiet");
    expect(therapy?.title).toMatch(/Therapy/i);
    const posted = visitPostedDefaults(therapy, {});
    expect(posted.note).not.toMatch(/Therapy/i);
    expect(posted.place).toBe("");
    expect(posted.claimLabel).not.toMatch(/Therapy/i);

    const after = postVisit(household, {
      date: today,
      amount: 160,
      appointmentId: therapy!.id,
      expectedRecovery: 80,
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    const expense = after.transactions.find((tx) => tx.source === "visit" && tx.type === "expense" && tx.date === today);
    expect(expense?.note).not.toMatch(/Therapy/i);
    expect(expense?.note).toMatch(/visit/i);
    expect(expense?.place).toBe("");

    const briefing = herculesBriefing(after, "home", today);
    const grounded = talkHercules(after, "what did you notice", today, "home");
    const req = composeHerculesChatRequest(after, "we good?", briefing, grounded, today);
    const payload = herculesModelPayload(req);
    expect(payloadContainsQuietSecret(payload, after)).toBe(false);
    expect(payload).not.toMatch(/Therapy/);
    expect(payload).not.toMatch(/Dr\. Chen/);
    expect(payload).not.toMatch(/The Annex/);
    expect(payload).toMatch(/the .+ visit/i);

    let body = "";
    await chatHercules(req, {
      fetch: async (_url, init) => {
        body = String(init?.body || "");
        return new Response(JSON.stringify({ ok: true, reply: "mrrp. The Tuesday visit is on the books." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    expect(body).not.toMatch(/Therapy/);
    expect(body).not.toMatch(/Dr\. Chen/);
  });

  it("strips invented CAD and keeps a tap-before-write rule on a coffee habit", async () => {
    expect(sanitizeHerculesReply("That coffee is $999.00 every morning.", "Tim Hortons is $2.25.", ["$2.25"])).not.toMatch(/999/);
    expect(sanitizeHerculesReply("That coffee is $999.00 every morning.", "Tim Hortons is $2.25.", ["$2.25"])).toMatch(/\$2\.25/);

    const household = seedDemoHousehold({ today, environment: "development" });
    const bubble = bubbleNotice(household, today)!;
    const briefing = herculesBriefing(household, "home", today);
    const grounded = talkHercules(household, "what did you notice", today, "home");
    const req = composeHerculesChatRequest(household, "what did you notice", briefing, grounded, today);
    expect(req.notices.some((item) => item.key === bubble.key)).toBe(true);
    expect(req.ledger.recent.some((row) => /tim hortons/i.test(row.note))).toBe(true);
    expect(req.figures).toContain("$2.25");

    const invented = await chatHercules(req, {
      fetch: async () =>
        new Response(JSON.stringify({ ok: true, reply: "I spotted $999.00 at a shop you never posted." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    expect(invented.text).not.toMatch(/999/);
  });

  it("merges presets across phones like recurrences", () => {
    const seeded = catalogHousehold();
    const first = addPreset(seeded, {
      type: "expense",
      amount: 2.25,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Tim Hortons",
    });
    const both = addPreset(first.household, {
      type: "expense",
      amount: 3.5,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Second cup",
    });
    const left = { ...first.household, presets: first.household.presets.filter((item) => item.note === "Tim Hortons") };
    const right = { ...both.household, presets: both.household.presets.filter((item) => item.note === "Second cup") };
    const merged = assembleHousehold(
      mergeShared(splitForSync(left, "MEM-002").shared, splitForSync(right, "MEM-001").shared),
      splitForSync(left, "MEM-002").personal,
    );
    expect(merged.presets.filter((item) => item.active).map((item) => item.note).sort()).toEqual(["Second cup", "Tim Hortons"]);
  });

  it("still asks before posting a preset-shaped coffee that matches a recent row", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    expect(() =>
      postEntry(household, {
        date: today,
        type: "expense",
        amount: 2.25,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-COFFEE",
        note: "Tim Hortons",
        createdBy: "MEM-002",
      }),
    ).toThrow(NeedsConfirmationError);
  });
});
