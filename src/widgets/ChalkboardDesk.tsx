import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  detectChalkLetters,
  eraseGlyphAt,
  hasChalkInk,
  inkBounds,
  organizeChalkNotes,
  reviseChalkInk,
  scribbleChalk,
  wipeChalk,
  weatherChip,
  type ChalkInk,
  type ChalkNote,
  type ChalkStroke,
  type CommitResult,
  type Household,
  type WeatherReading,
} from "../core/index.ts";

export function chalkboardGlance(household: Household): string {
  const notes = organizeChalkNotes(household.kitchen.chalkboard);
  if (!notes.length) return "chalk";
  return notes.slice(0, 2).map((note) => note.text || "drawing").join(" · ");
}

export function WeatherBadge({ reading }: { reading: WeatherReading }) {
  const chip = weatherChip(reading);
  return (
    <div className="chalk-weather-badge" aria-label={`${chip.word}, ${chip.celsiusLabel}`}>
      <span className="chalk-weather-emoji" aria-hidden="true">{chip.emoji}</span>
      <span className="chalk-weather-word">{chip.word}</span>
      <span className="chalk-weather-temp">{chip.celsiusLabel}</span>
    </div>
  );
}

function paintInk(canvas: HTMLCanvasElement, ink: ChalkInk, color = "#f4f1e6") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2.2, w / 90);
  for (const stroke of ink.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x * w, stroke.points[0]!.y * h);
    for (const point of stroke.points.slice(1)) ctx.lineTo(point.x * w, point.y * h);
    ctx.stroke();
  }
}

function ChalkCanvas({
  disabled,
  inkSeed,
  onInk,
  tall,
  fill,
  tool = "chalk",
}: {
  disabled?: boolean;
  inkSeed?: ChalkInk | null;
  onInk: (ink: ChalkInk | null) => void;
  tall?: boolean;
  fill?: boolean;
  tool?: "chalk" | "eraser";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committed = useRef<ChalkStroke[]>(inkSeed?.strokes ?? []);
  const live = useRef<{ x: number; y: number }[] | null>(null);

  function currentInk(): ChalkInk | null {
    const strokes = [...committed.current];
    if (live.current && live.current.length >= 2) strokes.push({ points: live.current });
    if (!strokes.length) return null;
    return { w: canvasRef.current?.width ?? 320, h: canvasRef.current?.height ?? 160, strokes };
  }

  function redraw() {
    const canvas = canvasRef.current;
    const ink = currentInk();
    if (!canvas) return;
    if (!ink) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    paintInk(canvas, ink);
  }

  useEffect(() => {
    committed.current = inkSeed?.strokes ?? [];
    live.current = null;
    redraw();
  }, [inkSeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = canvas.parentElement;
    const resize = () => {
      const width = Math.max(160, frame?.clientWidth ?? 240);
      const height = fill
        ? Math.max(120, frame?.clientHeight ?? 180)
        : tall
          ? Math.min(160, Math.max(110, Math.round(width * 0.42)))
          : Math.round(width * 0.55);
      canvas.width = Math.round(width * 2);
      canvas.height = Math.round(height * 2);
      if (!fill) canvas.style.height = `${height}px`;
      else canvas.style.height = "100%";
      redraw();
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);
      if (nextWidth > 0 && (!fill || nextHeight > 0)) resize();
    });
    if (frame && observer) observer.observe(frame);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [tall, fill]);

  function pointFrom(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  return (
    <canvas
      ref={canvasRef}
      className={`chalk-canvas ${fill ? "is-fill" : ""} ${tool === "eraser" ? "is-eraser" : ""}`}
      aria-label={tool === "eraser" ? "Erase a chalk letter" : "Draw on the chalkboard"}
      onPointerDown={(event) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = pointFrom(event);
        if (!point) return;
        if (tool === "eraser") {
          committed.current = eraseGlyphAt({ w: canvasRef.current?.width ?? 320, h: canvasRef.current?.height ?? 160, strokes: committed.current }, point.x, point.y)?.strokes ?? [];
          live.current = null;
          redraw();
          onInk(currentInk());
          return;
        }
        live.current = [point];
      }}
      onPointerMove={(event) => {
        if (disabled) return;
        if (tool === "eraser") {
          if (event.buttons === 0 && !live.current) return;
          const point = pointFrom(event);
          if (!point) return;
          committed.current = eraseGlyphAt({ w: canvasRef.current?.width ?? 320, h: canvasRef.current?.height ?? 160, strokes: committed.current }, point.x, point.y)?.strokes ?? committed.current;
          redraw();
          onInk(currentInk());
          return;
        }
        if (!live.current) return;
        const point = pointFrom(event);
        if (!point) return;
        live.current = [...live.current, point];
        redraw();
      }}
      onPointerUp={() => {
        if (live.current && live.current.length >= 2) {
          committed.current = [...committed.current, { points: live.current }];
        }
        live.current = null;
        redraw();
        onInk(currentInk());
      }}
      onPointerCancel={() => {
        live.current = null;
        redraw();
        onInk(currentInk());
      }}
    />
  );
}

function NoteThumb({
  note,
  expanded,
  busy,
  onExpand,
  onSave,
  onDelete,
}: {
  note: ChalkNote;
  expanded: boolean;
  busy: boolean;
  onExpand: () => void;
  onSave: (text: string, ink: ChalkInk | null) => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [editText, setEditText] = useState(note.text);
  const [editInk, setEditInk] = useState<ChalkInk | null>(note.ink ?? null);

  useEffect(() => {
    if (!ref.current || !note.ink) return;
    paintInk(ref.current, note.ink, "#e7f0e4");
  }, [note.ink]);

  useEffect(() => {
    if (expanded) {
      setEditText(note.text);
      setEditInk(note.ink ?? null);
    }
  }, [expanded, note.text, note.ink]);

  if (expanded) {
    return (
      <div className="chalk-rail-item is-editing">
        <div className="chalk-rail-edit">
          <textarea
            className="chalk-input"
            rows={2}
            maxLength={160}
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
          />
          <div className="chalk-slate chalk-slate--thumb">
            <ChalkCanvas disabled={busy} inkSeed={editInk} tall onInk={setEditInk} />
          </div>
          <div className="chalk-rail-edit-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => onSave(editText, editInk)}>Save</button>
            <button type="button" className="ghost" disabled={busy} onClick={onExpand}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chalk-rail-item">
      <button type="button" className="chalk-rail-thumb" onClick={onExpand} aria-label="Expand chalk note">
        {hasChalkInk(note.ink) && (
          <canvas ref={ref} className="chalk-thumb" width={160} height={80} aria-hidden="true" />
        )}
        {note.text && <span className="chalk-rail-caption">{note.text}</span>}
      </button>
      <button
        type="button"
        className="chalk-rail-delete"
        disabled={busy}
        aria-label="Delete note"
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  );
}

function LiveChalkSurface({
  notes,
  busy,
  slate,
  onInk,
  onSave,
  onEraseNote,
}: {
  notes: ChalkNote[];
  busy: boolean;
  slate: number;
  onInk: (ink: ChalkInk | null) => void;
  onSave: (ink: ChalkInk) => void;
  onEraseNote: (noteId: string, point: { x: number; y: number }) => void;
}) {
  const [tool, setTool] = useState<"chalk" | "eraser">("chalk");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawn = useRef<ChalkInk | null>(null);
  const inkNotes = notes.filter((note) => hasChalkInk(note.ink));
  const textNotes = notes.filter((note) => !hasChalkInk(note.ink) && note.text);

  function queueSave(next: ChalkInk | null) {
    drawn.current = next;
    onInk(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!next || !hasChalkInk(next)) return;
    saveTimer.current = setTimeout(() => {
      const payload = drawn.current;
      if (payload && hasChalkInk(payload)) onSave(payload);
    }, 500);
  }

  return (
    <div className={`chalkboard-surface is-live ${tool === "eraser" ? "is-erasing" : ""}`}>
      <div className="chalkboard-live-board">
        {inkNotes.map((note) => {
          const box = inkBounds(note.ink);
          if (!box || !note.ink) return null;
          const width = Math.max(8, (box.x1 - box.x0) * 55);
          const height = Math.max(6, (box.y1 - box.y0) * 55);
          return (
            <button
              key={note.id}
              type="button"
              className="chalk-stamp"
              style={{
                left: `${box.x0 * 100}%`,
                top: `${box.y0 * 100}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              aria-label={note.text ? `Saved chalk. ${note.text}` : "Saved chalk"}
              onPointerDown={(event) => {
                if (tool !== "eraser") return;
                event.preventDefault();
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                const nx = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
                const ny = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
                onEraseNote(note.id, {
                  x: box.x0 + nx * (box.x1 - box.x0),
                  y: box.y0 + ny * (box.y1 - box.y0),
                });
              }}
            >
              <StampCanvas ink={note.ink} />
            </button>
          );
        })}
        {textNotes.length > 0 && (
          <ul className="chalk-text-stamps">
            {textNotes.map((note) => (
              <li key={note.id}>{note.text}</li>
            ))}
          </ul>
        )}
        <ChalkCanvas key={slate} disabled={busy} fill tool={tool} onInk={queueSave} />
      </div>
      <button
        type="button"
        className={`chalk-eraser ${tool === "eraser" ? "is-on" : ""}`}
        aria-pressed={tool === "eraser"}
        aria-label="Chalk eraser. Erases one letter at a time."
        onClick={() => setTool((current) => (current === "eraser" ? "chalk" : "eraser"))}
      >
        eraser
      </button>
    </div>
  );
}

function StampCanvas({ ink }: { ink: ChalkInk }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    paintInk(ref.current, ink, "#e7f0e4");
  }, [ink]);
  return <canvas ref={ref} className="chalk-stamp-canvas" width={160} height={90} aria-hidden="true" />;
}

export function ChalkboardBody({
  household,
  memberId,
  busy,
  onCommand,
  reading,
  shrinkable = false,
  shrunk = false,
  onToggleShrink,
  liveSurface = false,
}: {
  household: Household;
  memberId: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  reading?: WeatherReading;
  shrinkable?: boolean;
  shrunk?: boolean;
  onToggleShrink?: () => void;
  liveSurface?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [ink, setInk] = useState<ChalkInk | null>(null);
  const [slate, setSlate] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const memberName = household.members.find((member) => member.id === memberId)?.name ?? "You";
  const notes = organizeChalkNotes(household.kitchen.chalkboard);
  const preview = ink ? detectChalkLetters(ink) : "";

  function saveNote(text: string, nextInk: ChalkInk | null) {
    setDraft("");
    setInk(null);
    setSlate((n) => n + 1);
    onCommand((current) => scribbleChalk(current, { text, author: memberId, ink: nextInk }));
  }

  function replaceNote(noteId: string, text: string, nextInk: ChalkInk | null) {
    onCommand((current) => {
      const wiped = wipeChalk(current, noteId);
      return scribbleChalk(wiped.household, { text, author: memberId, ink: nextInk });
    });
    setExpandedId(null);
  }

  if (liveSurface) {
    return (
      <LiveChalkSurface
        notes={notes}
        slate={slate}
        busy={busy}
        onInk={setInk}
        onSave={(nextInk) => saveNote("", nextInk)}
        onEraseNote={(noteId, point) => {
          const note = notes.find((row) => row.id === noteId);
          if (!note?.ink) return;
          const next = eraseGlyphAt(note.ink, point.x, point.y);
          onCommand((current) => reviseChalkInk(current, noteId, next));
        }}
      />
    );
  }

  if (shrinkable && shrunk) {
    return (
      <div className="chalkboard-surface is-shrunk">
        {reading && <WeatherBadge reading={reading} />}
        <button type="button" className="chalk-shrink-open" onClick={onToggleShrink}>
          Open chalkboard
        </button>
      </div>
    );
  }

  return (
    <div className={`chalkboard-surface ${shrinkable ? "is-shrinkable" : ""}`}>
      {reading && <WeatherBadge reading={reading} />}
      {shrinkable && (
        <button type="button" className="chalk-shrink-toggle" onClick={onToggleShrink} aria-label="Shrink chalkboard">
          −
        </button>
      )}
      <div className="chalkboard-stage">
        <div className="chalkboard-draw">
          <ChalkCanvas key={slate} disabled={busy} onInk={setInk} tall />
          {preview && <p className="chalk-reading muted">Reading: {preview}</p>}
        </div>
        <aside className="chalk-rail" aria-label="Saved chalk notes">
          {notes.map((note) => (
            <NoteThumb
              key={note.id}
              note={note}
              expanded={expandedId === note.id}
              busy={busy}
              onExpand={() => setExpandedId((id) => (id === note.id ? null : note.id))}
              onSave={(text, nextInk) => replaceNote(note.id, text, nextInk)}
              onDelete={() => onCommand((current) => wipeChalk(current, note.id))}
            />
          ))}
        </aside>
      </div>
      <footer className="chalk-compose">
        <label className="sr-only" htmlFor="office-chalk">Typeset instead</label>
        <textarea
          id="office-chalk"
          className="chalk-input"
          rows={2}
          maxLength={160}
          placeholder={`${memberName} can draw, or type…`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="primary chalk-save"
          disabled={busy}
          onClick={() => saveNote(draft, ink)}
        >
          Save
        </button>
      </footer>
    </div>
  );
}
