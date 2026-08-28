import { describe, expect, it } from "vitest";
import { readEvidenceStatus } from "../src/imports/evidenceClient.ts";

function response(body: Record<string, unknown>) {
  return Response.json(body, { headers: { "Content-Type": "application/json" } });
}

describe("Evidence client environment contract", () => {
  it("accepts an explicit Development-and-Production availability map", async () => {
    const status = await readEvidenceStatus(async () => response({
      ok: true,
      available: true,
      environment: "development-and-production",
      productionAllowed: true,
      environments: { development: { available: true }, production: { available: true } },
    }));
    expect(status.environments).toMatchObject({ development: { available: true }, production: { available: true } });
  });

  it("rejects a status that claims Production without the Production contract", async () => {
    await expect(readEvidenceStatus(async () => response({
      ok: true, available: true, environment: "development-only", productionAllowed: true,
    }))).rejects.toThrow(/unsafe status/i);
  });
});
