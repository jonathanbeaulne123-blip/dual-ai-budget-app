import { existsSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Principal = {
  role: "anon" | "authenticated";
  authUserId: string;
  sessionId: string;
  email: string;
};

type PermissionCase = {
  controlId: string;
  expected: "allow" | "deny";
  operation: "select" | "insert" | "update" | "rpc" | "realtime-subscribe";
  principal: Principal;
  run: (database: PGlite) => Promise<boolean>;
  testId: string;
};

type Manifest = {
  version: number;
  controls: Array<{
    controlId: string;
    permissionCaseIds?: string[];
    proofFiles: string[];
    testId: string;
  }>;
};

const fixtureSource = readFileSync("test/fixtures/permission-matrix.sql", "utf8");
const matrixSource = readFileSync("docs/OCTOBER_READINESS_MATRIX.md", "utf8");
const manifest = JSON.parse(readFileSync("test/permission-matrix.manifest.json", "utf8")) as Manifest;
const contractSources = {
  cutover: readFileSync("supabase/migrations/006_auth_rls_cutover.sql", "utf8"),
  productionBridge: readFileSync("supabase/migrations/008_production_continuity_select.sql", "utf8"),
  atomicPublish: readFileSync("supabase/migrations/012_publish_continuity_snapshot.sql", "utf8"),
  commandEvents: readFileSync("supabase/migrations/013_continuity_command_events.sql", "utf8"),
  realtime: readFileSync("supabase/migrations/014_realtime_publication.sql", "utf8"),
  sessions: readFileSync("supabase/migrations/017_shared_money_membership_sessions.sql", "utf8"),
  qrInvite: readFileSync("supabase/migrations/018_qr_invite_full_house.sql", "utf8"),
  cutoverStatus: readFileSync("docs/AUTH_RLS_CUTOVER.md", "utf8"),
  lifecycle: readFileSync("src/core/lifecycleAuthority.ts", "utf8"),
  continuityPolicy: readFileSync("src/ledger/continuityPolicy.ts", "utf8"),
  transport: readFileSync("src/ledger/supabase.ts", "utf8"),
};

const principals = {
  anon: { role: "anon", authUserId: "", sessionId: "", email: "" },
  ownerA: { role: "authenticated", authUserId: "USER-A", sessionId: "SESSION-A", email: "a@example.test" },
  ownerARevoked: { role: "authenticated", authUserId: "USER-A", sessionId: "SESSION-A-REVOKED", email: "a@example.test" },
  memberB: { role: "authenticated", authUserId: "USER-B", sessionId: "SESSION-B", email: "b@example.test" },
  ownerC: { role: "authenticated", authUserId: "USER-C", sessionId: "SESSION-C", email: "c@example.test" },
  ownerCRevoked: { role: "authenticated", authUserId: "USER-C", sessionId: "SESSION-C-REVOKED", email: "c@example.test" },
  ownerAProduction: { role: "authenticated", authUserId: "USER-A", sessionId: "SESSION-A-PROD", email: "a@example.test" },
  invitee: { role: "authenticated", authUserId: "USER-D", sessionId: "SESSION-D", email: "invitee@example.test" },
  outsider: { role: "authenticated", authUserId: "USER-X", sessionId: "SESSION-X", email: "x@example.test" },
} as const satisfies Record<string, Principal>;

async function openHarness(weakenSharedSelect = false): Promise<PGlite> {
  const database = new PGlite();
  const source = weakenSharedSelect
    ? fixtureSource.replace(
      "/* SHARED_SELECT_PREDICATE */\n  hearth_private.is_active_member(environment, household_id)",
      "/* SHARED_SELECT_PREDICATE */\n  true",
    )
    : fixtureSource;
  if (weakenSharedSelect && source === fixtureSource) {
    throw new Error("PM-HARNESS-INVERSION-MARKER-MISSING");
  }
  await database.exec(source);
  return database;
}

async function assumePrincipal(database: PGlite, principal: Principal): Promise<void> {
  await database.exec("RESET ROLE;");
  await database.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [principal.authUserId]);
  await database.query("SELECT set_config('request.jwt.claim.session_id', $1, false)", [principal.sessionId]);
  await database.query("SELECT set_config('request.jwt.claim.email', $1, false)", [principal.email]);
  await database.exec(principal.role === "anon" ? "SET ROLE anon;" : "SET ROLE authenticated;");
}

async function hasRows(database: PGlite, sql: string): Promise<boolean> {
  try {
    const result = await database.query(sql);
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function returnsTrue(database: PGlite, sql: string): Promise<boolean> {
  try {
    const result = await database.query<{ allowed: boolean }>(sql);
    return result.rows[0]?.allowed === true;
  } catch {
    return false;
  }
}

async function mutationSucceeds(database: PGlite, sql: string): Promise<boolean> {
  try {
    const result = await database.query(sql);
    return Number(result.affectedRows ?? result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

const permissionCases: PermissionCase[] = [
  {
    testId: "PM-OCT-002-ANON-PERSONAL-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.anon, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT member_id FROM continuity_personal_snapshots WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-002-SELF-PERSONAL-ALLOW", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.memberB, operation: "select", expected: "allow",
    run: (database) => hasRows(database, "SELECT member_id FROM continuity_personal_snapshots WHERE environment='development' AND household_id='H1' AND member_id='M-B'"),
  },
  {
    testId: "PM-OCT-002-CROSS-MEMBER-PERSONAL-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.memberB, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT member_id FROM continuity_personal_snapshots WHERE environment='development' AND household_id='H1' AND member_id='M-A'"),
  },
  {
    testId: "PM-OCT-002-REVOKED-PERSONAL-INSERT-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.ownerCRevoked, operation: "insert", expected: "deny",
    run: (database) => mutationSucceeds(database, "INSERT INTO continuity_personal_snapshots VALUES ('development','H2','M-C',1,'{}'::jsonb)"),
  },
  {
    testId: "PM-OCT-002-SELF-PERSONAL-INSERT-ALLOW", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.ownerC, operation: "insert", expected: "allow",
    run: (database) => mutationSucceeds(database, "INSERT INTO continuity_personal_snapshots VALUES ('development','H2','M-C',1,'{}'::jsonb)"),
  },
  {
    testId: "PM-OCT-002-CROSS-MEMBER-PERSONAL-INSERT-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.memberB, operation: "insert", expected: "deny",
    run: (database) => mutationSucceeds(database, "INSERT INTO continuity_personal_snapshots VALUES ('development','H1','M-X-PERSONAL',1,'{}'::jsonb)"),
  },
  {
    testId: "PM-OCT-002-ANON-PERSONAL-INSERT-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.anon, operation: "insert", expected: "deny",
    run: (database) => mutationSucceeds(database, "INSERT INTO continuity_personal_snapshots VALUES ('development','H1','M-ANON',1,'{}'::jsonb)"),
  },
  {
    testId: "PM-OCT-002-SELF-PERSONAL-UPDATE-ALLOW", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.memberB, operation: "update", expected: "allow",
    run: (database) => mutationSucceeds(database, "UPDATE continuity_personal_snapshots SET revision=2 WHERE environment='development' AND household_id='H1' AND member_id='M-B'"),
  },
  {
    testId: "PM-OCT-002-CROSS-MEMBER-PERSONAL-UPDATE-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.memberB, operation: "update", expected: "deny",
    run: (database) => mutationSucceeds(database, "UPDATE continuity_personal_snapshots SET revision=2 WHERE environment='development' AND household_id='H1' AND member_id='M-A'"),
  },
  {
    testId: "PM-OCT-002-ANON-PERSONAL-UPDATE-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.anon, operation: "update", expected: "deny",
    run: (database) => mutationSucceeds(database, "UPDATE continuity_personal_snapshots SET revision=2 WHERE environment='development' AND household_id='H1' AND member_id='M-A'"),
  },
  {
    testId: "PM-OCT-002-REVOKED-PERSONAL-UPDATE-DENY", controlId: "OCT-002-PERSONAL-DENIAL",
    principal: principals.ownerARevoked, operation: "update", expected: "deny",
    run: (database) => mutationSucceeds(database, "UPDATE continuity_personal_snapshots SET revision=2 WHERE environment='development' AND household_id='H1' AND member_id='M-A'"),
  },
  {
    testId: "PM-OCT-003-ANON-SHARED-DENY", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.anon, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-003-MEMBER-SHARED-ALLOW", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.memberB, operation: "select", expected: "allow",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-003-OUTSIDER-SHARED-DENY", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.outsider, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-003-DIRECT-MEMBERSHIP-INSERT-DENY", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.outsider, operation: "insert", expected: "deny",
    run: (database) => mutationSucceeds(database, "INSERT INTO continuity_memberships VALUES ('development','H1','M-X','USER-X','member',true,NULL)"),
  },
  {
    testId: "PM-OCT-003-OUTSIDER-MEMBERSHIP-SELECT-DENY", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.outsider, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT member_id FROM continuity_memberships WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-004-DEVELOPMENT-TO-PRODUCTION-DENY", controlId: "OCT-004-CROSS-ENV-DENIAL",
    principal: principals.ownerA, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='production' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-004-PRODUCTION-TO-DEVELOPMENT-DENY", controlId: "OCT-004-CROSS-ENV-DENIAL",
    principal: principals.ownerAProduction, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-005-NEW-DEVELOPMENT-CREATE-ALLOW", controlId: "OCT-005-CREATE",
    principal: principals.ownerA, operation: "rpc", expected: "allow",
    run: (database) => returnsTrue(database, "SELECT hearth_create_household_test('development','H-NEW') AS allowed"),
  },
  {
    testId: "PM-OCT-005-EXISTING-CREATE-DENY", controlId: "OCT-005-CREATE",
    principal: principals.ownerA, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_create_household_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-005-PRODUCTION-CREATE-SERVER-ALLOW", controlId: "OCT-005-CREATE",
    principal: principals.ownerA, operation: "rpc", expected: "allow",
    run: (database) => returnsTrue(database, "SELECT hearth_create_household_test('production','H-NEW') AS allowed"),
  },
  {
    testId: "PM-OCT-005-HOUSEHOLD-REVOKE-DOES-NOT-REVOKE-AUTH-CREATE", controlId: "OCT-005-CREATE",
    principal: principals.ownerARevoked, operation: "rpc", expected: "allow",
    run: (database) => returnsTrue(database, "SELECT hearth_create_household_test('development','H-REVOKED-CREATOR') AS allowed"),
  },
  {
    testId: "PM-OCT-006-OWNER-INVITE-RPC-ALLOW", controlId: "OCT-006-EMAIL-INVITE",
    principal: principals.ownerA, operation: "rpc", expected: "allow",
    run: (database) => returnsTrue(database, "SELECT hearth_issue_invite_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-006-MEMBER-INVITE-RPC-DENY", controlId: "OCT-006-EMAIL-INVITE",
    principal: principals.memberB, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_issue_invite_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-006-INVITED-EMAIL-SELECT-ALLOW", controlId: "OCT-006-EMAIL-INVITE",
    principal: principals.invitee, operation: "select", expected: "allow",
    run: (database) => hasRows(database, "SELECT id FROM household_invitations WHERE id='INV-H1'"),
  },
  {
    testId: "PM-OCT-007-OTHER-INVITE-SELECT-DENY", controlId: "OCT-007-QR-INVITE",
    principal: principals.outsider, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT id FROM household_invitations WHERE id='INV-H1'"),
  },
  {
    testId: "PM-OCT-008-DIRECT-INVITE-UPDATE-DENY", controlId: "OCT-008-INVITE-REVOKE",
    principal: principals.ownerA, operation: "update", expected: "deny",
    run: (database) => mutationSucceeds(database, "UPDATE household_invitations SET status='revoked' WHERE id='INV-H1'"),
  },
  {
    testId: "PM-OCT-009-NONOWNER-MANAGEMENT-RPC-DENY", controlId: "OCT-009-REMOVE-MEMBER",
    principal: principals.memberB, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_remove_member_test('development','H1','M-A') AS allowed"),
  },
  {
    testId: "PM-OCT-009-OWNER-REMOVE-MEMBER-ALLOW", controlId: "OCT-009-REMOVE-MEMBER",
    principal: principals.ownerA, operation: "rpc", expected: "allow",
    run: (database) => returnsTrue(database, "SELECT hearth_remove_member_test('development','H1','M-B') AS allowed"),
  },
  {
    testId: "PM-OCT-010-REVOKED-SESSION-SELECT-DENY", controlId: "OCT-010-DEVICE-REVOKE",
    principal: principals.ownerARevoked, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-010-REVOKED-SESSION-PUBLISH-DENY", controlId: "OCT-010-DEVICE-REVOKE",
    principal: principals.ownerARevoked, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_publish_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-010-REVOKED-SESSION-INVITE-DENY", controlId: "OCT-010-DEVICE-REVOKE",
    principal: principals.ownerARevoked, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_issue_invite_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-010-REVOKED-SESSION-REMOVE-DENY", controlId: "OCT-010-DEVICE-REVOKE",
    principal: principals.ownerARevoked, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_remove_member_test('development','H1','M-B') AS allowed"),
  },
  {
    testId: "PM-OCT-010-REVOKED-SESSION-LEAVE-DENY", controlId: "OCT-010-DEVICE-REVOKE",
    principal: principals.ownerARevoked, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_leave_household_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-010-REVOKED-SESSION-REALTIME-DENY", controlId: "OCT-010-DEVICE-REVOKE",
    principal: principals.ownerARevoked, operation: "realtime-subscribe", expected: "deny",
    run: (database) => hasRows(database, "SELECT topic FROM realtime_topics WHERE topic='development:H1'"),
  },
  {
    testId: "PM-OCT-011-DIRECT-MEMBERSHIP-UPDATE-DENY", controlId: "OCT-011-LAST-OWNER",
    principal: principals.ownerA, operation: "update", expected: "deny",
    run: (database) => mutationSucceeds(database, "UPDATE continuity_memberships SET active=false WHERE environment='development' AND household_id='H1' AND member_id='M-A'"),
  },
  {
    testId: "PM-OCT-011-LAST-OWNER-LEAVE-DENY", controlId: "OCT-011-LAST-OWNER",
    principal: principals.ownerA, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_leave_household_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-011-MEMBER-LEAVE-ALLOW", controlId: "OCT-011-LAST-OWNER",
    principal: principals.memberB, operation: "rpc", expected: "allow",
    run: (database) => returnsTrue(database, "SELECT hearth_leave_household_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-012-ACTIVE-PUBLISH-RPC-ALLOW", controlId: "OCT-012-ATOMIC-COMMAND-CAS",
    principal: principals.ownerA, operation: "rpc", expected: "allow",
    run: (database) => returnsTrue(database, "SELECT hearth_publish_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-012-OUTSIDER-PUBLISH-RPC-DENY", controlId: "OCT-012-ATOMIC-COMMAND-CAS",
    principal: principals.outsider, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_publish_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-012-DIRECT-SNAPSHOT-INSERT-DENY", controlId: "OCT-012-ATOMIC-COMMAND-CAS",
    principal: principals.ownerA, operation: "insert", expected: "deny",
    run: (database) => mutationSucceeds(database, "INSERT INTO household_snapshots VALUES ('development','H3',1,'{}'::jsonb)"),
  },
  {
    testId: "PM-OCT-012-DIRECT-SNAPSHOT-UPDATE-DENY", controlId: "OCT-012-ATOMIC-COMMAND-CAS",
    principal: principals.ownerA, operation: "update", expected: "deny",
    run: (database) => mutationSucceeds(database, "UPDATE household_snapshots SET revision=2 WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-003-CROSS-HOUSEHOLD-DENY", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.ownerC, operation: "select", expected: "deny",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='development' AND household_id='H1'"),
  },
  {
    testId: "PM-OCT-003-OWN-HOUSEHOLD-ALLOW", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.ownerC, operation: "select", expected: "allow",
    run: (database) => hasRows(database, "SELECT household_id FROM household_snapshots WHERE environment='development' AND household_id='H2'"),
  },
  {
    testId: "PM-OCT-003-ANON-RPC-DENY", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.anon, operation: "rpc", expected: "deny",
    run: (database) => returnsTrue(database, "SELECT hearth_publish_test('development','H1') AS allowed"),
  },
  {
    testId: "PM-OCT-003-ACTIVE-REALTIME-ALLOW", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.memberB, operation: "realtime-subscribe", expected: "allow",
    run: (database) => hasRows(database, "SELECT topic FROM realtime_topics WHERE topic='development:H1'"),
  },
  {
    testId: "PM-OCT-003-CROSS-HOUSEHOLD-REALTIME-DENY", controlId: "OCT-003-MEMBERSHIP-DENIAL",
    principal: principals.ownerC, operation: "realtime-subscribe", expected: "deny",
    run: (database) => hasRows(database, "SELECT topic FROM realtime_topics WHERE topic='development:H1'"),
  },
];

async function evaluateCase(database: PGlite, row: PermissionCase): Promise<boolean> {
  await assumePrincipal(database, row.principal);
  return row.run(database);
}

async function failedTestIds(database: PGlite, cases: PermissionCase[]): Promise<string[]> {
  const failures: string[] = [];
  for (const row of cases) {
    const allowed = await evaluateCase(database, row);
    if (allowed !== (row.expected === "allow")) failures.push(row.testId);
  }
  return failures;
}

function assertMatrixPassed(failures: string[]): void {
  if (failures.length > 0) {
    throw new Error(`Permission matrix failed: ${failures.join(", ")}`);
  }
}

function markdownRows(source: string): string[][] {
  return source.split("\n")
    .filter((line) => /^\| OCT-\d{3}-/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function proofFilesFromCell(cell: string): string[] {
  return [...cell.matchAll(/`((?:test|\.github)\/[^`]+|wrangler\.jsonc)`/g)]
    .map((match) => match[1]!)
    .sort();
}

function expectContractFragment(testId: string, source: string, fragment: string): void {
  expect(source.includes(fragment), testId).toBe(true);
}

let database: PGlite;

beforeAll(async () => {
  database = await openHarness();
});

afterAll(async () => {
  await database.close();
});

describe("Readiness 3 repository authorization contract parity", () => {
  it("models the applied 008 then 006 policy order instead of reviving the temporary Production bridge", () => {
    const bridgeApplied = contractSources.cutoverStatus.indexOf("3. ~~Apply 008~~");
    const cutoverApplied = contractSources.cutoverStatus.indexOf("4. ~~Apply 006~~");
    expect(bridgeApplied >= 0 && cutoverApplied > bridgeApplied, "PM-CONTRACT-APPLY-ORDER-008-006").toBe(true);
    expect(/DROP POLICY IF EXISTS %I ON public\.%I/.test(contractSources.cutover), "PM-CONTRACT-006-DROPS-OLDER-POLICIES").toBe(true);
    expectContractFragment(
      "PM-CONTRACT-008-WAS-PERMISSIVE-BRIDGE",
      contractSources.productionBridge,
      "FOR SELECT TO anon, authenticated\n  USING (environment = 'production')",
    );
    expect(fixtureSource.includes("continuity_production_select"), "PM-CONTRACT-FIXTURE-NO-STALE-008-POLICY").toBe(false);
  });

  it("tracks 006 table grants, Personal read/write policies, and bounded Create environments", () => {
    for (const fragment of [
      "CREATE POLICY hearth_personal_select",
      "CREATE POLICY hearth_personal_insert",
      "CREATE POLICY hearth_personal_update",
      "GRANT SELECT, INSERT, UPDATE ON TABLE public.continuity_personal_snapshots TO authenticated",
      "FROM anon, authenticated",
      "p_environment NOT IN ('development', 'production')",
    ]) {
      expectContractFragment("PM-CONTRACT-006-RLS-CREATE", contractSources.cutover, fragment);
    }
    expectContractFragment("PM-CONTRACT-CLIENT-PRODUCTION-GATE", contractSources.continuityPolicy, "VITE_PRODUCTION_CONTINUITY");
    expectContractFragment("PM-CONTRACT-CLIENT-CREATE-RPC", contractSources.transport, 'rest(config, "rpc/hearth_create_household"');
  });

  it("tracks session-gated membership helpers and every modeled lifecycle RPC", () => {
    for (const fragment of [
      "SELECT hearth_private.session_is_live()",
      "registered.session_id = hearth_private.current_session_id()",
      "registered.revoked_at IS NULL",
      "CREATE OR REPLACE FUNCTION public.hearth_issue_invite(",
      "CREATE OR REPLACE FUNCTION public.hearth_revoke_member(",
      "CREATE OR REPLACE FUNCTION public.hearth_leave_household(",
      "GRANT EXECUTE ON FUNCTION public.hearth_revoke_member(text, text, text) TO authenticated",
    ]) {
      expectContractFragment("PM-CONTRACT-017-SESSION-LIFECYCLE", contractSources.sessions, fragment);
    }
    const createDecision = contractSources.lifecycle.indexOf('input.action === "create-household"');
    const deviceDecision = contractSources.lifecycle.indexOf("actorDeviceDenial(input, actor)");
    expect(createDecision >= 0 && deviceDecision > createDecision, "PM-CONTRACT-CREATE-OUTSIDE-HOUSEHOLD-DEVICE-SCOPE").toBe(true);
  });

  it("tracks atomic publish, command, Realtime publication, and QR session guards", () => {
    expectContractFragment("PM-CONTRACT-012-ACTIVE-MEMBER", contractSources.atomicPublish, "IF NOT hearth_private.is_active_member(p_household_id, p_environment) THEN");
    expectContractFragment("PM-CONTRACT-013-DEVELOPMENT-ONLY", contractSources.commandEvents, "p_environment IS DISTINCT FROM 'development'");
    expectContractFragment("PM-CONTRACT-013-ACTIVE-MEMBER", contractSources.commandEvents, "hearth_private.is_active_member(household_id, environment)");
    for (const table of ["household_snapshots", "continuity_personal_snapshots", "continuity_command_events"]) {
      expectContractFragment(`PM-CONTRACT-014-PUBLICATION-${table}`, contractSources.realtime, table);
    }
    expectContractFragment("PM-CONTRACT-018-LIVE-SESSION", contractSources.qrInvite, "caller IS NULL OR NOT hearth_private.session_is_live()");
    expectContractFragment("PM-CONTRACT-018-AUTHENTICATED-ONLY", contractSources.qrInvite, "TO authenticated");
  });
});

describe("Readiness 3 permission manifest", () => {
  it("maps every automated October control one-to-one without duplicate IDs", () => {
    const rows = markdownRows(matrixSource);
    const matrixIds = rows.map((row) => row[0]!);
    const manifestIds = manifest.controls.map((row) => row.controlId);
    const testIds = manifest.controls.map((row) => row.testId);

    expect(manifest.version).toBe(1);
    expect(new Set(matrixIds).size).toBe(matrixIds.length);
    expect(new Set(manifestIds).size).toBe(manifestIds.length);
    expect(new Set(testIds).size).toBe(testIds.length);
    expect(manifestIds.sort()).toEqual(matrixIds.sort());
  });

  it("keeps each manifest proof path equal to the matrix and present in the repository", () => {
    const rows = markdownRows(matrixSource);
    for (const control of manifest.controls) {
      const matrixRow = rows.find((row) => row[0] === control.controlId);
      expect(matrixRow, control.testId).toBeDefined();
      expect([...control.proofFiles].sort(), control.testId).toEqual(proofFilesFromCell(matrixRow![4]!));
      for (const path of control.proofFiles) expect(existsSync(path), control.testId).toBe(true);
    }
  });

  it("binds every declared permission case to one existing unique matrix case", () => {
    const caseIds = permissionCases.map((row) => row.testId);
    expect(new Set(caseIds).size).toBe(caseIds.length);
    const indexed = new Map(permissionCases.map((row) => [row.testId, row]));
    for (const control of manifest.controls) {
      for (const testId of control.permissionCaseIds ?? []) {
        expect(indexed.get(testId)?.controlId, control.testId).toBe(control.controlId);
      }
    }
    expect(new Set(manifest.controls.flatMap((row) => row.permissionCaseIds ?? []))).toEqual(new Set(caseIds));
  });
});

describe("Readiness 3 synthetic PostgreSQL authorization matrix", () => {
  it("covers select, insert, update, RPC, and realtime subscription admission", () => {
    expect(new Set(permissionCases.map((row) => row.operation))).toEqual(new Set([
      "select", "insert", "update", "rpc", "realtime-subscribe",
    ]));
  });

  it("passes the complete A/B/C, H1/H2, environment, anon, and revoked-session matrix", async () => {
    assertMatrixPassed(await failedTestIds(database, permissionCases));
  }, 30_000);

  it("proves the gate catches an isolated deliberately weakened shared-select policy", async () => {
    const weakened = await openHarness(true);
    const target = permissionCases.find((row) => row.testId === "PM-OCT-003-OUTSIDER-SHARED-DENY")!;
    try {
      const failures = await failedTestIds(weakened, [target]);
      expect(() => assertMatrixPassed(failures)).toThrow(target.testId);
    } finally {
      await weakened.close();
    }
  }, 30_000);

  it("keeps failure output to control/test IDs without fixture payloads or credentials", () => {
    expect(() => assertMatrixPassed(["PM-OCT-003-OUTSIDER-SHARED-DENY"]))
      .toThrow("Permission matrix failed: PM-OCT-003-OUTSIDER-SHARED-DENY");
    const publicArtifacts = `${fixtureSource}\n${readFileSync("test/permission-matrix.manifest.json", "utf8")}`;
    expect(publicArtifacts).not.toMatch(/console\.(?:log|warn|error)|service[_-]?role|SUPABASE_SERVICE_ROLE/i);
  });
});
