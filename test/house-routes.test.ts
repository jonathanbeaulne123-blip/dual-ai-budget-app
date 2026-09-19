import { describe, expect, it } from "vitest";
import { HOUSE_LEVELS, HOUSE_ROOMS, housePath, parseHouseRoute, togetherLevelForRoom, togetherRoomForLevel } from "../src/hearthside/houseRoutes.ts";
import { parseHearthsideRoute } from "../src/hearthside/routes.ts";

describe("the unified web house address", () => {
  it("round-trips every room and level without crossing households", () => {
    for (const room of HOUSE_ROOMS) for (const level of HOUSE_LEVELS) {
      const route = {room, level, householdId:"HH-one"} as const;
      const path = housePath(route);
      expect(parseHouseRoute(path,"HH-one")).toEqual(route);
      expect(parseHouseRoute(path,"HH-two")).toBeNull();
    }
  });

  it("maps Together levels onto the retained Hearthside interiors", () => {
    expect(togetherRoomForLevel("above")).toBe("conservatory");
    expect(togetherRoomForLevel("middle")).toBe("common");
    expect(togetherRoomForLevel("below")).toBe("studio");
    expect(togetherLevelForRoom("theatre")).toBe("below");
    expect(parseHearthsideRoute("/house/together/above?household=HH-one","HH-one")?.room).toBe("conservatory");
    expect(parseHearthsideRoute("/house/together/below?household=HH-one&room=theatre","HH-one")?.room).toBe("theatre");
  });

  it("keeps Hearthside's object and focused-surface addresses as aliases", () => {
    expect(parseHearthsideRoute("/hearthside/memories/MEM-1?household=HH-one&room=theatre&mode=remember", "HH-one")).toMatchObject({
      room: "theatre", mode: "remember", object: { kind: "memory", id: "MEM-1" },
    });
    expect(parseHearthsideRoute("/hearthside/rooms/studio?household=HH-one&room=studio&mode=present&surface=wardrobe&design=DES-1&piece=PIECE-1", "HH-one")).toMatchObject({
      room: "studio", surface: "wardrobe", studioSelection: { designId: "DES-1", pieceId: "PIECE-1" },
    });
  });

  it("keeps malformed and unrelated paths out of the house", () => {
    for (const path of ["/house/home/roof", "/house/garage/middle", "/house/home/middle/extra", "/hearthside/rooms/common"]) {
      expect(parseHouseRoute(path,"HH-one")).toBeNull();
    }
  });
});
