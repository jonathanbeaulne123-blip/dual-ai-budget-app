import { analogAngles, clockArcPath, torontoClockParts, type ShiftClockSpan } from "../core/analogClock.ts";

export function AnalogClockFace({
  now = new Date(),
  span,
  label,
}: {
  now?: Date;
  span?: ShiftClockSpan | null;
  label?: string;
}) {
  const parts = torontoClockParts(now);
  const angles = analogAngles(parts);
  const arc = span ? clockArcPath(span.startAngle, span.endAngle) : "";
  return (
    <div className="analog-clock" role="img" aria-label={label ?? `Toronto clock ${parts.hour}:${String(parts.minute).padStart(2, "0")}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" className="analog-bezel" />
        <circle cx="50" cy="50" r="42" className="analog-face" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 - 90) * Math.PI / 180;
          const inner = i % 3 === 0 ? 34 : 36;
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * inner}
              y1={50 + Math.sin(a) * inner}
              x2={50 + Math.cos(a) * 40}
              y2={50 + Math.sin(a) * 40}
              className={i % 3 === 0 ? "analog-tick major" : "analog-tick"}
            />
          );
        })}
        {arc && <path d={arc} className={span?.live ? "analog-arc live" : "analog-arc"} />}
        {span && (
          <circle
            cx={50 + Math.cos((span.startAngle - 90) * Math.PI / 180) * 34}
            cy={50 + Math.sin((span.startAngle - 90) * Math.PI / 180) * 34}
            r="2.4"
            className="analog-start"
          />
        )}
        <line
          x1="50"
          y1="50"
          x2={50 + Math.cos((angles.hour - 90) * Math.PI / 180) * 22}
          y2={50 + Math.sin((angles.hour - 90) * Math.PI / 180) * 22}
          className="analog-hour"
        />
        <line
          x1="50"
          y1="50"
          x2={50 + Math.cos((angles.minute - 90) * Math.PI / 180) * 30}
          y2={50 + Math.sin((angles.minute - 90) * Math.PI / 180) * 30}
          className="analog-minute"
        />
        <circle cx="50" cy="50" r="2.2" className="analog-cap" />
      </svg>
    </div>
  );
}