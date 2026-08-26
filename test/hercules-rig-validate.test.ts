import { describe, expect, it } from "vitest";
import { validateRigCommands, validateRigPayload, sanitizeRigSessionId } from "../src/herculesRig/validate.ts";

describe("Hercules rig validation", () => {
  it("accepts bounded part commands", () => {
    const commands = validateRigCommands([
      { type: "setPart", part: "head", transform: { rotate: 12, translateY: -3 } },
      { type: "playPose", pose: "beg" },
    ]);
    expect(commands).toHaveLength(2);
  });

  it("rejects money-ish keys and unknown parts", () => {
    const commands = validateRigCommands([
      { type: "setPart", part: "wallet", transform: { rotate: 1 } },
      { type: "postEntry", amountCents: 100 },
    ] as unknown[]);
    expect(commands).toHaveLength(0);
  });

  it("validates session payloads", () => {
    const sessionId = sanitizeRigSessionId("kitchen-session-1");
    expect(sessionId).toBe("kitchen-session-1");
    const payload = validateRigPayload({
      sessionId,
      commands: [{ type: "reset" }],
    });
    expect(payload?.commands[0]?.type).toBe("reset");
  });
});
