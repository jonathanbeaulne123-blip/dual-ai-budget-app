import { HOUSE_FLOORS, HOUSE_WORDS, type HousePlace } from "./queenHouse.ts";

/**
 * The house rail (2026-09-14): three stops on one line, marking which floor you
 * are standing on and taking you to either of the others in one press.
 *
 * It exists because the swipe and the haul must never be the only way through
 * the house. A gesture is a shortcut for people who found it; this is the door
 * for everyone else — a real button per floor, in the reading order the house
 * is stacked in, with the current floor marked by `aria-current` rather than by
 * colour alone.
 */
export function QueenHouseRail({ place, onGo, className }: {
  place: HousePlace;
  onGo: (place: HousePlace) => void;
  className?: string;
}) {
  return (
    <nav className={`queen-house-rail${className ? ` ${className}` : ""}`} aria-label="Where you are in the house">
      {HOUSE_FLOORS.map((floor) => {
        const words = HOUSE_WORDS[floor];
        const here = floor === place;
        return (
          <button
            key={floor}
            type="button"
            className="queen-house-rail__stop"
            data-floor={floor}
            aria-current={here ? "true" : undefined}
            aria-label={here ? `${words.name} — ${words.role}, where you are` : `Go to ${words.name.toLowerCase()} — ${words.role}`}
            onClick={() => { if (!here) onGo(floor); }}
          >
            <span className="queen-house-rail__mark" aria-hidden="true" />
            <span className="queen-house-rail__name">{words.name}</span>
            <span className="queen-house-rail__role">{words.role}</span>
          </button>
        );
      })}
    </nav>
  );
}
