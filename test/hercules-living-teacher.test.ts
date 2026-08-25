import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  catalogHousehold,
  composeHerculesChatRequest,
  gateHerculesQuestion,
  herculesBriefing,
  householdForHerculesContext,
  planHerculesTurn,
  postEntry,
  seedDemoHousehold,
  transactionsForHerculesSource,
} from "../src/core/index.ts";
import {
  herculesInLitter,
  herculesLitterRect,
  herculesOverFly,
  keepHerculesOutOfLitter,
  wanderFly,
} from "../src/HerculesFly.tsx";

const today = "2026-08-21";

describe("Hercules living teacher", () => {
  it("answers food anxiety with grounded, clickable plan facts", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const plan = planHerculesTurn(
      household,
      "will I be able to eat this week?",
      today,
      "home",
      "",
      { memberId: "MEM-001", view: "household" },
    );
    expect(plan.skipModel).toBe(true);
    expect(plan.talk.spoken).toMatch(/books|grocer|cash-like|plan/i);
    expect(plan.talk.facts?.length).toBeGreaterThanOrEqual(2);
    expect(plan.talk.facts?.every((fact) => fact.source.route === "plan")).toBe(true);
  });

  it("compares only a member's shared posts in household view", () => {
    let household = catalogHousehold();
    for (const [date, amount] of [["2026-08-20", 120], ["2026-08-13", 40], ["2026-08-06", 40], ["2026-07-30", 40], ["2026-07-23", 40]] as const) {
      household = postEntry(household, {
        date,
        type: "expense",
        amount,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        createdBy: "MEM-002",
        visibility: "household",
        confirmDuplicate: true,
      }).household;
    }
    household = postEntry(household, {
      date: "2026-08-20",
      type: "expense",
      amount: 999,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "private canary",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const plan = planHerculesTurn(
      household,
      "did Jonathan overspend this week?",
      today,
      "home",
      "",
      { memberId: "MEM-001", view: "household" },
    );
    expect(plan.skipModel).toBe(true);
    expect(plan.talk.spoken).toMatch(/Jonathan.*above.*average/i);
    expect(plan.talk.spoken).not.toMatch(/999/);
    expect(plan.talk.facts?.[0]?.source).toMatchObject({ route: "ledger", view: "household", memberId: "MEM-002" });
  });

  it("refuses partner-personal questions in the personal ledger with Hercules voice", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const gate = gateHerculesQuestion(household, "did Jonathan overspend?", "MEM-001", "personal");
    expect(gate.allow).toBe(false);
    const plan = planHerculesTurn(
      household,
      "did Jonathan overspend this week?",
      today,
      "home",
      "",
      { memberId: "MEM-001", view: "personal" },
    );
    expect(plan.skipModel).toBe(true);
    expect(plan.talk.spoken).toMatch(/nice try, you silly kitten/i);
    expect(plan.talk.spoken).not.toMatch(/\$/);
  });

  it("uses own personal rows only in personal context and shared rows only in household context", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const own = householdForHerculesContext(household, "MEM-001", "personal");
    expect(own.transactions.some((tx) => /haircut/i.test(tx.note))).toBe(true);
    expect(own.transactions.some((tx) => tx.visibility === "household")).toBe(false);
    const shared = householdForHerculesContext(household, "MEM-001", "household");
    expect(shared.transactions.some((tx) => /haircut/i.test(tx.note))).toBe(false);
    expect(shared.transactions.some((tx) => tx.visibility === "household")).toBe(true);
    expect(shared.appointments.every((item) => item.sensitivity === "household")).toBe(true);
    const sharedAppointmentIds = new Set(shared.appointments.map((item) => item.id));
    expect(shared.claims.every((claim) => !claim.appointmentId || sharedAppointmentIds.has(claim.appointmentId))).toBe(true);

    const req = composeHerculesChatRequest(
      household,
      "what did I spend?",
      herculesBriefing(household, "home", today),
      today,
      "MEM-001",
      "",
      { view: "personal" },
    );
    expect(req.ledger.recent.some((row) => /haircut/i.test(row.note))).toBe(true);
    expect(req.ledger.recent.some((row) => /gym drop-in/i.test(row.note))).toBe(false);
  });

  it("attaches exact account provenance instead of linking digits from prose", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const plan = planHerculesTurn(
      household,
      "what's on the Visa?",
      today,
      "home",
      "",
      { memberId: "MEM-001", view: "household" },
    );
    expect(plan.talk.facts?.length).toBeGreaterThan(1);
    expect(plan.talk.facts?.every((fact) => fact.source.accountId === "ACC-VISA")).toBe(true);
    const ui = readFileSync("src/Hercules.tsx", "utf8");
    expect(ui).toContain("onOpenSource(fact.source)");
    expect(ui).not.toMatch(/matchAll\([^)]*\\d/);
  });

  it("opens the exact structured ledger rows behind a grounded number", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const shared = householdForHerculesContext(household, "MEM-001", "household");
    const target = shared.transactions.find((tx) => tx.createdBy === "MEM-002" && tx.subcategoryId);
    expect(target).toBeDefined();
    expect(target?.subcategoryId).toBeTruthy();
    if (!target?.subcategoryId) return;
    const targetCategory = target.subcategoryId;
    const rows = transactionsForHerculesSource(shared.transactions, {
      route: "ledger",
      view: "household",
      label: "Jonathan's shared week",
      memberId: target.createdBy,
      categoryId: targetCategory,
      from: target.date,
      to: target.date,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((tx) => tx.createdBy === target.createdBy)).toBe(true);
    expect(rows.every((tx) => tx.subcategoryId === targetCategory)).toBe(true);
    expect(rows.every((tx) => tx.date === target.date)).toBe(true);
  });

  it("restores per-turn bubbles and keeps desktop-only fly play outside the litter zone", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toMatch(/\.hercules-turn\s*\{[^}]*border-radius/s);
    expect(css).toMatch(/\.hercules-turn\.you\s*\{[^}]*align-self:\s*flex-end/s);
    expect(css).toMatch(/\.hercules-turn\.cat\s*\{[^}]*align-self:\s*flex-start/s);
    const flyCss = readFileSync("src/hercules.css", "utf8");
    expect(flyCss).toMatch(/@media \(max-width: 719px\)[\s\S]*\.herc-fly[\s\S]*display: none/);

    const viewport = { w: 1200, h: 800 };
    const litter = herculesLitterRect(viewport);
    const unsafe = { x: litter.x + 4, y: litter.y + 4 };
    const safe = keepHerculesOutOfLitter(unsafe, viewport);
    expect(herculesInLitter(safe, viewport)).toBe(false);
    expect(herculesInLitter(unsafe, viewport)).toBe(true);
    expect(herculesOverFly({ x: 100, y: 100 }, { x: 140, y: 140 })).toBe(true);
    const spawned = wanderFly(viewport, 76, () => 0.99, litter);
    expect(spawned.x).toBeLessThan(litter.x);
  });
});
