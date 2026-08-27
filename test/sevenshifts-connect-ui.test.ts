// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/auth/supabaseSession.ts", () => ({
  ensureSupabaseSession: vi.fn(async () => ({
    accessToken: "signed-user-jwt", refreshToken: "refresh", userId: "auth-user", email: "member@example.com",
    googleSubject: "google", displayName: "Member", expiresAt: Date.now() + 60_000,
  })),
}));

import { SevenShiftsConnectPanel } from "../src/SevenShiftsConnectPanel.tsx";
import type { WorkJob } from "../src/core/types.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

async function settleUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
    if (predicate()) return;
  }
  throw new Error(container.textContent || "UI did not settle.");
}

const job = {
  id: "JOB-HARBOUR",
  memberId: "MEM-001",
  name: "Harbour",
  color: "#a85a3d",
  active: true,
  timezone: "America/Toronto",
  locationName: "",
  gpsEnabled: false,
  roles: [{ id: "ROLE-SERVER", name: "Server", tipped: true, active: true, rates: [], createdAt: "", updatedAt: "" }],
  paidBreakRate: "role",
  paidBreakHourlyRateCents: 0,
  overtimeEnabled: false,
  overtimeWeeklyThresholdHours: 44,
  overtimeMultiplier: 1.5,
  tipOutRules: [],
  salesFields: [],
  paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
  tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
  tipWeekStartsOn: 1,
  defaults: {
    wagesVisibility: "personal",
    cashTipsVisibility: "personal",
    cardTipsVisibility: "personal",
    tipOutVisibility: "personal",
    wagesDepositAccountId: "",
    cashTipsAccountId: "",
    cardTipsDepositAccountId: "",
  },
  wagesReceivableAccountId: "",
  cardTipsReceivableAccountId: "",
  note: "",
  createdAt: "",
  updatedAt: "",
} as WorkJob;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("7shifts Connect panel", () => {
  it("keeps the access token in the form only and shows a co-workers tab without posting", async () => {
    const onPulled = vi.fn();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/work/7shifts/status") {
        return new Response(JSON.stringify({
          ok: true, available: true, phase: "sandbox-configured", environment: "development-only",
          providerCallsEnabled: true, productionAllowed: false, detail: "Configured",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (path.startsWith("/work/7shifts/connections?")) {
        return new Response(JSON.stringify({ ok: true, connections: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`Unexpected ${path}`);
    });
    vi.stubGlobal("fetch", fetcher);
    act(() => root.render(createElement(SevenShiftsConnectPanel, {
      environment: "development",
      householdId: "HH-TEST",
      memberId: "MEM-001",
      jobs: [job],
      disabled: false,
      onPulled,
    })));
    await settleUntil(() => /access token/i.test(container.textContent || ""));
    const password = container.querySelector("input[type='password']") as HTMLInputElement;
    expect(password).toBeTruthy();
    act(() => {
      password.value = "seven-shifts-access-token-harbour-dev-0001";
      password.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onPulled).not.toHaveBeenCalled();
    act(() => (container.querySelectorAll("button")[1] as HTMLButtonElement).click());
    await settleUntil(() => /Co-workers/i.test(container.textContent || ""));
    expect(container.textContent).toMatch(/not household members/i);
    expect(container.textContent).toMatch(/Tips are not in 7shifts/i);
  });
});
