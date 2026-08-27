// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  list: vi.fn(),
  pull: vi.fn(),
}));

vi.mock("../src/imports/sevenShiftsClient.ts", () => ({
  listSevenShiftsConnections: client.list,
  pullSevenShiftsPunches: client.pull,
}));

import { WorkShiftWithSevenShifts } from "../src/WorkShiftWithSevenShifts.tsx";
import {
  catalogHousehold,
  shapeWorkJob,
  upsertWorkJob,
  type Household,
  type SevenShiftsInboxPayload,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CONNECTION_ID = `s7c_${"a".repeat(32)}`;
const PUNCH_ID = `s7punch_${"b".repeat(64)}`;
const PULL_ID = `s7pull_${"c".repeat(64)}`;

let root: Root;
let container: HTMLDivElement;

async function settleUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
    if (predicate()) return;
  }
  throw new Error(container.textContent || "UI did not settle.");
}

function household(householdId: string, memberId: string): Household {
  const base = { ...catalogHousehold("development"), householdId };
  const job = shapeWorkJob({
    id: "JOB-SHARED",
    memberId,
    name: "Harbour",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [{
        id: "RATE-1",
        effectiveDate: "2026-01-01",
        grossHourlyRateCents: 1800,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 1500,
        deductions: [],
        createdAt: "",
        updatedAt: "",
      }],
      createdAt: "",
      updatedAt: "",
    }],
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
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CASH",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
  return upsertWorkJob(base, { job }).household;
}

function payload(jobId = "JOB-SHARED"): SevenShiftsInboxPayload {
  return {
    provider: "7shifts",
    sourceName: "Harbour",
    sourceHash: PULL_ID,
    jobId,
    punches: [{
      stablePunchId: PUNCH_ID,
      date: "2026-08-26",
      startedAt: "2026-08-26T15:12:00.000Z",
      endedAt: "2026-08-26T20:47:00.000Z",
      workedHours: 5.08,
      paidBreakHours: 0.5,
      roleName: "Server",
      locationName: "Harbour",
      open: false,
      tipsOmitted: true,
    }],
    coworkers: [],
  };
}

function renderTimesheet(nextHousehold: Household, memberId: string, onConfirm = vi.fn()) {
  root.render(createElement(WorkShiftWithSevenShifts, {
    household: nextHousehold,
    memberId,
    today: "2026-08-27",
    punch: null,
    busy: false,
    onConfirm,
  }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client.list.mockResolvedValue([{ connectionId: CONNECTION_ID }]);
  client.pull.mockResolvedValue({ connectionId: CONNECTION_ID, payload: payload() });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("7shifts Timesheet scope boundary", () => {
  it("drops a filled draft when the ledger or active member changes, even with colliding job ids", async () => {
    const onConfirm = vi.fn();
    const first = household("HH-ONE", "MEM-001");
    const second = household("HH-TWO", "MEM-002");
    expect(first.workJobs[0]?.id).toBe(second.workJobs[0]?.id);
    client.pull.mockResolvedValue({ connectionId: CONNECTION_ID, payload: payload(first.workJobs[0]!.id) });
    act(() => renderTimesheet(first, "MEM-001", onConfirm));
    await settleUntil(() => /Fill from 7shifts/.test(container.textContent || ""));
    act(() => (Array.from(container.querySelectorAll("button")).find((button) => /Fill from 7shifts/.test(button.textContent || "")) as HTMLButtonElement).click());
    await settleUntil(() => /7shifts draft/.test(container.textContent || ""));
    expect(container.textContent).toMatch(/5\.08 h/);

    act(() => renderTimesheet(second, "MEM-002", onConfirm));
    await settleUntil(() => /Already off/.test(container.textContent || ""));
    expect(container.textContent).not.toMatch(/7shifts draft|5\.08 h/);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("aborts and ignores a pull that completes after its scope was replaced", async () => {
    let oldSignal: AbortSignal | undefined;
    let finishOldPull: ((value: { connectionId: string; payload: SevenShiftsInboxPayload }) => void) | undefined;
    client.pull.mockImplementation((_scope, _connectionId, signal) => {
      oldSignal = signal;
      return new Promise((resolve) => { finishOldPull = resolve; });
    });
    act(() => renderTimesheet(household("HH-ONE", "MEM-001"), "MEM-001"));
    await settleUntil(() => /Fill from 7shifts/.test(container.textContent || ""));
    act(() => (Array.from(container.querySelectorAll("button")).find((button) => /Fill from 7shifts/.test(button.textContent || "")) as HTMLButtonElement).click());
    await settleUntil(() => Boolean(oldSignal));

    act(() => renderTimesheet(household("HH-TWO", "MEM-002"), "MEM-002"));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => finishOldPull?.({ connectionId: CONNECTION_ID, payload: payload() }));
    await settleUntil(() => /Already off/.test(container.textContent || ""));
    expect(container.textContent).not.toMatch(/7shifts draft|5\.08 h/);
  });
});
