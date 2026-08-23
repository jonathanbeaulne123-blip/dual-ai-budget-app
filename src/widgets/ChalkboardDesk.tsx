import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  BOARD_EMPTY,
  chalkboardPrompts,
  dailyDare,
  detectChalkLetters,
  groceryHighFive,
  hasChalkInk,
  neatenChalk,
  organizeChalkNotes,
  scribbleChalk,
  wipeChalk,
  type ChalkInk,
  type ChalkNote,
  type ChalkStroke,
  type CommitResult,
  type Household,
} from "../core/index.ts";

export function chalkboardGlance(household: Household): string {
  const notes = organizeChalkNotes(household.kitchen.chalkboard);
  if (!notes.length) return "chalk";
  return notes.slice(0, 2).map((note) => note.text || "drawing").join(" · ");
}

/** Transparent typeset notes on the weather glass. Same Fraunces hand, cozy cream. */
export function ChalkGlassNotes({ household }: { household: Household }) {
  const notes = organizeChalkNotes(household.kitchen.chalkboard).slice(0, 3);
  if (!notes.length) return null;
  return (
    <div className="chalk-glass" aria-hidden="true">
      {notes.map((note) => (
        <p key={note.id} className="chalk-glass-line">{note.text || "unreadable hand"}</p>
      ))}
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
  onInk,
}: {
  disabled?: boolean;
  onInk: (ink: ChalkInk | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committed = useRef<ChalkStroke[]>([]);
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = canvas.parentElement;
    const resize = () => {
      const width = Math.max(160, frame?.clientWidth ?? 240);
      canvas.width = Math.round(width * 2);
      canvas.height = Math.round(width);
      redraw();
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    if (frame && observer) observer.observe(frame);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

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
    <div className="chalk-slate">
      <canvas
        ref={canvasRef}
        className="chalk-canvas"
        aria-label="Draw on the chalkboard"
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointFrom(event);
          if (!point) return;
          live.current = [point];
        }}
        onPointerMove={(event) => {
          if (!live.current || disabled) return;
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
      <button
        type="button"
        className="chip quiet"
        disabled={disabled}
        onClick={() => {
          committed.current = [];
          live.current = null;
          redraw();
          onInk(null);
        }}
      >
        Erase slate
      </button>
    </div>
  );
}

function NoteThumb({ note }: { note: ChalkNote }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current || !note.ink) return;
    paintInk(ref.current, note.ink, "#e7f0e4");
  }, [note.ink]);
  if (!hasChalkInk(note.ink)) return null;
  return <canvas ref={ref} className="chalk-thumb" width={160} height={80} aria-hidden="true" />;
}

export function ChalkboardBody({
  household,
  memberId,
  today,
  busy,
  onCommand,
  onBuyNote,
}: {
  household: Household;
  memberId: string;
  today: string;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onBuyNote: (text: string) => void;
}) {
  const prompts = chalkboardPrompts(today);
  const highFive = groceryHighFive(household, today);
  const [draft, setDraft] = useState("");
  const [ink, setInk] = useState<ChalkInk | null>(null);
  const [slate, setSlate] = useState(0);
  const memberName = household.members.find((member) => member.id === memberId)?.name ?? "You";
  const notes = organizeChalkNotes(household.kitchen.chalkboard);
  const preview = ink ? detectChalkLetters(ink) : "";

  return (
    <div>
      {notes.length === 0 ? (
        <p className="muted">{BOARD_EMPTY} Dare: {dailyDare(today)}</p>
      ) : (
        notes.map((note) => (
          <div className="chalk-note" key={note.id}>
            <NoteThumb note={note} />
            <p className="chalk-typeset">{note.text || "unreadable hand"}</p>
            <div className="chalk-actions">
              {note.text && (
                <button type="button" disabled={busy} onClick={() => onBuyNote(note.text)}>bought</button>
              )}
              {hasChalkInk(note.ink) && (
                <button type="button" disabled={busy} onClick={() => onCommand((current) => neatenChalk(current, note.id))}>
                  neaten
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => onCommand((current) => wipeChalk(current, note.id))} aria-label="Wipe this note">
                wipe
              </button>
            </div>
          </div>
        ))
      )}
      <div className="chips chalk-prompts">
        {prompts.map((prompt) => (
          <button key={prompt} className="chip quiet" type="button" onClick={() => setDraft(prompt)}>{prompt}</button>
        ))}
        {highFive.yes && (
          <button className="chip quiet" type="button" onClick={() => onCommand((current) => scribbleChalk(current, { text: "nice.", author: memberId }))}>
            nice.
          </button>
        )}
      </div>
      <ChalkCanvas key={slate} disabled={busy} onInk={setInk} />
      {preview && <p className="muted">Reading: {preview}</p>}
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
        className="primary chalk-save"
        disabled={busy || (!draft.trim() && !ink)}
        onClick={() => {
          const text = draft;
          const nextInk = ink;
          setDraft("");
          setInk(null);
          setSlate((n) => n + 1);
          onCommand((current) => scribbleChalk(current, { text, author: memberId, ink: nextInk }));
        }}
      >
        Keep
      </button>
    </div>
  );
}
