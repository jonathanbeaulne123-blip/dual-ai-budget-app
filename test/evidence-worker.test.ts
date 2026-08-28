import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";
import { sevenShiftsEvidenceMaterialHash, type SevenShiftsEvidenceBundle } from "../src/core/index.ts";

const kitchen = "https://hearth-books.jonathan-beaulne123.workers.dev";

type Row = Record<string, any>;

class MemoryD1 {
  items: Row[] = [];
  audits: Row[] = [];
  derivatives: Row[] = [];
  observations: Row[] = [];
  drift: Row[] = [];
  evidenceConflicts: Row[] = [];
  bundles: Row[] = [];
  policies: Row[] = [];
  jobs: Row[] = [];
  receipts: Row[] = [];
  r2Budget = { stored_bytes: 0, object_count: 0 };
  r2Monthly = new Map<string, { class_a_puts: number; class_b_gets: number }>();
  sql: string[] = [];

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  prepare(sql: string) {
    this.sql.push(sql);
    const db = this;
    return {
      bind(...values: any[]) {
        return {
          async first() {
            if (sql.includes("SELECT 1 AS ok")) return { ok: 1 };
            if (sql.startsWith("SELECT * FROM evidence_items")) {
              if (!sql.includes("environment = ?")) return db.items.find((row) => row.evidence_id === values[0]) ?? null;
              return db.items.find((row) => row.evidence_id === values[0]
                && row.environment === values[1]
                && row.auth_user_id === values[2]
                && row.household_id === values[3]
                && row.member_id === values[4]
                && (!sql.includes("state <> 'deleted'") || row.state !== "deleted")) ?? null;
            }
            if (sql.startsWith("SELECT evidence_id, state, revision")) {
              const row = db.items.find((item) => item.evidence_id === values[0]);
              return row ? { evidence_id: row.evidence_id, state: row.state, revision: row.revision } : null;
            }
            if (sql.startsWith("SELECT evidence_id, state, capture_kind")) {
              const row = db.items.find((item) => item.environment === values[0] && item.auth_user_id === values[1]
                && item.household_id === values[2] && item.member_id === values[3]
                && item.capture_kind === "gmail-7shifts-email" && item.plaintext_sha256 === values[4] && item.state !== "deleted");
              return row ?? null;
            }
            if (sql.startsWith("SELECT parser_version, schema_fingerprint")) {
              return db.derivatives.find((row) => row.evidence_id === values[0] && row.revision === values[1] && row.canonical_shift_key === values[2]) ?? null;
            }
            if (sql.startsWith("SELECT bundle_id, material_hash")) {
              return db.bundles.find((row) => row.environment === values[0] && row.auth_user_id === values[1]
                && row.household_id === values[2] && row.member_id === values[3]
                && row.canonical_shift_key === values[4] && row.revision === values[5]) ?? null;
            }
            if (sql.startsWith("SELECT policy_json FROM evidence_automation_policies")) {
              return db.policies.find((row) => row.environment === values[0] && row.auth_user_id === values[1]
                && row.household_id === values[2] && row.member_id === values[3]
                && (!sql.includes("job_id = ?") || row.job_id === values[4]) && (!sql.includes("enabled = 1") || row.enabled === 1)) ?? null;
            }
            if (sql.startsWith("SELECT bundle_id FROM evidence_bundles")) {
              return [...db.bundles].filter((row) => row.environment === values[0] && row.auth_user_id === values[1]
                && row.household_id === values[2] && row.member_id === values[3] && row.canonical_shift_key === values[4]
                && row.revision < values[5] && row.state === "posted").sort((a, b) => b.revision - a.revision)[0] ?? null;
            }
            if (sql.startsWith("SELECT j.*, b.canonical_shift_key")) {
              if (sql.includes("WHERE j.job_key = ?")) {
                const job = db.jobs.find((candidate) => candidate.job_key === values[0] && candidate.lease_id === values[1]
                  && candidate.environment === values[2] && candidate.auth_user_id === values[3] && candidate.household_id === values[4]
                  && candidate.member_id === values[5] && candidate.state === "claimed" && candidate.lease_expires_at > values[6]);
                if (!job) return null;
                const bundle = db.bundles.find((candidate) => candidate.bundle_id === job.bundle_id && candidate.state === "eligible");
                const policy = db.policies.find((candidate) => candidate.environment === job.environment && candidate.auth_user_id === job.auth_user_id
                  && candidate.household_id === job.household_id && candidate.member_id === job.member_id && candidate.job_id === job.hearth_job_id && candidate.enabled === 1);
                return bundle && policy ? { ...job, canonical_shift_key: bundle.canonical_shift_key, bundle_json: bundle.sanitized_json, policy_json: policy.policy_json } : null;
              }
              const job = db.jobs.find((candidate) => candidate.environment === values[0] && candidate.auth_user_id === values[1]
                && candidate.household_id === values[2] && candidate.member_id === values[3]
                && (candidate.state === "pending" || (candidate.state === "claimed" && candidate.lease_expires_at < values[4])));
              if (!job) return null;
              const bundle = db.bundles.find((candidate) => candidate.bundle_id === job.bundle_id && candidate.state === "eligible");
              const policy = db.policies.find((candidate) => candidate.environment === job.environment && candidate.auth_user_id === job.auth_user_id
                && candidate.household_id === job.household_id && candidate.member_id === job.member_id && candidate.job_id === job.hearth_job_id && candidate.enabled === 1);
              return bundle && policy ? { ...job, canonical_shift_key: bundle.canonical_shift_key, bundle_json: bundle.sanitized_json, policy_json: policy.policy_json } : null;
            }
            if (sql.startsWith("SELECT revision FROM evidence_bundles")) {
              return [...db.bundles].filter((row) => row.environment === values[0] && row.auth_user_id === values[1]
                && row.household_id === values[2] && row.member_id === values[3] && row.canonical_shift_key === values[4]
                && !["deleted", "superseded"].includes(row.state)).sort((a, b) => b.revision - a.revision)[0] ?? null;
            }
            if (sql.startsWith("SELECT state FROM evidence_automation_jobs")) {
              const row = db.jobs.find((item) => item.job_key === values[0]);
              return row ? { state: row.state } : null;
            }
            return null;
          },
          async all() {
            if (sql.startsWith("SELECT canonical_shift_key, parser_version")) {
              return { results: db.derivatives.filter((row) => row.evidence_id === values[0] && row.revision === values[1]) };
            }
            if (sql.startsWith("SELECT observation_id, canonical_shift_key")) {
              return { results: db.observations.filter((row) => row.evidence_id === values[0] && row.revision === values[1]) };
            }
            if (sql.startsWith("SELECT drift_id, canonical_shift_key")) {
              return { results: db.drift.filter((row) => row.evidence_id === values[0] && row.revision === values[1]) };
            }
            if (sql.startsWith("SELECT m.hearth_job_id")) return { results: [] };
            if (sql.startsWith("SELECT o.observation_id")) {
              return { results: db.observations.filter((row) => row.canonical_shift_key === values[4]
                && ["local-ocr", "cloud-vision"].includes(row.extraction_method)) };
            }
            if (sql.startsWith("SELECT evidence_id, capture_kind")) {
              return { results: db.items.filter((row) => row.environment === values[0]
                && row.auth_user_id === values[1]
                && row.household_id === values[2]
                && row.member_id === values[3]
                && row.state !== "deleted") };
            }
            if (sql.startsWith("SELECT evidence_id, field_key")) {
              return { results: db.observations.filter((row) => row.evidence_id === values[0]
                && row.revision === values[1] && row.canonical_shift_key === values[2]) };
            }
            if (sql.startsWith("SELECT j.job_key, j.bundle_id")) {
              return { results: db.jobs.filter((job) => job.environment === values[0] && job.auth_user_id === values[1]
                && job.household_id === values[2] && job.member_id === values[3] && job.state !== "acknowledged")
                .filter((job) => {
                  const bundle = db.bundles.find((row) => row.bundle_id === job.bundle_id);
                  return Boolean(bundle && bundle.canonical_shift_key === values[4] && bundle.revision <= values[5]);
                }).map((job) => ({ job_key: job.job_key, bundle_id: job.bundle_id })) };
            }
            return { results: [] };
          },
          async run() {
            if (sql.startsWith("INSERT OR IGNORE INTO evidence_r2_budget")) return { meta: { changes: 0 } };
            if (sql.startsWith("UPDATE evidence_r2_budget SET stored_bytes = stored_bytes +")) {
              const allowed = db.r2Budget.stored_bytes + values[0] <= values[3] && db.r2Budget.object_count + 1 <= values[4];
              if (allowed) { db.r2Budget.stored_bytes += values[0]; db.r2Budget.object_count += 1; }
              return { meta: { changes: allowed ? 1 : 0 } };
            }
            if (sql.startsWith("UPDATE evidence_r2_budget SET stored_bytes = MAX")) {
              db.r2Budget.stored_bytes = Math.max(0, db.r2Budget.stored_bytes - values[0]);
              db.r2Budget.object_count = Math.max(0, db.r2Budget.object_count - 1);
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT OR IGNORE INTO evidence_r2_monthly_usage")) {
              if (!db.r2Monthly.has(values[0])) db.r2Monthly.set(values[0], { class_a_puts: 0, class_b_gets: 0 });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("UPDATE evidence_r2_monthly_usage SET class_a_puts")) {
              const row = db.r2Monthly.get(values[1])!;
              const allowed = row.class_a_puts < values[2];
              if (allowed) row.class_a_puts += 1;
              return { meta: { changes: allowed ? 1 : 0 } };
            }
            if (sql.startsWith("UPDATE evidence_r2_monthly_usage SET class_b_gets")) {
              const row = db.r2Monthly.get(values[1])!;
              const allowed = row.class_b_gets < values[2];
              if (allowed) row.class_b_gets += 1;
              return { meta: { changes: allowed ? 1 : 0 } };
            }
            if (sql.startsWith("DELETE FROM evidence_observations")) {
              db.observations = db.observations.filter((row) => row.evidence_id !== values[0] || row.revision !== values[1]);
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("DELETE FROM evidence_derivatives")) {
              db.derivatives = db.derivatives.filter((row) => row.evidence_id !== values[0] || row.revision !== values[1]);
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("DELETE FROM evidence_schema_drift")) {
              db.drift = db.drift.filter((row) => row.evidence_id !== values[0] || row.revision !== values[1]);
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT INTO evidence_items")) {
              db.items.push({
                evidence_id: values[0], environment: values[1], auth_user_id: values[2], household_id: values[3], member_id: values[4],
                capture_kind: values[5], state: values[6], content_type: values[7], byte_length: values[8], plaintext_sha256: values[9],
                cipher_version: 1, kek_version: 1, wrapped_dek: values[10], nonce_manifest: values[11], object_key: values[12], revision: 1,
                created_at: values[13], updated_at: values[14], deleted_at: null,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT INTO evidence_access_audit")) {
              db.audits.push({ audit_id: values[0], evidence_id: values[1], action: values[6], outcome: values[7] });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT INTO evidence_derivatives")) {
              db.derivatives.push({ evidence_id: values[0], revision: values[1], canonical_shift_key: values[2], parser_version: values[3], schema_fingerprint: values[4], sanitized_json: values[5], created_at: values[6] });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT INTO evidence_observations")) {
              db.observations.push({
                observation_id: values[0], evidence_id: values[1], revision: values[2], canonical_shift_key: values[3], field_key: values[4],
                value_json: values[5], unit: values[6], source_location: values[7], confidence_bps: values[8], finality: values[9],
                extraction_method: values[10], conflict_state: values[11], created_at: values[12],
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT INTO evidence_schema_drift")) {
              db.drift.push({ drift_id: values[0], evidence_id: values[1], revision: values[2], canonical_shift_key: values[3] ?? null, field_path: values[4], value_json: values[5], value_type: values[6], value_digest: values[7], created_at: values[8] });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("UPDATE evidence_observations SET conflict_state")) {
              const row = db.observations.find((item) => item.observation_id === values[1]);
              if (row) row.conflict_state = values[0];
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (sql.startsWith("INSERT OR REPLACE INTO evidence_conflicts")) {
              db.evidenceConflicts = db.evidenceConflicts.filter((row) => row.conflict_id !== values[0]);
              db.evidenceConflicts.push({ conflict_id: values[0], canonical_shift_key: values[5], field_key: values[6], observation_ids_json: values[7] });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT INTO evidence_bundles")) {
              db.bundles.push({
                bundle_id: values[0], environment: values[1], auth_user_id: values[2], household_id: values[3], member_id: values[4],
                canonical_shift_key: values[5], revision: values[6], state: values[7], material_hash: values[8], sanitized_json: values[9],
                created_at: values[10], updated_at: values[11],
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("INSERT OR IGNORE INTO evidence_automation_jobs")) {
              if (!db.jobs.some((row) => row.job_key === values[0])) db.jobs.push({
                job_key: values[0], environment: values[1], auth_user_id: values[2], household_id: values[3], member_id: values[4],
                hearth_job_id: values[5], bundle_id: values[6], bundle_revision: values[7], action_kind: values[8], state: "pending",
                attempts: 0, created_at: values[9], updated_at: values[10], lease_id: null, lease_expires_at: null,
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("UPDATE evidence_automation_jobs SET state = 'quarantined', last_error_code = 'superseded-before-claim'") && sql.includes("bundle_id IN")) {
              const olderBundleIds = new Set(db.bundles.filter((row) => row.environment === values[5] && row.auth_user_id === values[6]
                && row.household_id === values[7] && row.member_id === values[8] && row.canonical_shift_key === values[9] && row.revision < values[10]).map((row) => row.bundle_id));
              let changes = 0;
              for (const row of db.jobs) if (row.environment === values[1] && row.auth_user_id === values[2] && row.household_id === values[3]
                && row.member_id === values[4] && olderBundleIds.has(row.bundle_id) && row.state === "pending") {
                Object.assign(row, { state: "quarantined", last_error_code: "superseded-before-claim", updated_at: values[0] }); changes += 1;
              }
              return { meta: { changes } };
            }
            if (sql.startsWith("UPDATE evidence_bundles SET state = 'superseded'")) {
              let changes = 0;
              for (const row of db.bundles) if (row.environment === values[1] && row.auth_user_id === values[2] && row.household_id === values[3]
                && row.member_id === values[4] && row.canonical_shift_key === values[5] && row.revision < values[6] && row.state === "eligible") {
                Object.assign(row, { state: "superseded", updated_at: values[0] }); changes += 1;
              }
              return { meta: { changes } };
            }
            if (sql.startsWith("UPDATE evidence_automation_jobs SET state = 'claimed'")) {
              const row = db.jobs.find((item) => item.job_key === values[3] && item.environment === values[4] && item.auth_user_id === values[5]
                && item.household_id === values[6] && item.member_id === values[7] && item.state === "pending");
              if (row) Object.assign(row, { state: "claimed", lease_id: values[0], lease_expires_at: values[1], attempts: row.attempts + 1, updated_at: values[2] });
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (sql.startsWith("INSERT OR IGNORE INTO evidence_automation_receipts")) {
              if (!db.receipts.some((row) => row.job_key === values[0])) db.receipts.push({
                job_key: values[0], command_event_id: values[1], confirmation_id: values[2], result_revision: values[3],
                identity_hash: values[4], audit_hash: values[5], acknowledged_at: values[6],
              });
              return { meta: { changes: 1 } };
            }
            if (sql.startsWith("UPDATE evidence_bundles SET state = 'posted'")) {
              const row = db.bundles.find((item) => item.bundle_id === values[1] && item.environment === values[2]
                && item.auth_user_id === values[3] && item.household_id === values[4] && item.member_id === values[5]);
              if (row) Object.assign(row, { state: "posted", updated_at: values[0] });
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (sql.startsWith("UPDATE evidence_automation_jobs SET state = 'acknowledged'") && !sql.includes("lease_id = ?")) {
              const row = db.jobs.find((item) => item.job_key === values[1] && item.environment === values[2]
                && item.auth_user_id === values[3] && item.household_id === values[4] && item.member_id === values[5]);
              if (row) Object.assign(row, { state: "acknowledged", lease_id: null, lease_expires_at: null, updated_at: values[0] });
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (sql.startsWith("UPDATE evidence_automation_jobs SET state = 'quarantined', last_error_code = 'action-reclassified'")) {
              const row = db.jobs.find((item) => item.job_key === values[1] && ["pending", "claimed"].includes(item.state));
              if (row) Object.assign(row, { state: "quarantined", last_error_code: "action-reclassified", updated_at: values[0] });
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (sql.includes("SET state = 'deleted'")) {
              const row = db.items.find((item) => item.evidence_id === values[2]
                && item.environment === values[3] && item.auth_user_id === values[4]
                && item.household_id === values[5] && item.member_id === values[6] && item.state !== "deleted");
              if (!row) return { meta: { changes: 0 } };
              Object.assign(row, { state: "deleted", wrapped_dek: null, nonce_manifest: null, object_key: null, deleted_at: values[0], updated_at: values[1] });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("SET state = 'deriving'")) {
              const row = db.items.find((item) => item.evidence_id === values[1] && item.revision === values[2] && item.state === "ready");
              if (row) row.state = "deriving";
              return { meta: { changes: row ? 1 : 0 } };
            }
            if (sql.includes("SET state = 'ready_to_review'")) {
              const row = db.items.find((item) => item.evidence_id === values[1] && item.revision === values[2] && item.state === "deriving");
              if (row) row.state = "ready_to_review";
              return { meta: { changes: row ? 1 : 0 } };
            }
            return { meta: { changes: 1 } };
          },
        };
      },
      async first() {
        if (sql.includes("SELECT 1 AS ok")) return { ok: 1 };
        return null;
      },
    };
  }
}

class MemoryR2 {
  objects = new Map<string, Uint8Array>();
  getCalls = 0;
  async put(key: string, value: Uint8Array) { this.objects.set(key, new Uint8Array(value)); }
  async get(key: string) {
    this.getCalls += 1;
    const value = this.objects.get(key);
    return value ? { arrayBuffer: async () => value.slice().buffer } : null;
  }
  async delete(key: string) { this.objects.delete(key); }
}

class MemoryQueue {
  sent: any[] = [];
  async send(value: any) { this.sent.push(value); }
}

function env(overrides: Record<string, unknown> = {}) {
  return {
    EVIDENCE_ENABLED: "true",
    EVIDENCE_ALLOW_PRODUCTION: "false",
    EVIDENCE_KEK_V1: "development-evidence-key-".repeat(3),
    EVIDENCE_DB: new MemoryD1(),
    EVIDENCE_RAW: new MemoryR2(),
    EVIDENCE_DERIVE: new MemoryQueue(),
    SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    ASSETS: { fetch: vi.fn() },
    ...overrides,
  } as any;
}

function authFetch(extra?: (url: URL, init?: RequestInit) => Response | Promise<Response> | null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const custom = extra?.(url, init);
    if (custom) return custom;
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "auth-user-1" });
    if (url.pathname === "/rest/v1/continuity_memberships") {
      const member = url.searchParams.get("member_id")?.replace(/^eq\./, "");
      const household = url.searchParams.get("household_id")?.replace(/^eq\./, "");
      const environment = url.searchParams.get("environment")?.replace(/^eq\./, "");
      return Response.json(member === "MEM-001" && household === "HH-TEST"
        ? [{ environment, household_id: "HH-TEST", member_id: "MEM-001", auth_user_id: "auth-user-1", role: "owner" }]
        : []);
    }
    if (url.pathname === "/rest/v1/continuity_command_events") return Response.json([]);
    throw new Error(`Unexpected fetch ${url}`);
  });
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`${kitchen}${path}`, {
    ...init,
    headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", ...init.headers },
  });
}

function derivedBundle(revision = 1, suffix = "0001"): SevenShiftsEvidenceBundle {
  const evidenceId = `evi_owned_structured_capture_${suffix}`;
  const bundle: SevenShiftsEvidenceBundle = {
    version: 1, provider: "7shifts", canonicalShiftKey: "shift:tenant:punch-0001", providerSubjectKey: "subject:tenant:worker-0001",
    environment: "development", householdId: "HH-TEST", memberId: "MEM-001", jobId: "JOB-CAFE",
    startedAt: "2026-08-28T21:00:00.000Z", endedAt: "2026-08-29T02:00:00.000Z", workedMinutes: 285, paidBreakMinutes: 15,
    revision, state: "eligible",
    evidence: [{
      evidenceId, environment: "development", householdId: "HH-TEST", memberId: "MEM-001", sourceKind: "browser-structured",
      capturedAt: "2026-08-29T03:00:00.000Z", observedAt: "2026-08-29T02:05:00.000Z", providerResourceKind: "time-punch",
      providerResourceId: "punch-0001", providerRevision: `revision-${revision}`, parserVersion: "evidence-v1", schemaFingerprint: "schema-v1",
      rawDigest: "a".repeat(64), finality: "approved", supersedesEvidenceId: null,
    }],
    observations: [
      { evidenceId, field: "date", value: "2026-08-28", unit: "date", sourcePath: "punch.business_date", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
      { evidenceId, field: "roleId", value: "ROLE-SERVER", unit: "identifier", sourcePath: "mapping.role", confidenceBps: 10_000, finality: "approved", extraction: "human", conflict: "clear" },
      { evidenceId, field: "cashTipsCents", value: 4200, unit: "cad-cents", sourcePath: "punch.tips.cash", confidenceBps: 10_000, finality: "approved", extraction: "structured", conflict: "clear" },
    ],
    authority: { workedMinutesEvidenceId: evidenceId, paidBreakMinutesEvidenceId: evidenceId, cashTipsEvidenceId: evidenceId, cardTipsEvidenceId: null, finalWagesEvidenceId: null },
    conflicts: [], materialHash: "",
  };
  bundle.materialHash = sevenShiftsEvidenceMaterialHash(bundle);
  return bundle;
}

function seedDerivative(db: MemoryD1, bundle: SevenShiftsEvidenceBundle) {
  const envelope = bundle.evidence[0]!;
  db.items.push({
    evidence_id: envelope.evidenceId, environment: bundle.environment, auth_user_id: "auth-user-1", household_id: bundle.householdId,
    member_id: bundle.memberId, capture_kind: envelope.sourceKind, state: "ready_to_review", plaintext_sha256: envelope.rawDigest,
    created_at: envelope.capturedAt, revision: 1,
  });
  db.derivatives.push({
    evidence_id: envelope.evidenceId, revision: 1, canonical_shift_key: bundle.canonicalShiftKey, parser_version: envelope.parserVersion, schema_fingerprint: envelope.schemaFingerprint,
    sanitized_json: JSON.stringify({ bundleFacts: {
      canonicalShiftKey: bundle.canonicalShiftKey, providerSubjectKey: bundle.providerSubjectKey, jobId: bundle.jobId,
      startedAt: bundle.startedAt, endedAt: bundle.endedAt, workedMinutes: bundle.workedMinutes, paidBreakMinutes: bundle.paidBreakMinutes,
      sourceKind: envelope.sourceKind, observedAt: envelope.observedAt, providerResourceKind: envelope.providerResourceKind,
      providerResourceId: envelope.providerResourceId, providerRevision: envelope.providerRevision, finality: envelope.finality,
      supersedesEvidenceId: envelope.supersedesEvidenceId,
    } }),
  });
  db.observations.push(...bundle.observations.map((row, index) => ({
    observation_id: `obs-${index}`, evidence_id: row.evidenceId, revision: 1, canonical_shift_key: bundle.canonicalShiftKey,
    field_key: row.field, value_json: JSON.stringify(row.value), unit: row.unit, source_location: row.sourcePath,
    confidence_bps: row.confidenceBps, finality: row.finality, extraction_method: row.extraction, conflict_state: row.conflict,
  })));
}

afterEach(() => vi.unstubAllGlobals());

describe("Evidence Mesh Worker", () => {
  it("is unavailable when disabled and refuses an unprovisioned Production scope without disabling Development", async () => {
    const disabled = env({ EVIDENCE_ENABLED: "false" });
    const status = await worker.fetch(request("/work/evidence/status", { headers: { Origin: kitchen } }), disabled);
    expect(await status.json()).toMatchObject({ ok: true, available: false, environment: "development-only", productionAllowed: false });
    const unsafe = env({ EVIDENCE_ALLOW_PRODUCTION: "true" });
    const active = await worker.fetch(request("/work/evidence/captures?environment=production&householdId=HH-TEST&memberId=MEM-001", { method: "GET" }), unsafe);
    expect(active.status).toBe(503);
    expect(await active.json()).toMatchObject({ ok: false, error: expect.stringMatching(/production bindings are not configured/i) });
    vi.stubGlobal("fetch", authFetch());
    const development = await worker.fetch(request("/work/evidence/captures?environment=development&householdId=HH-TEST&memberId=MEM-001", { method: "GET" }), unsafe);
    expect(development.status).toBe(200);
  });

  it("routes Production captures only to the separately keyed Production D1, R2, and Queue", async () => {
    const productionDb = new MemoryD1();
    const productionRaw = new MemoryR2();
    const productionQueue = new MemoryQueue();
    const bindings = env({
      EVIDENCE_ALLOW_PRODUCTION: "true",
      EVIDENCE_PRODUCTION_KEK_V1: "production-evidence-key-".repeat(3),
      EVIDENCE_PRODUCTION_DB: productionDb,
      EVIDENCE_PRODUCTION_RAW: productionRaw,
      EVIDENCE_PRODUCTION_DERIVE: productionQueue,
    });
    vi.stubGlobal("fetch", authFetch());
    const plaintext = new TextEncoder().encode('{"provider":"7shifts","production":true}');
    const uploaded = await worker.fetch(request("/work/evidence/captures?environment=production&householdId=HH-TEST&memberId=MEM-001", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Evidence-Capture-Kind": "selected-json" },
      body: plaintext,
    }), bindings);
    expect(uploaded.status).toBe(201);
    const capture = (await uploaded.json() as any).capture;
    expect(productionDb.items).toHaveLength(1);
    expect(bindings.EVIDENCE_DB.items).toHaveLength(0);
    expect(productionRaw.objects.size).toBe(1);
    expect(bindings.EVIDENCE_RAW.objects.size).toBe(0);
    expect(productionQueue.sent).toEqual([{ evidenceId: capture.evidenceId, revision: 1 }]);
    const ack = vi.fn();
    await worker.queue({
      queue: "hearth-evidence-derive-production",
      messages: [{ body: { evidenceId: capture.evidenceId, revision: 1 }, ack, retry: vi.fn() }],
    } as any, bindings);
    expect(ack).toHaveBeenCalledOnce();
    expect(productionDb.items[0]?.state).toBe("ready_to_review");
    expect(productionDb.derivatives).toHaveLength(1);
    expect(bindings.EVIDENCE_DB.derivatives).toHaveLength(0);
    const read = await worker.fetch(request(`/work/evidence/captures/${capture.evidenceId}/raw?environment=production&householdId=HH-TEST&memberId=MEM-001`), bindings);
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(plaintext);
    const wrongEnvironment = await worker.fetch(request(`/work/evidence/captures/${capture.evidenceId}/raw?environment=development&householdId=HH-TEST&memberId=MEM-001`), bindings);
    expect(wrongEnvironment.status).toBe(404);
  });

  it("encrypts a member-selected capture, queues only its opaque id, decrypts for its owner, and crypto-erases it", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    const plaintext = new TextEncoder().encode('{"provider":"7shifts","unknown_future_field":true}');
    const path = "/work/evidence/captures?environment=development&householdId=HH-TEST&memberId=MEM-001";
    const uploaded = await worker.fetch(request(path, {
      method: "POST",
      headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json", "X-Evidence-Capture-Kind": "browser-structured" },
      body: plaintext,
    }), bindings);
    expect(uploaded.status).toBe(201);
    const capture = (await uploaded.json() as any).capture;
    expect(capture.evidenceId).toMatch(/^evi_/);
    expect(bindings.EVIDENCE_DERIVE.sent).toEqual([{ evidenceId: capture.evidenceId, revision: 1 }]);
    expect(JSON.stringify(bindings.EVIDENCE_DERIVE.sent)).not.toContain("unknown_future_field");
    const row = bindings.EVIDENCE_DB.items[0]!;
    expect(row).not.toHaveProperty("raw_body");
    const ciphertext = bindings.EVIDENCE_RAW.objects.get(row.object_key)!;
    expect(new TextDecoder().decode(ciphertext)).not.toContain("unknown_future_field");

    const read = await worker.fetch(request(`/work/evidence/captures/${capture.evidenceId}/raw?environment=development&householdId=HH-TEST&memberId=MEM-001`), bindings);
    expect(read.status).toBe(200);
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(plaintext);

    const partner = await worker.fetch(request(`/work/evidence/captures/${capture.evidenceId}/raw?environment=development&householdId=HH-TEST&memberId=MEM-002`), bindings);
    expect(partner.status).toBe(401);

    const removed = await worker.fetch(request(`/work/evidence/captures/${capture.evidenceId}?environment=development&householdId=HH-TEST&memberId=MEM-001`, { method: "DELETE" }), bindings);
    expect(removed.status).toBe(200);
    expect(row).toMatchObject({ state: "deleted", wrapped_dek: null, nonce_manifest: null, object_key: null });
    expect(bindings.EVIDENCE_RAW.objects.size).toBe(0);
    expect(bindings.EVIDENCE_DB.r2Budget).toEqual({ stored_bytes: 0, object_count: 0 });
    const reread = await worker.fetch(request(`/work/evidence/captures/${capture.evidenceId}/raw?environment=development&householdId=HH-TEST&memberId=MEM-001`), bindings);
    expect(reread.status).toBe(404);
  });

  it("accepts only raw 7shifts Gmail and deduplicates a repeated scrub before R2", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    const path = "/work/evidence/captures?environment=development&householdId=HH-TEST&memberId=MEM-001";
    const goodRaw = ["From: 7shifts <notifications@7shifts.com>", "To: member@example.test", "Subject: Schedule", "", "Thu August 27, 2026 4:30 pm - 10:30 pm"].join("\r\n");
    const upload = (raw: string) => worker.fetch(request(path, {
      method: "POST",
      headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", "Content-Type": "message/rfc822", "X-Evidence-Capture-Kind": "gmail-7shifts-email" },
      body: raw,
    }), bindings);
    const first = await upload(goodRaw);
    const second = await upload(goodRaw);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstCapture = (await first.json() as any).capture;
    const secondCapture = (await second.json() as any).capture;
    expect(secondCapture).toMatchObject({ evidenceId: firstCapture.evidenceId, duplicate: true });
    expect(bindings.EVIDENCE_DB.items).toHaveLength(1);
    expect(bindings.EVIDENCE_RAW.objects.size).toBe(1);
    expect(bindings.EVIDENCE_DERIVE.sent).toHaveLength(1);

    const lookalike = await upload("From: alerts@7shifts.com.evil.test\r\n\r\nbody");
    expect(lookalike.status).toBe(400);
    expect(await lookalike.json()).toMatchObject({ error: expect.stringMatching(/not a 7shifts domain/i) });
  });

  it("fails closed before R2 when the Development storage or monthly operation budget is exhausted", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    const path = "/work/evidence/captures?environment=development&householdId=HH-TEST&memberId=MEM-001";
    const upload = () => worker.fetch(request(path, {
      method: "POST",
      headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json", "X-Evidence-Capture-Kind": "selected-json" },
      body: "{}",
    }), bindings);
    bindings.EVIDENCE_DB.r2Budget.stored_bytes = 1024 * 1024 * 1024;
    const storageBlocked = await upload();
    expect(storageBlocked.status).toBe(400);
    expect(await storageBlocked.json()).toMatchObject({ error: expect.stringMatching(/storage safety limit/i) });
    expect(bindings.EVIDENCE_RAW.objects.size).toBe(0);
    bindings.EVIDENCE_DB.r2Budget.stored_bytes = 0;
    bindings.EVIDENCE_DB.r2Monthly.set(new Date().toISOString().slice(0, 7), { class_a_puts: 10_000, class_b_gets: 0 });
    const operationsBlocked = await upload();
    expect(operationsBlocked.status).toBe(400);
    expect(await operationsBlocked.json()).toMatchObject({ error: expect.stringMatching(/operation safety limit/i) });
    expect(bindings.EVIDENCE_DB.r2Budget).toEqual({ stored_bytes: 0, object_count: 0 });
    expect(bindings.EVIDENCE_RAW.objects.size).toBe(0);
  });

  it("reads only bounded UTF-8 calendars from 7shifts hosts and never follows an external redirect", async () => {
    const bindings = env();
    const calendar = "BEGIN:VCALENDAR\r\nPRODID:-//7shifts//Calendar//EN\r\nEND:VCALENDAR\r\n";
    vi.stubGlobal("fetch", authFetch((url) => {
      if (url.hostname === "app.7shifts.com" && url.pathname === "/calendar") return new Response(calendar, { headers: { "Content-Type": "text/calendar" } });
      if (url.hostname === "app.7shifts.com" && url.pathname === "/redirect") return new Response(null, { status: 302, headers: { Location: "https://example.com/private" } });
      return null;
    }));
    const body = (url: string) => JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", url });
    const good = await worker.fetch(request("/work/evidence/calendar/read", { method: "POST", headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" }, body: body("https://app.7shifts.com/calendar") }), bindings);
    expect(good.status).toBe(200);
    expect(await good.json()).toMatchObject({ ok: true, source: calendar });
    const redirected = await worker.fetch(request("/work/evidence/calendar/read", { method: "POST", headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" }, body: body("https://app.7shifts.com/redirect") }), bindings);
    expect(redirected.status).toBe(400);
    expect(await redirected.json()).toMatchObject({ error: expect.stringMatching(/Only a 7shifts calendar host/i) });
  });

  it("acknowledges leftover queue deliveries without reading evidence while the mesh is disabled", async () => {
    const bindings = env();
    bindings.EVIDENCE_ENABLED = "false";
    const ack = vi.fn();
    const retry = vi.fn();
    await worker.queue({ messages: [{ body: { evidenceId: "evi_not_read_while_disabled", revision: 1 }, ack, retry }] } as any, bindings);
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
    expect(bindings.EVIDENCE_DB.derivatives).toHaveLength(0);
    expect(bindings.EVIDENCE_RAW.getCalls).toBe(0);
  });

  it("processes duplicate queue deliveries idempotently without invoking a model or money writer", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    const uploaded = await worker.fetch(request("/work/evidence/captures?environment=development&householdId=HH-TEST&memberId=MEM-001", {
      method: "POST",
      headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json", "X-Evidence-Capture-Kind": "browser-structured" },
      body: JSON.stringify({ data: [{ id: 1, user_id: 77, clocked_in: "2026-08-28T13:00:00Z", clocked_out: "2026-08-28T21:00:00Z", approved: true, unknown_future_flag: "kept" }] }),
    }), bindings);
    const evidenceId = (await uploaded.json() as any).capture.evidenceId;
    const ack = vi.fn();
    const retry = vi.fn();
    const batch = { messages: [{ body: { evidenceId, revision: 1 }, ack, retry }] } as any;
    await worker.queue(batch, bindings);
    expect(bindings.EVIDENCE_DB.items[0]?.state).toBe("ready_to_review");
    expect(bindings.EVIDENCE_DB.derivatives).toHaveLength(1);
    expect(bindings.EVIDENCE_DB.observations.some((row: Row) => row.field_key === "workedMinutes" && JSON.parse(row.value_json) === 480)).toBe(true);
    expect(bindings.EVIDENCE_DB.drift.some((row: Row) => row.field_path.endsWith("unknown_future_flag") && JSON.parse(row.value_json) === "kept")).toBe(true);
    const derived = await worker.fetch(request(`/work/evidence/captures/${evidenceId}/derived?environment=development&householdId=HH-TEST&memberId=MEM-001`), bindings);
    expect(derived.status).toBe(200);
    const derivedBody = await derived.json() as any;
    expect(derivedBody).toMatchObject({
      ok: true,
      derived: {
        evidenceId,
        state: "ready_to_review",
        derivatives: [{ facts: { mappingState: "unmapped", unknownFieldCount: 1 } }],
      },
    });
    expect(derivedBody.derived.observations).toEqual(expect.arrayContaining([expect.objectContaining({ field: "workedMinutes", value: 480 })]));
    expect(derivedBody.derived.schemaDrift).toEqual(expect.arrayContaining([expect.objectContaining({ fieldPath: expect.stringMatching(/unknown_future_flag$/), value: "kept" })]));
    const partnerDerived = await worker.fetch(request(`/work/evidence/captures/${evidenceId}/derived?environment=development&householdId=HH-TEST&memberId=MEM-002`), bindings);
    expect(partnerDerived.status).toBe(401);
    expect(ack).toHaveBeenCalledTimes(1);
    await worker.queue(batch, bindings);
    expect(ack).toHaveBeenCalledTimes(2);
    expect(retry).not.toHaveBeenCalled();
  });

  it("corroborates matching local/cloud screen facts and records a conflict when either extraction changes", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    const upload = async (captureKind: "local-ocr" | "cloud-vision", cardTips: number) => {
      const response = await worker.fetch(request("/work/evidence/captures?environment=development&householdId=HH-TEST&memberId=MEM-001", {
        method: "POST",
        headers: { Origin: kitchen, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json", "X-Evidence-Capture-Kind": captureKind },
        body: JSON.stringify({ shiftDraft: {
          artifact_digest: "artifact_7shifts_report_12345", date: "2026-08-25",
          started_at: "2026-08-25T21:00:00-04:00", ended_at: "2026-08-26T05:00:00-04:00",
          worked_hours: 8, paid_break_minutes: 0, card_tips: cardTips,
        } }),
      }), bindings);
      const evidenceId = (await response.json() as any).capture.evidenceId;
      await worker.queue({ messages: [{ body: { evidenceId, revision: 1 }, ack: vi.fn(), retry: vi.fn() }] } as any, bindings);
    };
    await upload("local-ocr", 80);
    await upload("cloud-vision", 80);
    const worked = bindings.EVIDENCE_DB.observations.filter((row: Row) => row.field_key === "workedMinutes");
    expect(worked).toHaveLength(2);
    expect(worked.every((row: Row) => row.conflict_state === "corroborated")).toBe(true);
    await upload("cloud-vision", 81);
    const cardTips = bindings.EVIDENCE_DB.observations.filter((row: Row) => row.field_key === "cardTipsCents");
    expect(cardTips.every((row: Row) => row.conflict_state === "conflicted")).toBe(true);
    expect(bindings.EVIDENCE_DB.evidenceConflicts.some((row: Row) => row.field_key === "cardTipsCents")).toBe(true);
  });

  it("rejects fabricated eligible facts and accepts only the exact immutable owned derivative", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    const bundle = derivedBundle();
    seedDerivative(bindings.EVIDENCE_DB, bundle);
    const forged = structuredClone(bundle);
    forged.observations.find((row) => row.field === "cashTipsCents")!.value = 42000;
    forged.materialHash = sevenShiftsEvidenceMaterialHash(forged);
    const post = (value: SevenShiftsEvidenceBundle) => worker.fetch(request("/work/evidence/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", bundle: value }),
    }), bindings);
    const rejected = await post(forged);
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: expect.stringMatching(/exactly match.*server-derived/i) });
    expect(bindings.EVIDENCE_DB.bundles).toHaveLength(0);
    const accepted = await post(bundle);
    expect(accepted.status).toBe(201);
    expect(bindings.EVIDENCE_DB.bundles).toHaveLength(1);
  });

  it("supersedes an older unclaimed revision and claims only the newest eligible facts", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    bindings.EVIDENCE_DB.policies.push({
      environment: "development", auth_user_id: "auth-user-1", household_id: "HH-TEST", member_id: "MEM-001", job_id: "JOB-CAFE", enabled: 1,
      policy_json: JSON.stringify({ version: 1, environment: "development", householdId: "HH-TEST", memberId: "MEM-001", jobId: "JOB-CAFE", enabled: true, stableWindowHours: 24, payrollWeekStarts: 1, correctionHorizonDays: 60, closedPeriodAction: "variance", updatedAt: new Date().toISOString() }),
    });
    const first = derivedBundle(1, "0001");
    const second = derivedBundle(2, "0002");
    second.observations.find((row) => row.field === "cashTipsCents")!.value = 4300;
    second.materialHash = sevenShiftsEvidenceMaterialHash(second);
    seedDerivative(bindings.EVIDENCE_DB, first);
    seedDerivative(bindings.EVIDENCE_DB, second);
    const post = (value: SevenShiftsEvidenceBundle) => worker.fetch(request("/work/evidence/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", bundle: value }),
    }), bindings);
    expect((await post(first)).status).toBe(201);
    expect((await post(second)).status).toBe(201);
    expect(bindings.EVIDENCE_DB.jobs).toHaveLength(2);
    expect(bindings.EVIDENCE_DB.jobs.find((row: Row) => row.bundle_revision === 1)?.state).toBe("quarantined");
    const claimed = await worker.fetch(request("/work/evidence/automation/jobs/claim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001" }),
    }), bindings);
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toMatchObject({ job: { actionKind: "post", bundle: { revision: 2 } } });
  });

  it("reclassifies a newer pending post as payroll-week reconciliation when the claimed prior revision finishes first", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    bindings.EVIDENCE_DB.policies.push({
      environment: "development", auth_user_id: "auth-user-1", household_id: "HH-TEST", member_id: "MEM-001", job_id: "JOB-CAFE", enabled: 1,
      policy_json: JSON.stringify({ version: 1, environment: "development", householdId: "HH-TEST", memberId: "MEM-001", jobId: "JOB-CAFE", enabled: true, stableWindowHours: 24, payrollWeekStarts: 1, correctionHorizonDays: 60, closedPeriodAction: "variance", updatedAt: new Date().toISOString() }),
    });
    const first = derivedBundle(1, "1001");
    const second = derivedBundle(2, "1002");
    second.observations.find((row) => row.field === "cashTipsCents")!.value = 4300;
    second.materialHash = sevenShiftsEvidenceMaterialHash(second);
    seedDerivative(bindings.EVIDENCE_DB, first);
    seedDerivative(bindings.EVIDENCE_DB, second);
    const post = async (value: SevenShiftsEvidenceBundle) => worker.fetch(request("/work/evidence/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", bundle: value }),
    }), bindings);
    expect((await post(first)).status).toBe(201);
    const firstJob = bindings.EVIDENCE_DB.jobs[0]!;
    firstJob.state = "claimed";
    firstJob.lease_expires_at = "2099-01-01T00:00:00.000Z";
    expect((await post(second)).status).toBe(201);
    bindings.EVIDENCE_DB.bundles.find((row: Row) => row.revision === 1)!.state = "posted";
    firstJob.state = "acknowledged";
    const claimed = await worker.fetch(request("/work/evidence/automation/jobs/claim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001" }),
    }), bindings);
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toMatchObject({ job: { actionKind: "reconcile_week", bundle: { revision: 2 } } });
    expect(bindings.EVIDENCE_DB.jobs.some((row: Row) => row.bundle_revision === 2 && row.action_kind === "post" && row.state === "quarantined")).toBe(true);
  });

  it("enforces the correction horizon by creating variance review instead of an old automatic reversal", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    bindings.EVIDENCE_DB.policies.push({
      environment: "development", auth_user_id: "auth-user-1", household_id: "HH-TEST", member_id: "MEM-001", job_id: "JOB-CAFE", enabled: 1,
      policy_json: JSON.stringify({ version: 1, environment: "development", householdId: "HH-TEST", memberId: "MEM-001", jobId: "JOB-CAFE", enabled: true, stableWindowHours: 24, payrollWeekStarts: 1, correctionHorizonDays: 1, closedPeriodAction: "variance", updatedAt: new Date().toISOString() }),
    });
    const old = (revision: number, suffix: string) => {
      const value = derivedBundle(revision, suffix);
      value.startedAt = "2026-01-10T21:00:00.000Z";
      value.endedAt = "2026-01-11T02:00:00.000Z";
      value.evidence[0]!.capturedAt = `2026-01-${revision === 1 ? "11" : "12"}T03:00:00.000Z`;
      value.evidence[0]!.observedAt = "2026-01-11T02:05:00.000Z";
      value.observations.find((row) => row.field === "date")!.value = "2026-01-10";
      value.materialHash = sevenShiftsEvidenceMaterialHash(value);
      return value;
    };
    const first = old(1, "2001");
    const second = old(2, "2002");
    seedDerivative(bindings.EVIDENCE_DB, first);
    seedDerivative(bindings.EVIDENCE_DB, second);
    const post = async (value: SevenShiftsEvidenceBundle) => worker.fetch(request("/work/evidence/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", bundle: value }),
    }), bindings);
    expect((await post(first)).status).toBe(201);
    bindings.EVIDENCE_DB.bundles[0]!.state = "posted";
    bindings.EVIDENCE_DB.jobs[0]!.state = "acknowledged";
    expect((await post(second)).status).toBe(201);
    expect(bindings.EVIDENCE_DB.jobs.find((row: Row) => row.bundle_revision === 2)?.action_kind).toBe("variance");
  });

  it("rechecks the kill switch after claim and refuses a job when its exact policy was disabled", async () => {
    const bindings = env();
    vi.stubGlobal("fetch", authFetch());
    bindings.EVIDENCE_DB.policies.push({
      environment: "development", auth_user_id: "auth-user-1", household_id: "HH-TEST", member_id: "MEM-001", job_id: "JOB-CAFE", enabled: 1,
      policy_json: JSON.stringify({ version: 1, environment: "development", householdId: "HH-TEST", memberId: "MEM-001", jobId: "JOB-CAFE", enabled: true, stableWindowHours: 24, payrollWeekStarts: 1, correctionHorizonDays: 60, closedPeriodAction: "variance", updatedAt: new Date().toISOString() }),
    });
    const bundle = derivedBundle(1, "3001");
    seedDerivative(bindings.EVIDENCE_DB, bundle);
    const staged = await worker.fetch(request("/work/evidence/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", bundle }),
    }), bindings);
    expect(staged.status).toBe(201);
    const claimed = await worker.fetch(request("/work/evidence/automation/jobs/claim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001" }),
    }), bindings);
    const job = (await claimed.json() as any).job;
    bindings.EVIDENCE_DB.policies[0]!.enabled = 0;
    const validation = await worker.fetch(request("/work/evidence/automation/jobs/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", jobKey: job.jobKey, leaseId: job.leaseId }),
    }), bindings);
    expect(validation.status).toBe(400);
    expect(await validation.json()).toMatchObject({ error: expect.stringMatching(/policy.*changed before posting/i) });
  });

  it("recovers a hosted r1 receipt after Worker acknowledgement failure before classifying r2", async () => {
    const bindings = env();
    let hostedJobKey = "";
    vi.stubGlobal("fetch", authFetch((url) => {
      if (url.pathname !== "/rest/v1/continuity_command_events") return null;
      const requested = url.searchParams.get("idempotency_key")?.replace(/^eq\./, "");
      return Response.json(requested === hostedJobKey ? [{
        id: "event-r1", member_id: "MEM-001", idempotency_key: hostedJobKey, confirmation_id: hostedJobKey,
        identity_hash: "identity-r1", result_revision: 8,
        payload_json: { confirmationId: hostedJobKey, identityHash: "identity-r1", auditHash: "audit-r1" },
      }] : []);
    }));
    bindings.EVIDENCE_DB.policies.push({
      environment: "development", auth_user_id: "auth-user-1", household_id: "HH-TEST", member_id: "MEM-001", job_id: "JOB-CAFE", enabled: 1,
      policy_json: JSON.stringify({ version: 1, environment: "development", householdId: "HH-TEST", memberId: "MEM-001", jobId: "JOB-CAFE", enabled: true, stableWindowHours: 24, payrollWeekStarts: 1, correctionHorizonDays: 60, closedPeriodAction: "variance", updatedAt: new Date().toISOString() }),
    });
    const first = derivedBundle(1, "4001");
    const second = derivedBundle(2, "4002");
    second.observations.find((row) => row.field === "cashTipsCents")!.value = 4300;
    second.materialHash = sevenShiftsEvidenceMaterialHash(second);
    seedDerivative(bindings.EVIDENCE_DB, first);
    seedDerivative(bindings.EVIDENCE_DB, second);
    const stage = async (value: SevenShiftsEvidenceBundle) => worker.fetch(request("/work/evidence/bundles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001", bundle: value }),
    }), bindings);
    expect((await stage(first)).status).toBe(201);
    hostedJobKey = bindings.EVIDENCE_DB.jobs[0]!.job_key;
    // The authenticated command append succeeded, but the Evidence ACK never arrived.
    expect((await stage(second)).status).toBe(201);
    expect(bindings.EVIDENCE_DB.jobs.find((row: Row) => row.job_key === hostedJobKey)?.state).toBe("quarantined");
    const claimed = await worker.fetch(request("/work/evidence/automation/jobs/claim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "development", householdId: "HH-TEST", memberId: "MEM-001" }),
    }), bindings);
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toMatchObject({ job: { actionKind: "reconcile_week", bundle: { revision: 2 } } });
    expect(bindings.EVIDENCE_DB.receipts).toContainEqual(expect.objectContaining({ job_key: hostedJobKey, command_event_id: "event-r1" }));
    expect(bindings.EVIDENCE_DB.bundles.find((row: Row) => row.revision === 1)?.state).toBe("posted");
  });
});
