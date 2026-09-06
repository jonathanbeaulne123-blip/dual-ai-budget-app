// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HerculesPresence } from "../src/Hercules.tsx";
import { catalogHousehold } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1100 });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe("onboarding render identity resilience", () => {
  it.each(["deactivated", "unknown"] as const)("keeps Hercules mounted for a %s session member", (variant) => {
    const household = catalogHousehold("development");
    const memberId = variant === "unknown" ? "MEM-NOT-HERE" : household.members[0]!.id;
    if (variant === "deactivated") household.members[0] = { ...household.members[0]!, active: false };

    expect(() => act(() => root.render(createElement(HerculesPresence, {
      household,
      today: "2026-09-06",
      tab: "home",
      adding: false,
      memberId,
      view: "household",
      onOpenAdd: vi.fn(),
      onGo: vi.fn(),
      onLedger: vi.fn(),
      onOpenSource: vi.fn(),
    })))).not.toThrow();

    expect(host.querySelector(".hercules-world")).not.toBeNull();
    expect(host.querySelector(".onboarding-shell")).toBeNull();
  });
});
