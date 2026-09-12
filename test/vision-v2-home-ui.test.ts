// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdHome } from "../src/HouseholdHome.tsx";
import { useComfort, writeComfort } from "../src/theme/comfort.ts";
import { catalogHousehold, keepWinAsMemory, recordWin } from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

describe("Vision v2 Home UI review repairs", () => {
  it("offers the second partner Memory consent without an impossible fade action", async () => {
    let household = recordWin(catalogHousehold(), {
      memberId: "MEM-001",
      level: "shared-win",
      title: "We chose the rent payday",
      at: "2026-09-12T10:00:00.000Z",
    }).household;
    household = keepWinAsMemory(household, {
      memberId: "MEM-001",
      winId: household.wins![0]!.id,
      at: "2026-09-12T10:01:00.000Z",
    }).household;

    await act(async () => root.render(createElement(HouseholdHome, {
      household,
      memberId: "MEM-002",
      today: "2026-09-12",
      freshness: "current",
      busy: false,
      onCommand: vi.fn(),
      onGo: vi.fn(),
    })));

    const labels = [...host.querySelectorAll("button")].map((button) => button.textContent);
    expect(labels).toContain("Keep as a Memory");
    expect(labels).not.toContain("Let it fade");
  });

  it("reloads device-local comfort when the environment changes", async () => {
    writeComfort("development", { quiet: false, celebration: "full", motion: "system", haptics: true, sound: true });
    writeComfort("production", { quiet: true, celebration: "off", motion: "reduced", haptics: false, sound: false });
    function Probe({ environment }: { environment: string }) {
      const [comfort] = useComfort(environment);
      return createElement("output", null, `${environment}:${comfort.quiet}:${comfort.sound}`);
    }

    await act(async () => root.render(createElement(Probe, { environment: "development" })));
    expect(host.textContent).toBe("development:false:true");
    await act(async () => root.render(createElement(Probe, { environment: "production" })));
    expect(host.textContent).toBe("production:true:false");
    expect(document.documentElement.dataset.motion).toBe("reduced");
  });
});
