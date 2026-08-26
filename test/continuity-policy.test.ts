import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hostedContinuityAllowed,
  legacyLinkedPublishAllowed,
  productionContinuityEnabled,
  unprojectedHostedTransportAllowed,
} from "../src/ledger/continuityPolicy.ts";

describe("hosted continuity policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps Production continuity off unless the explicit build flag is set", () => {
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "");
    expect(productionContinuityEnabled()).toBe(false);
    expect(hostedContinuityAllowed("development")).toBe(true);
    expect(hostedContinuityAllowed("production")).toBe(false);
    expect(unprojectedHostedTransportAllowed("development")).toBe(true);
    expect(unprojectedHostedTransportAllowed("production")).toBe(false);
    expect(legacyLinkedPublishAllowed("development")).toBe(true);
    expect(legacyLinkedPublishAllowed("production")).toBe(false);
  });

  it("allows Production continuity only when VITE_PRODUCTION_CONTINUITY=1", () => {
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "1");
    expect(productionContinuityEnabled()).toBe(true);
    expect(hostedContinuityAllowed("production")).toBe(true);
    expect(unprojectedHostedTransportAllowed("production")).toBe(false);
    expect(legacyLinkedPublishAllowed("production")).toBe(false);
  });
});
