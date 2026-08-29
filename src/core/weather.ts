import { hourInToronto, kitchenSeason, type DateKey } from "./calendar.ts";
import type { Environment } from "./types.ts";
import type { ShiftWeatherContext } from "./shiftEnvelope.ts";

export type WeatherGlass = "clear" | "rain" | "snow" | "night" | "humid";

export type WeatherReading = {
  glass: WeatherGlass;
  celsius: number | null;
  windKmh: number | null;
  sentence: string;
  season: ReturnType<typeof kitchenSeason>;
  source: "live" | "fallback";
  fetchedAt: string;
};

export type WeatherChip = { emoji: string; word: string; celsiusLabel: string };

export const WEATHER_TTL_MS = 30 * 60 * 1000;
export const WEATHER_TIMEOUT_MS = 4000;
export const TORONTO = { latitude: 43.65, longitude: -79.38 };

export function openMeteoUrl(latitude: number, longitude: number, timeZone = "America/Toronto"): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code,is_day,wind_speed_10m&timezone=${encodeURIComponent(timeZone)}`;
}

export const OPEN_METEO_URL = openMeteoUrl(TORONTO.latitude, TORONTO.longitude);

export function openMeteoHistoricalUrl(input: {
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt: string;
}): string {
  const start = new Date(input.startedAt);
  const end = new Date(input.endedAt);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: (Math.round(input.latitude * 100) / 100).toFixed(2),
    longitude: (Math.round(input.longitude * 100) / 100).toFixed(2),
    start_date: date(start),
    end_date: date(end),
    hourly: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    timezone: "UTC",
  });
  return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
}

export function pendingHistoricalWeather(input: {
  latitude: number | null;
  longitude: number | null;
  startedAt: string;
  endedAt: string;
}, state: ShiftWeatherContext["state"] = "pending"): ShiftWeatherContext {
  return {
    state,
    source: "open-meteo-historical",
    latitudeRounded: input.latitude == null ? null : Math.round(input.latitude * 100) / 100,
    longitudeRounded: input.longitude == null ? null : Math.round(input.longitude * 100) / 100,
    intervalStartedAt: new Date(input.startedAt).toISOString(),
    intervalEndedAt: new Date(input.endedAt).toISOString(),
    midpointTemperatureCelsius: null,
    apparentTemperatureCelsius: null,
    precipitationMm: null,
    weatherCode: null,
    windKph: null,
    fetchedAt: null,
  };
}

/** Historical context for the actual work interval. Failure is proposal-only and never blocks Confirm. */
export async function readHistoricalShiftWeather(input: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  startedAt: string;
  endedAt: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ShiftWeatherContext> {
  const latitude = typeof input.latitude === "number" && Number.isFinite(input.latitude) ? input.latitude : null;
  const longitude = typeof input.longitude === "number" && Number.isFinite(input.longitude) ? input.longitude : null;
  const pending = pendingHistoricalWeather({ latitude, longitude, startedAt: input.startedAt, endedAt: input.endedAt });
  if (latitude == null || longitude == null) return pending;
  const started = Date.parse(input.startedAt);
  const ended = Date.parse(input.endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started || ended - started > 48 * 60 * 60 * 1000) return { ...pending, state: "unavailable" };
  const fetchImpl = input.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchImpl) return pending;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? WEATHER_TIMEOUT_MS);
  try {
    const response = await fetchImpl(openMeteoHistoricalUrl({ latitude, longitude, startedAt: input.startedAt, endedAt: input.endedAt }), { signal: controller.signal });
    if (!response.ok) return pending;
    const body = await response.json() as { hourly?: Record<string, unknown> };
    const hourly = body.hourly;
    const times = Array.isArray(hourly?.time) ? hourly.time as unknown[] : [];
    const temps = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m as unknown[] : [];
    const apparent = Array.isArray(hourly?.apparent_temperature) ? hourly.apparent_temperature as unknown[] : [];
    const precip = Array.isArray(hourly?.precipitation) ? hourly.precipitation as unknown[] : [];
    const codes = Array.isArray(hourly?.weather_code) ? hourly.weather_code as unknown[] : [];
    const winds = Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m as unknown[] : [];
    const points = times.slice(0, 72).flatMap((raw, index) => {
      const at = Date.parse(`${String(raw)}Z`);
      if (!Number.isFinite(at) || at < started - 30 * 60_000 || at > ended + 30 * 60_000) return [];
      const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
      return [{ at, temperature: number(temps[index]), apparent: number(apparent[index]), precipitation: number(precip[index]), code: number(codes[index]), wind: number(winds[index]) }];
    });
    if (!points.length) return pending;
    const midpoint = started + (ended - started) / 2;
    const midpointPoint = [...points].sort((a, b) => Math.abs(a.at - midpoint) - Math.abs(b.at - midpoint))[0]!;
    const average = (values: Array<number | null>) => {
      const present = values.filter((value): value is number => value != null);
      return present.length ? Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 10) / 10 : null;
    };
    const codeCounts = new Map<number, number>();
    for (const point of points) if (point.code != null) codeCounts.set(Math.round(point.code), (codeCounts.get(Math.round(point.code)) ?? 0) + 1);
    const weatherCode = [...codeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
    const precipitationValues = points.map((point) => point.precipitation).filter((value): value is number => value != null);
    return {
      ...pending,
      state: "complete",
      midpointTemperatureCelsius: midpointPoint.temperature == null ? null : Math.round(midpointPoint.temperature * 10) / 10,
      apparentTemperatureCelsius: average(points.map((point) => point.apparent)),
      precipitationMm: precipitationValues.length ? Math.round(precipitationValues.reduce((sum, value) => sum + value, 0) * 10) / 10 : null,
      weatherCode,
      windKph: average(points.map((point) => point.wind)),
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return pending;
  } finally {
    clearTimeout(timer);
  }
}

export function historicalWeatherGlass(weather: ShiftWeatherContext): WeatherGlass | null {
  if (weather.state !== "complete") return null;
  const code = weather.weatherCode ?? 0;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((weather.precipitationMm ?? 0) > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  return "clear";
}

export type WeatherStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type CacheRow = {
  reading: WeatherReading;
  storedAt: number;
};

export function weatherCacheKey(environment: Environment): string {
  return `hearth.weather.${environment}`;
}

export function fallbackWeather(today: DateKey, now = new Date()): WeatherReading {
  const hour = hourInToronto(now);
  const season = kitchenSeason(today);
  const night = hour < 6 || hour >= 20;
  let glass: WeatherGlass = "clear";
  if (night) glass = "night";
  else if (season === "ruff") glass = "snow";
  else if (season === "patio") glass = "humid";
  return {
    glass,
    celsius: null,
    windKmh: null,
    sentence: fallbackSentence(glass, season, hour),
    season,
    source: "fallback",
    fetchedAt: now.toISOString(),
  };
}

/** One emoji, one accurate word, and Celsius for the chalkboard overlay. */
export function weatherChip(reading: WeatherReading): WeatherChip {
  const celsiusLabel = reading.celsius == null ? "—°C" : `${reading.celsius}°C`;
  if (reading.windKmh != null && reading.windKmh >= 30) {
    return { emoji: "💨", word: "windy", celsiusLabel };
  }
  if (reading.glass === "rain") return { emoji: "🌧️", word: "raining", celsiusLabel };
  if (reading.glass === "snow") return { emoji: "❄️", word: "snowy", celsiusLabel };
  if (reading.glass === "night" || reading.glass === "humid") {
    return { emoji: "☁️", word: "cloudy", celsiusLabel };
  }
  return { emoji: "☀️", word: "sunny", celsiusLabel };
}

function fallbackSentence(glass: WeatherGlass, season: WeatherReading["season"], hour: number): string {
  if (glass === "night") return hour < 6 ? "Still dark over the harbour." : "Night on the glass.";
  if (glass === "snow") return "Winter light. The sill looks cold.";
  if (glass === "humid") return "August haze. The air is thick.";
  if (season === "patio") return "Patio season. The window is open in spirit.";
  return "Clear enough to see the street.";
}

export function glassFromOpenMeteo(current: {
  temperature_2m?: number;
  precipitation?: number;
  weather_code?: number;
  is_day?: number;
  wind_speed_10m?: number;
}, today: DateKey, now = new Date()): WeatherReading {
  const hour = hourInToronto(now);
  const season = kitchenSeason(today);
  const code = Number(current.weather_code ?? 0);
  const precip = Number(current.precipitation ?? 0);
  const night = current.is_day === 0 || hour < 6 || hour >= 20;
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const rain = precip > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  let glass: WeatherGlass = "clear";
  if (snow) glass = "snow";
  else if (rain) glass = "rain";
  else if (night) glass = "night";
  else if (season === "patio") glass = "humid";
  const celsius = Number.isFinite(Number(current.temperature_2m)) ? Math.round(Number(current.temperature_2m)) : null;
  const windKmh = Number.isFinite(Number(current.wind_speed_10m)) ? Math.round(Number(current.wind_speed_10m)) : null;
  const temp = celsius == null ? "" : ` ${celsius}°.`;
  let sentence = `Clear.${temp}`;
  if (glass === "rain") sentence = celsius == null ? "Rain on the glass." : `Rain. ${celsius}°.`;
  else if (glass === "snow") sentence = celsius == null ? "Snow light." : `Snow. ${celsius}°.`;
  else if (glass === "night") sentence = celsius == null ? "Night on the glass." : `Night. ${celsius}°.`;
  else if (glass === "humid") sentence = celsius == null ? "August haze." : `Hazy. ${celsius}°.`;
  else if (celsius != null) sentence = `${celsius}°.`;
  return {
    glass,
    celsius,
    windKmh,
    sentence: sentence.replace(/\$/g, ""),
    season,
    source: "live",
    fetchedAt: now.toISOString(),
  };
}

function readCache(storage: WeatherStore | undefined, key: string, nowMs: number): CacheRow | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRow;
    if (!parsed?.reading?.glass) return null;
    if (typeof parsed.storedAt !== "number") return null;
    if (nowMs - parsed.storedAt > WEATHER_TTL_MS * 4) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(storage: WeatherStore | undefined, key: string, row: CacheRow): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(row));
  } catch {
    /* private mode */
  }
}

export function cacheIsFresh(storedAt: number, nowMs = Date.now()): boolean {
  return nowMs - storedAt < WEATHER_TTL_MS;
}

export async function readTorontoWeather(input: {
  environment: Environment;
  today: DateKey;
  now?: Date;
  fetchImpl?: typeof fetch;
  storage?: WeatherStore;
  timeoutMs?: number;
  /** Q7 B: when location is allowed, Office may pass browser coords. */
  latitude?: number;
  longitude?: number;
  timeZone?: string;
}): Promise<WeatherReading> {
  const now = input.now ?? new Date();
  const latitude = Number.isFinite(input.latitude) ? Number(input.latitude) : TORONTO.latitude;
  const longitude = Number.isFinite(input.longitude) ? Number(input.longitude) : TORONTO.longitude;
  const timeZone = input.timeZone?.trim() || "America/Toronto";
  const key = `${weatherCacheKey(input.environment)}:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = readCache(input.storage, key, now.getTime());
  if (cached && cacheIsFresh(cached.storedAt, now.getTime())) {
    return cached.reading;
  }
  const fallback = fallbackWeather(input.today, now);
  const fetchImpl = input.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchImpl) {
    if (cached) return { ...cached.reading, source: cached.reading.source };
    return fallback;
  }
  const timeoutMs = input.timeoutMs ?? WEATHER_TIMEOUT_MS;
  try {
    const controller = new AbortController();
    const timed = new Promise<never>((_, reject) => {
      setTimeout(() => {
        controller.abort();
        reject(new Error("weather-timeout"));
      }, timeoutMs);
    });
    const response = await Promise.race([
      fetchImpl(openMeteoUrl(latitude, longitude, timeZone), { signal: controller.signal }),
      timed,
    ]);
    if (!response.ok) {
      return cached?.reading ?? fallback;
    }
    const body = await response.json() as { current?: Parameters<typeof glassFromOpenMeteo>[0] };
    if (!body?.current) return cached?.reading ?? fallback;
    const reading = glassFromOpenMeteo(body.current, input.today, now);
    writeCache(input.storage, key, { reading, storedAt: now.getTime() });
    return reading;
  } catch {
    return cached?.reading ?? fallback;
  }
}
