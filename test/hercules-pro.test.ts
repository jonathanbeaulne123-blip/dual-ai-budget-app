import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";
import { herculesProTest } from "../workers/herculesPro.js";
import { catalogHousehold, postShift, seedDemoHousehold } from "../src/core/index.ts";
import { assembleHousehold, personalReplicaForMember, splitForSync } from "../src/core/sync.ts";

const origin = "https://hearth-books.jonathan-beaulne123.workers.dev";
const env = { HERCULES_PRO_SIGNING_SECRET: "test-secret-that-is-longer-than-thirty-two-characters" };

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("Hercules Pro OAuth and MCP bridge", () => {
  it("advertises OAuth and refuses anonymous ledger tools", async () => {
    const metadata = await worker.fetch(new Request(`${origin}/.well-known/oauth-protected-resource`), env);
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({ resource: `${origin}/mcp`, scopes_supported: ["hearth.read", "hearth.write"] });

    const denied = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }), env);
    expect(denied.status).toBe(401);
    expect(denied.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource");
  });

  it("links one Google member with PKCE and executes only read tools", async () => {
    const household = seedDemoHousehold({ today: "2026-08-25", environment: "development" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return response({ id: "auth-user-1", email: "bianca@example.com" });
      if (url.includes("/auth/v1/token?grant_type=refresh_token")) return response({ access_token: "renewed-supabase-token", refresh_token: "renewed-refresh-token" });
      if (url.includes("continuity_memberships?")) return response([{ household_id: household.householdId, member_id: "MEM-002", auth_user_id: "auth-user-1", role: "member" }]);
      if (url.includes("continuity_personal_snapshots?")) return response([]);
      if (url.includes("household_snapshots?")) return response([{ payload: JSON.stringify(household) }]);
      return response({ message: `unexpected ${url}` }, 404);
    }));

    const registered = await worker.fetch(new Request(`${origin}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "ChatGPT", redirect_uris: ["https://chatgpt.com/aip/callback"] }),
    }), env);
    const client = await registered.json() as { client_id: string };
    expect(registered.status).toBe(201);

    const verifier = "pkce-verifier-with-more-than-forty-three-characters-123456789";
    const challenge = await herculesProTest.sha256Base64Url(verifier);
    const authorize = new URL(`${origin}/oauth/authorize`);
    authorize.searchParams.set("client_id", client.client_id);
    authorize.searchParams.set("redirect_uri", "https://chatgpt.com/aip/callback");
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("state", "state-1");
    authorize.searchParams.set("scope", "hearth.read");
    authorize.searchParams.set("resource", `${origin}/mcp`);
    const authorization = await worker.fetch(new Request(authorize), env);
    const approvalRequest = new URL(authorization.headers.get("Location")!).searchParams.get("herculesProAuthorize");
    expect(approvalRequest).toBeTruthy();

    const approved = await worker.fetch(new Request(`${origin}/oauth/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorizationRequest: approvalRequest,
        environment: "development",
        householdId: household.householdId,
        memberId: "MEM-002",
        supabaseAccessToken: "verified-supabase-token",
        supabaseRefreshToken: "verified-refresh-token",
      }),
    }), env);
    const approval = await approved.json() as { redirect: string };
    const code = new URL(approval.redirect).searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await worker.fetch(new Request(`${origin}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: client.client_id,
        code: code!,
        code_verifier: verifier,
        redirect_uri: "https://chatgpt.com/aip/callback",
        resource: `${origin}/mcp`,
      }),
    }), env);
    const tokens = await token.json() as { access_token: string; refresh_token: string; scope: string };
    expect(tokens.scope).toBe("hearth.read");
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.access_token).not.toContain("verified-supabase-token");
    expect(tokens.refresh_token).not.toContain("verified-refresh-token");

    const initialized = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    }), env);
    const initializedBody = await initialized.json() as { result: { serverInfo: { version: string }; instructions: string } };
    expect(initializedBody.result.serverInfo.version).toBe("0.3.3");
    expect(initializedBody.result.instructions).toContain("FIRST tool call MUST be summon_hercules");
    expect(initializedBody.result.instructions).toContain("requests picture-in-picture");

    const tools = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    }), env);
    const listed = await tools.json() as { result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean }; _meta?: { ui?: { resourceUri?: string } } }> } };
    // companion (1) + TOOL_CATALOG (63) + writeToolDefinitions (3). Confirm is the only non-read-only tool.
    expect(listed.result.tools).toHaveLength(67);
    expect(listed.result.tools.filter((tool) => tool.annotations.readOnlyHint)).toHaveLength(66);
    expect(listed.result.tools.filter((tool) => tool.name !== "confirm_transaction").every((tool) => tool.annotations.readOnlyHint)).toBe(true);
    const names = listed.result.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "shift_year_simulation",
      "explain_shift_simulation",
      "cash_cinema",
      "what_if_desk",
      "year_review",
      "tip_oracle",
      "summon_hercules",
      "confirm_transaction",
    ]));
    expect(listed.result.tools.find((tool) => tool.name === "confirm_transaction")?.annotations.readOnlyHint).toBe(false);
    expect(listed.result.tools.find((tool) => tool.name === "shift_year_simulation")?.annotations.readOnlyHint).toBe(true);
    expect(listed.result.tools.some((tool) => /^(?:post|delete|pay|transfer)(?:_|$)/.test(tool.name))).toBe(false);
    expect(listed.result.tools.some((tool) => tool.name === "tip_oracle")).toBe(true);
    expect(listed.result.tools.find((tool) => tool.name === "summon_hercules")?._meta?.ui?.resourceUri).toBe("ui://hearth/hercules-companion-v5.html");

    const resources = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 30, method: "resources/list" }),
    }), env);
    expect(await resources.json()).toMatchObject({ result: { resources: [{
      uri: "ui://hearth/hercules-companion-v5.html",
      mimeType: "text/html;profile=mcp-app",
    }] } });

    const resource = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 31, method: "resources/read", params: { uri: "ui://hearth/hercules-companion-v5.html" } }),
    }), env);
    const rendered = await resource.json() as { result: { contents: Array<{ text: string; _meta: { ui: { csp: { resourceDomains: string[] } } } }> } };
    expect(rendered.result.contents[0]?.text).toContain("/hercules-pro/hercules.pro.v1.glb");
    expect(rendered.result.contents[0]?.text).toContain("/hercules-pro/companion.v1.js?v=5");
    expect(rendered.result.contents[0]?.text).toContain(".companion { position: relative; width: 100%; height: 100vh; min-height: 300px; overflow: hidden; background: transparent; }");
    expect(rendered.result.contents[0]?.text).toContain('<section class="sr-only" aria-live="polite">');
    expect(rendered.result.contents[0]?.text).not.toContain("radial-gradient");
    expect(rendered.result.contents[0]?.text).toContain("3D unavailable — Hercules is still listening");
    expect(rendered.result.contents[0]?._meta.ui.csp.resourceDomains).toEqual([origin]);
    expect(rendered.result.contents[0]?.text).not.toContain("verified-supabase-token");

    const summon = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 32, method: "tools/call", params: { name: "summon_hercules", arguments: {
        mood: "teaching",
        message: "Debits on the left. I brought my pointing paw.",
        headline: "Follow the journal",
        ledger: "personal",
      } } }),
    }), env);
    expect(await summon.json()).toMatchObject({ result: { isError: false, structuredContent: {
      status: "companion-ready",
      mood: "teaching",
      headline: "Follow the journal",
      ledger: "personal",
      readOnly: true,
    } } });

    const call = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "account_balance", arguments: { view: "personal" } } }),
    }), env);
    const called = await call.json() as { result: { isError: boolean; structuredContent: { readOnly: boolean; memberId: string; ledger: string; accountingBasis: string; currency: string; timeZone: string; usedTool: string; answer: string; teachingContract: { writeAuthority: string; clickableSources: boolean; announceTool: boolean } } } };
    expect(called.result.isError).toBe(false);
    expect(called.result.structuredContent).toMatchObject({ readOnly: true, memberId: "MEM-002", ledger: "personal", accountingBasis: "posted-recognized-journal", currency: "CAD", timeZone: "America/Toronto", usedTool: "account_balance", teachingContract: { writeAuthority: "none", clickableSources: true, announceTool: true } });
    expect(called.result.structuredContent.answer.startsWith("I used `account_balance`.")).toBe(true);

    const refresh = await worker.fetch(new Request(`${origin}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: tokens.refresh_token, resource: `${origin}/mcp` }),
    }), env);
    const refreshed = await refresh.json() as { access_token: string; refresh_token: string };
    expect(refresh.status).toBe(200);
    expect(refreshed.access_token).toBeTruthy();
    expect(refreshed.refresh_token).not.toContain("renewed-refresh-token");

    const replay = await worker.fetch(new Request(`${origin}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, code: code!, code_verifier: verifier, redirect_uri: "https://chatgpt.com/aip/callback", resource: `${origin}/mcp` }),
    }), env);
    expect(replay.status).toBe(400);
  });

  it("downgrades a broad connector reconnect to read-only when writing is off", async () => {
    const household = seedDemoHousehold({ today: "2026-08-25", environment: "development" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return response({ id: "auth-user-1", email: "jonathan@example.com" });
      if (url.includes("continuity_memberships?")) return response([{ household_id: household.householdId, member_id: "MEM-002", auth_user_id: "auth-user-1", role: "member" }]);
      if (url.includes("continuity_personal_snapshots?")) return response([]);
      if (url.includes("household_snapshots?")) return response([{ payload: JSON.stringify(household) }]);
      return response({ message: `unexpected ${url}` }, 404);
    }));

    const now = Math.floor(Date.now() / 1000);
    const authorizationRequest = await herculesProTest.seal(env, {
      kind: "authorize",
      clientId: "client",
      redirectUri: "https://chatgpt.com/aip/callback",
      challenge: "challenge",
      scope: "hearth.read hearth.write",
      resource: `${origin}/mcp`,
      state: "state",
      iat: now,
      exp: now + 60,
    });
    const approved = await worker.fetch(new Request(`${origin}/oauth/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorizationRequest,
        environment: "development",
        householdId: household.householdId,
        memberId: "MEM-002",
        supabaseAccessToken: "verified-supabase-token",
        supabaseRefreshToken: "verified-refresh-token",
      }),
    }), env);

    expect(approved.status).toBe(200);
    const approval = await approved.json() as { redirect: string };
    const code = new URL(approval.redirect).searchParams.get("code");
    const claims = await herculesProTest.unsealPrivate(env, code, "code");
    expect(claims.scope).toBe("hearth.read");
  });

  it("reads personal-envelope shifts from split hosted snapshots through MCP", async () => {
    let household = catalogHousehold();
    household = postShift(household, {
      date: "2026-08-25",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "120.00",
      cashTips: "25.00",
      ccTips: "35.00",
      hours: "5.00",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const { shared } = splitForSync(household, "MEM-002");
    const personal = personalReplicaForMember(household, "MEM-002");
    expect(shared.shifts).toHaveLength(0);
    expect(personal.shifts).toHaveLength(1);

    const now = Math.floor(Date.now() / 1000);
    const accessToken = await herculesProTest.sealPrivate(env, {
      kind: "access",
      scope: "hearth.read",
      resource: `${origin}/mcp`,
      aud: `${origin}/mcp`,
      environment: "development",
      householdId: household.householdId,
      memberId: "MEM-002",
      authUserId: "auth-user-1",
      supabaseAccessToken: "supabase-token",
      iat: now,
      exp: now + 60,
    });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("continuity_memberships?")) {
        return response([{ household_id: household.householdId, member_id: "MEM-002", auth_user_id: "auth-user-1", role: "member" }]);
      }
      if (url.includes("continuity_personal_snapshots?")) {
        return response([{ payload: JSON.stringify(personal) }]);
      }
      if (url.includes("household_snapshots?")) {
        return response([{ payload: JSON.stringify(assembleHousehold(shared, null)) }]);
      }
      return response({ message: `unexpected ${url}` }, 404);
    }));

    const shiftCall = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 40, method: "tools/call", params: {
        name: "shift_summary",
        arguments: { period: "this_week" },
      } }),
    }), env);
    const shiftResult = await shiftCall.json() as { result: { isError: boolean; structuredContent: { status: string; usedTool: string; answer: string; ledger: string } } };
    expect(shiftResult.result.isError).toBe(false);
    expect(shiftResult.result.structuredContent).toMatchObject({ status: "ok", usedTool: "shift_summary", ledger: "personal" });
    expect(shiftResult.result.structuredContent.answer).toMatch(/1 posted shift/i);
  });

  it("keeps Production off until the reviewed security cutover", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/auth/v1/user")) return response({ id: "auth-user-1", email: "a@example.com" });
      return response([]);
    }));
    const now = Math.floor(Date.now() / 1000);
    const authorizationRequest = await herculesProTest.seal(env, {
      kind: "authorize",
      clientId: "client",
      redirectUri: "https://chatgpt.com/aip/callback",
      challenge: "challenge",
      scope: "hearth.read",
      resource: `${origin}/mcp`,
      state: "state",
      iat: now,
      exp: now + 60,
    });
    const result = await worker.fetch(new Request(`${origin}/oauth/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorizationRequest, environment: "production" }),
    }), env);
    expect(result.status).toBe(400);
    expect(await result.text()).toMatch(/Development-only/);
  });

  it("stores member-owned Personal and Household opt-ins in the Personal envelope", async () => {
    const household = seedDemoHousehold({ today: "2026-08-25", environment: "development" });
    const writes: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) return response({ id: "auth-user-1", email: "bianca@example.com" });
      if (url.includes("continuity_memberships?")) return response([{ household_id: household.householdId, member_id: "MEM-002", auth_user_id: "auth-user-1", role: "member" }]);
      if (url.includes("household_snapshots?")) return response([{ payload: JSON.stringify(household) }]);
      if (url.includes("continuity_personal_snapshots?") && init?.method === "POST") {
        writes.push(JSON.parse(String(init.body)));
        return response(null);
      }
      if (url.includes("continuity_personal_snapshots?")) return response([]);
      return response({ message: `unexpected ${url}` }, 404);
    }));
    const permissionsUrl = new URL(`${origin}/hercules-pro/permissions`);
    permissionsUrl.searchParams.set("environment", "development");
    permissionsUrl.searchParams.set("householdId", household.householdId);
    permissionsUrl.searchParams.set("memberId", "MEM-002");
    const saved = await worker.fetch(new Request(permissionsUrl, {
      method: "PUT",
      headers: { Authorization: "Bearer supabase-user-token", "Content-Type": "application/json" },
      body: JSON.stringify({ personalWrite: true, householdWrite: false }),
    }), env);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ ok: true, permissions: { personalWrite: true, householdWrite: false } });
    expect(writes).toHaveLength(1);
    const row = writes[0] as { member_id: string; payload: string };
    expect(row.member_id).toBe("MEM-002");
    expect(JSON.parse(row.payload)).toMatchObject({
      kind: "personal",
      memberId: "MEM-002",
      herculesProPermissions: { personalWrite: true, householdWrite: false },
    });
  });

  it("previews without writing and posts the sealed preview only after confirmation", async () => {
    const household = seedDemoHousehold({ today: "2026-08-25", environment: "development" });
    const personal = {
      kind: "personal",
      memberId: "MEM-002",
      lastCommittedAt: household.lastCommittedAt,
      transactions: [],
      shifts: [],
      goals: [],
      goalContributions: [],
      goalPurchases: [],
      tombstones: [],
      herculesProPermissions: { personalWrite: true, householdWrite: true, updatedAt: "2026-08-25T12:00:00.000Z" },
    };
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    let permissionsEnabled = true;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("continuity_memberships?")) return response([{ household_id: household.householdId, member_id: "MEM-002", auth_user_id: "auth-user-1", role: "member" }]);
      if (url.includes("continuity_personal_snapshots?")) return response([{ payload: JSON.stringify({
        ...personal,
        herculesProPermissions: { ...personal.herculesProPermissions, personalWrite: permissionsEnabled },
      }) }]);
      if (url.includes("household_snapshots?")) return response([{ payload: JSON.stringify(household) }]);
      if (url.includes("rpc/publish_hercules_confirmed_write")) return response([{ ok: true, duplicate: false, revision: household.revision + 1 }]);
      return response({ message: `unexpected ${url}` }, 404);
    }));
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await herculesProTest.sealPrivate(env, {
      kind: "access",
      scope: "hearth.read hearth.write",
      resource: `${origin}/mcp`,
      aud: `${origin}/mcp`,
      environment: "development",
      householdId: household.householdId,
      memberId: "MEM-002",
      authUserId: "auth-user-1",
      supabaseAccessToken: "supabase-token",
      iat: now,
      exp: now + 60,
    });
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

    const listedResponse = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 20, method: "tools/list" }),
    }), env);
    const listed = await listedResponse.json() as { result: { tools: Array<{ name: string; annotations: { readOnlyHint: boolean; destructiveHint: boolean } }> } };
    expect(listed.result.tools).toHaveLength(67);
    expect(listed.result.tools.find((tool) => tool.name === "confirm_transaction")?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(listed.result.tools.some((tool) => tool.name === "year_review")).toBe(true);
    expect(listed.result.tools.some((tool) => tool.name === "shift_year_simulation")).toBe(true);

    const account = household.accounts.find((row) => row.active)!;
    const category = household.categories.find((row) => row.active && row.recordType === "category" && row.transactionType === "expense")!;
    const prepare = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 21, method: "tools/call", params: {
        name: "prepare_transaction",
        arguments: {
          view: "personal",
          type: "expense",
          date: "2026-08-24",
          amountCents: 4321,
          accountId: account.id,
          subcategoryId: category.id,
          note: "Synthetic write proof",
        },
      } }),
    }), env);
    const prepared = await prepare.json() as { result: { isError: boolean; structuredContent: { confirmationToken: string; postedNothing: boolean; preview: { amountCents: number; ledger: string } } } };
    expect(prepared.result.isError).toBe(false);
    expect(prepared.result.structuredContent).toMatchObject({ postedNothing: true, preview: { amountCents: 4321, ledger: "personal" } });
    expect(calls.some((call) => call.url.includes("rpc/publish_hercules_confirmed_write"))).toBe(false);

    const confirm = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 22, method: "tools/call", params: {
        name: "confirm_transaction",
        arguments: { confirmationToken: prepared.result.structuredContent.confirmationToken, confirmed: true },
      } }),
    }), env);
    const confirmed = await confirm.json() as { result: { isError: boolean; structuredContent: { postedExactlyOnce: boolean; ledger: string } } };
    expect(confirmed.result.isError).toBe(false);
    expect(confirmed.result.structuredContent).toMatchObject({ postedExactlyOnce: true, ledger: "personal" });
    const publish = calls.find((call) => call.url.includes("rpc/publish_hercules_confirmed_write"));
    expect(publish).toBeTruthy();
    const body = JSON.parse(String(publish?.init?.body));
    expect(body).toMatchObject({ p_ledger_view: "personal", p_member_id: "MEM-002" });
    expect(JSON.parse(body.p_personal_payload).transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ amountCents: 4321, visibility: "personal", createdBy: "MEM-002" }),
    ]));

    const secondPrepare = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 23, method: "tools/call", params: {
        name: "prepare_transaction",
        arguments: {
          view: "personal",
          type: "expense",
          date: "2026-08-23",
          amountCents: 1111,
          accountId: account.id,
          subcategoryId: category.id,
        },
      } }),
    }), env);
    const second = await secondPrepare.json() as { result: { structuredContent: { confirmationToken: string } } };
    permissionsEnabled = false;
    const rpcCount = calls.filter((call) => call.url.includes("rpc/publish_hercules_confirmed_write")).length;
    const blocked = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 24, method: "tools/call", params: {
        name: "confirm_transaction",
        arguments: { confirmationToken: second.result.structuredContent.confirmationToken, confirmed: true },
      } }),
    }), env);
    expect(await blocked.text()).toMatch(/turned off/);
    expect(calls.filter((call) => call.url.includes("rpc/publish_hercules_confirmed_write"))).toHaveLength(rpcCount);
  });

  it("binds authorization, token exchange, and MCP access to the exact resource", async () => {
    const now = Math.floor(Date.now() / 1000);
    const wrongAudience = await herculesProTest.sealPrivate(env, {
      kind: "access",
      scope: "hearth.read",
      resource: "https://example.com/mcp",
      aud: "https://example.com/mcp",
      iat: now,
      exp: now + 60,
    });
    const denied = await worker.fetch(new Request(`${origin}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wrongAudience}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }),
    }), env);
    expect(denied.status).toBe(401);

    const registered = await worker.fetch(new Request(`${origin}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://chatgpt.com/aip/callback"] }),
    }), env);
    const client = await registered.json() as { client_id: string };
    const authorize = new URL(`${origin}/oauth/authorize`);
    authorize.searchParams.set("client_id", client.client_id);
    authorize.searchParams.set("redirect_uri", "https://chatgpt.com/aip/callback");
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("code_challenge", "challenge");
    authorize.searchParams.set("resource", "https://example.com/mcp");
    const rejected = await worker.fetch(new Request(authorize), env);
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).toMatch(/OAuth resource/);
  });
});
