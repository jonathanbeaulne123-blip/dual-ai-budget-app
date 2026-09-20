import { describe, expect, it } from "vitest";
import { homeBankAnchorId, homeJarAnchorId, homeJarAppearance, homeObjectPosition } from "../src/house/world/homeObjects.ts";
import type { CellarJar } from "../src/core/queenCellar.ts";

const jar = (over: Partial<CellarJar> = {}): CellarJar => ({
  id: "cellar:rent", bankId: "rent", label: "Rent", date: "2026-09-20", type: "house", category: "protect",
  groupName: "Housing", lineName: "Rent", hue: "housing", umbrellaHue: null, umbrellaId: null, finish: "plain", size: 5,
  targetCents: 100, savedCents: 100, leftCents: 0, fill: 1, daysAway: 1, due: false, full: true, paid: false,
  strike: "none", recurrenceId: "rent", obligationId: "recurrence:rent:2026-09-20", ...over,
});

describe("whole-house canonical Home object presentation", () => {
  it("keeps stable anchor ids and authored slots independent of financial amounts", () => {
    expect(homeBankAnchorId("goal:trip")).toBe("home-bank:goal:trip");
    expect(homeJarAnchorId("cellar:rent")).toBe("home-jar:cellar:rent");
    expect(homeObjectPosition("bank", 0)).toEqual(homeObjectPosition("bank", 0));
    expect(homeObjectPosition("bank", 4)[1]).toBeGreaterThan(homeObjectPosition("bank", 0)[1]);
    expect(homeObjectPosition("jar", 5)[1]).toBeGreaterThan(homeObjectPosition("jar", 0)[1]);
  });

  it("frosts canonical planned jars, cracks only supported underfunding, and turns paid jars into shards", () => {
    expect(homeJarAppearance(jar({ type: "potential" }))).toEqual({ paid: false, frosted: true, cracked: false });
    expect(homeJarAppearance(jar({ strike: "crack", full: false, savedCents: 50, leftCents: 50, fill: 0.5, due: true }))).toEqual({ paid: false, frosted: false, cracked: true });
    expect(homeJarAppearance(jar({ strike: "hammer", due: true }))).toEqual({ paid: false, frosted: false, cracked: false });
    expect(homeJarAppearance(jar({ paid: true, strike: "shard" }))).toEqual({ paid: true, frosted: false, cracked: false });
  });
});
