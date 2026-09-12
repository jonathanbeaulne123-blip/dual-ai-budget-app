import type { BoardKind } from "../core/board.ts";
import type { CalendarVisibility } from "./visibility.ts";
import { KIND_LAYERS, KIND_REGISTRY, kindClassNames, type KindLayer } from "./semantics.ts";

/**
 * The legend is the filter. One button per kind that is actually on screen —
 * swatch, glyph and word from the registry — and pressing it hides that
 * kind's layer. Kinds that share a layer (pay and tips; visits and owed) show
 * and hide together, and say so. Nothing here changes amounts, heat or due
 * reminders: those still count hidden items.
 */
export function KindLegend({ kinds, visibility, onToggle, hiddenCount }: {
  kinds: readonly BoardKind[];
  visibility: CalendarVisibility;
  onToggle: (layer: KindLayer) => void;
  hiddenCount?: number;
}) {
  if (kinds.length === 0) return <p className="kind-legend-note">No dates this month. Select a day to add one.</p>;
  const layerLabel = new Map(KIND_LAYERS);
  return (
    <section className="kind-legend" aria-label="What the calendar shows">
      <ul>
        {kinds.map(kind => {
          const entry = KIND_REGISTRY[kind];
          const visible = visibility[entry.layer] !== false;
          const group = layerLabel.get(entry.layer) ?? entry.word;
          return (
            <li key={kind}>
              <button
                type="button"
                className={kindClassNames(kind)}
                role="switch"
                aria-checked={visible}
                aria-label={`${entry.word}. ${visible ? "Shown" : "Hidden"}. Toggles ${group.toLowerCase()}.`}
                title={visible ? `Hide ${group.toLowerCase()}` : `Show ${group.toLowerCase()}`}
                onClick={() => onToggle(entry.layer)}
              >
                <span className="cal-kind" aria-hidden="true">{entry.glyph}</span>
                <span>{entry.word}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {hiddenCount ? <p className="kind-legend-note" role="status">{hiddenCount} hidden. Amounts and due reminders still count them.</p> : null}
    </section>
  );
}
