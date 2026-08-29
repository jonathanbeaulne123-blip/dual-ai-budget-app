// @vitest-environment jsdom
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold } from "../src/core/index.ts";
import { SevenShiftsEvidenceCenter } from "../src/SevenShiftsEvidenceCenter.tsx";

const captures = Array.from({ length: 100 }, (_, index) => ({
  evidenceId: `evi_${String(index).padStart(24, "0")}`,
  captureKind: "browser-structured",
  state: "ready_to_review",
  contentType: "application/json",
  byteLength: 978,
  revision: 1,
  capturedAt: "2026-08-29T01:18:31.947Z",
}));

vi.mock("../src/imports/evidenceClient.ts", () => ({
  readEvidenceStatus: vi.fn(async () => ({ ok: true, available: true, environment: "development-only", productionAllowed: false, environments: { development: { available: true } } })),
  listEvidence: vi.fn(async () => captures),
  listEvidenceBundles: vi.fn(async () => []),
  listEvidenceAutomationPolicies: vi.fn(async () => []),
  readEvidenceDerived: vi.fn(async (_scope, evidenceId) => ({
    evidenceId,
    revision: 1,
    state: "ready_to_review",
    parserVersion: "hearth-s7-extract-v2",
    schemaFingerprint: "fixture",
    derivatives: [{
      canonicalShiftKey: "shift-1", parserVersion: "hearth-s7-extract-v2", schemaFingerprint: "fixture",
      facts: { version: 1, mappingState: "mapped", bundleFacts: {
        canonicalShiftKey: "shift-1", providerSubjectKey: "s7subject_abcdefghijklmnopqrstuvwxyz",
        providerResourceKind: "worked-shift", jobId: "JOB-HARBOUR",
        startedAt: "2026-08-15T20:30:00.000Z", endedAt: "2026-08-16T02:31:00.000Z",
        workedMinutes: 361, paidBreakMinutes: null, finality: "final",
      } }, createdAt: "2026-08-29T01:18:34.956Z",
    }],
    observations: [
      ["approved", true, "boolean"],
      ["date", "2026-08-15", "date"],
      ["startedAt", "2026-08-15T20:30:00.000Z", "iso-time"],
      ["endedAt", "2026-08-16T02:31:00.000Z", "iso-time"],
      ["workedMinutes", 361, "minutes"],
    ].map(([field, value, unit], index) => ({ observationId: `obs-${index}`, canonicalShiftKey: "shift-1", field, value, unit, sourceLocation: `timesheet.${field}`, confidenceBps: 10_000, finality: "final", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-29T01:18:34.956Z" })),
    schemaDrift: [],
  })),
  deleteEvidence: vi.fn(),
  putEvidenceAutomationPolicy: vi.fn(),
  mintEvidenceCaptureCapability: vi.fn(),
  readEvidenceRaw: vi.fn(),
  readSevenShiftsCalendarEvidence: vi.fn(),
  uploadEvidence: vi.fn(),
}));

describe("Evidence derived review placement", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens and focuses extracted facts above a long capture history", async () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    await act(async () => {
      root.render(createElement(SevenShiftsEvidenceCenter, {
        household, memberId: "MEM-001", memberName: "Bianca", today: "2026-08-28", busy: false,
        onSaveSchedule: () => {},
      }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const review = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Review facts");
    expect(review).toBeTruthy();
    await act(async () => {
      review!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const panel = container.querySelector<HTMLElement>('[aria-label="Extracted evidence facts"]');
    const firstCapture = container.querySelector<HTMLElement>(".work-shift-history-row");
    expect(panel?.textContent).toContain("worked minutes");
    expect(document.activeElement).toBe(panel);
    expect(panel && firstCapture && Boolean(panel.compareDocumentPosition(firstCapture) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("offers an approved punch as a Shift draft without posting it", async () => {
    const household = seedDemoHousehold({ today: "2026-08-28", environment: "development" });
    household.workJobs = [{
      id: "JOB-HARBOUR", memberId: "MEM-001", name: "Harbour", color: "#a85a3d", active: true,
      timezone: "America/Toronto", locationName: "Toronto", gpsEnabled: false,
      roles: [{ id: "ROLE-SERVER", name: "Server", tipped: true, active: true, rates: [], createdAt: "", updatedAt: "" }],
      paidBreakRate: "role", paidBreakHourlyRateCents: 0, overtimeEnabled: false, overtimeWeeklyThresholdHours: 44, overtimeMultiplier: 1.5,
      tipOutRules: [], salesFields: [],
      paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
      tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
      tipWeekStartsOn: 1,
      defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "", cashTipsAccountId: "", cardTipsDepositAccountId: "" },
      wagesReceivableAccountId: "", cardTipsReceivableAccountId: "", note: "", createdAt: "", updatedAt: "",
    }];
    const used: unknown[] = [];
    await act(async () => {
      root.render(createElement(SevenShiftsEvidenceCenter, {
        household, memberId: "MEM-001", memberName: "Bianca", today: "2026-08-28", busy: false,
        onSaveSchedule: () => {},
        onUseShiftDraft: (candidate: unknown) => used.push(candidate),
      }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const review = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Review facts")!;
    await act(async () => {
      review.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const use = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Use as Shift draft")!;
    expect(use).toBeTruthy();
    expect(container.textContent).toContain("paid break missing");
    act(() => use.click());
    expect(used).toHaveLength(1);
    expect(used[0]).toMatchObject({ missingPaidBreak: true, draft: { workedHours: 6.02 } });
  });
});
