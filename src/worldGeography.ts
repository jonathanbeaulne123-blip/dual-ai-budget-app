/** Shared by the browser and Worker; a new geography requires a new presence world. */
export const CURRENT_WORLD_GEOGRAPHY = 'hearth-mountain-geo-2' as const;
export const LEGACY_MOUNTAIN_WORLDS = ['hearth-mountain-1','hearth-mountain-2'] as const;
export type MountainWorld = typeof CURRENT_WORLD_GEOGRAPHY | (typeof LEGACY_MOUNTAIN_WORLDS)[number];
export const isMountainWorld = (value: unknown): value is MountainWorld =>
  value === CURRENT_WORLD_GEOGRAPHY || (LEGACY_MOUNTAIN_WORLDS as readonly string[]).includes(value as string);

/** The opt-in Horizon has a separate world; Mountain clients never share its coordinates. */
export const HORIZON_GEOGRAPHY = 'horizon-geo-1' as const;
export const HORIZON_PRESENCE_WORLD = 'horizon:horizon-geo-1' as const;
export const HORIZON_WORLD_BOUNDS = { minX: 0, maxX: 2000, minZ: 0, maxZ: 1800, minY: -100, maxY: 300 } as const;
export type HorizonWorld = typeof HORIZON_PRESENCE_WORLD;
export type PresenceWorld = MountainWorld | HorizonWorld;
export const isHorizonWorld = (value: unknown): value is HorizonWorld => value === HORIZON_PRESENCE_WORLD;
export const isPresenceWorld = (value: unknown): value is PresenceWorld => isMountainWorld(value) || isHorizonWorld(value);

/** Navigation can migrate older saved Horizon revisions; live presence accepts only the exact current world. */
export const isSavedHorizonWorld=(value:unknown):value is string=>typeof value==="string"&&/^horizon:horizon-geo-[0-9]{1,6}$/.test(value);
