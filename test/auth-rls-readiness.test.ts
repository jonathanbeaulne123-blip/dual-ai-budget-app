import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Auth/RLS readiness packet", () => {
  const legacy = readFileSync("docs/sql/rls_auth_ready.sql", "utf8");
  const cutover = readFileSync("docs/AUTH_RLS_CUTOVER.md", "utf8");
  const migration = readFileSync("supabase/migrations/004_auth_rls_cutover.sql", "utf8");
  const cas = readFileSync("supabase/migrations/002_snapshot_cas.sql", "utf8");

  it("keeps every Auth/RLS artifact as do-not-apply with no household project contact", () => {
    for (const packet of [legacy, migration, cas]) {
      expect(packet).toMatch(/DO NOT APPLY/i);
      expect(packet).not.toMatch(/tykhocwacaxwquhynkok|service_role key\s*=/i);
    }
    expect(cutover).toMatch(/Do \*\*not\*\* apply|DO NOT APPLY/i);
  });

  it("anchors cutover on continuity_memberships rather than a fictional members door", () => {
    expect(cutover).toMatch(/continuity_memberships/);
    expect(cutover).toMatch(/auth_user_id/);
    expect(migration).toMatch(/continuity_memberships/);
    expect(legacy).toMatch(/continuity_memberships/);
  });

  it("locks Q1 A, Q3 email|QR, Q4 no-anon REST, and ships executable deny-by-default SQL", () => {
    expect(cutover).toMatch(/Q1.*Supabase Auth Google/i);
    expect(cutover).toMatch(/Email invite or QR invite/i);
    expect(cutover).toMatch(/No household REST for anon/i);
    expect(cutover).toMatch(/anon \| deny/);
    expect(migration).toMatch(/Q1 A/);
    expect(migration).toMatch(/kind IN \('email', 'qr'\)/);
    expect(migration).toMatch(/REVOKE ALL ON TABLE households FROM anon/i);
    expect(migration).toMatch(/hearth_issue_invite|hearth_redeem_invite/);
    expect(migration).not.toMatch(/intentionally contains NO executable policy/i);
  });

  it("covers least privilege, DELETE refusal, owner invite RPCs, and service-role isolation", () => {
    expect(cutover).toMatch(/DELETE/);
    expect(cutover).toMatch(/service_role/);
    expect(migration).toMatch(/REVOKE DELETE/i);
    expect(migration).toMatch(/household_invitations/);
    expect(migration).toMatch(/hearth_is_household_owner/);
    expect(legacy).toMatch(/household_invitations/);
    expect(cas).toMatch(/publish_household_snapshot/);
  });
});

