import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  aiDisclosurePayloadLeaks,
  collectAllowedFigures,
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
  upsertCoworker,
  splitForSync,
} from "../src/core/index.ts";

const today = todayKey();

describe("member-scoped AI disclosure (D-115)", () => {
  function boundedPayload(request: ReturnType<typeof composeHerculesChatRequest>) {
    return herculesModelPayload({
      ...request,
      fullSyntheticContext: undefined,
      dataClassification: undefined,
    });
  }

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

    const forJonathan = householdForAiDisclosure(household, "MEM-001", { view: "personal" });
    expect(forJonathan.transactions.some((tx) => /gym drop-in/i.test(tx.note))).toBe(false);
    expect(forJonathan.transactions.some((tx) => /haircut/i.test(tx.note))).toBe(true);
    expect(forJonathan.kitchen.hercules?.memories.some((row) => /secret spa/i.test(row.label))).toBe(false);
    expect(forJonathan.kitchen.hercules?.memories.some((row) => /payday/i.test(row.label))).toBe(true);
    expect(forJonathan.kitchen.hercules?.chats).toEqual([]);

    const forBianca = householdForAiDisclosure(household, "MEM-002", { view: "personal" });
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
    const asMem001 = composeHerculesChatRequest(
      household,
      "what did we spend",
      fullBriefing,
      today,
      "MEM-001",
    );

    expect(asMem001.briefing.monthOutCad).not.toBe(fullBriefing.monthOutCad);
    expect(asMem001.briefing.monthOutCad).not.toMatch(/777\.77/);
    expect(asMem001.ledger.monthByCategory.some((row) => row.amount.includes("777.77"))).toBe(false);
    expect(asMem001.ledger.recent.some((row) => /yacht daydream/i.test(row.note))).toBe(false);
    expect(asMem001.memberId).toBe("MEM-001");

    const bounded = boundedPayload(asMem001);
    expect(bounded).not.toMatch(/yacht daydream/i);
    expect(bounded).not.toMatch(/777\.77/);
    expect(aiDisclosurePayloadLeaks(bounded, household, "MEM-001")).toEqual([]);
    const payload = herculesModelPayload(asMem001);
    expect(payload).toMatch(/yacht daydream/i);
    expect(payload).toMatch(/777\.77/);
    expect(asMem001.dataClassification).toBe("synthetic");
  });

  it("keeps own personal rows and both-visibility rows visible to the viewer", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const briefing = herculesBriefing(household, "home", today);
    const asMem001 = composeHerculesChatRequest(household, "what did I spend", briefing, today, "MEM-001", "", { view: "personal" });

    expect(asMem001.ledger.recent.some((row) => /haircut/i.test(row.note))).toBe(true);
    expect(asMem001.ledger.recent.some((row) => /saturday coffee/i.test(row.note))).toBe(true);
    expect(formatCad(4200)).toMatch(/42/);
    const payload = boundedPayload(asMem001);
    expect(payload).toMatch(/haircut/i);
    expect(aiDisclosurePayloadLeaks(payload, household, "MEM-001")).toEqual([]);
  });

  it("shares only explicitly selected owner coworker facts for one personal model request", () => {
    const base = seedDemoHousehold({ today, environment: "development" });
    const job = base.workJobs.find((row) => row.memberId === "MEM-002")!;
    const added = upsertCoworker(base, {
      ownerMemberId: "MEM-002",
      jobId: job.id,
      locationName: job.locationName,
      displayName: "Alex Lee",
      source: "seven-shifts-roster",
      sourceIdentityKey: "s7subject_aaaaaaaaaaaaaaaaaaaa",
      observedRoles: [{ label: "Support", firstObservedAt: "2026-08-28T12:00:00.000Z", lastObservedAt: "2026-08-28T12:00:00.000Z" }],
    }).household;
    added.coworkers = [...added.coworkers!, {
      ...added.coworkers![0]!, id: "COW-PARTNER-CANARY", ownerMemberId: "MEM-001", displayName: "Partner Private Canary",
      normalizedName: "partner private canary", aliases: ["partner private canary"], sourceIdentityKey: "s7subject_bbbbbbbbbbbbbbbbbbbb",
    }];
    const briefing = herculesBriefing(added, "home", today);
    const defaultRequest = composeHerculesChatRequest(added, "who worked", briefing, today, "MEM-002", "", { view: "personal" });
    expect(defaultRequest.workplaceContext).toBeNull();
    expect(boundedPayload(defaultRequest)).not.toMatch(/Alex Lee|Partner Private Canary/);
    expect(herculesModelPayload(defaultRequest)).toMatch(/Alex Lee|Partner Private Canary/);

    const selected = composeHerculesChatRequest(added, "who worked", briefing, today, "MEM-002", "", {
      view: "personal",
      coworkerIdsForModel: [added.coworkers![0]!.id, "COW-PARTNER-CANARY"],
    });
    expect(selected.workplaceContext?.coworkers).toMatchObject([{ displayName: "Alex Lee", observedRoles: ["Support"] }]);
    const payload = herculesModelPayload(selected);
    expect(payload).toContain("Alex Lee");
    expect(payload).toContain("Partner Private Canary");
    expect(payload).not.toContain("s7subject_");
    expect(splitForSync(added, "MEM-002").shared.kitchen.hercules?.chats.some((row) => /Alex Lee/.test(row.text))).toBe(false);
    expect(composeHerculesChatRequest(added, "who worked", briefing, today, "MEM-002", "", {
      view: "household", coworkerIdsForModel: [added.coworkers![0]!.id],
    }).workplaceContext).toBeNull();
    const herculesUi = readFileSync(new URL("../src/Hercules.tsx", import.meta.url), "utf8");
    expect(herculesUi).toContain("if (ephemeral) return;");
    expect(herculesUi).toContain("function consumeWorkplaceRosterConsent");
    expect(herculesUi).toMatch(/function speak[\s\S]*consumeWorkplaceRosterConsent\(\)[\s\S]*sendChat\(helpCmd\?\.prompt \?\? text, requestedCoworkerIds\)/);
    expect(herculesUi).toMatch(/keepTalk\(message, result\.text,[\s\S]*coworkerIdsForModel\.length > 0\)/);
  });

  it("rebuilds grounded answers and allowed figures from the member projection", () => {
    let household = seedDemoHousehold({ today, environment: "development" });
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: 777.77,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Partner-private aggregate canary",
      place: "Personal",
      splits: [{ party: "MEM-002", amountCents: 77777 }],
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;

    const message = "Show me the income statement";
    const fullGrounded = talkHercules(household, message, today, "home");
    const disclosed = householdForAiDisclosure(household, "MEM-001");
    const scopedGrounded = talkHercules(disclosed, message, today, "home");
    expect(fullGrounded.spoken).not.toBe(scopedGrounded.spoken);

    const request = composeHerculesChatRequest(
      household,
      message,
      herculesBriefing(household, "home", today),
      today,
      "MEM-001",
    );

    expect(request.grounded.spoken).toBe(scopedGrounded.spoken);
    expect(request.grounded.fact).toEqual(scopedGrounded.fact);
    const scopedFigures = collectAllowedFigures(
      scopedGrounded.spoken,
      scopedGrounded.lesson,
      scopedGrounded.fact?.value,
    );
    const fullOnlyFigures = collectAllowedFigures(
      fullGrounded.spoken,
      fullGrounded.lesson,
      fullGrounded.fact?.value,
    ).filter((figure) => !scopedFigures.includes(figure));
    expect(fullOnlyFigures.length).toBeGreaterThan(0);
    expect(request.figures).toEqual(scopedFigures);
    expect(request.figures).not.toEqual(expect.arrayContaining(fullOnlyFigures));
  });

  it("shares the credential-free full snapshot only for synthetic Development", () => {
    const development = seedDemoHousehold({ today, environment: "development" });
    const request = composeHerculesChatRequest(
      development,
      "explain our whole synthetic picture",
      herculesBriefing(development, "home", today),
      today,
      "MEM-001",
    );
    expect(request.dataClassification).toBe("synthetic");
    expect(request.fullSyntheticContext).toMatch(/gym drop-in|haircut/i);
    expect(request.fullSyntheticContext).not.toMatch(/inviteCode|sourceIdentityKey|s7subject_|password|authorization|commandReceipts/i);

    const production = seedDemoHousehold({ today, environment: "production" });
    const productionRequest = composeHerculesChatRequest(
      production,
      "explain our books",
      herculesBriefing(production, "home", today),
      today,
      "MEM-001",
    );
    expect(productionRequest.fullSyntheticContext).toBeUndefined();
    expect(productionRequest.dataClassification).toBeUndefined();
  });
});
