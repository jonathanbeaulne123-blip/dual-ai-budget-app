import { describe, expect, it } from "vitest";
import { personalFolioDraftObject, personalFolioObject, personalFolioObjectPath } from "../src/house/personalFolioRoute.ts";

describe("personal folio route identity", () => {
  it("keeps old generic drafts compatible while isolating addressed pages", () => {
    const page = personalFolioObject("wish/WISH-1");
    expect(personalFolioDraftObject("scope", null)).toBe("folio:scope");
    expect(personalFolioDraftObject("scope", page)).toBe("object:wish/WISH-1");
    expect(personalFolioObjectPath("note", "NOTE-2")).toBe("note/NOTE-2");
  });

  it("rejects a malformed or cross-room object address", () => {
    expect(personalFolioObject("piece/PIECE/DESIGN")).toBeNull();
    expect(personalFolioObject("memory/")).toBeNull();
    expect(personalFolioObject("wish/A/extra")).toBeNull();
  });
});
