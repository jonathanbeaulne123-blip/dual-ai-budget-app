import { emitOfficeIntent, type SillOverview } from "../core/index.ts";

export function SillOverviewPlate({
  overview,
  compact,
}: {
  overview: SillOverview;
  compact?: boolean;
}) {
  return (
    <section className={`sill-plate ${compact ? "is-compact" : ""}`} aria-label={`Desk overview. ${overview.needsMe}`}>
      <p className="sill-needs">{overview.needsMe}</p>
      <div className="sill-figures">
        {overview.figures.map((figure) => (
          <button
            key={figure.id}
            type="button"
            className={`sill-figure ${figure.warn ? "is-warn" : ""}`}
            onClick={() => emitOfficeIntent({ type: "expand", id: figure.instrument })}
          >
            <span className="sill-label">{figure.label}</span>
            <span className="sill-value">{figure.value}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
