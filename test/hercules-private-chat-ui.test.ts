// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HerculesPresence } from "../src/Hercules.tsx";
import { catalogHousehold } from "../src/core/index.ts";
import { companionFor, commitCompanion } from "../src/core/herculesCompanion.ts";
import type { KitchenCommand } from "../src/kitchenCommand.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function send(text: string) {
  const input = host.querySelector('input[aria-label="Ask Hercules"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
describe("private chat pending continuity", () => {
  it("keeps talking and includes the complete pending exchange before cloud ACK", async () => {
    const requests: Record<string, any>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true, provider: "gemini", reply: "A warm windowsill. Excellent for a nap." }), { headers: { "Content-Type": "application/json" } });
    }));
    const h = catalogHousehold(); h.companionProfile = companionFor(h, "MEM-001");
    const onCommand = vi.fn<KitchenCommand>().mockImplementation(() => new Promise(() => {}));
    await act(async () => root.render(createElement(HerculesPresence, { household: h, today: "2026-09-10", tab: "ledger", adding: false, memberId: "MEM-001", view: "household", onOpenAdd: vi.fn(), onGo: vi.fn(), onLedger: vi.fn(), onCompanionCommand: onCommand, onOpenSource: vi.fn() })));
    await act(async () => (host.querySelector('.hercules-pill') as HTMLButtonElement).click());
    await send("Tell me about your favourite napping spot");
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Saving this conversation");
    await send("why?");
    expect(requests).toHaveLength(2);
    expect(requests[1]!.companion.context.map((row: { role: string }) => row.role)).toEqual(["user", "hercules"]);
    expect(JSON.stringify(requests[1]!.companion.context)).toContain("napping spot");
    expect(host.textContent).not.toContain("Conversation saved privately");
  });
  it.each([false, true])("Undo restores an earlier preference without creating another Undo; stale=%s", async stale => {
    let h = catalogHousehold(); h.companionProfile = companionFor(h, "MEM-001");
    h.companionProfile.preferences = [{ key: "answerLength", value: "detailed", revision: 1, updatedAt: new Date().toISOString(), source: "explicit-user" }];
    const callback = vi.fn<KitchenCommand>().mockImplementation(async (fn, options) => {
      try { const result = fn(h); h = result.household; render(); return { kind: "synchronized", ok: true, household: h } as import("../src/kitchenCommand.ts").KitchenCommandResult; }
      catch { options?.onDefinitiveRejected?.({ retryable: false }); return null; }
    });
    function render() { root.render(createElement(HerculesPresence, { household: h, today: "2026-09-10", tab: "ledger", adding: false, memberId: "MEM-001", view: "household", onOpenAdd: vi.fn(), onGo: vi.fn(), onLedger: vi.fn(), onCompanionCommand: callback, onOpenSource: vi.fn() })); }
    await act(async () => render());
    await act(async () => (host.querySelector('.hercules-pill') as HTMLButtonElement).click());
    await send("keep answers short");
    expect(h.companionProfile!.preferences.find(row => row.key === "answerLength")?.value).toBe("concise");
    if (stale) {
      h = commitCompanion(h, { version: 1, id: crypto.randomUUID(), scope: h.companionProfile!.scope, operation: { kind: "preference.set", key: "answerLength", value: "detailed", expectedRevision: 2, origin: { kind: "manual" } } }).household;
      await act(async () => render());
    }
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === "Undo remembered preference")!.click());
    expect(h.companionProfile!.preferences.find(row => row.key === "answerLength")?.value).toBe("detailed");
    expect(host.textContent).not.toContain("Undo remembered preference");
    if (stale) expect(host.textContent).toContain("not applied");
    await send("my favourite colour is blue");
    expect(h.companionProfile!.preferences.find(row => row.key === "favouriteColours")?.value).toEqual(["blue"]);
  });

});
