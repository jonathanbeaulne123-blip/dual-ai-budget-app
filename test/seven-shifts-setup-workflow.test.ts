import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifySevenShiftsSchema } from "../scripts/verify-seven-shifts-schema.mjs";

const workflow = readFileSync(".github/workflows/seven-shifts-setup.yml", "utf8");
const schemaVerifier = readFileSync("scripts/verify-seven-shifts-schema.mjs", "utf8");

describe("D-155 Development setup workflow", () => {
  it("is manual-only and refuses to set up an active or Production provider", () => {
    expect(workflow).toMatch(/on:\s*\n\s+workflow_dispatch:/);
    expect(workflow).not.toMatch(/\n\s+(?:push|pull_request):/);
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain('if [ "$GITHUB_REF" != "refs/heads/main" ]');
    expect(workflow).toContain('if [ -z "$current_main_sha" ] || [ "$GITHUB_SHA" != "$current_main_sha" ]');
    expect(workflow).toContain("group: hearth-books-production");
    expect(workflow).toContain('config.vars?.SEVENSHIFTS_ENABLED !== "false"');
    expect(workflow).toContain('config.vars?.SEVENSHIFTS_ALLOW_PRODUCTION !== "false"');
    expect(workflow).toContain('status.phase !== "scaffold"');
    expect(workflow).toContain('status.environment !== "development-only"');
    expect(workflow).toContain("Activation still requires Worker secrets, the D1 table, and deploy approval.");
    expect(workflow).toContain("status.available !== false");
    expect(workflow).toContain("status.providerCallsEnabled !== false");
    expect(workflow).toContain("status.productionAllowed !== false");
  });

  it("allows only migration 0002 or its exact empty resume state", () => {
    expect(workflow).toContain('names[0] !== "0002_seven_shifts_connections.sql"');
    expect(workflow).toContain("npx wrangler d1 migrations apply FLINKS_DB --remote");
    expect(workflow).toContain('if grep -q "0002_seven_shifts_connections.sql"');
    expect(workflow).toContain('node scripts/verify-seven-shifts-schema.mjs "$schema_file"');
    expect(schemaVerifier).toContain("D1 first-time setup requires an empty seven_shifts_connections table.");
    expect(schemaVerifier).toContain("check (environment = 'development')");
    expect(schemaVerifier).toContain("check (state in ('ready', 'revoked'))");
    expect(schemaVerifier).toContain('seven_shifts_connections_owner');
    expect(schemaVerifier).toContain('["environment", "auth_user_id", "household_id", "member_id", "updated_at"]');
  });

  it("creates only missing, distinct secret names without printing values", () => {
    expect(workflow).toContain("npx wrangler secret list --format json");
    expect(workflow).toContain("npx wrangler secret bulk");
    expect(workflow).toContain("SEVENSHIFTS_CONNECTION_ENCRYPTION_KEY SEVENSHIFTS_DIGEST_KEY");
    expect(workflow).toContain("Both 7shifts Worker secrets already existed; nothing was rotated.");
    expect(workflow).not.toMatch(/echo\s+\"?\$(?:value|secret_upload)/);
  });

  it("executes the exact schema verifier and preserves SQL constraint quotes", () => {
    const columns = [
      ["connection_id", "TEXT", 0, null, 1],
      ["environment", "TEXT", 1, null, 0],
      ["auth_user_id", "TEXT", 1, null, 0],
      ["household_id", "TEXT", 1, null, 0],
      ["member_id", "TEXT", 1, null, 0],
      ["job_id", "TEXT", 1, null, 0],
      ["state", "TEXT", 1, null, 0],
      ["state_version", "INTEGER", 1, "1", 0],
      ["sealed_private", "TEXT", 0, null, 0],
      ["key_version", "INTEGER", 1, "1", 0],
      ["company_label", "TEXT", 1, null, 0],
      ["created_at", "TEXT", 1, null, 0],
      ["updated_at", "TEXT", 1, null, 0],
      ["last_pull_at", "TEXT", 0, null, 0],
      ["revoked_at", "TEXT", 0, null, 0],
    ].map(([name, type, notnullValue, dfltValue, pk], cid) => ({ cid, name, type, notnull_value: notnullValue, dflt_value: dfltValue, pk }));
    const payload: Array<{ results: Array<Record<string, unknown>> }> = [
      { results: columns },
      { results: [{ table_sql: "CREATE TABLE seven_shifts_connections (connection_id TEXT PRIMARY KEY, environment TEXT NOT NULL CHECK (environment = 'development'), auth_user_id TEXT NOT NULL, household_id TEXT NOT NULL, member_id TEXT NOT NULL, job_id TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('ready', 'revoked')), state_version INTEGER NOT NULL DEFAULT 1, sealed_private TEXT, key_version INTEGER NOT NULL DEFAULT 1, company_label TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_pull_at TEXT, revoked_at TEXT)" }] },
      { results: [{ name: "seven_shifts_connections_owner", is_unique: 0, origin: "c", partial: 0 }] },
      { results: ["environment", "auth_user_id", "household_id", "member_id", "updated_at"].map((name, seqno) => ({ seqno, cid: seqno + 1, name })) },
      { results: [{ row_count: 0 }] },
    ];

    expect(() => verifySevenShiftsSchema(payload)).not.toThrow();
    const unquoted = structuredClone(payload);
    const tableRow = unquoted[1]?.results[0];
    if (!tableRow) throw new Error("Missing schema fixture table row.");
    tableRow.table_sql = String(tableRow.table_sql).replaceAll("'", "");
    expect(() => verifySevenShiftsSchema(unquoted)).toThrow(/CHECK constraints/);
  });
});
