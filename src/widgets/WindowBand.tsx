import { useFurniture } from "./useFurniture.ts";
import type { WeatherReading } from "../core/weather.ts";
import type { ReactNode } from "react";

export function WindowBand({
  reading,
  expanded,
  minimized,
  stale,
  onToggle,
  chalk,
  chalkboardOpen,
  chalkboardBody,
  onChalk,
}: {
  reading: WeatherReading;
  expanded: boolean;
  minimized: boolean;
  stale: boolean;
  onToggle: () => void;
  chalk?: ReactNode;
  chalkboardOpen?: boolean;
  chalkboardBody?: ReactNode;
  onChalk?: () => void;
}) {
  const sill = useFurniture("window", "sill", true, false);
  const temp = reading.celsius == null ? "" : `${reading.celsius}°`;
  const aria = `Window. ${reading.sentence}${temp ? ` ${temp}` : ""}`.replace(/\$/g, "");
  return (
    <section
      className={`office-window glass-${reading.glass} ${minimized ? "is-minimized" : ""} ${chalkboardOpen ? "has-chalk" : ""}`}
      aria-label={aria}
    >
      <button type="button" className="office-glass" onClick={onToggle} aria-expanded={expanded}>
        <span className="sr-only">Window</span>
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
        {chalk}
      </button>
      {onChalk && !minimized && (
        <button type="button" className="chalk-glass-open" onClick={onChalk} aria-expanded={Boolean(chalkboardOpen)}>
          Chalk
        </button>
      )}
      {expanded && !minimized && (
        <div className="office-forecast">
          <p>{reading.sentence}</p>
          <p className="season">{reading.season === "none" ? "Ordinary season" : reading.season}</p>
        </div>
      )}
      {chalkboardOpen && !minimized && chalkboardBody && (
        <div className="office-chalk-body">
          {chalkboardBody}
        </div>
      )}
      <div ref={sill} className={`office-sill ${stale ? "is-stale" : ""}`}>
        {temp}
      </div>
    </section>
  );
}
