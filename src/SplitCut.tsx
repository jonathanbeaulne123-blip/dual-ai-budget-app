import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CUT_DETENTS, splitReading } from "./core/splitDraft.ts";
import { formatCad } from "./core/money.ts";
import "./split-cut.css";

type CutMember = { id: string; name: string };
export function SplitCut({ members, percents, amountCents, onChange, onPreviewChange }: {
  members: [CutMember, CutMember]; percents: Record<string, number>; amountCents: number;
  onChange: (memberId: string, percent: number) => void;
  onPreviewChange?: (active: boolean) => void;
}) {
  const lane = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; start: number; x: number; width: number } | null>(null);
  useEffect(() => () => onPreviewChange?.(false), [onPreviewChange]);
  const [preview, setPreview] = useState<number | null>(null);
  const first = members[0], last = members[1];
  const percent = preview ?? percents[first.id] ?? 0;
  const shown = preview === null ? percents : { [first.id]: percent, [last.id]: Math.round((100 - percent) * 100) / 100 };
  const reading = splitReading(members.map(member => member.id), shown, amountCents);
  const point = (event: PointerEvent) => {
    const origin = drag.current!;
    const delta = Math.round((event.clientX - origin.x) / origin.width * 100);
    if (!delta) return origin.start;
    const value = Math.max(0, Math.min(100, origin.start + delta));
    const stop = CUT_DETENTS.find(stop => Math.abs(stop - value) <= 2);
    return stop ?? value;
  };
  const choose = (value: number) => { drag.current = null; setPreview(null); onPreviewChange?.(false); onChange(first.id, Math.max(0, Math.min(100, value))); };
  const cancel = () => { drag.current = null; setPreview(null); onPreviewChange?.(false); };
  return <div className="split-cut" aria-label="The Cut">
    <div className="cut-card">
      <div className="cut-readings">
        {members.map((member, index) => <div className={`cut-reading is-${index}`} key={member.id}>
          <span className="cut-name">{member.name}{index === 1 ? " · fills" : ""}</span>
          <strong data-cut-cents={reading.cents[member.id]}>{formatCad(reading.cents[member.id]!)}</strong>
          {index === 0 ? <label className="cut-exact"><input aria-label={`${member.name}'s exact share`} type="number" min="0" max="100" step="1" value={percent} onChange={event => { if (event.currentTarget.value !== "" && Number.isFinite(event.currentTarget.valueAsNumber)) choose(event.currentTarget.valueAsNumber); }} />%</label>
            : <span className="cut-percent">{shown[member.id]}%</span>}
        </div>)}
      </div>
      <div className="cut-lane" ref={lane}>
        <div className="cut-tint" style={{ width: `${percent}%` }} />
        <div className="cut-line" style={{ left: `${percent}%` }} aria-hidden="true" />
        <button type="button" className="cut-handle" role="slider" data-dialog-escape-boundary={preview !== null || undefined} aria-label={`${first.name}'s share`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          aria-valuetext={`${first.name} ${percent}%, ${formatCad(reading.cents[first.id]!)}; ${last.name} ${shown[last.id]}%, ${formatCad(reading.cents[last.id]!)}`}
          style={{ left: `clamp(22px, ${percent}%, calc(100% - 22px))` }}
          onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, start: percent, x: event.clientX, width: lane.current!.getBoundingClientRect().width }; setPreview(percent); onPreviewChange?.(true); }}
          onPointerMove={event => { if (drag.current?.id === event.pointerId) setPreview(point(event)); }}
          onPointerUp={event => { if (drag.current?.id !== event.pointerId) return; const value = point(event); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); choose(value); }}
          onPointerCancel={cancel} onLostPointerCapture={cancel}
          onKeyDown={event => {
            const values: Record<string, number> = { ArrowRight: percent + 1, ArrowUp: percent + 1, ArrowLeft: percent - 1, ArrowDown: percent - 1, PageUp: percent + 10, PageDown: percent - 10, Home: 0, End: 100 };
            if (event.key === "Escape" && drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); return; }
            if (event.key in values) { event.preventDefault(); event.stopPropagation(); choose(values[event.key]!); }
          }}><span aria-hidden="true">⇔</span></button>
      </div>
    </div>
    <div className="cut-detents" aria-label={`${first.name}'s share stops`}>
      {CUT_DETENTS.map(value => <button type="button" key={value} aria-pressed={percent === value} onClick={() => choose(value)}>{value}%</button>)}
    </div>
    <p className="cut-remainder">{last.name} fills the remaining cents after rounding.</p>
  </div>;
}
