// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleBridgeCard } from "../src/GoogleBridge.tsx";
import { catalogHousehold } from "../src/core/index.ts";
import {
  createMemoryTokenStore,
  resetGoogleEngineForTests,
  scopeString,
  setGoogleClientIdForTests,
  setGoogleHttpFetch,
  setGoogleTokenRequester,
  setGoogleTokenStore,
} from "../src/google/index.ts";

afterEach(() => {
  resetGoogleEngineForTests();
  setGoogleTokenStore(null);
  document.body.innerHTML = "";
});

describe("Google household async scope", () => {
  it.each(["A-to-B", "A-to-B-to-A", "unmount"] as const)("discards a delayed link result after %s", async (scenario) => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setGoogleTokenStore(createMemoryTokenStore());
    setGoogleClientIdForTests("test-client");
    let release!: (response: { access_token: string; expires_in: number; scope: string }) => void;
    setGoogleTokenRequester(() => new Promise((resolve) => { release = resolve; }));
    setGoogleHttpFetch(async (url) => {
      if (url.includes("userinfo")) return new Response(JSON.stringify({ sub: "sub-a", email: "a@example.com", name: "A" }), { status: 200 });
      if (url.includes("calendarList")) return new Response(JSON.stringify({ items: [{ id: "a@example.com", primary: true }] }), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    });
    const first = { ...catalogHousehold(), householdId: "HH-A" };
    const second = { ...catalogHousehold(), householdId: "HH-B" };
    const onCommand = vi.fn();
    const node = document.createElement("div");
    document.body.appendChild(node);
    const root = createRoot(node);
    const render = (household: typeof first) => createElement(GoogleBridgeCard, {
      household, environment: "development", memberId: "MEM-001", busy: false, onCommand, onError: vi.fn(),
    });

    await act(async () => { root.render(render(first)); });
    const link = [...node.querySelectorAll("button")].find((button) => button.textContent === "Link");
    await act(async () => { link?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    if (scenario === "unmount") await act(async () => { root.unmount(); });
    else {
      await act(async () => { root.render(render(second)); });
      if (scenario === "A-to-B-to-A") await act(async () => { root.render(render(first)); });
    }
    await act(async () => {
      release({ access_token: "token-a", expires_in: 3600, scope: scopeString(["identity", "calendar", "drive"]) });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCommand).not.toHaveBeenCalled();
    if (scenario !== "unmount") await act(async () => { root.unmount(); });
  });
});
