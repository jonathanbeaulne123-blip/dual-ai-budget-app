import { HEARTHSIDE_ROOMS, type HearthsideRoom } from "./contracts.ts";

export const HOUSE_ROOMS = ["home", "study", "kitchen-table", "together"] as const;
export const HOUSE_LEVELS = ["above", "middle", "below"] as const;
export type HouseRoom = typeof HOUSE_ROOMS[number];
export type HouseLevel = typeof HOUSE_LEVELS[number];
export type HouseRoute = { room: HouseRoom; level: HouseLevel; householdId: string };

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
  if (route.room === "together") query.set("room", togetherRoomForLevel(route.level));
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
    return { room, level, householdId };
  } catch {
    return null;
  }
}
