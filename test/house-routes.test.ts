import { describe, expect, it } from "vitest";
import { HOUSE_LEVELS, HOUSE_ROOMS, housePath, parseHouseRoute, togetherLevelForRoom, togetherRoomForLevel } from "../src/hearthside/houseRoutes.ts";
import { hearthsidePath, parseHearthsideRoute } from "../src/hearthside/routes.ts";
import { readHearthsideToolReturn } from "../src/hearthside/focusedTool.ts";

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

  it("allows same-house Together returns without widening their scope", () => {
    const returnPath = "/house/together/below?household=HH-one&room=theatre";
    const object = {version:1 as const,householdId:"HH-one",room:"theatre" as const,mode:"remember" as const,object:{kind:"memory" as const,id:"MEM-1"},returnContext:{path:returnPath,focusId:"hearthside-title"}};
    expect(parseHearthsideRoute(hearthsidePath(object), "HH-one")?.returnContext?.path).toBe(returnPath);
    expect(readHearthsideToolReturn({scope:"scope",path:returnPath,focusId:"hearthside-title",label:"Memory",tab:"planner"}, "scope", "HH-one")?.path).toBe(returnPath);
    for (const path of ["https://outside.example/house/together/middle?household=HH-one", "//outside.example/house/together/middle?household=HH-one"]) expect(readHearthsideToolReturn({scope:"scope",path,focusId:"hearthside-title",label:"Memory",tab:"planner"},"scope","HH-one")).toBeNull();
    expect(readHearthsideToolReturn({scope:"scope",path:"/house/home/middle?household=HH-one",focusId:"hearthside-title",label:"Memory",tab:"planner"}, "scope", "HH-one")).toBeNull();
  });

  it("rejects a Together interior addressed on the wrong level, including focused returns", () => {
    for (const path of ["/house/together/above?household=HH-one&room=studio", "/house/together/middle?household=HH-one&room=theatre", "/house/together/below?household=HH-one&room=conservatory", "/house/together/middle?household=HH-one&room=unknown"]) {
      expect(parseHouseRoute(path,"HH-one")).toBeNull();
      expect(parseHearthsideRoute(path,"HH-one")).toBeNull();
      expect(readHearthsideToolReturn({scope:"scope",path,focusId:"hearthside-title",label:"Memory",tab:"planner"},"scope","HH-one")).toBeNull();
      expect(() => hearthsidePath({version:1,householdId:"HH-one",room:"theatre",mode:"remember",returnContext:{path,focusId:"hearthside-title"}})).toThrow('HEARTHSIDE_INVALID_RETURN');
    }
  });

  it("restores the exact private linked task only for its originating audience", () => {
    const record = {scope:"scope",audience:"personal",path:"/house/together/above?household=HH-one&scope=personal&object=experience%2FPRIVATE-1&surface=personal-experience",focusId:"personal-task-PRIVATE-1-TASK-1",label:"My private folio",tab:"planner",taskId:"TASK-1"};
    expect(readHearthsideToolReturn(record,"scope","HH-one","personal")).toEqual(record);
    expect(readHearthsideToolReturn(record,"scope","HH-one","household")).toBeNull();
    expect(readHearthsideToolReturn({...record,audience:"household"},"scope","HH-one","personal")).toBeNull();
    expect(readHearthsideToolReturn({...record,scope:"another-member"},"scope","HH-one","personal")).toBeNull();
    expect(readHearthsideToolReturn({...record,path:"/hearthside/rooms/common?household=HH-one&room=common&mode=present"},"scope","HH-one","personal")).toBeNull();
  });

  it("keeps malformed and unrelated paths out of the house", () => {
    for (const path of ["/house/home/roof", "/house/garage/middle", "/house/home/middle/extra", "/hearthside/rooms/common"]) {
      expect(parseHouseRoute(path,"HH-one")).toBeNull();
    }
  });
});
