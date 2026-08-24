import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/003_continuity_membership.sql", import.meta.url)),
  "utf8",
);

describe("D-115 hosted continuity schema readiness", () => {
  it("creates household membership and personal snapshot scopes with household-local keys", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS continuity_memberships");
    expect(sql).toContain("PRIMARY KEY (environment, household_id, member_id)");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS continuity_personal_snapshots");
    expect(sql).toContain("REFERENCES continuity_memberships(environment, household_id, member_id)");
  });

  it("limits the temporary open policies to disposable Development rows", () => {
    expect(sql).toContain("USING (environment = 'development')");
    expect(sql).toContain("WITH CHECK (environment = 'development')");
    expect(sql).toContain("DO NOT APPLY WITHOUT JONATHAN'S EXPLICIT SCHEMA APPROVAL");
    expect(sql).not.toMatch(/GRANT\s+ALL/i);
  });
});
