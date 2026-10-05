import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { horizonHostFor, horizonPlaceTarget } from "../src/harbour/horizon/HorizonWorld.tsx";
import { VILLAGE_ADDRESS } from "../src/harbour/village/layout.ts";
import type { HarbourPlaceId } from "../src/harbour/flag.ts";

/**
 * The Horizon worn in the old app shell (Jonathan, 2026-09-29): the old shell's chrome (dock, panels, room bar,
 * presence, emotes) around the Horizon's land and movers; no Horizon toolbar; a Horizon that cannot open hands the
 * harbour back to the old world.
 */
const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
/** The baked world the app loads (hosts carry `returnAt`; places carry anchors), not the authoring manifest. */
const world = JSON.parse(gunzipSync(readFileSync(join(root, "public/horizon/world/horizon-geo-1.index.json.gz"))).toString("utf8")) as Parameters<typeof horizonPlaceTarget>[0];

describe("every harbour place has somewhere to walk to on the Horizon", () => {
  it.each(Object.keys(VILLAGE_ADDRESS) as HarbourPlaceId[])("%s", place => {
    const at = horizonPlaceTarget(world, place);
    expect(at).not.toBeNull();
    expect(at!.every(Number.isFinite)).toBe(true);
  });

  it("rooms of the house walk to the home door; the bank to the bank; the kiln to the studio", () => {
    expect(horizonHostFor(world, "tower")?.id).toBe("home");
    expect(horizonHostFor(world, "cellar")?.id).toBe("home");
    expect(horizonHostFor(world, "bank")?.id).toBe("bank");
    expect(horizonHostFor(world, "kiln")?.id).toBe("studio");
    expect(horizonHostFor(world, "court")).toBeNull();
  });
});

describe("the old shell's chrome around the Horizon (static)", () => {
  const shell = read("src/harbour/horizon/HorizonWorld.tsx");
  const stage = read("src/harbour/horizon/HorizonStage.tsx");
  const harbour = read("src/harbour/HarbourWorld.tsx");

  it("renders the old shell's pieces: dock, room bar, host panel, presence, Mine ribbon, Home Book, emotes", () => {
    for (const piece of ["<HarbourFlat ", "<Dock ", "<VillageHUD ", "<HostPanel ", "<WalkTogether ", "<MineRibbon ", "<HomeBookButton", "harbour-moves__emote"]) expect(shell).toContain(piece);
    expect(shell).toMatch(/className=\{`harbour-world harbour-world--\$\{theme\} harbour-world--horizon/);
  });

  it("All tools › Places and a panel's Visit quick-travel on the Horizon; a route change, the map markers and the room bar still walk", () => {
    expect(shell).toMatch(/window\.addEventListener\(HARBOUR_GO_EVENT,go\)/);
    expect(shell).toMatch(/if\(place&&Object\.hasOwn\(VILLAGE_ADDRESS,place\)\)jumpToPlace\(place as HarbourPlaceId\)/);
    expect(shell).toMatch(/onVisit=\{\(\)=>\{const host=props\.panel\?\.host;[^}]*jumpToPlace/);
    // Quick travel keeps the walk's refusals and its arrival, and never marks the place current twice (no walk after the jump).
    expect(shell).toMatch(/const jumpToPlace=useCallback\(\(place:HarbourPlaceId\)=>\{/);
    expect(shell).toMatch(/if\(riding\.attached\|\|riding\.airborne\)\{setTravelTo\(null\);setNotice\('Park the ride first, then choose where to go\.'\);return false;\}[\s\S]*?world\.quickTravel\(/);
    expect(shell).toMatch(/lastHere\.current=place;props\.onNavigateLocation\(\{\.\.\.routeRef\.current,\.\.\.VILLAGE_ADDRESS\[place\],surface:undefined,object:undefined\}\)/);
    expect(shell).toMatch(/onActivate=\{rect=>\{[^}]*walkToPlace\(place as HarbourPlaceId\)/);
    expect(shell).toMatch(/onVisit=\{place=>\{walkToPlace\(place\);\}\}/);
    // The runtime: a restore (so the chunk gate still holds the body on unloaded ground), refused for a ride, the monorail and the kitchen.
    const quick = read("src/harbour/horizon/runtime/index.ts");
    expect(quick).toMatch(/quickTravel\(p:XYZ,facing\?:number,label=''\)\{\s*schedule\(\);const busy=registry\.active\(\)\|\|monorail\?\.state\(\)\|\|kitchen\?\.active\(\);if\(busy\)return false;\s*restore\(\{world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:p\[0\],y:p\[1\],z:p\[2\],yaw:/);
    expect(quick).toMatch(/fadeCut\(label\);return true;/);
    expect(shell).toMatch(/if\(lastHere\.current===here\|\|toolOpen\|\|!worldReady\|\|riding\)return;if\(walkToPlace\(here\)\)lastHere\.current=here;/);
    // Arrival makes the place current (the old shell's Places navigated there); a ride refuses the walk and says so.
    expect(shell).toMatch(/props\.onNavigateLocation\(\{\.\.\.routeRef\.current,\.\.\.VILLAGE_ADDRESS\[travelTo\],surface:undefined/);
    expect(shell).toMatch(/if\(riding\.attached\|\|riding\.airborne\)\{setTravelTo\(null\);setNotice\(/);
    const runtime = read("src/harbour/horizon/runtime/index.ts");
    expect(runtime).toMatch(/walkTo\(p:XYZ\)\{schedule\(\);if\(registry\.active\(\)\|\|skating\(\)\|\|monorail\?\.state\(\)\)return null;/);
    expect(runtime).toMatch(/function startRide\(\)\{schedule\(\);(?:recordDiagnostic\([^;]+\);)?emote=null;/);
  });

  it("drops the Horizon toolbar inside the shell and keeps the movers' controls", () => {
    expect(shell).toMatch(/<HorizonStage shell /);
    expect(stage).toMatch(/\{!props\.shell&&<div className="horizon-toolbar"/);
    expect(stage).toMatch(/className="horizon-cruiser-controls"/);
    expect(stage).toMatch(/className="horizon-fleet"/);
    expect(stage).toMatch(/if\(latest\.current\.shell&&world\.mode\(\)!=='walk'\)/);
  });

  it("walk-together sharing is read per environment in the same render (never the previous environment's choice)", () => {
    expect(shell).toMatch(/const walkShare=walkShareState\.environment===household\.environment\?walkShareState\.share:readWorldPresenceShare\(household\.environment\);/);
    expect(shell).toMatch(/share:walkShare,world:HORIZON_PRESENCE_WORLD/);
  });

  it("a Horizon that cannot open hands the harbour back to the old world", () => {
    expect(stage).toMatch(/latest\.current\.onFailed\?\.\(message\)/);
    expect(harbour).toMatch(/if\(edition==='flat'\|\|!canDraw\|\|failed\)return <MountainHarbourWorld/);
    expect(harbour).toMatch(/class HorizonBoundary extends Component/);
  });

  it("the old skate: SkateHUD reachable across the Horizon, B boards, progress saved under the old key", () => {
    expect(shell).toMatch(/!riding&&skateAvailable&&<SkateHUD model=\{skating\}/);
    expect(shell).toMatch(/if\(k==='b'\)\{if\(board\?\.active\(\)\)leaveSkating\(\);else if\(world\.hasSkate\?\.\(\)\)startSkating\(\)/);
    expect(shell).toMatch(/skateProgressKey\(household\.environment,household\.householdId,memberId\)/);
    const runtime = read("src/harbour/horizon/runtime/index.ts");
    expect(runtime).toMatch(/const skate:NativeSkate\|null=placed\?createNativeSkate\(/);
    expect(runtime).toMatch(/else if\(skating\(\)\)skateStep\(dt\);else if\(registry\.active\(\)\)/);
    // #571 review: travel steps off the board; the camera tests what is drawn; keys reset on blur; the rider shows in first person.
    expect(shell).toMatch(/if\(world\.skate\(\)\?\.active\(\)\)\{world\.skate\(\)\?\.setAudio\(null\);world\.stopSkate\(\)/);
    expect(runtime).toMatch(/blocked:\(x,y,z,r\)=>placed\.region\.blocked\(x,y,z,r\)/);
    // Airport brake reset precedes skating input reset; both must remain in the shared blur handler.
    expect(runtime).toMatch(/function clear\(\)\{airport\.brake\(false\);skate\?\.controls\.input\(\)\?\.reset\(\);/);
    expect(runtime).toMatch(/figure\.group\.visible=mode==='walk'&&\(!firstPerson\|\|skating\(\)\)/);
    expect(read("src/harbour/horizon/HorizonStage.tsx")).toMatch(/aria-label=\{mover\?\.mode==='plane'\?FLIGHT_CONTROLS:props\.skating\?SKATE_STAGE_WORDS:/);
    expect(read("src/harbour/horizon/skate/nativeSkate.ts")).not.toMatch(/worldCollisionAt/);
    expect(shell).toContain('worldReady&&!toolOpen&&!skating&&<button type="button" className="horizon-recovery" aria-label="Reset position to safe ground"');
    expect(runtime).toMatch(/skate!\.controls\.command\('retry'\)/);
    expect(runtime).toMatch(/const saved=savedBody\(\);[\s\S]*?const node=nearestPathNode/);
    expect(runtime).not.toMatch(/if\(registry\.active\(\)\|\|monorail\?\.state\(\)\|\|kitchen\?\.active\(\)\)return false;/);
  });

  it("the Horizon figure plays the emote row", () => {
    const runtime = read("src/harbour/horizon/runtime/index.ts");
    expect(runtime).toMatch(/emote\(id:EmoteId\|null\)\{/);
    expect(runtime).toMatch(/emote:emote\.id,emoteAt:/);
  });
});
