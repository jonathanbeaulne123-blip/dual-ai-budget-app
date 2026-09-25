// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useJourneyCloudTransition } from "../src/path/JourneyCloudTransition.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Journey cloud passage", () => {
  afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

  it.each(["to-journey", "to-harbour"] as const)("keeps %s covered until its scene is ready", async (direction) => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let passage!: ReturnType<typeof useJourneyCloudTransition>;
    function Harness() { passage = useJourneyCloudTransition(); return passage.clouds; }
    await act(async () => { root.render(createElement(Harness)); });
    const navigate = vi.fn();
    await act(async () => { passage.begin(direction, navigate); });
    expect(host.querySelector("[data-phase='cover']")).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(520); });
    expect(navigate).toHaveBeenCalledOnce();
    expect(host.querySelector("[data-phase='hold']")).not.toBeNull();
    await act(async () => { passage.ready(direction); });
    expect(host.querySelector("[data-phase='reveal']")).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(650); });
    expect(host.querySelector(".journey-cloud-passage")).toBeNull();
    await act(async () => { root.unmount(); });
  });
});
