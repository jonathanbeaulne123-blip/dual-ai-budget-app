/** Shared by the browser and Worker; a new geography requires a new presence world. */
export const CURRENT_WORLD_GEOGRAPHY = 'hearth-mountain-geo-2' as const;
export const LEGACY_MOUNTAIN_WORLDS = ['hearth-mountain-1','hearth-mountain-2'] as const;
export type MountainWorld = typeof CURRENT_WORLD_GEOGRAPHY | (typeof LEGACY_MOUNTAIN_WORLDS)[number];
export const isMountainWorld = (value: unknown): value is MountainWorld =>
  value === CURRENT_WORLD_GEOGRAPHY || (LEGACY_MOUNTAIN_WORLDS as readonly string[]).includes(value as string);
