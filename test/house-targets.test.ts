import { describe, expect, it } from "vitest";
import { houseTargets, personalFolioPage, personalSurfaceAvailable } from "../src/house/houseTargets.ts";

describe("scope-aware house targets", () => {
  it("does not advertise shared-only Common room actions in Personal scope", () => {
    expect(houseTargets("personal", "together", "middle").map(target => target.id)).toEqual(["pottery", "letters"]);
    expect(houseTargets("personal", "together", "below").map(target => target.id)).toEqual(["memories"]);
    expect(houseTargets("household", "together", "middle").map(target => target.id)).toContain("encounters");
    expect(houseTargets("household", "together", "below").map(target => target.id)).toContain("projector");
  });

  it("maps supported private furnishings to the matching folio page", () => {
    expect(personalFolioPage("wishes")).toBe("wish");
    expect(personalFolioPage("letters")).toBe("note");
    expect(personalFolioPage("memories")).toBe("memory");
    expect(personalFolioPage("encounters")).toBeNull();
    expect(personalSurfaceAvailable("encounters")).toBe(false);
    expect(personalSurfaceAvailable("projector")).toBe(false);
  });
});
