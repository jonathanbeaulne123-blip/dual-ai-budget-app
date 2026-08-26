import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/012_publish_continuity_snapshot.sql", import.meta.url)),
  "utf8",
);

describe("migration 012 publish_continuity_snapshot (D-148 T1-S1)", () => {
  it("defines atomic continuity RPC with Shared CAS and Personal upsert in one function", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.publish_continuity_snapshot\(/);
    expect(sql).toMatch(/UPDATE public\.households SET[\s\S]*revision = p_revision/);
    expect(sql).toMatch(/UPDATE public\.household_snapshots SET[\s\S]*snapshot_hash = p_snapshot_hash/);
    expect(sql).toMatch(/INSERT INTO public\.continuity_personal_snapshots[\s\S]*ON CONFLICT \(environment, household_id, member_id\) DO UPDATE/);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/FOR UPDATE/i);
  });

  it("requires authenticated member, shared payload, and valid personal envelope", () => {
    expect(sql).toMatch(/auth\.uid\(\) IS NULL[\s\S]*unauthenticated/i);
    expect(sql).toMatch(/hearth_private\.is_active_member/);
    expect(sql).toMatch(/hearth_private\.own_member_id/);
    expect(sql).toMatch(/hearth_private\.payload_is_shared\(p_payload\)/);
    expect(sql).toMatch(/hearth_private\.payload_is_member_personal\(p_personal_payload, p_member_id\)/);
    expect(sql).toMatch(/invalid-personal-payload/);
  });

  it("supports stale revision conflict and idempotent duplicate acknowledgement", () => {
    expect(sql).toMatch(/stale-revision/);
    expect(sql).toMatch(/revision-hash-mismatch/);
    expect(sql).toMatch(/duplicate', true/);
    expect(sql).toMatch(/hearth_private\.payload_has_confirmation/);
    expect(sql).toMatch(/missing-confirmation-receipt/);
  });

  it("guards Development-only and grants authenticated execution only", () => {
    expect(sql).toMatch(/p_environment IS DISTINCT FROM 'development'[\s\S]*production-disabled/i);
    expect(sql).toMatch(/GRANT EXECUTE[\s\S]*publish_continuity_snapshot[\s\S]*TO authenticated/i);
    expect(sql).toMatch(/REVOKE ALL[\s\S]*FROM PUBLIC, anon/i);
    expect(sql).not.toMatch(/GRANT EXECUTE[\s\S]*publish_continuity_snapshot[\s\S]*TO anon/i);
  });

  it("records schema migration id 12 and documents rollback", () => {
    expect(sql).toMatch(/INSERT INTO public\.schema_migrations[\s\S]*VALUES \(12,/);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.publish_continuity_snapshot/);
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it("validates goals, contributions, purchases, and rejects receipts in personal envelope", () => {
    expect(sql).toMatch(/payload -> 'goals'/);
    expect(sql).toMatch(/ownerMemberId/);
    expect(sql).toMatch(/goalContributions/);
    expect(sql).toMatch(/goalPurchases/);
    expect(sql).toMatch(/commandReceipts/);
  });

  it("returns personal-payload-mismatch on duplicate Shared revision with divergent Personal", () => {
    expect(sql).toMatch(/personal-payload-mismatch/);
    expect(sql).toMatch(/current_personal_payload IS DISTINCT FROM p_personal_payload/);
  });

  it("touches membership updated_at without weakening RLS helpers", () => {
    expect(sql).toMatch(/UPDATE public\.continuity_memberships[\s\S]*updated_at = now\(\)::text/);
    expect(sql).not.toMatch(/DROP POLICY/i);
    expect(sql).not.toMatch(/GRANT SELECT, INSERT, UPDATE ON TABLE public\.households TO anon/i);
  });
});
