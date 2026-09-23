import { HEARTHSIDE_ROOMS, type HearthsideRoom } from "./contracts.ts";
import { villageLocation, villageMatchesHouseAddress, type VillageLocation } from '../house/villageLocation.ts';

export const HOUSE_ROOMS = ["home", "study", "kitchen-table", "together", "making"] as const;
export const HOUSE_LEVELS = ["above", "middle", "below"] as const;
export type HouseRoom = typeof HOUSE_ROOMS[number];
export type HouseLevel = typeof HOUSE_LEVELS[number];
export type HouseRoute = { room: HouseRoom; level: HouseLevel; householdId: string; scope?: "personal" | "household"; object?: string; surface?: string; studioSelection?: { designId: string; pieceId: string }; studioTab?: "shape" | "paint" | "kiln"; time?: string; village?: VillageLocation };

const TOGETHER_ROOM: Record<HouseLevel, HearthsideRoom> = {
  above: "conservatory",
  middle: "common",
  below: "studio",
};

export function togetherRoomForLevel(level: HouseLevel): HearthsideRoom {
  return TOGETHER_ROOM[level];
}

export function togetherLevelForRoom(room: HearthsideRoom): HouseLevel {
  if (room === "conservatory") return "above";
  if (room === "common") return "middle";
  return "below";
}

export function housePath(route: HouseRoute): string {
  if (!HOUSE_ROOMS.includes(route.room) || !HOUSE_LEVELS.includes(route.level) || !route.householdId.trim()) throw new Error("HOUSE_INVALID_ROUTE");
  const query = new URLSearchParams({ household: route.householdId });
  if (route.room === "together") query.set("room", route.scope&&route.level==="below"?"theatre":togetherRoomForLevel(route.level));
  if (route.scope) query.set("scope", route.scope);
  if (route.village) {
    const location = villageLocation(route.village.place, route.village.room);
    if (!location || route.scope === 'personal' || !villageMatchesHouseAddress(location, route.room, route.level)) throw new Error('HOUSE_INVALID_VILLAGE_LOCATION');
    query.set('place', location.place);
    if (location.room) query.set('villageRoom', location.room);
  }
  if (route.object) query.set("object", route.object);
  if (route.surface) query.set("surface", route.surface);
  if (route.studioSelection) {
    const { designId, pieceId } = route.studioSelection;
    if (!["pottery", "wardrobe"].includes(route.surface ?? "") || !designId.trim() || !pieceId.trim() || designId.length > 180 || pieceId.length > 180 || /[\u0000-\u001f]/.test(designId) || /[\u0000-\u001f]/.test(pieceId)) throw new Error("HOUSE_INVALID_STUDIO_SELECTION");
    query.set("design", designId); query.set("piece", pieceId);
  }
  if (route.studioTab) {
    if (route.surface !== "pottery" || !["shape", "paint", "kiln"].includes(route.studioTab)) throw new Error("HOUSE_INVALID_STUDIO_BENCH");
    query.set("bench", route.studioTab);
  }
  if (route.time) query.set("time", route.time);
  return `/house/${route.room}/${route.level}?${query}`;
}

export function parseHouseRoute(url: string, householdId: string): HouseRoute | null {
  try {
    const parsed = new URL(url, "https://hearth.invalid");
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length !== 3 || parts[0] !== "house") return null;
    const room = parts[1] as HouseRoom;
    const level = parts[2] as HouseLevel;
    if (!HOUSE_ROOMS.includes(room) || !HOUSE_LEVELS.includes(level)) return null;
    const interior = parsed.searchParams.get("room");
    if (room === "together" && interior !== null && (!HEARTHSIDE_ROOMS.includes(interior as HearthsideRoom) || togetherLevelForRoom(interior as HearthsideRoom) !== level)) return null;
    const addressedHousehold = parsed.searchParams.get("household") ?? householdId;
    if (!addressedHousehold || addressedHousehold !== householdId) return null;
    const scope = parsed.searchParams.get("scope");
    if (scope !== null && scope !== "personal" && scope !== "household") return null;
    const place = parsed.searchParams.get('place'), villageRoom = parsed.searchParams.get('villageRoom');
    const village = place === null ? null : villageLocation(place, villageRoom ?? undefined);
    if (place !== null && (!village || scope === 'personal' || !villageMatchesHouseAddress(village, room, level)) || place === null && villageRoom !== null) return null;
    const bounded = (key: string) => { const value = parsed.searchParams.get(key); return value && value.length <= 180 && !/[\u0000-\u001f]/.test(value) ? value : undefined; };
    const object = bounded("object"), surface = bounded("surface"), designId = bounded("design"), pieceId = bounded("piece");
    const hasDesign = parsed.searchParams.has("design"), hasPiece = parsed.searchParams.has("piece");
    if (hasDesign !== hasPiece || hasDesign && (!designId || !pieceId || !["pottery", "wardrobe"].includes(surface ?? ""))) return null;
    const bench = parsed.searchParams.get("bench");
    if (bench !== null && (surface !== "pottery" || !["shape", "paint", "kiln"].includes(bench))) return null;
    return { room, level, householdId, ...(village ? {village} : {}), ...(bench ? {studioTab: bench as NonNullable<HouseRoute["studioTab"]>} : {}), ...(scope ? {scope} : {}), ...(object ? {object} : {}), ...(surface ? {surface} : {}), ...(designId && pieceId ? {studioSelection: {designId, pieceId}} : {}), ...(bounded("time") ? {time: bounded("time")} : {}) };
  } catch {
    return null;
  }
}
