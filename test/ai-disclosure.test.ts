import { describe, expect, it } from "vitest";
import {
  aiDisclosurePayloadLeaks,
  composeHerculesChatRequest,
  formatCad,
  herculesBriefing,
  herculesModelPayload,
  householdForAiDisclosure,
  postEntry,
  recordHerculesTalk,
  seedDemoHousehold,
  talkHercules,
  todayKey,
} from "../src/core/index.ts";

const today = todayKey();

describe("member-scoped AI disclosure (D-115)", () => {
  it("projects partner personal money and memories out of the household slice", () => {
    let household = seedDemoHousehold({ today, environment: "development" });
    household = recordHerculesTalk(household, {
      author: "MEM-002",
      userText: "remember my secret spa budget",
      herculesText: "Noted.",
      source: "local",
      memory: { kind: "preference", text: "secret spa budget CAD", label: "preference: secret spa" },
    }).household;
    household = recordHerculesTalk(household, {
      author: "MEM-001",
      userText: "remember payday Friday",
      herculesText: "Noted.",
      source: "local",
      memory: { kind: "payday", text: "payday Friday", label: "payday: Friday" },
    }).household;

    const forJonathan = householdForAiDisclosure(household, "MEM-001");
    expect(forJonathan.transactions.some((tx) => /gym drop-in/i.test(tx.note))).toBe(false);
    expect(forJonathan.transactions.some((tx) => /haircut/i.test(tx.note))).toBe(true);
    expect(forJonathan.kitchen.hercules?.memories.some((row) => /secret spa/i.test(row.label))).toBe(false);
    expect(forJonathan.kitchen.hercules?.memories.some((row) => /payday/i.test(row.label))).toBe(true);
    expect(forJonathan.kitchen.hercules?.chats).toEqual([]);

    const forBianca = householdForAiDisclosure(household, "MEM-002");
    expect(forBianca.transactions.some((tx) => /haircut/i.test(tx.note))).toBe(false);
    expect(forBianca.transactions.some((tx) => /gym drop-in/i.test(tx.note))).toBe(true);
  });

  it("rebuilds briefing aggregates and notices from the disclosure projection only", () => {
    let household = seedDemoHousehold({ today, environment: "development" });
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: 777.77,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Partner-only yacht daydream",
      place: "Personal",
      splits: [{ party: "MEM-002", amountCents: 77777 }],
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;

    const fullBriefing = herculesBriefing(household, "home", today);
    const grounded = talkHercules(household, "what did we spend", today, "home");
    const asMem001 = composeHerculesChatRequest(
      household,
      "what did we spend",
      fullBriefing,
      grounded,
      today,
      "MEM-001",
    );

    expect(asMem001.briefing.monthOutCad).not.toBe(fullBriefing.monthOutCad);
    expect(asMem001.briefing.monthOutCad).not.toMatch(/777\.77/);
    expect(asMem001.ledger.monthByCategory.some((row) => row.amount.includes("777.77"))).toBe(false);
    expect(asMem001.ledger.recent.some((row) => /yacht daydream/i.test(row.note))).toBe(false);
    expect(asMem001.memberId).toBe("MEM-001");

    const payload = herculesModelPayload(asMem001);
    expect(payload).not.toMatch(/yacht daydream/i);
    expect(payload).not.toMatch(/777\.77/);
    expect(aiDisclosurePayloadLeaks(payload, household, "MEM-001")).toEqual([]);
  });

  it("keeps own personal rows and both-visibility rows visible to the viewer", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const briefing = herculesBriefing(household, "home", today);
    const grounded = talkHercules(household, "what did I spend", today, "home");
    const asMem001 = composeHerculesChatRequest(household, "what did I spend", briefing, grounded, today, "MEM-001");

    expect(asMem001.ledger.recent.some((row) => /haircut/i.test(row.note))).toBe(true);
    expect(asMem001.ledger.recent.some((row) => /saturday coffee/i.test(row.note))).toBe(true);
    expect(formatCad(4200)).toMatch(/42/);
    const payload = herculesModelPayload(asMem001);
    expect(payload).toMatch(/haircut/i);
    expect(aiDisclosurePayloadLeaks(payload, household, "MEM-001")).toEqual([]);
  });
});
