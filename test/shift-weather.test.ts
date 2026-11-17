import { describe, expect, it, vi } from "vitest";
import type { ShiftWeatherContext } from "../src/core/shiftEnvelope.ts";
import { historicalWeatherGlass, openMeteoHistoricalUrl, pendingHistoricalWeather, readHistoricalShiftWeather } from "../src/core/weather.ts";

function completeWeather(overrides: Partial<ShiftWeatherContext> = {}): ShiftWeatherContext {
  return {
    state: "complete",
    source: "open-meteo-historical",
    latitudeRounded: 43.65,
    longitudeRounded: -79.38,
    intervalStartedAt: "2026-08-29T20:00:00.000Z",
    intervalEndedAt: "2026-08-29T22:00:00.000Z",
    midpointTemperatureCelsius: -2,
    apparentTemperatureCelsius: -4,
    precipitationMm: 0,
    weatherCode: 0,
    windKph: 8,
    fetchedAt: "2026-08-29T22:05:00.000Z",
    ...overrides,
  };
}

describe("D-172 historical shift weather", () => {
  it("requests the rounded job place and aggregates the actual UTC shift window", async () => {
    let requestedUrl = "";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => { requestedUrl = String(input); return new Response(JSON.stringify({ hourly: {
      time: ["2026-08-29T20:00", "2026-08-29T21:00", "2026-08-29T22:00"],
      temperature_2m: [24, 22, 20], apparent_temperature: [25, 23, 21], precipitation: [0, 0.4, 0.2], weather_code: [1, 61, 61], wind_speed_10m: [10, 12, 14],
    } }), { status: 200, headers: { "Content-Type": "application/json" } }); });
    const weather = await readHistoricalShiftWeather({
      latitude: 43.6532, longitude: -79.3832, startedAt: "2026-08-29T20:00:00.000Z", endedAt: "2026-08-29T22:00:00.000Z", fetchImpl: fetchImpl as typeof fetch,
    });
    expect(requestedUrl).toContain("latitude=43.65&longitude=-79.38");
    expect(weather).toMatchObject({ state: "complete", latitudeRounded: 43.65, longitudeRounded: -79.38, midpointTemperatureCelsius: 22, apparentTemperatureCelsius: 23, precipitationMm: 0.6, weatherCode: 61, windKph: 12 });
    expect(historicalWeatherGlass(weather)).toBe("rain");
  });

  it("never blocks Confirm when the place or provider is unavailable", async () => {
    expect(await readHistoricalShiftWeather({ latitude: null, longitude: null, startedAt: "2026-08-29T20:00:00.000Z", endedAt: "2026-08-29T22:00:00.000Z" })).toMatchObject({ state: "pending", fetchedAt: null });
    expect(await readHistoricalShiftWeather({ latitude: 43.65, longitude: -79.38, startedAt: "2026-08-29T20:00:00.000Z", endedAt: "2026-08-29T22:00:00.000Z", fetchImpl: vi.fn(async () => { throw new Error("offline"); }) as typeof fetch })).toMatchObject({ state: "pending" });
    expect(openMeteoHistoricalUrl({ latitude: 43.65, longitude: -79.38, startedAt: "2026-08-29T20:00:00.000Z", endedAt: "2026-08-29T22:00:00.000Z" })).toContain("timezone=UTC");
  });

  it("classifies complete WMO evidence and withholds a glass until the fetch finishes", () => {
    expect(historicalWeatherGlass(pendingHistoricalWeather({
      latitude: 43.65,
      longitude: -79.38,
      startedAt: "2026-08-29T20:00:00.000Z",
      endedAt: "2026-08-29T22:00:00.000Z",
    }))).toBeNull();
    expect(historicalWeatherGlass(completeWeather({ state: "unavailable" }))).toBeNull();
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 71 }))).toBe("snow");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 77 }))).toBe("snow");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 85 }))).toBe("snow");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 86, precipitationMm: 4 }))).toBe("snow");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 1, precipitationMm: 0.4 }))).toBe("rain");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 61, precipitationMm: 0 }))).toBe("rain");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 80 }))).toBe("rain");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 95 }))).toBe("rain");
    expect(historicalWeatherGlass(completeWeather({ weatherCode: 1, precipitationMm: 0 }))).toBe("clear");
  });
});
