import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Auth/RLS readiness packet", () => {
  const packet = readFileSync("docs/sql/rls_auth_ready.sql", "utf8");
  const cas = readFileSync("supabase/migrations/002_snapshot_cas.sql", "utf8");

  it("is a do-not-apply packet with no household project contact", () => {
    expect(packet).toMatch(/DO NOT APPLY/i);
    expect(cas).toMatch(/DO NOT APPLY/i);
    expect(packet).not.toMatch(/tykhocwacaxwquhynkok|service_role key\s*=/i);
  });

  it("covers membership, least privilege, owner/member, DELETE, invites, revoke, and service-role isolation", () => {
    expect(packet).toMatch(/auth_user_id/);
    expect(packet).toMatch(/role IN \('owner', 'member'\)/);
    expect(packet).toMatch(/REVOKE DELETE/);
    expect(packet).toMatch(/household_invitations/);
    expect(packet).toMatch(/Revoked member/);
    expect(packet).toMatch(/Cross-household/);
    expect(packet).toMatch(/REVOKE ALL ON households[\s\S]*FROM anon/);
    expect(packet).toMatch(/Never a VITE_SUPABASE_SERVICE_ROLE|never ships in VITE_/i);
  });

  it("documents order, rollback, and synthetic proofs without claiming Auth is live", () => {
    expect(packet).toMatch(/002_snapshot_cas\.sql/);
    expect(packet).toMatch(/Rollback/);
    expect(packet).toMatch(/not live Auth/i);
    expect(packet).toMatch(/revoked member cannot read/i);
    expect(cas).toMatch(/publish_household_snapshot/);
  });
});
