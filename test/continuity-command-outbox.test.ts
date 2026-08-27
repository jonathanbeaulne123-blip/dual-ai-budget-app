import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import {
  createMemoryContinuityStore,
  enqueueContinuitySnapshot,
  flushContinuityOutbox,
  listContinuityOutbox,
  setContinuityStore,
} from "../src/continuity.ts";
import { bundledSupabaseConfig } from "../src/ledger/supabase.ts";

const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };
const authConfig = {
  ...bundledSupabaseConfig(),
  authUserId: "auth-user-jonathan",
  accessToken: "jwt-test-token",
};

function googleHousehold() {
  return linkGoogleIdentity(catalogHousehold(), {
    memberId: "MEM-001",
    email: identity.email,
    subject: identity.subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
}

function withReceipt(household: ReturnType<typeof googleHousehold>, confirmationId: string) {
  const posted = postEntry(household, {
    date: "2026-08-24",
    type: "expense",
    amount: "4.00",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "Command log milk",
    createdBy: "MEM-001",
    confirmDuplicate: true,
  }).household;
  return {
    ...posted,
    commandReceipts: [{
      confirmationId,
      identityHash: "identity-hash-demo",
      auditHash: "audit-hash-demo",
      commandKind: "postEntry",
      postedIds: [posted.transactions.at(-1)!.id],
      revision: posted.revision,
      acceptedAt: "2026-08-26T12:00:00.000Z",
    }],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setContinuityStore(null);
});

describe("T2-S2 command-ref outbox", () => {
  it("stores ref-only durable rows when VITE_CONTINUITY_COMMAND_LOG=1", () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    const household = withReceipt(googleHousehold(), "confirm-ref-1");
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 0,
      confirmationId: "confirm-ref-1",
    });
    const raw = store.getItem("hearth:continuity-outbox:v1:development") ?? "";
    expect(raw).toBeTruthy();
    expect(raw).not.toMatch(/"transactions"/);
    expect(raw).toMatch(/"commandRefs"/);
    expect(raw).toMatch(/confirm-ref-1/);
    const durable = JSON.parse(raw) as Array<{ transportKind?: string; commandRefs?: unknown[] }>;
    expect(durable[0]?.transportKind).toBe("command-ref");
    expect(durable[0]?.commandRefs?.length).toBe(1);
    expect(listContinuityOutbox("development")[0]?.snapshot?.householdId).toBe(household.householdId);
  });

  it("keeps legacy snapshot-tip flush for rows without commandRefs when flag is on", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    setContinuityStore(createMemoryContinuityStore());
    const household = googleHousehold();
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 0,
      confirmationId: "legacy-tip",
    });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: household.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/append_continuity_command")) {
        throw new Error("append_continuity_command must not run for legacy snapshot-tip rows");
      }
      if (url.includes("rpc/publish_continuity_snapshot") || url.includes("rpc/publish_household_snapshot")) {
        return new Response(JSON.stringify({ ok: true, conflict: false, duplicate: false, revision: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config: authConfig,
      force: true,
    });
    expect(flushed.synchronized).toBe(1);
    expect(calls.some((url) => url.includes("rpc/append_continuity_command"))).toBe(false);
  });

  it("creates the household on the first command-ref flush instead of appending", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    setContinuityStore(createMemoryContinuityStore());
    const household = withReceipt(googleHousehold(), "confirm-create");
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 0,
      confirmationId: "confirm-create",
    });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("rpc/append_continuity_command")) {
        throw new Error("append_continuity_command must not run until the household exists");
      }
      if (url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          ok: true,
          conflict: false,
          duplicate: false,
          revision: household.revision,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("rpc/publish_continuity_snapshot")) {
        return new Response(JSON.stringify({
          ok: true,
          conflict: false,
          duplicate: false,
          revision: household.revision,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config: authConfig,
      force: true,
    });
    expect(flushed.synchronized).toBe(1);
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(calls.some((url) => url.includes("rpc/hearth_create_household"))).toBe(true);
    expect(calls.some((url) => url.includes("rpc/append_continuity_command"))).toBe(false);
  });

  it("flushes command-ref rows through append_continuity_command", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    setContinuityStore(createMemoryContinuityStore());
    const household = withReceipt(googleHousehold(), "confirm-append");
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-append",
    });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: household.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/append_continuity_command")) {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        expect(body.p_idempotency_key).toBe("confirm-append");
        expect(body.p_confirmation_id).toBe("confirm-append");
        expect(typeof body.p_shared_payload).toBe("string");
        expect(typeof body.p_personal_payload).toBe("string");
        const personal = JSON.parse(String(body.p_personal_payload)) as { kind?: string; memberId?: string };
        expect(personal.kind).toBe("personal");
        expect(personal.memberId).toBe("MEM-001");
        expect(JSON.stringify(personal)).not.toMatch(/hearthPayload/);
        return new Response(JSON.stringify({
          ok: true,
          conflict: false,
          duplicate: false,
          result_revision: household.revision,
          event_id: "evt-demo",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config: authConfig,
      force: true,
    });
    expect(flushed.synchronized).toBe(1);
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(calls.some((url) => url.includes("rpc/append_continuity_command"))).toBe(true);
    expect(calls.some((url) => url.includes("rpc/publish_continuity_snapshot"))).toBe(false);
  });

  it("never puts partner-personal rows on a shared-scope command payload", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    setContinuityStore(createMemoryContinuityStore());
    let household = googleHousehold();
    household = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "88.88",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "SECRET-PERSONAL-THERAPY-COPAY",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const personalId = household.transactions.at(-1)!.id;
    household = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "6.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const sharedId = household.transactions.at(-1)!.id;
    household = {
      ...household,
      commandReceipts: [
        {
          confirmationId: "confirm-personal",
          identityHash: "hash-personal",
          auditHash: "audit-personal",
          commandKind: "postEntry",
          postedIds: [personalId],
          revision: household.revision - 1,
          acceptedAt: "2026-08-26T12:00:00.000Z",
        },
        {
          confirmationId: "confirm-shared",
          identityHash: "hash-shared",
          auditHash: "audit-shared",
          commandKind: "postEntry",
          postedIds: [sharedId],
          revision: household.revision,
          acceptedAt: "2026-08-26T12:00:01.000Z",
        },
      ],
    };
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-personal",
    });
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-shared",
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([{ id: household.householdId }]), { status: 200 });
      }
      if (url.includes("rpc/append_continuity_command")) {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        expect(body.p_ledger_scope).toBe("shared");
        const payload = body.p_command_payload as {
          materializationFacts?: { transactions?: Array<{ id: string; note?: string; visibility?: string }> };
          postedIds?: string[];
        };
        const wire = JSON.stringify(payload);
        expect(wire).not.toMatch(/SECRET-PERSONAL-THERAPY-COPAY/);
        expect(payload.materializationFacts?.transactions?.some((row) => row.visibility === "personal")).toBeFalsy();
        expect(payload.postedIds ?? []).not.toContain(personalId);
        expect(payload.postedIds ?? []).toContain(sharedId);
        return new Response(JSON.stringify({
          ok: true,
          conflict: false,
          duplicate: false,
          result_revision: household.revision,
          event_id: "evt-shared-only",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const flushed = await flushContinuityOutbox({
      environment: "development",
      identity,
      config: authConfig,
      force: true,
    });
    expect(flushed.synchronized).toBe(1);
  });

  it("stays smaller than a fat snapshot tip for large households", () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    let household = googleHousehold();
    for (let i = 0; i < 100; i += 1) {
      household = postEntry(household, {
        date: "2026-08-24",
        type: "expense",
        amount: "11.11",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `quota stress line ${i} xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
        createdBy: "MEM-001",
        visibility: i % 2 ? "personal" : "household",
        confirmDuplicate: true,
      }).household;
    }
    const confirmationId = "size-ref-final";
    household = {
      ...household,
      commandReceipts: [{
        confirmationId,
        identityHash: "identity-hash-quota",
        auditHash: "audit-hash-quota",
        commandKind: "postEntry",
        postedIds: [household.transactions.at(-1)!.id],
        revision: household.revision,
        acceptedAt: "2026-08-26T12:00:00.000Z",
      }],
    };
    const fatOutboxBytes = Buffer.byteLength(JSON.stringify([{ id: "legacy", snapshot: household }]));
    const store = createMemoryContinuityStore();
    setContinuityStore(store);
    enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 0,
      confirmationId,
    });
    const slim = store.getItem("hearth:continuity-outbox:v1:development") ?? "";
    expect(Buffer.byteLength(slim)).toBeLessThan(fatOutboxBytes / 50);
    expect(slim).not.toMatch(/"transactions"/);
    expect(slim).toMatch(/"commandRefs"/);
  });
});
