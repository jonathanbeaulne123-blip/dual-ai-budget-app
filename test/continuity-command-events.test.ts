import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/013_continuity_command_events.sql", import.meta.url)),
  "utf8",
);

describe("migration 013 continuity_command_events (D-148 T2-S1)", () => {
  it("defines append-only command log with idempotency unique key", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.continuity_command_events/);
    expect(sql).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    expect(sql).toMatch(/UNIQUE \(environment, household_id, idempotency_key\)/);
    expect(sql).toMatch(/ledger_scope TEXT NOT NULL CHECK \(ledger_scope IN \('shared', 'personal'\)\)/);
    expect(sql).toMatch(/payload_json JSONB NOT NULL/);
    expect(sql).toMatch(/continuity_command_events_household_order/);
  });

  it("scopes SELECT RLS to shared household members and personal owner only", () => {
    expect(sql).toMatch(/hearth_command_events_select/);
    expect(sql).toMatch(/ledger_scope = 'shared'[\s\S]*hearth_private\.is_active_member/);
    expect(sql).toMatch(/ledger_scope = 'personal'[\s\S]*hearth_private\.own_member_id/);
    expect(sql).toMatch(/REVOKE ALL PRIVILEGES ON TABLE public\.continuity_command_events FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT SELECT ON TABLE public\.continuity_command_events TO authenticated/);
    expect(sql).not.toMatch(/GRANT INSERT ON TABLE public\.continuity_command_events TO authenticated/i);
  });

  it("defines append_continuity_command RPC with membership guards and Development gate", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.append_continuity_command\(/);
    expect(sql).toMatch(/auth\.uid\(\) IS NULL[\s\S]*unauthenticated/i);
    expect(sql).toMatch(/p_environment IS DISTINCT FROM 'development'[\s\S]*production-disabled/i);
    expect(sql).toMatch(/hearth_private\.is_active_member/);
    expect(sql).toMatch(/hearth_private\.own_member_id/);
    expect(sql).toMatch(/command-payload-too-large/);
  });

  it("returns duplicate result_revision on idempotent replay and rejects key reuse with different body", () => {
    expect(sql).toMatch(/idempotency-key-reused/);
    expect(sql).toMatch(/'duplicate', true/);
    expect(sql).toMatch(/existing\.result_revision/);
  });

  it("links event insert to atomic snapshot bump via publish_continuity_snapshot in same transaction", () => {
    expect(sql).toMatch(/INSERT INTO public\.continuity_command_events[\s\S]*RETURNING id INTO new_event_id/);
    expect(sql).toMatch(/snapshot_result := public\.publish_continuity_snapshot\(/);
    expect(sql).toMatch(/RAISE EXCEPTION 'snapshot-bump-failed: %', snapshot_result/);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
  });

  it("grants authenticated EXECUTE only and records schema migration id 13", () => {
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]*append_continuity_command[\s\S]*TO authenticated/i);
    expect(sql).not.toMatch(/GRANT EXECUTE[\s\S]*append_continuity_command[\s\S]*TO anon/i);
    expect(sql).toMatch(/INSERT INTO public\.schema_migrations[\s\S]*VALUES \(13,/);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.append_continuity_command/);
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it("requires Migration 012 publish_continuity_snapshot to exist at apply time", () => {
    expect(sql).toMatch(/public\.publish_continuity_snapshot\(/);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.publish_continuity_snapshot/);
  });
});
