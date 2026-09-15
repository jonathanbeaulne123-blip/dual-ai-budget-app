import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { demoSuiteSeatFor } from "../src/demoSuiteIdentity.ts";
import type { Household } from "../src/core/types.ts";

/** A generated showcase always has the fixture's two seats: MEM-001 Bianca, MEM-002 Jonathan. */
function showcase(): Household {
  const h = catalogHousehold("development");
  return { ...h, householdId: "HH-showcase", syntheticFixture: { kind: "hearth-demo-suite" } as Household["syntheticFixture"] };
}

describe("the seat a person takes in a generated Demo Suite or habitat", () => {
  it("steps into the seat with their name when the pressing household uses its own member ids", () => {
    const own = catalogHousehold("development");
    own.members = [
      { ...own.members[0]!, id: "MEM-8f2c", name: "Bianca" },
      { ...own.members[1]!, id: "MEM-41aa", name: "jonathan " },
    ];
    expect(demoSuiteSeatFor(own, "MEM-8f2c", showcase())).toBe("MEM-001");
    expect(demoSuiteSeatFor(own, "MEM-41aa", showcase())).toBe("MEM-002");
  });

  it("falls back to Jonathan's seat when no name matches — an invited person, or a renamed household", () => {
    const own = catalogHousehold("development");
    own.members = [{ ...own.members[0]!, id: "MEM-invited", name: "Invited person" }];
    expect(demoSuiteSeatFor(own, "MEM-invited", showcase())).toBe("MEM-002");
  });

  it("keeps the seat already held when replacing an existing fixture, and never chooses a seat outside the household", () => {
    const fixture = showcase();
    expect(demoSuiteSeatFor(fixture, "MEM-001", showcase())).toBe("MEM-001");
    const generated = showcase();
    const seat = demoSuiteSeatFor(catalogHousehold("development"), "MEM-nobody", generated);
    expect(generated.members.some((row) => row.active && row.id === seat)).toBe(true);
  });
});
