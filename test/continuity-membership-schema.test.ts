import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/003_continuity_membership.sql", import.meta.url)),
  "utf8",
);

describe("D-117 hosted continuity schema readiness", () => {
  it("creates household membership and personal snapshot scopes with household-local keys", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS continuity_memberships");
    expect(sql).toContain("PRIMARY KEY (environment, household_id, member_id)");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS continuity_personal_snapshots");
    expect(sql).toContain("REFERENCES continuity_memberships(environment, household_id, member_id)");
  });

  it("limits the temporary open policies to disposable Development rows", () => {
    expect(sql).toContain("USING (environment = 'development')");
    expect(sql).toContain("WITH CHECK (environment = 'development')");
    expect(sql).toContain("Applied to project tykhocwacaxwquhynkok on 2026-08-24");
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE continuity_memberships");
    expect(sql).toContain("REVOKE ALL PRIVILEGES ON TABLE continuity_personal_snapshots");
    expect(sql.match(/GRANT SELECT, INSERT, UPDATE/g)).toHaveLength(2);
    expect(sql).not.toMatch(/GRANT\s+ALL/i);
  });
});
