import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../workers/ledgerRoom.ts", () => ({ LedgerRoom: class {} }));

import worker from "../workers/site.js";
import { appendPlanSitdownTurn, catalogHousehold, splitForSync } from "../src/core/index.ts";
import { resetChatRateMemory } from "../workers/herculesGuard.js";

const origin = "http://localhost:5173";

describe("trusted Shared Plan Hercules route", () => {
  beforeEach(() => resetChatRateMemory());

  it("binds an actor-authored Shared turn to server receipt metadata before appending", async () => {
    let household = catalogHousehold();
    household = appendPlanSitdownTurn(household, {
      sitDownSessionId: "SITDOWN-WORKER",
      monthKey: "2026-09",
      planDraftId: "PLAN-SITDOWN-WORKING-2026-09",
      memberId: "MEM-001",
      text: "What is protected?",
    }).household;
    const session = household.planHerculesSessions![0]!;
    const sourceTurn = session.turns[0]!;
    const replica = splitForSync(household, "MEM-001");
    const appendTrustedPlanReply = vi.fn(async (_scope, input) => ({
      turnId: "PLAN-TURN-SERVER",
      sequence: household.revision + 1,
      input,
    }));
    const room = {
      ensureImported: vi.fn(async () => undefined),
      snapshot: vi.fn(async () => ({ sequence: household.revision, shared: replica.shared, personal: replica.personal })),
      appendTrustedPlanReply,
    };
    const env = {
      LEDGER_SYNC_LOCAL_AUTH: "true",
      LEDGER_ROOMS: { idFromName: vi.fn(() => "room-id"), get: vi.fn(() => room) },
    };
    const response = await worker.fetch(new Request(`${origin}/plan/shared/hercules/development/${household.householdId}`, {
      method: "POST",
      headers: { Origin: origin, Authorization: "Bearer local:MEM-001", "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, inReplyToTurnId: sourceTurn.id }),
    }), env);

    expect(response.status).toBe(200);
    expect(appendTrustedPlanReply).toHaveBeenCalledTimes(1);
    const [scope, accepted] = appendTrustedPlanReply.mock.calls[0]!;
    expect(scope).toMatchObject({ memberId: "MEM-001", householdId: household.householdId });
    expect(accepted).toMatchObject({
      sessionId: session.id,
      inReplyToTurnId: sourceTurn.id,
      sourceRevision: household.revision,
      provider: "grounded-fallback",
      responseHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      receiptId: expect.any(String),
      text: expect.any(String),
    });
    expect(accepted).not.toHaveProperty("memberId");
    expect(accepted).not.toHaveProperty("role");
  });

  it("refuses to answer a different member's source turn", async () => {
    let household = catalogHousehold();
    household = appendPlanSitdownTurn(household, {
      sitDownSessionId: "SITDOWN-WORKER",
      monthKey: "2026-09",
      planDraftId: "PLAN-SITDOWN-WORKING-2026-09",
      memberId: "MEM-002",
      text: "What is protected?",
    }).household;
    const session = household.planHerculesSessions![0]!;
    const replica = splitForSync(household, "MEM-001");
    const appendTrustedPlanReply = vi.fn();
    const room = { ensureImported: vi.fn(), snapshot: vi.fn(async () => ({ sequence: household.revision, shared: replica.shared, personal: replica.personal })), appendTrustedPlanReply };
    const env = { LEDGER_SYNC_LOCAL_AUTH: "true", LEDGER_ROOMS: { idFromName: vi.fn(() => "room-id"), get: vi.fn(() => room) } };
    const response = await worker.fetch(new Request(`${origin}/plan/shared/hercules/development/${household.householdId}`, {
      method: "POST",
      headers: { Origin: origin, Authorization: "Bearer local:MEM-001", "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, inReplyToTurnId: session.turns[0]!.id }),
    }), env);

    expect(response.status).toBe(409);
    expect(appendTrustedPlanReply).not.toHaveBeenCalled();
  });
});
