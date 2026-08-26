import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Auth/RLS readiness packet", () => {
  const legacy = readFileSync("docs/sql/rls_auth_ready.sql", "utf8");
  const cutover = readFileSync("docs/AUTH_RLS_CUTOVER.md", "utf8");
  const prepare = readFileSync("supabase/migrations/004_auth_rls_prepare.sql", "utf8");
  const hardening = readFileSync("supabase/migrations/005_snapshot_cas_hardening.sql", "utf8");
  const migration = readFileSync("supabase/migrations/006_auth_rls_cutover.sql", "utf8");
  const cas = readFileSync("supabase/migrations/002_snapshot_cas.sql", "utf8");

  it("keeps migration packets free of project identifiers and 006 visibly gated", () => {
    for (const packet of [legacy, prepare, hardening, migration, cas]) {
      expect(packet).toMatch(/DO NOT APPLY/i);
      expect(packet).not.toMatch(/tykhocwacaxwquhynkok|service_role key\s*=/i);
    }
    expect(cutover).toMatch(/006[`*]*\s*applied/i);
  });

  it("keeps living constitution aligned with applied deny-by-default 006", () => {
    const agents = readFileSync("AGENTS.md", "utf8");
    const continuity = readFileSync("docs/CLOUD_CONTINUITY.md", "utf8");
    const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");
    const environments = readFileSync("docs/ENVIRONMENTS.md", "utf8");
    for (const living of [agents, continuity, architecture, environments]) {
      expect(living).toMatch(/006 is applied/i);
      expect(living).not.toMatch(/RLS is still [`']?USING \(true\)/i);
      expect(living).not.toMatch(/006 remains unapplied/i);
      expect(living).not.toMatch(/006 is not applied/i);
      expect(living).not.toMatch(/006 is review-ready but unapplied/i);
    }
  });

  it("locks path B Production ceiling as NOTICE (abort only above ceiling 1)", () => {
    expect(migration).toMatch(/production_ceiling CONSTANT BIGINT := 1/);
    expect(migration).toMatch(/RAISE NOTICE 'Path B:/);
    expect(migration).toMatch(/Production households exceed Jonathan-approved path B ceiling/);
    expect(migration).not.toMatch(/Development-only cutover requires a separate project; Production needs explicit approval/);
  });

  it("anchors cutover on continuity_memberships rather than a fictional members door", () => {
    expect(cutover).toMatch(/membership/i);
    expect(prepare).toMatch(/auth_user_id/);
    expect(migration).toMatch(/continuity_memberships/);
    expect(prepare).toMatch(/continuity_memberships/);
    expect(legacy).toMatch(/continuity_memberships/);
  });

  it("locks Q1 A, Q3 email|QR, Q4 no-anon REST, and ships executable deny-by-default SQL", () => {
    expect(cutover).toMatch(/Q1.*Supabase Auth Google/i);
    expect(cutover).toMatch(/Email invite or QR invite/i);
    expect(cutover).toMatch(/No household REST for anon/i);
    expect(cutover).toMatch(/anon \| deny/);
    expect(cutover).toMatch(/Q1.*Supabase Auth Google/i);
    expect(prepare).toMatch(/kind TEXT NOT NULL CHECK \(kind IN \('email', 'qr'\)\)/);
    expect(migration).toMatch(/REVOKE ALL PRIVILEGES ON TABLE[\s\S]+public\.households[\s\S]+FROM anon, authenticated/i);
    expect(migration).toMatch(/hearth_issue_invite|hearth_redeem_invite/);
    expect(migration).not.toMatch(/intentionally contains NO executable policy/i);
    expect(prepare).not.toMatch(/REVOKE ALL PRIVILEGES ON TABLE/i);
  });

  it("covers least privilege, DELETE refusal, owner invite RPCs, and service-role isolation", () => {
    expect(cutover).toMatch(/DELETE/);
    expect(cutover).toMatch(/service-role/);
    expect(migration).toMatch(/REVOKE ALL PRIVILEGES ON TABLE/i);
    expect(migration).toMatch(/household_invitations/);
    expect(migration).toMatch(/hearth_private\.is_household_owner/);
    expect(legacy).toMatch(/household_invitations/);
    expect(cas).toMatch(/publish_household_snapshot/);
  });

  it("splits safe preparation from cutover and repairs live CAS forward", () => {
    expect(prepare).toMatch(/does NOT close the[\s\S]*current disposable-Development anon bridge/i);
    expect(prepare).toMatch(/auth\.identities/i);
    expect(prepare).toMatch(/target_member_id/i);
    expect(prepare).toMatch(/invite_token_hash/i);
    expect(hardening).toMatch(/pg_advisory_xact_lock/i);
    expect(hardening).toMatch(/p_revision <= p_expected_revision/i);
    expect(hardening).toMatch(/compacted offline/i);
    expect(migration).toMatch(/CAS hardening 005 has not been applied/i);
    expect(migration).toMatch(/Jonathan-approved path B ceiling/i);
    expect(migration).toMatch(/WHERE environment = 'production'/i);
    expect(migration).toMatch(/exactly one active owner/i);
    expect(migration).toMatch(/Personal ledger rows/i);
  });

  it("uses non-recursive private helpers and exposes only bounded write RPCs", () => {
    expect(migration).toMatch(/CREATE SCHEMA IF NOT EXISTS hearth_private/i);
    expect(migration).toMatch(/SECURITY DEFINER SET search_path = ''/i);
    expect(migration).not.toMatch(/CREATE POLICY[^;]+FOR (INSERT|UPDATE)[^;]+continuity_memberships/is);
    expect(migration).toMatch(/GRANT SELECT, INSERT, UPDATE ON TABLE public\.continuity_personal_snapshots/i);
    expect(migration).toMatch(/ALTER VIEW public\.v_journal SET \(security_invoker = true\)/i);
    expect(migration).toMatch(/reason', 'missing-snapshot'/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.publish_household_snapshot\(text, integer, text, text, text, text, text, boolean, integer, text, text, text\)/i);
  });
});
