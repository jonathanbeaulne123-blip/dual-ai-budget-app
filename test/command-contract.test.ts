import { describe, expect, it } from "vitest";
import {
  COMMAND_SURFACE_FIXTURES,
  guaranteesPostedExactlyOnce,
  guaranteesPostedNothing,
  retryRuleFor,
  toCommandSurface,
} from "../src/claude/commandContract.ts";
import { outcome } from "../src/core/commandOutcome.ts";
import { catalogHousehold } from "../src/core/index.ts";

describe("Claude command contract", () => {
  it("maps an accepted local outcome without leaking exceptions", () => {
    const household = catalogHousehold();
    const surface = toCommandSurface(
      outcome({
        kind: "accepted-local",
        household,
        previous: household,
        postedIds: ["TXN-1"],
        confirmationId: "confirm-milk",
        identityHash: "abc",
        revision: 1,
        sharingMode: "local",
        errorClass: null,
        userMessage: null,
        retryable: false,
        recoveryAvailable: false,
      }),
    );
    expect(guaranteesPostedExactlyOnce(surface)).toBe(true);
    expect(guaranteesPostedNothing(surface)).toBe(false);
    expect(retryRuleFor(surface)).toBe("do-not-retry");
    expect(surface.userMessage).toBeNull();
  });

  it("states which fixtures guarantee no post vs exactly-once", () => {
    expect(guaranteesPostedNothing(COMMAND_SURFACE_FIXTURES["rejected-no-write"])).toBe(true);
    expect(guaranteesPostedNothing(COMMAND_SURFACE_FIXTURES["permanent-validation-failure"])).toBe(true);
    expect(guaranteesPostedExactlyOnce(COMMAND_SURFACE_FIXTURES["accepted-local"])).toBe(true);
    expect(guaranteesPostedExactlyOnce(COMMAND_SURFACE_FIXTURES.synchronized)).toBe(true);
    expect(retryRuleFor(COMMAND_SURFACE_FIXTURES["conflict-needs-attention"])).toBe("wait-for-human-conflict");
    expect(retryRuleFor(COMMAND_SURFACE_FIXTURES["recovery-available"])).toBe("open-recovery");
    expect(retryRuleFor(COMMAND_SURFACE_FIXTURES["retryable-failure"])).toBe("retry-same-confirmation");
  });
});
