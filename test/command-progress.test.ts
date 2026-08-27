import { describe, expect, it } from "vitest";
import { outcome } from "../src/core/commandOutcome.ts";
import {
  buildCommandProgress,
  commandProgressPhaseAfterOutcome,
} from "../src/commandProgress.ts";
import { catalogHousehold } from "../src/core/index.ts";

describe("commandProgress (T3-S1)", () => {
  it("hides the rail when idle or transport is off", () => {
    expect(buildCommandProgress({ phase: "idle", transportRequested: true }).visible).toBe(false);
    expect(buildCommandProgress({ phase: "confirming", transportRequested: false }).visible).toBe(false);
  });

  it("walks confirming → accepted-local → cloud-ack for linked transport", () => {
    const confirming = buildCommandProgress({ phase: "confirming", transportRequested: true });
    expect(confirming.steps[0]?.state).toBe("active");
    expect(confirming.summary).toMatch(/Saving on this phone/i);

    const accepted = buildCommandProgress({ phase: "accepted-local", transportRequested: true });
    expect(accepted.steps[0]?.state).toBe("done");
    expect(accepted.steps[1]?.state).toBe("active");
    expect(accepted.summary).toMatch(/Sharing to the cloud/i);

    const ack = buildCommandProgress({ phase: "cloud-ack", transportRequested: true });
    expect(ack.steps.every((step) => step.state === "done")).toBe(true);
    expect(ack.summary).toMatch(/Shared with the household books/i);
    expect(ack.summary).not.toMatch(/Bianca/i);
  });

  it("maps CommandOutcome phases without celebrating before PGlite accept", () => {
    const household = catalogHousehold();
    const pending = outcome({
      kind: "pending-transport",
      ok: true,
      household,
      previous: household,
      postedIds: ["TXN-1"],
      confirmationId: "c1",
      identityHash: "h1",
      revision: 2,
      sharingMode: "pending-transport",
      errorClass: "pending-transport",
      userMessage: null,
      retryable: true,
      postedExactlyOnce: true,
      postedNothing: false,
      recoveryAvailable: false,
    });
    expect(commandProgressPhaseAfterOutcome(pending, true)).toBe("accepted-local");

    const synced = outcome({
      ...pending,
      kind: "synchronized",
      sharingMode: "synchronized",
      errorClass: null,
      retryable: false,
    });
    expect(commandProgressPhaseAfterOutcome(synced, true)).toBe("cloud-ack");

    const rejected = outcome({
      kind: "rejected-no-write",
      ok: false,
      household,
      previous: household,
      postedIds: [],
      confirmationId: "c2",
      identityHash: null,
      revision: 1,
      sharingMode: "local",
      errorClass: "validation-rejected",
      userMessage: "Amount required.",
      retryable: false,
      postedExactlyOnce: false,
      postedNothing: true,
      recoveryAvailable: false,
    });
    expect(commandProgressPhaseAfterOutcome(rejected, true)).toBe("failed");
  });
});
