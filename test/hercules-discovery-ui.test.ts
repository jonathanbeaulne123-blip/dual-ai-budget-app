// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HerculesDiscovery } from "../src/HerculesDiscovery.tsx";
import { catalogHousehold } from "../src/core/index.ts";
import type { KitchenCommand, KitchenCommandResult } from "../src/kitchenCommand.ts";
import type { DiscoveryInput } from "../src/core/herculesDiscovery.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, input: DiscoveryInput;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); input = { household: catalogHousehold(), memberId: "MEM-001", view: "household", tab: "home", today: "2026-09-10" }; });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const button = (text: string) => [...host.querySelectorAll("button")].find(row => row.textContent === text)!;
const click = async (text: string) => act(async () => button(text).click());
describe("Hercules discovery controls", () => {
  it("an A to B to A return cannot let an older save clear a newer pending save", async () => {
    const replies: Array<(value: KitchenCommandResult | null) => void> = [];
    const command = vi.fn<KitchenCommand>().mockImplementation(() => new Promise(done => { replies.push(done); }));
    const render = () => root.render(createElement(HerculesDiscovery,{ input, onCommand: command, onNavigate: vi.fn(), onContinueChat: vi.fn() }));
    await act(async () => render()); await click("Not now");
    input = { ...input, memberId: "MEM-002" }; await act(async () => render());
    input = { ...input, memberId: "MEM-001" }; await act(async () => render()); await click("Not now");
    await act(async () => replies[0]!({ kind: "synchronized", ok: true, household: input.household } as KitchenCommandResult));
    expect(host.textContent).toContain("Saving your choice"); expect(host.textContent).not.toContain("Set aside for 24 hours");
    expect(button("Not now").disabled).toBe(true);
    await act(async () => replies[1]!(null)); expect(host.textContent).toContain("Save not confirmed");
  });
  it("shows all three sections and sends each entry mode to the existing flow without a command", async () => {
    const command = vi.fn(), navigate = vi.fn();
    await act(async () => root.render(createElement(HerculesDiscovery,{ input, onCommand: command, onNavigate: navigate, onContinueChat: vi.fn() })));
    for (const label of ["For you now", "Things we can do", "Continue with me"]) expect(host.textContent).toContain(label);
    await click("Choose an entry");
    for (const mode of ["expense", "income", "transfer"]) { await click(`Start ${mode}`); expect(navigate).toHaveBeenLastCalledWith({ kind: "entry", mode }); }
    expect(command).not.toHaveBeenCalled();
  });
  it("does not claim a pending snooze is saved, retries with the same UUID and hides only after ACK", async () => {
    let resolve: (value: KitchenCommandResult | null) => void = () => {};
    const navigate = vi.fn(); const command = vi.fn<KitchenCommand>().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockImplementation(async fn => { input = { ...input, household: fn(input.household).household }; render(); return { kind: "synchronized", ok: true, household: input.household } as KitchenCommandResult; });
    function render() { root.render(createElement(HerculesDiscovery,{ input, onCommand: command, onNavigate: navigate, onContinueChat: vi.fn() })); }
    await act(async () => render()); const before = host.querySelector('[aria-label="For you now"] article h4')!.textContent;
    await click("Not now"); expect(host.textContent).toContain("Saving your choice"); expect(host.textContent).not.toContain("Set aside for 24 hours");
    await act(async () => resolve(null)); await click("Retry suggestion save");
    expect(command.mock.calls[0]![1]?.confirmationId).toBe(command.mock.calls[1]![1]?.confirmationId);
    expect(host.textContent).toContain("Set aside for 24 hours");
    expect([...host.querySelectorAll('[aria-label="For you now"] article h4')].map(row => row.textContent)).not.toContain(before);
  });
  it("drops a late save receipt after a person/view switch", async () => {
    let resolve: (value: KitchenCommandResult | null) => void = () => {};
    const command = vi.fn<KitchenCommand>().mockImplementation(() => new Promise(done => { resolve = done; }));
    const render = () => root.render(createElement(HerculesDiscovery,{ input, onCommand: command, onNavigate: vi.fn(), onContinueChat: vi.fn() }));
    await act(async () => render()); await click("Don’t suggest this");
    input = { ...input, memberId: "MEM-002", view: "personal" }; await act(async () => render());
    await act(async () => resolve({ kind: "synchronized", ok: true, household: input.household } as KitchenCommandResult));
    expect(host.textContent).not.toContain("Suggestions for this activity are off"); expect(host.textContent).not.toContain("Saving your choice");
  });
  it("removes a selected completed shift and blocks its old navigation", async () => {
    const at = "2026-09-10T12:00:00.000Z";
    input.household.kitchen.openShifts = [{ id: "SHIFT", memberId: input.memberId, startedAt: at, endedAt: null, breaks: [], scheduledItemId: null, sourceDeviceId: null, updatedAt: at, status: "open" }];
    const navigate = vi.fn(); const render = () => root.render(createElement(HerculesDiscovery,{ input, onNavigate: navigate, onContinueChat: vi.fn() }));
    await act(async () => render()); await click("Open my shift"); expect(host.textContent).toContain("Continue my shift");
    input = { ...input, household: { ...input.household, kitchen: { ...input.household.kitchen, openShifts: input.household.kitchen.openShifts!.map(row => ({ ...row, status: "cleared" as const })) } } };
    await act(async () => render()); expect(button("Continue my shift")).toBeUndefined(); expect(navigate).not.toHaveBeenCalled();
  });
});

describe("suggestion receipt recovery", () => {
 it("checks an accepted receipt before repeating a stale choice", async () => {
  let mutations = 0;
  const command: KitchenCommand = async (fn, options) => {
   if (options?.recoverConfirmation) { options.onRecoveredConfirmation?.(); return null; }
   mutations++; input = {...input,household:fn(input.household).household}; render(); return null;
  };
  const render=()=>root.render(createElement(HerculesDiscovery,{input,onCommand:command,onNavigate:vi.fn(),onContinueChat:vi.fn()}));
  await act(async()=>render()); await click("Not now"); await click("Retry suggestion save");
  expect(mutations).toBe(1); expect(host.textContent).toContain("Earlier choice confirmed");
 });
});
