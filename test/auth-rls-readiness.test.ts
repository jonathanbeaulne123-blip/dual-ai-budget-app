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

  it("documents the permission matrix and open product questions before locking SQL", () => {
    expect(cutover).toMatch(/### Q1/);
    expect(cutover).toMatch(/### Q5/);
    expect(cutover).toMatch(/anon \| deny/);
    expect(cutover).toMatch(/revoked \/ inactive membership/);
    expect(migration).toMatch(/Q1–Q5|Q1-Q5/);
    expect(migration).toMatch(/no-op placeholder|intentionally contains NO executable policy/i);
  });

  it("covers least privilege, DELETE refusal, invites/roles as open, and service-role isolation", () => {
    expect(cutover).toMatch(/No DELETE from authenticated/);
    expect(cutover).toMatch(/service_role/);
    expect(cutover).toMatch(/VITE_/);
    expect(legacy).toMatch(/REVOKE DELETE/);
    expect(legacy).toMatch(/household_invitations/);
    expect(cas).toMatch(/publish_household_snapshot/);
  });
});
