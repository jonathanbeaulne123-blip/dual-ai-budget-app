import { HARBOUR_PLACE_NAMES, type HarbourPlaceId } from "../flag.ts";
import type { HarbourReading } from "../data/reading.ts";
import { DoorSign } from "./DoorSign.tsx";
import "../harbour.css";

/** loading: the frame before the scene draws; fallback: WebGL failed; flat: no WebGL world by choice or by tier. */
export type HarbourFlatStatus = "loading" | "fallback" | "flat";

export type HarbourFlatProps = {
  place: HarbourPlaceId;
  /** Null while the App has no reading yet (the Suspense fallback): the frame then carries no sign. */
  reading: HarbourReading | null;
  status?: HarbourFlatStatus;
  theme?: "classic" | "taylor" | "newfoundland";
  /** Laid over a stage that is still being built, rather than standing on its own. */
  overlay?: boolean;
};

const capital = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const statusWords = (status: HarbourFlatStatus, name: string) =>
  status === "loading" ? `${name} is being built` : status === "fallback" ? `Reading edition · ${name} could not be drawn` : "Reading edition";

/**
 * The light flat frame (SIMPLE_VIEW_DESK S6). The Desk is the whole 2D world
 * at rest — every place, on the `flat` tier and when WebGL fails — so the old
 * per-place reading editions and the village door directory are retired. What
 * is left is the frame that stands where no Desk should: the App's Suspense
 * fallback, the transient loading overlay while the scene is built, and the
 * band behind a tool opened from the Desk. It reads no selector of its own —
 * only the reading it is handed, through the place's door sign — and it has no
 * door, because the Desk and the tool in front carry every money task.
 */
export function HarbourFlat({ place, reading, status = "loading", theme = "classic", overlay = false }: HarbourFlatProps) {
  const name = capital(HARBOUR_PLACE_NAMES[place] ?? "the Harbour");
  return <section className={`court-flat place-flat court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat={place} aria-label={`${name}, reading edition`} aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{statusWords(status, name)}</p>
      <DoorSign place={place} reading={reading} />
    </div>
  </section>;
}
