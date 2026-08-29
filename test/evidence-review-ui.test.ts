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
    derivatives: [],
    observations: [{ observationId: "obs-1", canonicalShiftKey: "shift-1", field: "workedMinutes", value: 361, unit: "minutes", sourceLocation: "timesheet.hours", confidenceBps: 10_000, finality: "final", extractionMethod: "structured", conflictState: "clear", createdAt: "2026-08-29T01:18:34.956Z" }],
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
});
