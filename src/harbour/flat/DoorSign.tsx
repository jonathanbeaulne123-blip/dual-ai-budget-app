import type { HarbourPlaceId } from "../flag.ts";
import type { HarbourReading } from "../data/reading.ts";
import { SIGN_TITLES, placeSigns } from "../nav/doorSigns.ts";

/**
 * A place's door sign, on the light flat frame (W5 #3; SIMPLE_VIEW_DESK S6).
 *
 * The sign on the path and the page have to say the same thing, or the flat
 * frame is a second, quieter truth. This is the same pure `placeSigns` the
 * plates on the lawn are engraved from, printed on the frame that stands
 * while the scene is built and behind a tool opened from the Desk: the
 * building's name, its one line, and the sign's full words for a screen reader.
 *
 * Tolerant by design. The frame is also the App's Suspense fallback, which
 * stands before any reading has arrived, so a missing reading is simply no
 * sign — never a throw, and never a number invented to fill the line.
 */
export function DoorSign({ place, reading }: { place: HarbourPlaceId; reading: HarbourReading | null }) {
  if (!reading) return null;
  let line: string;
  let aria: string;
  try {
    const sign = placeSigns(reading)[place];
    if (!sign) return null;
    line = sign.line;
    aria = sign.aria;
  } catch { return null; }
  return <p className="place-flat__sign" data-place-sign={place} aria-label={aria}>
    <small>{SIGN_TITLES[place]}</small>
    <strong>{line}</strong>
  </p>;
}
