import {buildAirportMap} from "./airport.ts";
/**
 * `buildJourneyRouteLand()` (T2, @deprecated by the Horizon Clock's clay `buildJourneyLand` in `clay.ts`): the low-poly bird's-eye island as one three.js Group the board layer stands on.
 *
 * Terrain (20 m lattice, compressed heights, paint/height colours) · sea plane + water bodies · line ribbons per kind ·
 * the road's bridges, covered stretches and boulevard reaches (ROAD.md §7; `road.ts`, `bridges.ts`) · hosts (the
 * shared "Our home" included) · reserve outlines · the viewer's home(s) at map scale. No vegetation,
 * moving fleet, sky effects, district chunks, lights or scene state (the board scene owns lights, fog and background from the dressing).
 * Budget (PLAN §A): ≤ 25k triangles / ≤ 20 draw calls on full, ≤ 15k triangles on lite; `stats()` reports it.
 */
import * as THREE from "three";
import type { BuildJourneyLand, JourneyHome, JourneyLandData, JourneyLandHandle, Point3, StationId, ThemeId } from "../contracts.ts";
import { compressHeight } from "../contracts.ts";
import { countDraws } from "./clayKit.ts";
import { landDressing } from "./dressing.ts";
import { buildHomes, type HomeMeshes, type Season } from "./homes.ts";
import { buildHosts, HOST_MIN_PX } from "./hosts.ts";
import { buildBridges } from "./bridges.ts";
import { buildLines, landViewUniforms, MINOR_LINES_NAME, type LandViewUniforms, setStationPadMasks, type StationPadMask } from "./lines.ts";
import { planRoad } from "./road.ts";
import { createLandSurface } from "./surface.ts";
import { buildTerrainMesh } from "./terrain.ts";
import { buildWater } from "./water.ts";

export const JOURNEY_LAND_GROUP_NAME = "journey-land";
/** The land's own share of the board budget (PLAN §A). */
export const JOURNEY_LAND_BUDGET = { full: { triangles: 25_000, drawCalls: 20 }, lite: { triangles: 15_000, drawCalls: 20 } } as const;

export { countDraws };

/**
 * Show or hide the land's Sky-only simplifications on a built land: minor roads (spurs, plot service roads) are hidden
 * at Sky and shown from Region inward. The board scene calls this when its camera tier changes.
 */
export function setJourneyLandTier(land: Pick<JourneyLandHandle, "group">, tier: "sky" | "region" | "stop"): void {
  const minor = land.group.getObjectByName(MINOR_LINES_NAME);
  if (minor) minor.visible = tier !== "sky";
  const view = land.group.userData.view as LandViewUniforms | undefined;
  if (view) view.uHostPx.value = HOST_MIN_PX[tier];
}

/**
 * The view the land is drawn at (T7): world units per CSS pixel. Line widths are screen widths clamped in world units
 * and hosts keep a screen-constant minimum size, so the board scene calls this whenever the camera moves (a uniform
 * write — no rebuild). Optional `tier` also applies `setJourneyLandTier`.
 */
export function setJourneyLandView(land: Pick<JourneyLandHandle, "group">, view: { worldPerPixel: number; tier?: "sky" | "region" | "stop"; stationPads?: readonly StationPadMask[] }): void {
  const u = land.group.userData.view as LandViewUniforms | undefined;
  if (u && Number.isFinite(view.worldPerPixel) && view.worldPerPixel > 0) u.uWpp.value = view.worldPerPixel;
  if (u && view.stationPads) setStationPadMasks(u, view.stationPads);
  if (view.tier) setJourneyLandTier(land, view.tier);
}

/**
 * @deprecated Horizon Clock: the route board's flat, concept-metre land (read by the deprecated `board/scene.ts`
 * route board and its tests). The clay diorama land is `buildJourneyLand` (`clay.ts`). Deleted by the integrator
 * with the route board.
 */
export const buildJourneyRouteLand: BuildJourneyLand = (data: JourneyLandData, options): JourneyLandHandle => {
  let theme: ThemeId = options.theme;
  let dressing = landDressing(theme);
  const season: Season = options.season ?? "summer";
  const surface = createLandSurface(data);
  const group = new THREE.Group();
  group.name = JOURNEY_LAND_GROUP_NAME;
  group.userData.tier = options.tier;
  const view = landViewUniforms();
  group.userData.view = view;

  const terrain = buildTerrainMesh(data, dressing);
  const water = buildWater(data, surface, dressing);
  const road = planRoad(data, surface, options.tier);
  const lines = buildLines(road, dressing, view);
  const bridges = buildBridges(road.bridges, surface, dressing, view);
  const hosts = buildHosts(data, surface, dressing, view);
  const airport=buildAirportMap(dressing.hostRoof,dressing.road);group.add(airport.mesh);
  group.add(water.sea, terrain.mesh);
  if (water.bodies) group.add(water.bodies);
  for (const mesh of lines.meshes) group.add(mesh);
  if (bridges.mesh) group.add(bridges.mesh);
  if (hosts.shadows) group.add(hosts.shadows);
  if (hosts.hosts) group.add(hosts.hosts);
  if (hosts.reserves) group.add(hosts.reserves);
  let homes: HomeMeshes = buildHomes(options.homes, data, surface, dressing, season);
  group.add(homes.group);

  const stations = new Map(data.stations.map((s) => [s.id, s]));
  const worldToBoard = (x: number, y: number, lift = 0): Point3 => [x, compressHeight(surface.rawHeightAt(x, y)) + lift, y];
  let disposed = false;

  return {
    group,
    data,
    worldToBoard,
    heightAt: surface.heightAt,
    rawHeightAt: surface.rawHeightAt,
    isLand: surface.isLand,
    stationAt(id: StationId): Point3 {
      const s = stations.get(id);
      if (!s) throw new Error(`Unknown station ${id}`);
      return worldToBoard(s.anchor[0], s.anchor[1]);
    },
    setTheme(next: ThemeId) {
      if (next === theme) return;
      theme = next; dressing = landDressing(next);
      airport.recolour(dressing.hostRoof,dressing.road);terrain.recolour(dressing); water.recolour(dressing); lines.recolour(dressing); bridges.recolour(dressing); hosts.recolour(dressing); homes.recolour(dressing);
    },
    setHomes(next: JourneyHome[]) {
      if (disposed) return;
      homes.dispose();
      homes = buildHomes(next, data, surface, dressing, season);
      group.add(homes.group);
    },
    stats: () => countDraws(group),
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      airport.dispose();terrain.dispose(); water.dispose(); lines.dispose(); bridges.dispose(); hosts.dispose(); homes.dispose();
      group.clear();
    },
  };
};
