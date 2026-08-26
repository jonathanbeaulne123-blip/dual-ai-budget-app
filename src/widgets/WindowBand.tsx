import type { ReactNode } from "react";
import type { WeatherReading } from "../core/weather.ts";

/** Always-visible chalkboard band on wide Home. Weather lives inside the chalkboard overlay. */
export function WindowBand({
  reading,
  minimized,
  onToggle,
  chalkboardBody,
}: {
  reading: WeatherReading;
  minimized?: boolean;
  onToggle?: () => void;
  chalkboardBody?: ReactNode;
}) {
  return (
    <section
      className={`office-chalk-band glass-${reading.glass} ${minimized ? "is-minimized" : ""}`}
      aria-label="Notes"
    >
      {onToggle && (
        <button type="button" className="office-chalk-minimize" onClick={onToggle} aria-expanded={!minimized}>
          {minimized ? "Show chalkboard" : "Minimize band"}
        </button>
      )}
      {!minimized && chalkboardBody}
    </section>
  );
}
