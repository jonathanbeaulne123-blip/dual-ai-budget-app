import { HARBOUR_DEV } from "../flag.ts";
import { setHarbourWorld, useHarbourWorld, type HarbourWorldId } from "../harbourWorld.ts";
import "./harbour-nav.css";

const WORLDS: ReadonlyArray<{ id: HarbourWorldId; label: string }> = [
  { id: "mountain", label: "Mountain" },
  { id: "horizon", label: "Horizon" },
];

/**
 * Dev-only Mountain ↔ Horizon switch for full-App UX dissection.
 * Stands near the harbour chrome; production builds render nothing.
 */
export function WorldToggle() {
  const world = useHarbourWorld();
  if (!HARBOUR_DEV) return null;
  return (
    <div className="harbour-world-toggle" role="group" aria-label="Harbour world for dissection">
      {WORLDS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="harbour-world-toggle__btn"
          aria-pressed={world === id}
          onClick={() => { if (world !== id) setHarbourWorld(id); }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
