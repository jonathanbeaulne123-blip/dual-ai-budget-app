import { describe, expect, it } from "vitest";
import { UI, gloss, postGroceriesLabel } from "../src/core/naming.ts";
import { INSTRUMENT_LABEL } from "../src/core/officeLayout.ts";

describe("Scheme A naming (D-144)", () => {
  it("keeps chrome instrument titles human", () => {
    expect(INSTRUMENT_LABEL.jars).toBe(UI.goals);
    expect(INSTRUMENT_LABEL.postcard).toBe(UI.sitDown);
    expect(INSTRUMENT_LABEL.chalkboard).toBe(UI.notes);
    expect(INSTRUMENT_LABEL.wardrobe).toBe(UI.herculesOutfits);
    expect(INSTRUMENT_LABEL.cookoff).toBe(UI.kitchenVsTakeout);
    expect(INSTRUMENT_LABEL.timesheet).toBe(UI.shifts);
    expect(INSTRUMENT_LABEL.lamp).toBe(UI.health);
  });

  it("labels grocery posts without milk-only chrome", () => {
    expect(UI.groceries).toBe("Groceries");
    expect(postGroceriesLabel()).toBe("Post groceries");
    expect(postGroceriesLabel("$6.49")).toBe("Post groceries $6.49");
  });

  it("glosses Hercules metaphors with human meaning", () => {
    expect(gloss("Milk", "ordinary groceries")).toBe("Milk — ordinary groceries");
    expect(gloss("Tax milk", "educational tip tax set-aside")).toContain("educational tip tax set-aside");
    expect(gloss("Groceries", "Groceries")).toBe("Groceries");
  });
});
