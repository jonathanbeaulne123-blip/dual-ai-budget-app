/**
 * Live smoke for publish_household_snapshot (D-122) on disposable Development data.
 * Uses the bundled publishable key — no DB password. Safe only while Development
 * RLS remains open through 2026-09-30.
 *
 * Usage: pnpm books:smoke:cas
 */
const DEFAULT_URL = "https://tykhocwacaxwquhynkok.supabase.co";
const DEFAULT_KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";

const url = String(process.env.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, "");
const key = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY);
const stamp = Date.now().toString(36);
const householdId = `HH-cas-smoke-${stamp}`;
const invite = `cas-smoke-${stamp}`;
const payload = JSON.stringify({
  householdId,
  name: "CAS smoke (disposable)",
  environment: "development",
  timezone: "America/Toronto",
  currency: "CAD",
  inviteCode: invite,
  linked: true,
  revision: 1,
  baseRevision: 0,
  lastCommittedAt: new Date().toISOString(),
  members: [],
  transactions: [],
  smoke: true,
});

async function rpc(body) {
  const response = await fetch(`${url}/rest/v1/rpc/publish_household_snapshot`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

function baseArgs(overrides = {}) {
  return {
    p_household_id: householdId,
    p_expected_revision: 0,
    p_name: "CAS smoke (disposable)",
    p_timezone: "America/Toronto",
    p_currency: "CAD",
    p_environment: "development",
    p_invite_phrase: invite,
    p_linked: true,
    p_revision: 1,
    p_last_committed_at: new Date().toISOString(),
    p_payload: payload,
    p_snapshot_hash: `hash-smoke-${stamp}-v1`,
    ...overrides,
  };
}

const results = [];

function record(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`, typeof detail === "string" ? detail : JSON.stringify(detail));
}

// 1. First publish (create)
{
  const first = await rpc(baseArgs());
  const ok = first.status === 200 && first.body?.ok === true && first.body?.duplicate !== true;
  record("first publish creates revision 1", ok, first.body);
  if (!ok) {
    console.error("Aborting smoke — RPC missing or first publish failed. Apply 002 first.");
    process.exit(1);
  }
}

// 2. Idempotent duplicate
{
  const dup = await rpc(baseArgs());
  const ok = dup.status === 200 && dup.body?.ok === true && dup.body?.duplicate === true;
  record("duplicate delivery acknowledges", ok, dup.body);
}

// 3. Stale writer refused
{
  const stale = await rpc(baseArgs({
    p_expected_revision: 0,
    p_revision: 2,
    p_snapshot_hash: `hash-smoke-${stamp}-stale`,
    p_payload: payload.replace('"revision":1', '"revision":2'),
  }));
  const ok = stale.status === 200
    && stale.body?.ok === false
    && stale.body?.conflict === true
    && stale.body?.reason === "stale-revision";
  record("stale expected_revision conflicts", ok, stale.body);
}

// 4. Monotonic advance
{
  const next = await rpc(baseArgs({
    p_expected_revision: 1,
    p_revision: 2,
    p_snapshot_hash: `hash-smoke-${stamp}-v2`,
    p_payload: payload.replace('"revision":1', '"revision":2'),
  }));
  const ok = next.status === 200 && next.body?.ok === true && next.body?.revision === 2;
  record("advance 1 → 2 succeeds", ok, next.body);
}

const failed = results.filter((row) => !row.ok);
console.log(`\nCAS smoke household: ${householdId} (disposable Development)`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
