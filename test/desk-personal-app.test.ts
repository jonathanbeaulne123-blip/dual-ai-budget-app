// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AcceptWriteInput, CommandOutcome, Household } from "../src/core/index.ts";

/**
 * The personal Desk mounted by the real App (SIMPLE_VIEW_DESK S5), with the
 * house world and the harbour switched on and the flat edition chosen: the
 * household Desk carries the space switch in its header; one press there and
 * the personal Desk stands in place of the illustrated house; a tool opened
 * from it shows its surface with Put it back, and putting it back returns to
 * the Desk. Fictional demo household only.
 */
vi.setConfig({ testTimeout: 60_000 });
afterAll(() => vi.resetConfig());

vi.hoisted(() => {
  vi.stubEnv("VITE_HEARTH_HOUSE_WORLD", "1");
  vi.stubEnv("VITE_HEARTH_HARBOUR", "1");
});

vi.mock("../src/core/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/core/index.ts")>();
  return {
    ...actual,
    acceptHouseholdWrite: vi.fn(async (input: AcceptWriteInput): Promise<CommandOutcome> => ({
      kind: "accepted-local", ok: true, household: input.candidate, previous: input.previous, postedIds: [],
      confirmationId: input.confirmationId ?? "desk-test", identityHash: "desk-test", revision: input.candidate.revision,
      sharingMode: "local", errorClass: null, userMessage: null, retryable: false, recoveryAvailable: false,
      postedExactlyOnce: true, postedNothing: false,
    })),
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

function button(label: RegExp, scope: ParentNode = document): HTMLButtonElement {
  const match = [...scope.querySelectorAll("button")].find((item) => label.test(item.textContent ?? ""));
  if (!match) throw new Error(`Missing button ${label}`);
  return match as HTMLButtonElement;
}

/** Entry runs on fake timers (the demo chooser's 34 ms beat); the lazy harbour and Desk chunks then load in real time. */
async function settle(rounds = 3) {
  for (let i = 0; i < rounds; i += 1) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
}

async function waitFor<T>(read: () => T | null | undefined, what: string, rounds = 200): Promise<T> {
  for (let i = 0; i < rounds; i += 1) {
    const value = read();
    if (value) return value;
    await settle(1);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

describe("the personal Desk, mounted by the App", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("hearth:motion", "flat");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })),
    });
    class TestResizeObserver { observe() {} unobserve() {} disconnect() {} }
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    Element.prototype.scrollIntoView = vi.fn();
    // jsdom has no canvas: the harbour reads "no WebGL" and stands its reading edition, the Desk.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => { root.render(createElement(App)); await Promise.resolve(); await Promise.resolve(); });
    act(() => button(/Open the demo household table/i).click());
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    act(() => button(/I am Jonathan/i).click());
    for (let i = 0; i < 5; i += 1) await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    vi.useRealTimers();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("switches household ↔ personal from the Desk header, and the personal Desk stands in place of the house", async () => {
    const householdDesk = await waitFor(() => container.querySelector<HTMLElement>('[data-desk][data-desk-scope="household"]'), "the household Desk");
    const slot = householdDesk.querySelector<HTMLElement>('[data-desk-slot="space"]')!;
    const switchGroup = slot.querySelector<HTMLElement>('.view-switch[role="group"]');
    expect(switchGroup).not.toBeNull();
    const [shared, personal] = [...switchGroup!.querySelectorAll<HTMLButtonElement>("button")];
    expect(shared!.getAttribute("aria-pressed")).toBe("true");
    await act(async () => personal!.click());
    await settle();

    const desk = await waitFor(() => container.querySelector<HTMLElement>('[data-desk][data-desk-scope="personal"]'), "the personal Desk");
    expect(container.querySelector(".house-world")).toBeNull();
    expect(container.querySelector('[data-desk-scope="household"]')).toBeNull();
    // Today, personal: the six plates and the personal seal trio.
    expect([...desk.querySelectorAll<HTMLElement>("[data-desk-plate]")].map((plate) => plate.dataset.deskPlate).sort())
      .toEqual(["clock", "mine-saving", "month", "pay", "tips", "wallet"]);
    expect(desk.querySelector('[data-desk-seal="in"] .desk-seal__sub')!.textContent).toBe("Personal income this month");
    // The space switch lives in this header too, and is the only one on the page.
    const personalSwitch = desk.querySelector<HTMLElement>('[data-desk-slot="space"] .view-switch')!;
    expect([...personalSwitch.querySelectorAll("button")].map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
    expect(container.querySelectorAll(".view-switch").length).toBe(1);
    // The bar keeps the flip and the + (two presses to a money verb); the rooms step aside for the Desk's chips.
    const nav = container.querySelector<HTMLElement>('nav[data-edition-nav="desk"]')!;
    expect(nav).not.toBeNull();
    expect(nav.querySelector<HTMLButtonElement>(".house-nav-flip")!.getAttribute("aria-label")).toBe("Switch to the illustrated house");
    expect(nav.querySelector("button.fab")).not.toBeNull();
    expect(nav.querySelector(".house-nav-phone")).toBeNull();

    // Back to shared in two presses from here too.
    await act(async () => personalSwitch.querySelectorAll<HTMLButtonElement>("button")[0]!.click());
    await settle();
    await waitFor(() => container.querySelector('[data-desk][data-desk-scope="household"]'), "the household Desk again");
  });

  it("opens a tool from the personal Desk with Put it back, and putting it back returns to the Desk", async () => {
    const householdDesk = await waitFor(() => container.querySelector<HTMLElement>('[data-desk][data-desk-scope="household"]'), "the household Desk");
    await act(async () => householdDesk.querySelectorAll<HTMLButtonElement>('[data-desk-slot="space"] .view-switch button')[1]!.click());
    await settle();
    const desk = await waitFor(() => container.querySelector<HTMLElement>('[data-desk][data-desk-scope="personal"]'), "the personal Desk");

    await act(async () => desk.querySelector<HTMLButtonElement>('[data-desk-plate="mine-saving"]')!.click());
    await settle();
    expect(container.querySelector('[data-desk][data-desk-scope="personal"]')).toBeNull();
    const heading = await waitFor(() => container.querySelector<HTMLElement>(".house-tool-heading"), "the tool heading");
    expect(heading.querySelector("h2")!.textContent).toBe("Open Kitty Banks");
    expect(container.querySelector(".house-world")).toBeNull();

    await act(async () => button(/^Put it back$/, heading).click());
    await settle();
    await waitFor(() => container.querySelector('[data-desk][data-desk-scope="personal"]'), "the personal Desk after Put it back");
    expect(container.querySelector(".house-tool-heading")).toBeNull();
  });

  it("opens the All tools sheet from the personal Desk's drawer", async () => {
    const householdDesk = await waitFor(() => container.querySelector<HTMLElement>('[data-desk][data-desk-scope="household"]'), "the household Desk");
    await act(async () => householdDesk.querySelectorAll<HTMLButtonElement>('[data-desk-slot="space"] .view-switch button')[1]!.click());
    await settle();
    const desk = await waitFor(() => container.querySelector<HTMLElement>('[data-desk][data-desk-scope="personal"]'), "the personal Desk");
    await act(async () => desk.querySelector<HTMLButtonElement>("[data-desk-drawer]")!.click());
    await settle(2);
    const sheet = container.querySelector<HTMLElement>('[data-quick-sheet="open"]');
    expect(sheet).not.toBeNull();
    expect(sheet!.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
  });

  it("flips the personal edition with the backtick, and never while typing", async () => {
    const householdDesk = await waitFor(() => container.querySelector<HTMLElement>('[data-desk][data-desk-scope="household"]'), "the household Desk");
    await act(async () => householdDesk.querySelectorAll<HTMLButtonElement>('[data-desk-slot="space"] .view-switch button')[1]!.click());
    await settle();
    await waitFor(() => container.querySelector('[data-desk][data-desk-scope="personal"]'), "the personal Desk");

    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "`", bubbles: true })); });
    expect(localStorage.getItem("hearth:motion")).toBe("flat");
    input.remove();

    (document.activeElement as HTMLElement | null)?.blur();
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "`", bubbles: true })); });
    expect(localStorage.getItem("hearth:motion")).toBe("");
    await settle(2);
    // The illustrated personal house returns; the Desk steps away.
    expect(container.querySelector('[data-desk][data-desk-scope="personal"]')).toBeNull();
    expect(container.querySelector('nav[data-edition-nav="house"] .house-nav-flip')!.getAttribute("aria-label")).toBe("Switch to the simple view");
  });
});
