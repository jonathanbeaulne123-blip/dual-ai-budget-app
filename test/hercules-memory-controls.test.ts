// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanionMemoryControls } from "../src/CompanionMemoryControls.tsx";
import { catalogHousehold } from "../src/core/index.ts";
import { companionFor } from "../src/core/herculesCompanion.ts";
import type { KitchenCommand, KitchenCommandResult } from "../src/kitchenCommand.ts";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root!.unmount()); document.body.innerHTML = ""; });
async function mount(onCommand: KitchenCommand) {
  const household = catalogHousehold(); household.companionProfile = companionFor(household, "MEM-001");
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(createElement(CompanionMemoryControls, { household, memberId: "MEM-001", view: "household", onCommand })));
  const choose = async () => { const select = host.querySelector('select[aria-label="Answer length"]') as HTMLSelectElement; await act(async () => { select.value = "concise"; select.dispatchEvent(new Event("change", { bubbles: true })); }); };
  return { host, choose, household };
}
describe("Hercules acknowledged memory controls", () => {
  it("does not say saved before ACK and uses the same confirmation ID to retry", async () => {
    let release!: (value: KitchenCommandResult) => void;
    const callback = vi.fn<KitchenCommand>().mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const { host, choose } = await mount(callback); await choose();
    expect(host.textContent).toContain("Saving…"); expect(host.textContent).not.toContain("Saved for you");
    await act(async () => release(null));
    expect(host.textContent).toContain("Save not confirmed");
    const id = callback.mock.calls[0]![1]?.confirmationId;
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Retry private save")!.click(); });
    expect(callback.mock.calls[1]![1]?.confirmationId).toBe(id);
    await act(async () => release(null));
  });
  it("a scope change discards late success state", async () => {
    let release!: (value: KitchenCommandResult) => void;
    const callback: KitchenCommand = () => new Promise(resolve => { release = resolve; });
    const { host, choose, household } = await mount(callback); await choose();
    await act(async () => root!.render(createElement(CompanionMemoryControls, { household, memberId: "MEM-002", view: "personal", onCommand: callback })));
    await act(async () => release({ kind: "synchronized", ok: true } as KitchenCommandResult));
    expect(host.textContent).not.toContain("Saved for you"); expect(host.textContent).not.toContain("Saving…");
  });
});
