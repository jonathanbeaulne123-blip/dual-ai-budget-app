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

  it("All tools › Places walks on the Horizon (HARBOUR_GO_EVENT), as do a panel's Visit and a route change", () => {
    expect(shell).toMatch(/window\.addEventListener\(HARBOUR_GO_EVENT,go\)/);
    expect(shell).toMatch(/onVisit=\{\(\)=>\{const host=props\.panel\?\.host;[^}]*walkToPlace/);
    expect(shell).toMatch(/if\(!toolOpen\)walkToPlace\(here\)/);
  });

  it("drops the Horizon toolbar inside the shell and keeps the movers' controls", () => {
    expect(shell).toMatch(/<HorizonStage shell /);
    expect(stage).toMatch(/\{!props\.shell&&<div className="horizon-toolbar"/);
    expect(stage).toMatch(/className="horizon-cruiser-controls"/);
    expect(stage).toMatch(/className="horizon-fleet"/);
    expect(stage).toMatch(/if\(latest\.current\.shell&&world\.mode\(\)!=='walk'\)/);
  });

  it("a Horizon that cannot open hands the harbour back to the old world", () => {
    expect(stage).toMatch(/latest\.current\.onFailed\?\.\(message\)/);
    expect(harbour).toMatch(/if\(edition==='flat'\|\|!canDraw\|\|failed\)return <MountainHarbourWorld/);
    expect(harbour).toMatch(/class HorizonBoundary extends Component/);
  });

  it("the old skate: SkateHUD on Mountain v2's island, B boards, progress saved under the old key", () => {
    expect(shell).toMatch(/\(skating\|\|canSkate\)&&<SkateHUD model=\{skating\}/);
    expect(shell).toMatch(/if\(k==='b'\)\{if\(board\?\.active\(\)\)leaveSkating\(\);else if\(world\.canSkate\(\)\)startSkating\(\)/);
    expect(shell).toMatch(/skateProgressKey\(household\.environment,household\.householdId,memberId\)/);
    const runtime = read("src/harbour/horizon/runtime/index.ts");
    expect(runtime).toMatch(/const skate:NativeSkate\|null=placed\?createNativeSkate\(/);
    expect(runtime).toMatch(/if\(skating\(\)\)skateStep\(dt\);else if\(registry\.active\(\)\)/);
  });

  it("the Horizon figure plays the emote row", () => {
    const runtime = read("src/harbour/horizon/runtime/index.ts");
    expect(runtime).toMatch(/emote\(id:EmoteId\|null\)\{/);
    expect(runtime).toMatch(/emote:emote\.id,emoteAt:/);
  });
});
