// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHeldSave } from "../src/queen/useHeldSave.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

type Api = ReturnType<typeof useHeldSave<number>>;
let api: Api;
function Probe({ commit }: { commit: (value: number) => Promise<unknown> }) { api = useHeldSave<number>(commit); return createElement("span", null, String(api.draft)); }

describe("The house holds its edits and sends one save", () => {
  it("shows every change at once, writes nothing while held, and sends only the last value on Done", async () => {
    const commit = vi.fn(async () => undefined);
    await act(async () => root.render(createElement(Probe, { commit })));
    for (const value of [1, 2, 3, 4]) await act(async () => api.hold(value));
    expect(host.textContent).toBe("4");
    expect(api.dirty).toBe(true);
    expect(commit).not.toHaveBeenCalled();
    await act(async () => { api.flush(); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(4);
    expect(api.dirty).toBe(false);
    await act(async () => { api.flush(); });
    expect(commit).toHaveBeenCalledTimes(1);
  });
  it("sends when the page is hidden and when it goes away", async () => {
    const commit = vi.fn(async () => undefined);
    await act(async () => root.render(createElement(Probe, { commit })));
    await act(async () => api.hold(7));
    await act(async () => { window.dispatchEvent(new Event("pagehide")); });
    expect(commit).toHaveBeenLastCalledWith(7);
    await act(async () => api.hold(8));
    await act(async () => root.unmount());
    expect(commit).toHaveBeenLastCalledWith(8);
    expect(commit).toHaveBeenCalledTimes(2);
    root = createRoot(host);
  });
});
