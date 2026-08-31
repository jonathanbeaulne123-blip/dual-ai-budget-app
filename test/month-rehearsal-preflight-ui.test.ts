// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonthRehearsalPanel } from "../src/MonthRehearsalPanel.tsx";
import { catalogHousehold, makeHouseholdExport, type Household } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function emptyDevelopment(): Household {
  const household = catalogHousehold("development");
  household.transactions = [];
  household.shifts = [];
  household.commandReceipts = [];
  household.activity = [];
  return household;
}

async function settleUntil(predicate: () => boolean, message: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 2)));
    if (predicate()) return;
  }
  throw new Error(`${message}\n${container.textContent}`);
}

function startButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Start our month");
  if (!button) throw new Error("Missing Start our month button");
  return button;
}

function downloadButton(): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes("Download private backup"));
  if (!button) throw new Error("Missing private-backup download button");
  return button;
}

async function chooseBackup(raw: string) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Missing recovery file input");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [{ name: "hearth-development-rehearsal-backup.json", text: async () => raw }],
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:rehearsal-backup") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("founding-household preflight UI", () => {
  it("enables Start only after exact recovery and every acknowledgement, then invalidates on revision change", async () => {
    const household = emptyDevelopment();
    const file = await makeHouseholdExport(household);
    await act(async () => root.render(createElement(MonthRehearsalPanel, {
      household,
      memberId: "MEM-001",
      today: "2026-08-31",
      onApply: () => undefined,
    })));

    expect(startButton().disabled).toBe(true);
    const selects = [...container.querySelectorAll("select")];
    await act(async () => {
      selects[0]!.value = "MEM-001";
      selects[0]!.dispatchEvent(new Event("change", { bubbles: true }));
      selects[1]!.value = "MEM-002";
      selects[1]!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await chooseBackup(JSON.stringify(file));
    await settleUntil(() => container.textContent?.includes("Recovery check passed") === true, "Recovery did not pass");
    expect(startButton().disabled).toBe(true);

    for (const checkbox of container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      await act(async () => checkbox.click());
    }
    expect(startButton().disabled).toBe(true);

    await act(async () => downloadButton().click());
    await settleUntil(() => container.textContent?.includes("Backup downloaded") === true, "Download was not announced");
    expect(startButton().disabled).toBe(true);
    await chooseBackup(JSON.stringify(file));
    await settleUntil(() => container.textContent?.includes("Recovery check passed") === true, "Fresh recovery did not pass");
    await settleUntil(() => !startButton().disabled, "Start did not unlock");

    const changed = { ...household, revision: household.revision + 1 };
    await act(async () => root.render(createElement(MonthRehearsalPanel, {
      household: changed,
      memberId: "MEM-001",
      today: "2026-08-31",
      onApply: () => undefined,
    })));
    await settleUntil(() => startButton().disabled, "Changed household did not invalidate recovery proof");
    expect(container.textContent).toContain("The household changed. Download and verify a fresh backup.");
  });

  it("announces a mismatched backup error and leaves Start disabled", async () => {
    const household = emptyDevelopment();
    const mislabeled = { ...await makeHouseholdExport(household), environment: "production" as const };
    await act(async () => root.render(createElement(MonthRehearsalPanel, {
      household,
      memberId: "MEM-001",
      today: "2026-08-31",
      onApply: () => undefined,
    })));
    await chooseBackup(JSON.stringify(mislabeled));
    await settleUntil(() => container.querySelector('[role="alert"]')?.textContent?.includes("environment label") === true, "Backup error was not announced");
    expect(startButton().disabled).toBe(true);
  });
});
