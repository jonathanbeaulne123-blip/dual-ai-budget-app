/**
 * Live Development anon denial matrix (D-123 / D-143).
 * Runs only when VITE_SUPABASE_LIVE=1 — hits the real project with the publishable key.
 */
import { describe, expect, it } from "vitest";

const live = String(import.meta.env.VITE_SUPABASE_LIVE || "") === "1";
const URL = "https://tykhocwacaxwquhynkok.supabase.co";
const KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";

async function rest(path: string, init?: RequestInit): Promise<{ status: number; body: string }> {
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return { status: response.status, body: await response.text() };
}

describe.skipIf(!live)("live Development anon denial (VITE_SUPABASE_LIVE=1)", () => {
  it("denies anon SELECT on households and snapshots", async () => {
    const households = await rest("households?select=id&limit=1");
    expect(households.status).toBe(401);
    expect(households.body).toMatch(/permission denied/i);

    const snapshots = await rest("household_snapshots?select=household_id&limit=1");
    expect(snapshots.status).toBe(401);
    expect(snapshots.body).toMatch(/permission denied/i);
  });

  it("denies anon EXECUTE on Auth membership RPCs (proves functions exist)", async () => {
    const bind = await rest("rpc/hearth_bind_google_memberships", {
      method: "POST",
      body: JSON.stringify({ p_environment: "development" }),
    });
    expect(bind.status).toBe(401);
    expect(bind.body).toMatch(/permission denied for function hearth_bind_google_memberships/);

    const create = await rest("rpc/hearth_create_household", {
      method: "POST",
      body: JSON.stringify({
        p_household_id: "HH-probe",
        p_name: "x",
        p_timezone: "America/Toronto",
        p_currency: "CAD",
        p_environment: "development",
        p_invite_phrase: "a-b-c",
        p_linked: false,
        p_revision: 1,
        p_last_committed_at: null,
        p_payload: "{}",
        p_snapshot_hash: "x",
        p_member_id: "MEM-001",
        p_display_name: "x",
      }),
    });
    expect(create.status).toBe(401);
    expect(create.body).toMatch(/permission denied for function hearth_create_household/);

    const issue = await rest("rpc/hearth_issue_invite", {
      method: "POST",
      body: JSON.stringify({
        p_environment: "development",
        p_household_id: "HH-probe",
        p_member_id: "MEM-002",
        p_kind: "qr",
        p_invited_email: null,
        p_ttl_hours: 1,
      }),
    });
    expect(issue.status).toBe(401);
    expect(issue.body).toMatch(/permission denied for function hearth_issue_invite/);
  });
});
