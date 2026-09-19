// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { JOURNEY_LEVEL_FOR_WORLD, JOURNEY_LEVELS, WORLD_LEVEL_FOR, useJourneyFocus, type JourneyFocusApi } from "../src/path/journeyFocus.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("journey focus (the shared view state)", () => {
  it("maps every journey level to a world level and back into the same band", () => {
    for (const level of JOURNEY_LEVELS) expect(JOURNEY_LEVEL_FOR_WORLD[WORLD_LEVEL_FOR[level]]).toBeDefined();
    expect(JOURNEY_LEVEL_FOR_WORLD[WORLD_LEVEL_FOR.journey]).toBe("journey");
    expect(JOURNEY_LEVEL_FOR_WORLD[WORLD_LEVEL_FOR.era]).toBe("era");
    expect(JOURNEY_LEVEL_FOR_WORLD[WORLD_LEVEL_FOR.month]).toBe("month");
  });
  it("records who changed it, ignores no-op changes and returns to today", async () => {
    let api!: JourneyFocusApi;
    function Probe() { api = useJourneyFocus("2026-10-06"); return null; }
    const host = document.createElement("div"); const root = createRoot(host);
    await act(async () => root.render(createElement(Probe)));
    expect(api.focus).toMatchObject({ level: "week", date: "2026-10-06", selected: null, seq: 0 });
    await act(async () => api.set({ level: "era", date: "2026-03-01" }, "world"));
    expect(api.focus).toMatchObject({ level: "era", date: "2026-03-01", source: "world", seq: 1 });
    await act(async () => api.set({ level: "era" }, "mini"));
    expect(api.focus.seq).toBe(1);
    await act(async () => api.toToday("mini", "day"));
    expect(api.focus).toMatchObject({ level: "day", date: "2026-10-06", source: "mini", seq: 2 });
    await act(async () => root.unmount());
  });
});
