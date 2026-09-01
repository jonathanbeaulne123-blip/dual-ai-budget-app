import { describe, expect, it } from "vitest";
import { createAccountFlowGate } from "../src/auth/accountFlow.ts";

describe("account-flow cancellation", () => {
  it("keeps a completed older discovery from restoring a signed-out account", () => {
    const gate = createAccountFlowGate();
    const olderDiscovery = gate.begin();

    gate.cancel();

    expect(olderDiscovery.isCurrent()).toBe(false);
    expect(gate.begin().isCurrent()).toBe(true);
  });
});
