// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { rigSessionId, startHerculesRigPoller } from "../src/herculesRig/transport.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("Hercules remote rig poller", () => {
  it("stays dormant until a person explicitly opens a rig session", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, entries: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const stop = startHerculesRigPoller(() => {}, 2_000);

    await vi.advanceTimersByTimeAsync(4_100);
    expect(fetchMock).not.toHaveBeenCalled();

    expect(rigSessionId()).toHaveLength(32);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2_100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
  });
});
