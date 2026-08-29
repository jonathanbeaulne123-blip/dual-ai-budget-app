import { weatherChip, type WeatherReading } from "../core/weather.ts";
import { useFurniture } from "./useFurniture.ts";

/** Rainy desk window — Draft D desktop atmosphere. Tap to expand forecast. */
export function OfficeWindow({
  reading,
  expanded,
  minimized,
  stale,
  onToggle,
}: {
  reading: WeatherReading;
  expanded: boolean;
  minimized: boolean;
  stale?: boolean;
  onToggle: () => void;
}) {
  const sill = useFurniture("window", "sill", true, false);
  const chip = weatherChip(reading);
  const temp = reading.celsius == null ? "" : `${reading.celsius}°`;
  const aria = `Window. ${reading.sentence}${temp ? ` ${temp}` : ""}`.replace(/\$/g, "");

  return (
    <section
      className={`office-window glass-${reading.glass} ${minimized ? "is-minimized" : ""}`}
      aria-label={aria}
    >
      <button type="button" className="office-glass" onClick={onToggle} aria-expanded={expanded}>
        <span className="sr-only">Window</span>
        {!minimized && (
          <div className="chalk-glass" aria-hidden="true">
            <p className="chalk-glass-line">{reading.sentence}</p>
            {reading.celsius != null && !reading.sentence.includes("°") ? (
              <p className="chalk-glass-line">{chip.celsiusLabel}</p>
            ) : null}
          </div>
        )}
        {reading.glass === "clear" && <span className="cloud-drift" aria-hidden="true" />}
        {reading.glass === "rain" && (
          <>
            <span className="rain-a" aria-hidden="true" />
            <span className="rain-b" aria-hidden="true" />
          </>
        )}
        {reading.glass === "snow" && (
          <>
            <span className="snow-drift" aria-hidden="true" />
            <span className="frost" aria-hidden="true" />
          </>
        )}
        {reading.glass === "night" && <span className="night-glow" aria-hidden="true" />}
      </button>
      {expanded && !minimized && (
        <div className="office-forecast">
          <p>{reading.sentence}</p>
          <p className="season">{reading.season === "none" ? "Ordinary season" : reading.season}</p>
        </div>
      )}
      <div ref={sill} className={`office-sill ${stale ? "is-stale" : ""}`} />
    </section>
  );
}
