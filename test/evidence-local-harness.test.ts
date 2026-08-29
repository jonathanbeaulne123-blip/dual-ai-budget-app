import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const kitchen = "https://hearth-books.jonathan-beaulne123.workers.dev";
const scope = "environment=development&householdId=HH-TEST&memberId=MEM-001";
const productionScope = "environment=production&householdId=HH-TEST&memberId=MEM-001";

let mf: Miniflare;

type LocalR2Bucket = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  put(key: string, value: Uint8Array): Promise<unknown>;
  list(): Promise<{ objects: unknown[] }>;
};

async function waitFor<T>(read: () => Promise<T | null>, timeoutMs = 8_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for the local Evidence queue.");
}

function headers(token = "owner-jwt") {
  return {
    Authorization: `Bearer ${token}`,
    Origin: kitchen,
  };
}

async function applyMigration(db: Awaited<ReturnType<Miniflare["getD1Database"]>>, path: string) {
  const sql = (await readFile(new URL(path, import.meta.url), "utf8"))
    .replace(/\r\n/g, "\n")
    .replace(/^\s*--.*$/gm, "")
    .replace(/^\s*PRAGMA\s+foreign_keys\s*=\s*ON;\s*$/gim, "");
  for (const statement of sql.split(";").map((value) => value.trim()).filter(Boolean)) {
    await db.prepare(statement).run();
  }
}

beforeAll(async () => {
  const entry = fileURLToPath(new URL("../workers/site.js", import.meta.url));
  const bundled = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    logLevel: "silent",
  });
  mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: bundled.outputFiles[0]!.text,
    compatibilityDate: "2026-08-21",
    bindings: {
      EVIDENCE_ENABLED: "true",
      EVIDENCE_ALLOW_PRODUCTION: "true",
      EVIDENCE_EMAIL_ENABLED: "false",
      EVIDENCE_KEK_V1: "local-only-evidence-key-material-for-synthetic-smoke",
      EVIDENCE_PRODUCTION_KEK_V1: "local-only-production-key-material-for-synthetic-smoke",
      EVIDENCE_PRODUCTION_QUEUE_NAME: "evidence-production-local-smoke",
      SEVENSHIFTS_ENABLED: "false",
      SEVENSHIFTS_ALLOW_PRODUCTION: "false",
      SUPABASE_URL: "https://supabase.test",
      SUPABASE_PUBLISHABLE_KEY: "publishable-local-test-key",
    },
    d1Databases: { EVIDENCE_DB: "evidence-local-smoke", EVIDENCE_PRODUCTION_DB: "evidence-production-local-smoke" },
    r2Buckets: { EVIDENCE_RAW: "evidence-local-smoke", EVIDENCE_PRODUCTION_RAW: "evidence-production-local-smoke" },
    queueProducers: {
      EVIDENCE_DERIVE: { queueName: "evidence-local-smoke" },
      EVIDENCE_PRODUCTION_DERIVE: { queueName: "evidence-production-local-smoke" },
    },
    queueConsumers: {
      "evidence-local-smoke": { maxBatchSize: 1, maxBatchTimeout: 1 },
      "evidence-production-local-smoke": { maxBatchSize: 1, maxBatchTimeout: 1 },
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const authUserId = token === "owner-jwt" ? "auth-user-1" : "auth-user-2";
      if (url.pathname === "/auth/v1/user") return Response.json({ id: authUserId });
      if (url.pathname === "/rest/v1/continuity_memberships") {
        const environment = url.searchParams.get("environment")?.replace(/^eq\./, "");
        const ownerMatch = authUserId === "auth-user-1"
          && (environment === "development" || environment === "production")
          && url.searchParams.get("household_id") === "eq.HH-TEST"
          && url.searchParams.get("member_id") === "eq.MEM-001"
          && url.searchParams.get("auth_user_id") === "eq.auth-user-1";
        return Response.json(ownerMatch ? [{
          environment,
          household_id: "HH-TEST",
          member_id: "MEM-001",
          auth_user_id: "auth-user-1",
          role: "owner",
        }] : []);
      }
      if (url.pathname === "/rest/v1/continuity_command_events") return Response.json([]);
      return new Response("not found", { status: 404 });
    },
  }));

  const db = await mf.getD1Database("EVIDENCE_DB");
  await applyMigration(db, "../migrations/evidence/0001_evidence_mesh.sql");
  await applyMigration(db, "../migrations/evidence/0002_r2_budget_guard.sql");
  const productionDb = await mf.getD1Database("EVIDENCE_PRODUCTION_DB");
  await applyMigration(productionDb, "../migrations/evidence-production/0001_evidence_mesh.sql");
  await applyMigration(productionDb, "../migrations/evidence-production/0002_r2_budget_guard.sql");
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
});

describe("local D1/R2/Queue Evidence smoke", () => {
  it("keeps Production encryption, metadata, objects, and queue derivation isolated from Development", async () => {
    const plaintext = JSON.stringify({ data: [{
      id: 8001, user_id: 77, clocked_in: "2026-08-30T13:00:00Z", clocked_out: "2026-08-30T21:00:00Z", approved: true,
    }] });
    const upload = await mf.dispatchFetch(`${kitchen}/work/evidence/captures?${productionScope}`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json", "X-Evidence-Capture-Kind": "selected-json" },
      body: plaintext,
    });
    expect(upload.status).toBe(201);
    const evidenceId = ((await upload.json()) as { capture: { evidenceId: string } }).capture.evidenceId;
    const productionDb = await mf.getD1Database("EVIDENCE_PRODUCTION_DB");
    const productionRow = await waitFor(async () => {
      const current = await productionDb.prepare("SELECT environment, state, object_key FROM evidence_items WHERE evidence_id = ?")
        .bind(evidenceId).first<Record<string, any>>();
      return current?.state === "ready_to_review" ? current : null;
    });
    expect(productionRow.environment).toBe("production");
    const developmentDb = await mf.getD1Database("EVIDENCE_DB");
    expect(await developmentDb.prepare("SELECT evidence_id FROM evidence_items WHERE evidence_id = ?").bind(evidenceId).first()).toBeNull();
    const productionBucket = await mf.getR2Bucket("EVIDENCE_PRODUCTION_RAW") as unknown as LocalR2Bucket;
    const developmentBucket = await mf.getR2Bucket("EVIDENCE_RAW") as unknown as LocalR2Bucket;
    expect(await productionBucket.get(String(productionRow.object_key))).not.toBeNull();
    expect((await developmentBucket.list()).objects).toHaveLength(0);
    const ownerRead = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}/raw?${productionScope}`, { headers: headers() });
    expect(ownerRead.status).toBe(200);
    expect(await ownerRead.text()).toBe(plaintext);
    const wrongEnvironment = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}/raw?${scope}`, { headers: headers() });
    expect(wrongEnvironment.status).toBe(404);
    const removed = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}?${productionScope}`, { method: "DELETE", headers: headers() });
    expect(removed.status).toBe(200);
    expect((await productionBucket.list()).objects).toHaveLength(0);
  }, 30_000);

  it("encrypts, derives, isolates, detects ciphertext tampering, and crypto-erases synthetic evidence", async () => {
    const plaintext = JSON.stringify({
      version: 1,
      captureClass: "punch",
      transport: "fetch",
      path: "/api/v2/company/44/time_punches",
      capturedAt: "2026-08-28T21:01:00.000Z",
      contentType: "application/json",
      body: { data: [{
        id: 7001,
        user_id: 77,
        clocked_in: "2026-08-28T13:00:00Z",
        clocked_out: "2026-08-28T21:00:00Z",
        breaks: [],
        approved: true,
        unknown_future_flag: "preserve-me",
      }] },
    });
    const upload = await mf.dispatchFetch(`${kitchen}/work/evidence/captures?${scope}`, {
      method: "POST",
      headers: {
        ...headers(),
        "Content-Type": "application/json",
        "X-Evidence-Capture-Kind": "browser-structured",
      },
      body: plaintext,
    });
    expect(upload.status).toBe(201);
    const evidenceId = ((await upload.json()) as { capture: { evidenceId: string } }).capture.evidenceId;

    const db = await mf.getD1Database("EVIDENCE_DB");
    const row = await waitFor(async () => {
      const current = await db.prepare("SELECT * FROM evidence_items WHERE evidence_id = ?").bind(evidenceId).first<Record<string, any>>();
      return current?.state === "ready_to_review" ? current : null;
    });
    const observation = await db.prepare("SELECT value_json FROM evidence_observations WHERE evidence_id = ? AND field_key = 'workedMinutes'")
      .bind(evidenceId).first<{ value_json: string }>();
    const drift = await db.prepare("SELECT value_json FROM evidence_schema_drift WHERE evidence_id = ? AND field_path LIKE '%unknown_future_flag'")
      .bind(evidenceId).first<{ value_json: string }>();
    expect(JSON.parse(observation!.value_json)).toBe(480);
    expect(JSON.parse(drift!.value_json)).toBe("preserve-me");

    const bucket = await mf.getR2Bucket("EVIDENCE_RAW") as unknown as LocalR2Bucket;
    const encrypted = await bucket.get(String(row.object_key));
    const ciphertext = new Uint8Array(await encrypted!.arrayBuffer());
    expect(new TextDecoder().decode(ciphertext)).not.toContain("preserve-me");

    const ownerRead = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}/raw?${scope}`, { headers: headers() });
    expect(ownerRead.status).toBe(200);
    expect(await ownerRead.text()).toBe(plaintext);

    const partnerRead = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}/raw?${scope}`, { headers: headers("partner-jwt") });
    expect(partnerRead.status).toBe(401);

    const tampered = ciphertext.slice();
    tampered[0] = tampered[0]! ^ 0xff;
    await bucket.put(String(row.object_key), tampered);
    const tamperedRead = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}/raw?${scope}`, { headers: headers() });
    expect(tamperedRead.status).toBe(400);
    expect(await tamperedRead.json()).toMatchObject({ error: expect.stringMatching(/decrypt|operation failed/i) });
    await bucket.put(String(row.object_key), ciphertext);

    const removed = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}?${scope}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect(removed.status).toBe(200);
    expect(await bucket.get(String(row.object_key))).toBeNull();
    const deleted = await db.prepare("SELECT state, wrapped_dek, nonce_manifest, object_key FROM evidence_items WHERE evidence_id = ?")
      .bind(evidenceId).first<Record<string, unknown>>();
    expect(deleted).toMatchObject({ state: "deleted", wrapped_dek: null, nonce_manifest: null, object_key: null });
    const budget = await db.prepare("SELECT stored_bytes, object_count FROM evidence_r2_budget WHERE singleton = 1")
      .first<Record<string, number>>();
    expect(budget).toEqual({ stored_bytes: 0, object_count: 0 });
  }, 30_000);

  it("drains duplicate and out-of-order queue messages and blocks storage limits before R2", async () => {
    const db = await mf.getD1Database("EVIDENCE_DB");
    await db.prepare("UPDATE evidence_r2_budget SET stored_bytes = ?, object_count = 0 WHERE singleton = 1")
      .bind(1024 * 1024 * 1024).run();
    const blocked = await mf.dispatchFetch(`${kitchen}/work/evidence/captures?${scope}`, {
      method: "POST",
      headers: {
        ...headers(),
        "Content-Type": "application/json",
        "X-Evidence-Capture-Kind": "selected-json",
      },
      body: "{}",
    });
    expect(blocked.status).toBe(400);
    expect(await blocked.json()).toMatchObject({ error: expect.stringMatching(/storage safety limit/i) });
    const bucket = await mf.getR2Bucket("EVIDENCE_RAW") as unknown as LocalR2Bucket;
    expect((await bucket.list()).objects).toHaveLength(0);
    await db.prepare("UPDATE evidence_r2_budget SET stored_bytes = 0, object_count = 0 WHERE singleton = 1").run();

    const payload = JSON.stringify({ data: [{
      id: 7002,
      user_id: 77,
      clocked_in: "2026-08-29T13:00:00Z",
      clocked_out: "2026-08-29T21:00:00Z",
      approved: true,
    }] });
    const uploaded = await mf.dispatchFetch(`${kitchen}/work/evidence/captures?${scope}`, {
      method: "POST",
      headers: {
        ...headers(),
        "Content-Type": "application/json",
        "X-Evidence-Capture-Kind": "selected-json",
      },
      body: payload,
    });
    expect(uploaded.status).toBe(201);
    const evidenceId = ((await uploaded.json()) as { capture: { evidenceId: string } }).capture.evidenceId;
    await waitFor(async () => {
      const row = await db.prepare("SELECT state FROM evidence_items WHERE evidence_id = ?").bind(evidenceId).first<{ state: string }>();
      return row?.state === "ready_to_review" ? row : null;
    });
    const before = await db.prepare("SELECT COUNT(*) AS count FROM evidence_derivatives WHERE evidence_id = ?")
      .bind(evidenceId).first<{ count: number }>();
    expect(Number(before!.count)).toBe(1);

    const queue = await mf.getQueueProducer<{ evidenceId: string; revision: number }>("EVIDENCE_DERIVE");
    await queue.send({ evidenceId, revision: 2 });
    await queue.send({ evidenceId, revision: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const after = await db.prepare("SELECT COUNT(*) AS count FROM evidence_derivatives WHERE evidence_id = ?")
      .bind(evidenceId).first<{ count: number }>();
    const item = await db.prepare("SELECT state, revision FROM evidence_items WHERE evidence_id = ?")
      .bind(evidenceId).first<{ state: string; revision: number }>();
    expect(Number(after!.count)).toBe(1);
    expect(item).toMatchObject({ state: "ready_to_review", revision: 1 });

    const removed = await mf.dispatchFetch(`${kitchen}/work/evidence/captures/${evidenceId}?${scope}`, {
      method: "DELETE",
      headers: headers(),
    });
    expect(removed.status).toBe(200);
    expect((await bucket.list()).objects).toHaveLength(0);
  }, 30_000);
});
