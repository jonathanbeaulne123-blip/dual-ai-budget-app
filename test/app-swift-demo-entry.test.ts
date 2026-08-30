// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AcceptWriteInput, CommandOutcome, Household } from "../src/core/index.ts";

const acceptance = vi.hoisted(() => ({
  calls: 0,
  ok: true,
  resolve: null as null | (() => void),
}));

vi.mock("../src/core/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/core/index.ts")>();
  return {
    ...actual,
    acceptHouseholdWrite: vi.fn((input: AcceptWriteInput) => {
      acceptance.calls += 1;
      return new Promise<CommandOutcome>((resolve) => {
        acceptance.resolve = () => resolve({
          kind: acceptance.ok ? "accepted-local" : "retryable-failure",
          ok: acceptance.ok,
          household: input.candidate,
          previous: input.previous,
          postedIds: [],
          confirmationId: input.confirmationId ?? "demo-test",
          identityHash: "demo-test",
          revision: input.candidate.revision,
          sharingMode: "local",
          errorClass: acceptance.ok ? null : "books-unavailable",
          userMessage: acceptance.ok ? null : "The local books could not open. Try again.",
          retryable: !acceptance.ok,
          recoveryAvailable: false,
          postedExactlyOnce: acceptance.ok,
          postedNothing: !acceptance.ok,
        });
      });
    }),
  };
});

vi.mock("../src/storage.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/storage.ts")>();
  return {
    ...actual,
    loadHousehold: vi.fn(async () => null),
    listHouseholdReplicas: vi.fn(async () => []),
    loadPersonalReplica: vi.fn(async () => null),
    saveHousehold: vi.fn(async (_household: Household) => undefined),
  };
});

vi.mock("../src/Office.tsx", () => ({ Office: () => null }));

import { App } from "../src/App.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function button(label: RegExp): HTMLButtonElement {
  const match = [...document.querySelectorAll("button")].find((item) => label.test(item.textContent ?? ""));
  if (!match) throw new Error(`Missing button ${label}`);
  return match as HTMLButtonElement;
}

describe("swift demo entry", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    acceptance.calls = 0;
    acceptance.ok = true;
    acceptance.resolve = null;
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    class TestResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: TestResizeObserver,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(App));
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("paints member choice before starting database acceptance and locks entry until acceptance", async () => {
    act(() => {
      const open = button(/Open the demo kitchen table/i);
      open.click();
      open.click();
    });

    expect(container.textContent).toContain("Choose yourself");
    expect(button(/I am Jonathan/i).disabled).toBe(false);
    expect(acceptance.calls).toBe(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(34); });
    expect(acceptance.calls).toBe(1);

    act(() => button(/I am Jonathan/i).click());
    expect(container.textContent).toContain("Validating the local journal before entering");
    expect(container.textContent).not.toContain("Good morning");

    await act(async () => {
      acceptance.resolve?.();
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain("Validating the local journal before entering");
    expect(container.querySelector("nav")).not.toBeNull();
  });

  it("stays on the chooser and re-enables entry when books acceptance fails", async () => {
    acceptance.ok = false;
    act(() => button(/Open the demo kitchen table/i).click());
    await act(async () => { await vi.advanceTimersByTimeAsync(34); });
    act(() => button(/I am Jonathan/i).click());

    await act(async () => {
      acceptance.resolve?.();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("The local books could not open. Try again.");
    expect(button(/I am Jonathan/i).disabled).toBe(false);
    expect(container.querySelector("nav")).toBeNull();
  });
});
