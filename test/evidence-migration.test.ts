import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const migration = [
  readFileSync(new URL("../migrations/evidence/0001_evidence_mesh.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../migrations/evidence/0002_r2_budget_guard.sql", import.meta.url), "utf8"),
].join("\n");

describe("D-158 dedicated Evidence D1 migration", () => {
  it("applies cleanly and separates canonical authority observations from schema drift", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(migration);
      const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'evidence_observations'").get() as { sql: string };
      expect(table.sql).toContain("canonical_shift_key TEXT NOT NULL");
      db.exec(`
        INSERT INTO evidence_items (evidence_id, environment, auth_user_id, household_id, member_id, capture_kind, state, content_type, byte_length, plaintext_sha256, created_at, updated_at)
          VALUES ('evi_schema_apply_000000000001', 'development', 'auth-1', 'HH-TEST', 'MEM-001', 'browser-structured', 'ready_to_review', 'application/json', 2, '${"a".repeat(64)}', '2026-08-28T00:00:00.000Z', '2026-08-28T00:00:00.000Z');
        INSERT INTO evidence_derivatives (evidence_id, revision, canonical_shift_key, parser_version, schema_fingerprint, sanitized_json, created_at)
          VALUES ('evi_schema_apply_000000000001', 1, 'shift:tenant:punch-1', 'v1', 'schema-v1', '{}', '2026-08-28T00:00:00.000Z');
        INSERT INTO evidence_observations (observation_id, evidence_id, revision, canonical_shift_key, field_key, value_json, unit, source_location, confidence_bps, finality, extraction_method, conflict_state, created_at)
          VALUES ('obs-1', 'evi_schema_apply_000000000001', 1, 'shift:tenant:punch-1', 'workedMinutes', '240', 'minutes', 'punch.worked_minutes', 10000, 'approved', 'structured', 'clear', '2026-08-28T00:00:00.000Z');
        INSERT INTO evidence_schema_drift (drift_id, evidence_id, revision, canonical_shift_key, field_path, value_json, value_type, value_digest, created_at)
          VALUES ('drift-1', 'evi_schema_apply_000000000001', 1, 'shift:tenant:punch-1', 'punch.future_field', '"kept"', 'string', '${"b".repeat(64)}', '2026-08-28T00:00:00.000Z');
      `);
      expect(db.prepare("SELECT field_key, value_json FROM evidence_observations WHERE evidence_id = 'evi_schema_apply_000000000001' AND revision = 1 AND canonical_shift_key = 'shift:tenant:punch-1'")
        .get()).toMatchObject({ field_key: "workedMinutes", value_json: "240" });
      expect(db.prepare("SELECT field_path, value_json FROM evidence_schema_drift WHERE evidence_id = 'evi_schema_apply_000000000001'")
        .get()).toMatchObject({ field_path: "punch.future_field", value_json: '"kept"' });
      expect(db.prepare("SELECT stored_bytes, object_count FROM evidence_r2_budget WHERE singleton = 1").get())
        .toMatchObject({ stored_bytes: 0, object_count: 0 });
    } finally {
      db.close();
    }
  });
});
