import { describe, expect, it } from "vitest";
import { ARRIVAL_KEY_PREFIX, arrivalKey, harbourArrivalRoute, hasArrived, markArrived, type ArrivalSession } from "../src/harbour/nav/arrival.ts";
import { COURT_ROUTE, HARBOUR_ENABLED, HARBOUR_PLACE_LEVELS, HARBOUR_PLACE_NAMES, HARBOUR_ROOMS, HARBOUR_WAYS, harbourOwnsRoute, harbourPlaceFor, harbourWayFor } from "../src/harbour/flag.ts";
import type { HouseRoute } from "../src/hearthside/houseRoutes.ts";

function fakeSession(): ArrivalSession & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return { store, getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); } };
}
const identity = "development:HH-one:MEM-001:household";
const saved: HouseRoute = { room: "study", level: "above", householdId: "HH-one", scope: "household" };

describe("the flag", () => {
  it("is off in vitest so the unchanged App runs", () => {
    expect(HARBOUR_ENABLED).toBe(false);
    expect(harbourOwnsRoute({ room: "home", level: "middle" }, "household")).toBe(false);
  });
  it("owns Household rooms by room and level, from one table", () => {
    expect(HARBOUR_ROOMS).toEqual({
      home: { above: "tower", middle: "court", below: "cellar" },
      study: { above: "glasshouse", middle: "library", below: "glasshouse" },
      // Journey (`kitchen-table`/above) keeps the house's own atlas.
      "kitchen-table": { middle: "kitchen", below: "kitchen" },
      together: { above: "boathouse", middle: "boathouse", below: "boathouse" },
    });
    expect(harbourOwnsRoute({ room: "home", level: "middle" }, "household", true)).toBe(true);
    expect(harbourOwnsRoute({ room: "study", level: "above" }, "household", true)).toBe(true);
    expect(harbourOwnsRoute({ room: "study", level: "below" }, "household", true)).toBe(true);
    expect(harbourOwnsRoute({ room: "study", level: "middle" }, "household", true)).toBe(true);
    expect(harbourOwnsRoute({ room: "kitchen-table", level: "above" }, "household", true)).toBe(false);
    expect(harbourOwnsRoute({ room: "together", level: "middle" }, "household", true)).toBe(true);
    expect(harbourOwnsRoute({ room: "home", level: "middle" }, "personal", true)).toBe(false);
    expect(harbourOwnsRoute(null, "household", true)).toBe(false);
  });
  it("gives each level of home its own place", () => {
    expect(harbourPlaceFor({ room: "home", level: "middle" }, "household", true)).toBe("court");
    expect(harbourPlaceFor({ room: "home", level: "above" }, "household", true)).toBe("tower");
    expect(harbourPlaceFor({ room: "home", level: "below" }, "household", true)).toBe("cellar");
    expect(harbourPlaceFor({ room: "together", level: "middle" }, "household", true)).toBe("boathouse");
    expect(harbourPlaceFor({ room: "kitchen-table", level: "middle" }, "household", true)).toBe("kitchen");
    expect(harbourPlaceFor({ room: "kitchen-table", level: "above" }, "household", true)).toBeNull();
    expect(harbourPlaceFor({ room: "study", level: "above" }, "household", true)).toBe("glasshouse");
    expect(harbourPlaceFor({ room: "study", level: "middle" }, "household", true)).toBe("library");
    expect(harbourPlaceFor({ room: "home", level: "middle" }, "personal", true)).toBeNull();
    expect(harbourPlaceFor({ room: "home", level: "middle" }, "household")).toBeNull();
  });
  it("names each place and the level it stands on", () => {
    expect(HARBOUR_PLACE_NAMES).toEqual({ court: "the Court", tower: "the Tower", cellar: "the Cellar", glasshouse: "the Glasshouse", kitchen: "the Kitchen", boathouse: "the Boathouse", library: "the Library" });
    expect(HARBOUR_PLACE_LEVELS).toEqual({ court: "middle", tower: "above", cellar: "below", glasshouse: "above", kitchen: "middle", boathouse: "middle", library: "middle" });
  });
  it("names the Court as home/middle in the household scope", () => {
    expect(COURT_ROUTE("HH-one")).toEqual({ room: "home", level: "middle", householdId: "HH-one", scope: "household" });
  });
});

describe("harbourArrivalRoute", () => {
  it("lands a fresh tab on the Court and marks the tab", () => {
    const session = fakeSession();
    const route = harbourArrivalRoute({ saved, scope: "household", householdId: "HH-one", identity, session, enabled: true });
    expect(route).toEqual(COURT_ROUTE("HH-one"));
    expect(session.store.get(`${ARRIVAL_KEY_PREFIX}${identity}`)).toBe("1");
    expect(hasArrived(session, identity)).toBe(true);
  });
  it("keeps the saved return route once the tab has arrived", () => {
    const session = fakeSession();
    markArrived(session, identity);
    expect(harbourArrivalRoute({ saved, scope: "household", householdId: "HH-one", identity, session, enabled: true })).toBe(saved);
  });
  it("keeps today's home/middle default when nothing is saved and the tab has arrived", () => {
    const session = fakeSession();
    markArrived(session, identity);
    expect(harbourArrivalRoute({ saved: null, scope: "household", householdId: "HH-one", identity, session, enabled: true }))
      .toEqual({ room: "home", level: "middle", householdId: "HH-one", scope: "household" });
  });
  it("never touches the Personal scope", () => {
    const session = fakeSession();
    const personal: HouseRoute = { ...saved, scope: "personal" };
    expect(harbourArrivalRoute({ saved: personal, scope: "personal", householdId: "HH-one", identity, session, enabled: true })).toBe(personal);
    expect(session.store.size).toBe(0);
  });
  it("is today's behaviour when the flag is off", () => {
    const session = fakeSession();
    expect(harbourArrivalRoute({ saved, scope: "household", householdId: "HH-one", identity, session })).toBe(saved);
    expect(harbourArrivalRoute({ saved: undefined, scope: "household", householdId: "HH-one", identity, session, enabled: false }))
      .toEqual({ room: "home", level: "middle", householdId: "HH-one", scope: "household" });
    expect(session.store.size).toBe(0);
  });
  it("keys the marker per identity so another member or environment arrives on its own", () => {
    const session = fakeSession();
    harbourArrivalRoute({ saved, scope: "household", householdId: "HH-one", identity, session, enabled: true });
    const other = "production:HH-one:MEM-002:household";
    expect(harbourArrivalRoute({ saved, scope: "household", householdId: "HH-one", identity: other, session, enabled: true })).toEqual(COURT_ROUTE("HH-one"));
    expect([...session.store.keys()].sort()).toEqual([arrivalKey(identity), arrivalKey(other)].sort());
  });
  it("survives a storage that throws or is missing", () => {
    const broken: ArrivalSession = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(harbourArrivalRoute({ saved, scope: "household", householdId: "HH-one", identity, session: broken, enabled: true })).toEqual(COURT_ROUTE("HH-one"));
    expect(harbourArrivalRoute({ saved, scope: "household", householdId: "HH-one", identity, session: null, enabled: true })).toEqual(COURT_ROUTE("HH-one"));
  });
});

describe("ways into the other places of the room", () => {
  it("sends the Rook up, the Bishop and the stairhead down, and a stair back to the Court", () => {
    expect(harbourWayFor("rook")).toBe("tower");
    expect(harbourWayFor("bishop")).toBe("cellar");
    expect(harbourWayFor("cellar-stair", "stair")).toBe("cellar");
    expect(harbourWayFor("stair", "stair")).toBe("court");
    // A place may add a stair of its own without amending the table.
    expect(harbourWayFor("back-stair", "stair")).toBe("court");
  });

  it("leaves the Knight and every door alone", () => {
    expect(harbourWayFor("knight")).toBeNull();
    expect(harbourWayFor("cistern")).toBeNull();
    expect(harbourWayFor("sundial", "prop")).toBeNull();
    expect(harbourWayFor("jar:bank/rent", "jar")).toBeNull();
    expect(harbourWayFor("bank:goal:trip", "bank")).toBeNull();
  });

  it("names a level for every way, so a tap is one navigation", () => {
    for (const [anchor, place] of Object.entries(HARBOUR_WAYS)) {
      expect(HARBOUR_PLACE_LEVELS[place], anchor).toMatch(/^(above|middle|below)$/);
    }
    expect(HARBOUR_PLACE_LEVELS[harbourWayFor("rook")!]).toBe("above");
    expect(HARBOUR_PLACE_LEVELS[harbourWayFor("bishop")!]).toBe("below");
  });
});
