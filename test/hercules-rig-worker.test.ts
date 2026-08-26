import { describe, expect, it, beforeEach } from "vitest";
import { validateRigPayload } from "../src/herculesRig/validate.ts";
import { enqueueRigCommands, pollRigCommands, resetRigQueueMemory } from "../workers/herculesRigQueue.js";
import { rigCorsHeaders, resolveChatOrigin } from "../workers/herculesGuard.js";

function rigPostRequest(origin: string, body: unknown) {
  return new Request("https://hearth-books.jonathan-beaulne123.workers.dev/hercules/rig", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Hercules rig worker queue", () => {
  beforeEach(() => resetRigQueueMemory());

  it("queues and polls commands in memory when KV is absent", async () => {
    const payload = validateRigPayload({
      sessionId: "testsession1",
      commands: [{ type: "playPose", pose: "loaf" }],
    });
    expect(payload).not.toBeNull();
    const entry = await enqueueRigCommands({}, payload!.sessionId, payload!.commands);
    const rows = await pollRigCommands({}, payload!.sessionId, entry.at - 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commands[0]?.type).toBe("playPose");
  });

  it("allows kitchen origin for rig CORS", () => {
    const req = rigPostRequest("http://localhost:5173", {});
    const gate = resolveChatOrigin(req);
    expect(gate.allowed).toBe(true);
    expect(rigCorsHeaders(gate.origin)["Access-Control-Allow-Methods"]).toContain("GET");
  });
});
