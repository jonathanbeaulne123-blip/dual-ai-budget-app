import { weatherChip, type WeatherReading } from "../core/weather.ts";

/** Thin atmosphere strip — weather only, no CAD. Draft C mobile + desktop header. */
export function WeatherRibbon({
  reading,
  place = "Toronto, ON",
}: {
  reading: WeatherReading;
  place?: string;
}) {
  const chip = weatherChip(reading);
  const aria = `${chip.word}, ${chip.celsiusLabel}. ${place}. ${reading.sentence}`.replace(/\$/g, "");

  return (
    <div
      className={`hearth-weather-ribbon glass-${reading.glass}`}
      role="status"
      aria-label={aria}
    >
      <span className="hearth-weather-left">
        <span className="hearth-weather-emoji" aria-hidden="true">{chip.emoji}</span>
        <span className="hearth-weather-temp">{chip.celsiusLabel}</span>
        <span className="hearth-weather-dot" aria-hidden="true">·</span>
        <span className="hearth-weather-word">{chip.word}</span>
      </span>
      <span className="hearth-weather-place">{place}</span>
    </div>
  );
}
