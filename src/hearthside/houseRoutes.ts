import { HEARTHSIDE_ROOMS, type HearthsideRoom } from "./contracts.ts";

export const HOUSE_ROOMS = ["home", "study", "kitchen-table", "together"] as const;
export const HOUSE_LEVELS = ["above", "middle", "below"] as const;
export type HouseRoom = typeof HOUSE_ROOMS[number];
export type HouseLevel = typeof HOUSE_LEVELS[number];
export type HouseRoute = { room: HouseRoom; level: HouseLevel; householdId: string; scope?: "personal" | "household"; object?: string; surface?: string; time?: string };

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
  if (route.object) query.set("object", route.object);
  if (route.surface) query.set("surface", route.surface);
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
    const bounded = (key: string) => { const value = parsed.searchParams.get(key); return value && value.length <= 180 && !/[\u0000-\u001f]/.test(value) ? value : undefined; };
    return { room, level, householdId, ...(scope ? {scope} : {}), ...(bounded("object") ? {object: bounded("object")} : {}), ...(bounded("surface") ? {surface: bounded("surface")} : {}), ...(bounded("time") ? {time: bounded("time")} : {}) };
  } catch {
    return null;
  }
}
