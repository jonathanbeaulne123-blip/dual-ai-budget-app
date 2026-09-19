// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { loadMiniJourney, useMiniJourneyLoad, miniLoaderInlineOnly } from "../src/path/mini/miniJourneyLoader.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
const failure = vi.hoisted(() => ({ fail: true }));
vi.mock("../src/path/mini/miniJourneyModel.ts", async (original) => {
  const actual = await original<typeof import("../src/path/mini/miniJourneyModel.ts")>();
  return { ...actual, miniJourneyBase: (...args: Parameters<typeof actual.miniJourneyBase>) => {
    if (failure.fail) throw new Error("Synthetic interrupted read");
    return actual.miniJourneyBase(...args);
  } };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it("retries an interrupted staged read on the same household without changing books", async () => {
  miniLoaderInlineOnly(true);
  const household = planLifeFixture("household");
  const before = JSON.stringify(household);
  let loader!: ReturnType<typeof useMiniJourneyLoad>;
  function Harness() { loader = useMiniJourneyLoad(household, { memberId: "MEM-001", view: "household", today: "2026-09-15" }); return null; }
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(Harness)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(loader.state.failed).toBe(true);
    const failedAgain = await loadMiniJourney(household, { memberId: "MEM-001", view: "household", today: "2026-09-15" });
    expect(failedAgain.failed).toBe(true);
    failure.fail = false;
    await act(async () => loader.retry());
    for (let i = 0; i < 20 && !loader.state.fund; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(loader.state.failed).toBe(false);
    expect(loader.state.base).toBeTruthy();
    expect(loader.state.month).toBeTruthy();
    expect(loader.state.fund).toBeTruthy();
    expect(JSON.stringify(household)).toBe(before);
  } finally { await act(async () => root.unmount()); host.remove(); miniLoaderInlineOnly(false); }
});
