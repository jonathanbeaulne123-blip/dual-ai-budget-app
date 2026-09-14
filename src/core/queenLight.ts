/**
 * Living light (2026-09-14): where the sun is over the household's civil
 * day, as one small number pair. Low and blue on a February evening, high
 * and warm in July. Pure; computed from the books' civil date and the
 * device clock, at the latitude of the books' zone (America/Toronto, D-126).
 *
 * It changes across hours and never animates. It scales the room's lamps
 * within a bounded range and never touches the material axis, so glazed
 * versus matte reads at every hour of the year.
 */
export type QueenLight = {
  /** 0 (deep night) .. 1 (high noon). Never below `QUEEN_LIGHT.floor` when applied. */
  level: number;
  /** 0 (blue, winter, dusk) .. 1 (warm, summer, day). */
  warmth: number;
  /** Sun elevation in degrees, for the words. */
  elevation: number;
  words: string;
};

export const QUEEN_LIGHT = {
  latitude: 43.7,
  /** The lamps never drop below this share of their full strength: she must stay legible, and the glaze axis must still read. */
  floor: 0.62,
} as const;

const RAD = Math.PI / 180;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Day of year, 1..366, from a civil date key. */
function dayOfYear(date: string): number {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7)), d = Number(date.slice(8, 10));
  if (![y, m, d].every(Number.isFinite)) return 172;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
}

/** `date` is the books' civil date (YYYY-MM-DD); `hour` is the local clock in hours, 0..24, fractional. */
export function queenLight(date: string, hour: number): QueenLight {
  const doy = dayOfYear(date);
  const declination = -23.44 * Math.cos(((360 / 365) * (doy + 10)) * RAD);
  // Quantized to the quarter hour: the light steps a few times an hour and never slides.
  const quarter = Math.floor(Math.max(0, Math.min(24, hour)) * 4) / 4;
  const hourAngle = (quarter - 12) * 15;
  const lat = QUEEN_LIGHT.latitude * RAD, dec = declination * RAD;
  const sinElevation = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle * RAD);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation))) / RAD;
  // Level: full at the year's highest sun (about 70° here), civil dusk at -6° reads as night.
  const level = clamp01((elevation + 6) / 76);
  // Warmth: the season (summer sun is high and warm) softened by the hour (a low sun is blue at dusk, not golden — this is a room, not a sunset).
  const season = clamp01((declination + 23.44) / 46.88);
  const warmth = clamp01(0.15 + season * 0.55 + level * 0.3);
  const time = elevation < -6 ? "night" : elevation < 8 ? "dusk" : elevation < 35 ? "morning or afternoon" : "midday";
  const words = `${time === "night" ? "Low, blue night light" : time === "dusk" ? "Low light" : time === "midday" ? "High light" : "Daylight"}, ${warmth > 0.6 ? "warm" : warmth > 0.4 ? "even" : "cool"}.`;
  return { level: Math.round(level * 1000) / 1000, warmth: Math.round(warmth * 1000) / 1000, elevation: Math.round(elevation * 10) / 10, words };
}

/** The lamps, scaled: a share of full strength that never drops under the floor. */
export const queenLampShare = (light: Pick<QueenLight, "level">): number => QUEEN_LIGHT.floor + (1 - QUEEN_LIGHT.floor) * light.level;

/** The local hour, fractional, in the device's own clock (each phone may display its own zone). */
export function localHour(now: Date = new Date()): number {
  return now.getHours() + now.getMinutes() / 60;
}
