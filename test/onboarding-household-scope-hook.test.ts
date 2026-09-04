// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import {
  useHouseholdScopeProbe,
  type HouseholdScopeProbeAdapters,
  type HouseholdScopeProbeControl,
} from "../src/onboardingHouseholdScope.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

describe("Chapter 2 household-scope hook", () => {
  it("lets a person retry a transient probe failure and shows checking while the retry is live", async () => {
    const household = catalogHousehold("development");
    const session = {
      accessToken: "token",
      refreshToken: "refresh",
      userId: "auth-bianca",
      sessionId: "session-bianca",
      email: "bianca@example.test",
      googleSubject: "google-bianca",
      displayName: "Bianca",
      expiresAt: Date.parse("2026-09-04T14:00:00.000Z"),
    };
    let accessCalls = 0;
    let releaseRetry!: () => void;
    const retryPending = new Promise<void>((resolve) => { releaseRetry = resolve; });
    const adapters: HouseholdScopeProbeAdapters = {
      loadSession: () => session,
      ensureSession: async () => session,
      readConfig: () => ({ url: "https://example.test", key: "publishable" }),
      listMemberships: async () => [{ householdId: household.householdId, memberId: BIANCA, role: "owner" }],
      listAccess: async () => {
        accessCalls += 1;
        if (accessCalls === 1) return { ok: false, reason: "temporary-service-error" };
        await retryPending;
        return {
          ok: true,
          access: {
            currentMemberId: BIANCA,
            currentRole: "owner",
            members: [
              { memberId: BIANCA, displayName: "Bianca", role: "owner" },
              { memberId: JONATHAN, displayName: "Jonathan", role: "member" },
            ],
            devices: [],
            audit: [],
          },
        };
      },
      isOnline: () => true,
      now: () => "2026-09-04T13:00:00.000Z",
    };

    let latest!: HouseholdScopeProbeControl;
    function Harness() {
      latest = useHouseholdScopeProbe({ active: true, household, memberId: BIANCA }, adapters);
      return createElement("button", { type: "button", onClick: latest.retry }, latest.observation?.kind ?? "empty");
    }

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(createElement(Harness)); });
    expect(latest.observation).toMatchObject({ kind: "blocked", reason: "probe-failed" });
    expect(accessCalls).toBe(1);

    await act(async () => {
      host.querySelector("button")!.click();
      await Promise.resolve();
    });
    expect(latest.observation).toMatchObject({ kind: "checking" });
    expect(accessCalls).toBe(2);

    await act(async () => { releaseRetry(); });
    expect(latest.observation).toMatchObject({
      kind: "resolved",
      currentMemberId: BIANCA,
      seatMemberIds: [BIANCA, JONATHAN],
    });

    act(() => root.unmount());
    host.remove();
  });
});
