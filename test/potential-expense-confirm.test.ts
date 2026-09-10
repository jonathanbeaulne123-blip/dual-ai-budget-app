// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { PotentialExpenseConfirmSheet } from "../src/PotentialExpenseConfirmSheet.tsx";
import { addPotentialExpense, catalogHousehold } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("potential expense Final Confirm", () => {
  it("starts from expected cents and submits the CadPad-adjusted actual amount", async () => {
    const household = addPotentialExpense(catalogHousehold(), {
      date: "2026-09-29", title: "Wedding travel", amount: "600", accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-LIFE-FUN", createdBy: "MEM-001", visibility: "household",
    }).household;
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const confirm = vi.fn();
    await act(async () => root.render(createElement(PotentialExpenseConfirmSheet, { plan: household.potentialExpenses[0]!, household, busy: false, onCancel: vi.fn(), onConfirm: confirm })));
    expect(host.textContent).toContain("expected $600.00");
    expect(host.textContent).toContain("Actual amount spent");
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Delete last digit"]')!.click());
    expect(host.textContent).toContain("Actual ownership:");
    expect(host.textContent).toContain("joint $60.00");
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.startsWith('Final Confirm'))!.click());
    expect(confirm).toHaveBeenCalledWith("60.00");
    await act(async () => root.unmount()); host.remove();
  });
});
