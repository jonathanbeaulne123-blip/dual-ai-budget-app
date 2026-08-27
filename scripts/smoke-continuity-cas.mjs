/**
 * Live smoke for publish_continuity_snapshot (Migration 012) on disposable Development data.
 *
 * Requires a signed-in JWT — anon/publishable key alone cannot pass auth.uid().
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<jwt> pnpm books:smoke:012
 *
 * Optional:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
const DEFAULT_URL = "https://tykhocwacaxwquhynkok.supabase.co";
const DEFAULT_KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";

const url = String(process.env.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, "");
const key = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY);
const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || process.env.VITE_SUPABASE_ACCESS_TOKEN || "").trim();

if (!accessToken) {
  console.log("SKIP  books:smoke:012 — set SUPABASE_ACCESS_TOKEN to a signed-in Development JWT.");
  console.log("      In-memory proof lives in test/continuity-cas-harness.test.ts and T1-S5 harness.");
  process.exit(0);
}

const stamp = Date.now().toString(36);
const householdId = `HH-012-smoke-${stamp}`;
const invite = `012-smoke-${stamp}`;
const memberId = "MEM-SMOKE-001";

const sharedPayload = JSON.stringify({
  householdId,
  name: "012 smoke (disposable)",
  environment: "development",
  timezone: "America/Toronto",
  currency: "CAD",
  inviteCode: invite,
  linked: true,
  revision: 1,
  baseRevision: 0,
  lastCommittedAt: new Date().toISOString(),
  members: [{ id: memberId, name: "Smoke", active: true }],
  transactions: [],
  smoke: true,
});

const personalPayload = JSON.stringify({
  kind: "personal",
  memberId,
  transactions: [],
  shifts: [],
  goals: [],
  goalContributions: [],
  goalPurchases: [],
});

async function rpc(name, body) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

function baseContinuityArgs(overrides = {}) {
  return {
    p_household_id: householdId,
    p_expected_revision: 0,
    p_name: "012 smoke (disposable)",
    p_timezone: "America/Toronto",
    p_currency: "CAD",
    p_environment: "development",
    p_invite_phrase: invite,
    p_linked: true,
    p_revision: 1,
    p_last_committed_at: new Date().toISOString(),
    p_payload: sharedPayload,
    p_snapshot_hash: `hash-012-smoke-${stamp}-v1`,
    p_member_id: memberId,
    p_personal_payload: personalPayload,
    ...overrides,
  };
}

const results = [];

function record(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`, typeof detail === "string" ? detail : JSON.stringify(detail));
}

// 1. Create household (006)
{
  const created = await rpc("hearth_create_household", {
    p_household_id: householdId,
    p_name: "012 smoke (disposable)",
    p_timezone: "America/Toronto",
    p_currency: "CAD",
    p_environment: "development",
    p_invite_phrase: invite,
    p_linked: true,
    p_revision: 1,
    p_last_committed_at: new Date().toISOString(),
    p_payload: sharedPayload,
    p_snapshot_hash: `hash-012-smoke-${stamp}-v1`,
    p_member_id: memberId,
    p_display_name: "Smoke",
  });
  const ok = created.status === 200 && created.body?.ok === true;
  record("hearth_create_household seeds revision 1", ok, created.body);
  if (!ok) {
    console.error("Aborting — create failed. Apply 006/012 and sign in as an active member.");
    process.exit(1);
  }
}

// 2. Atomic continuity publish (012) — idempotent duplicate after create
{
  const dup = await rpc("publish_continuity_snapshot", baseContinuityArgs({ p_expected_revision: 1 }));
  const ok = dup.status === 200 && dup.body?.ok === true;
  record("publish_continuity_snapshot acknowledges duplicate personal+shared", ok, dup.body);
}

// 3. Stale writer refused
{
  const stale = await rpc("publish_continuity_snapshot", baseContinuityArgs({
    p_expected_revision: 0,
    p_revision: 2,
    p_snapshot_hash: `hash-012-smoke-${stamp}-stale`,
    p_payload: sharedPayload.replace('"revision":1', '"revision":2'),
  }));
  const ok = stale.status === 200
    && stale.body?.ok === false
    && stale.body?.conflict === true
    && stale.body?.reason === "stale-revision";
  record("stale expected_revision conflicts", ok, stale.body);
}

// 4. Monotonic advance
{
  const nextPayload = sharedPayload.replace('"revision":1', '"revision":2');
  const nextPersonal = personalPayload;
  const next = await rpc("publish_continuity_snapshot", baseContinuityArgs({
    p_expected_revision: 1,
    p_revision: 2,
    p_snapshot_hash: `hash-012-smoke-${stamp}-v2`,
    p_payload: nextPayload,
    p_personal_payload: nextPersonal,
  }));
  const ok = next.status === 200 && next.body?.ok === true && next.body?.revision === 2;
  record("advance 1 → 2 succeeds atomically", ok, next.body);
}

const failed = results.filter((row) => !row.ok);
console.log(`\n012 smoke household: ${householdId} (disposable Development)`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
