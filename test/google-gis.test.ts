// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestGoogleAccess,
  resetGoogleEngineForTests,
  setGoogleClientIdForTests,
} from "../src/google/index.ts";

function clearGis(): void {
  document.querySelectorAll("script[data-hearth-gis]").forEach((script) => script.remove());
  delete (window as Window & { google?: unknown }).google;
}

afterEach(() => {
  vi.useRealTimers();
  resetGoogleEngineForTests();
  clearGis();
});

describe("Google Identity script recovery", () => {
  it("times out a stalled GIS script before account UI can hang forever", async () => {
    vi.useFakeTimers();
    setGoogleClientIdForTests("test-client");
    const pending = requestGoogleAccess({ services: ["identity"], requestOwner: "development:HH-A:MEM-001" });
    const rejection = expect(pending).rejects.toThrow(/too long to load/i);
    expect(document.querySelector("script[data-hearth-gis]")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(15_001);
    await rejection;
    expect(document.querySelector("script[data-hearth-gis]")).toBeNull();
  });

  it("removes a failed script and succeeds on a clean retry", async () => {
    setGoogleClientIdForTests("test-client");
    const first = requestGoogleAccess({ services: ["identity"], requestOwner: "development:HH-A:MEM-001" });
    const failed = document.querySelector<HTMLScriptElement>("script[data-hearth-gis]");
    failed?.dispatchEvent(new Event("error"));
    await expect(first).rejects.toThrow(/failed to load/i);
    expect(document.querySelector("script[data-hearth-gis]")).toBeNull();

    const second = requestGoogleAccess({ services: ["identity"], requestOwner: "development:HH-A:MEM-001" });
    const retry = document.querySelector<HTMLScriptElement>("script[data-hearth-gis]");
    expect(retry).not.toBe(failed);
    (window as Window & { google?: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: { callback: (response: { access_token: string; expires_in: number; scope: string }) => void }) => ({
            requestAccessToken: () => config.callback({
              access_token: "retry-token",
              expires_in: 3600,
              scope: "openid email profile",
            }),
          }),
        },
      },
    };
    retry?.dispatchEvent(new Event("load"));
    await expect(second).resolves.toMatchObject({ accessToken: "retry-token" });
  });
});
