import type { HarbourPlaceId } from "../flag.ts";
import type { HarbourReading } from "../data/reading.ts";
import { SIGN_TITLES, placeSigns } from "../nav/doorSigns.ts";

/**
 * A place's door sign, in the reading edition (W5 #3).
 *
 * The sign on the path and the page have to say the same thing, or the
 * reading edition is a second, quieter truth. This is the same pure
 * `placeSigns` the plates on the lawn are engraved from, printed at the top
 * of every flat edition: the building's name, its one line, and the sign's
 * full words for a screen reader.
 *
 * Tolerant by design. The flat edition is what stands while the books are
 * still being read and when the island could not be drawn at all, so a
 * reading that has not arrived is simply no sign — never a throw, and never
 * a number invented to fill the line.
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
