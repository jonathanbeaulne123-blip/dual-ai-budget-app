/**
 * Kitty Bank Studio: Shape · Paint · Kiln.
 *
 * All edits are local until "Keep the clay" (saveGoalEnvelope) or "Fire it"
 * (saveGoalEnvelope with fire: true, after a visible Confirm). The unsaved
 * draft also lives in a guarded sessionStorage key partitioned by identity
 * and goal so a reload does not lose ten minutes of painting. Nothing here
 * touches money.
 *
 * 2026-09-12: firing is no longer the end. A piece on the shelf can go back to
 * the wheel, be repainted and fired again, be chosen for display, or be thrown
 * away. The controls were cut down to what you reach for, with the rest one
 * disclosure away.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { saveGoalEnvelope, type CommitResult, type Goal, type Household } from "../../core/index.ts";
import type { KittyAnchor, KittyFeature, KittyPart, KittyPieceV1, KittySculptV1, KittyStampKind, KittyStampV1, KittyStrokeV1, KittyStudioV1, KittyTool, GoalEnvelope } from "../../core/types.ts";
import { KITTY_ANCHORS, KITTY_BODIES, KITTY_EARS, KITTY_EYES, KITTY_FEATURES, KITTY_HEADS, KITTY_MOUTHS, KITTY_NOSES, KITTY_PARTS, KITTY_STUDIO_LIMITS, KITTY_TAILS, KITTY_WHISKERS, defaultKittySculpt, displayedKittyPiece, emptyKittyStudio, kittyFeature, newKittyPiece, quantizeKittyStroke, removeKittyPiece, reopenKittyPiece, shapeKittyPiece, withKittyFeature } from "../../core/kittyStudio.ts";
import { ConfirmSheet } from "../../Confirm.tsx";
import type { KittyHit, KittyStageApi, KittyStageMode } from "../KittyStage.tsx";
import { KittyFlat } from "./flat.tsx";
import { BodyGlyph, EarsGlyph, EyesGlyph, HeadGlyph, MouthGlyph, NoseGlyph, StampGlyph, TailGlyph, ToolGlyph, WhiskersGlyph } from "./glyphs.tsx";
import { KITTY_ANCHOR_UV } from "./anchors.ts";
import { nearestKittyAnchor, stampTrim } from "./stampArt.ts";
import { STUDIO_PALETTE, isStudioHex, studioHex } from "./palette.ts";
import "./studio.css";

export type Bench = "wheel" | "paint" | "kiln";
export type BrushState = { tool: KittyTool; color: string; size: number; opacity: number; mirror: boolean; stamp: KittyStampKind | null; stampText: string };
type Review = { id: string; attempted?: boolean; title: string; body: string; extra: string; basis: string; command: (h: Household) => CommitResult };
export type StudioRun = (command: (h: Household) => CommitResult, message: string, review?: Review) => Promise<boolean>;

const HANDLES = [
  { index: 0, label: "Belly" },
  { index: 1, label: "Waist" },
  { index: 2, label: "Shoulder" },
  { index: 3, label: "Neck" },
] as const;
const ANCHOR_LABELS: Record<KittyAnchor, string> = {
  forehead: "Forehead", leftCheek: "Left cheek", rightCheek: "Right cheek", chin: "Chin", chest: "Chest", belly: "Belly", back: "Back",
  leftFlank: "Left flank", rightFlank: "Right flank", rump: "Rump", leftEar: "Left ear", rightEar: "Right ear", tailTip: "Tail tip",
};
const PART_LABELS: Record<KittyPart, string> = { body: "Body", head: "Head", earL: "Left ear", earR: "Right ear", tail: "Tail", paws: "Paws" };
const STAMP_LABELS: Record<KittyStampKind, string> = {
  heart: "Heart", star: "Star", paw: "Paw", fish: "Fish", moon: "Moon", flower: "Flower", bolt: "Bolt", initial: "Initial",
  "party-hat": "Party hat", "sun-hat": "Sun hat", beanie: "Beanie", crown: "Crown", glasses: "Glasses", sunglasses: "Sunglasses",
  bowtie: "Bow tie", scarf: "Scarf", purse: "Purse", suitcase: "Suitcase", camera: "Camera", palm: "Palm", shell: "Shell",
  ticket: "Ticket", balloon: "Balloon", sun: "Sun", cloud: "Cloud", key: "Key", leaf: "Leaf", cupcake: "Cupcake",
};
const FEATURE_LABELS: Record<KittyFeature, string> = { head: "Head", ears: "Ears", eyes: "Eyes", nose: "Nose", mouth: "Mouth", whiskers: "Whiskers", tail: "Tail" };
/** The extras drawer, grouped the way you go looking for them. */
const EXTRA_SHELVES: Array<{ id: string; label: string; kinds: readonly KittyStampKind[] }> = [
  { id: "marks", label: "Marks", kinds: ["heart", "star", "paw", "fish", "moon", "flower", "bolt", "initial"] },
  { id: "hats", label: "Hats", kinds: ["party-hat", "sun-hat", "beanie", "crown"] },
  { id: "worn", label: "Worn", kinds: ["glasses", "sunglasses", "bowtie", "scarf"] },
  { id: "carried", label: "Carried", kinds: ["purse", "suitcase", "camera", "key", "ticket"] },
  { id: "away", label: "Away days", kinds: ["palm", "shell", "sun", "cloud", "leaf", "balloon", "cupcake"] },
];
/** What this bank is for, told in pieces you can bake on. */
const STORY_KITS: Record<string, { label: string; blurb: string; kinds: readonly KittyStampKind[] }> = {
  getaway: { label: "Away days", blurb: "Sun hat, palm, a suitcase with somewhere to be.", kinds: ["sun-hat", "sunglasses", "palm", "shell", "suitcase", "camera", "sun"] },
  celebration: { label: "The big day", blurb: "Party hat, balloon, something with icing.", kinds: ["party-hat", "balloon", "cupcake", "crown", "star"] },
  home: { label: "Home things", blurb: "A key, a leaf, a little order.", kinds: ["key", "leaf", "flower", "heart", "cloud"] },
  wheels: { label: "On the road", blurb: "Keys, a ticket, weather going past.", kinds: ["key", "ticket", "cloud", "sun", "star"] },
  cosy: { label: "Kept back", blurb: "Scarf, beanie, moon — the quiet fund.", kinds: ["scarf", "beanie", "moon", "heart", "leaf"] },
};
const KIT_WORDS: Array<[RegExp, keyof typeof STORY_KITS]> = [
  [/trip|vacation|travel|holiday|flight|beach|cottage|getaway|away/i, "getaway"],
  [/wedding|birthday|party|anniversar|celebrat|christmas|gift/i, "celebration"],
  [/car|truck|bike|van|road|tires|insurance/i, "wheels"],
  [/home|house|reno|kitchen|garden|furniture|rent|mortgage/i, "home"],
  [/rainy|emergency|cushion|buffer|safety|vet|repair/i, "cosy"],
];
function storyKitFor(goal: Goal): { id: string } & (typeof STORY_KITS)[string] {
  const hay = `${goal.name} ${goal.envelope?.purpose ?? ""}`;
  for (const [pattern, id] of KIT_WORDS) if (pattern.test(hay)) return { id, ...STORY_KITS[id]! };
  const byKind = goal.envelope?.kind === "protect" ? "cosy" : goal.envelope?.kind === "prepare" ? "home" : "getaway";
  return { id: byKind, ...STORY_KITS[byKind]! };
}
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
const nowIso = () => new Date().toISOString();

function readDraft(key: string): KittyPieceV1 | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? shapeKittyPiece(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, draft: KittyPieceV1 | null) {
  try {
    if (draft) sessionStorage.setItem(key, JSON.stringify(draft));
    else sessionStorage.removeItem(key);
  } catch {
    /* Session storage is a convenience; the bank keeps the truth. */
  }
}
function randomSculpt(): KittySculptV1 {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
  const r = () => Math.round((0.7 + Math.random() * 0.4) * 100) / 100;
  return { body: pick(KITTY_BODIES), profile: [r(), r(), r(), Math.round((0.55 + Math.random() * 0.3) * 100) / 100], head: pick(KITTY_HEADS), ears: pick(KITTY_EARS), eyes: pick(KITTY_EYES), mouth: pick(KITTY_MOUTHS), whiskers: pick(KITTY_WHISKERS), tail: pick(KITTY_TAILS), nose: pick(KITTY_NOSES) };
}
const dist = (a: number, b: number, c: number, d: number) => Math.hypot(a - c, b - d);

export function useKittyStudio({ goal, identity, memberId, envelope, active, run, readLatest, saveDesign }: {
  goal: Goal;
  identity: string;
  memberId: string;
  /** The envelope the room would save (purpose/kind/refill live here). */
  envelope: GoalEnvelope;
  /** True while the Studio page is open; otherwise the stage shows the displayed piece. */
  active: boolean;
  run: StudioRun;
  readLatest: () => Household;
  /** Cosmetic storage for parent/source banks; Goals retain their ordinary command. */
  saveDesign?: (h: Household, studio: KittyStudioV1, fire: boolean) => CommitResult;
}) {
  const storageKey = `hearth-kitty-studio:${identity}:${goal.id}`;
  const server: KittyStudioV1 = goal.envelope?.studio ?? emptyKittyStudio();
  const [draft, setDraftState] = useState<KittyPieceV1 | null>(() => readDraft(storageKey) ?? server.draft);
  const [dirty, setDirty] = useState(() => readDraft(storageKey) !== null);
  const [bench, setBench] = useState<Bench>("wheel");
  const [flat, setFlat] = useState(false);
  const [brush, setBrush] = useState<BrushState>(() => ({ tool: "brush", color: studioHex(goal.envelope?.glaze ?? "cream"), size: 16, opacity: 0.9, mirror: true, stamp: null, stampText: "" }));
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const undo = useRef<KittyPieceV1[]>([]), redo = useRef<KittyPieceV1[]>([]);
  const [, bump] = useState(0);
  const [firing, setFiring] = useState<null | { phase: "heat" | "reveal"; started: number; skipped: boolean }>(null);
  const [previewFired, setPreviewFired] = useState(false);
  const [pending, setPending] = useState<Review | null>(null);
  const [status, setStatus] = useState("");
  const apiRef = useRef<KittyStageApi | null>(null);
  const onPaintRef = useRef<((hit: KittyHit | null, phase: "down" | "move" | "up") => void) | null>(null);
  const onThrowRef = useRef<((dy: number) => void) | null>(null);
  // Sync with the bank when the server draft changes underneath us and we have no local edits.
  const serverDraftJson = JSON.stringify(server.draft);
  useEffect(() => {
    if (!dirty) setDraftState(server.draft);
  }, [serverDraftJson, dirty]);
  useEffect(() => { writeDraft(storageKey, dirty ? draft : null); }, [draft, dirty, storageKey]);
  const setDraft = useCallback((next: KittyPieceV1 | ((current: KittyPieceV1) => KittyPieceV1), record = true) => {
    setDraftState((current) => {
      const base = current ?? newKittyPiece(id(), nowIso(), envelope.glaze);
      const value = typeof next === "function" ? next(base) : next;
      if (record) {
        undo.current.push(base);
        if (undo.current.length > 60) undo.current.shift();
        redo.current = [];
      }
      return value;
    });
    setDirty(true);
  }, [envelope.glaze]);
  const undoOnce = () => {
    const previous = undo.current.pop();
    if (!previous) return;
    setDraftState((current) => { if (current) redo.current.push(current); return previous; });
    setDirty(true);
    bump((n) => n + 1);
  };
  const redoOnce = () => {
    const next = redo.current.pop();
    if (!next) return;
    setDraftState((current) => { if (current) undo.current.push(current); return next; });
    setDirty(true);
    bump((n) => n + 1);
  };
  const throwAnother = () => {
    undo.current = [];
    redo.current = [];
    setDraftState(newKittyPiece(id(), nowIso(), envelope.glaze));
    setDirty(true);
    setPreviewFired(false);
    setBench("wheel");
    setStatus("Fresh clay on the wheel.");
  };
  const discard = () => {
    undo.current = [];
    redo.current = [];
    setDraftState(server.draft);
    setDirty(false);
    setStatus("Back to the clay the bank remembers.");
  };
  const studioForSave = (): KittyStudioV1 => ({ version: 1, draft, fired: server.fired, ...(server.displayId ? { displayId: server.displayId } : {}) });
  const saveStudio = (next: KittyStudioV1, message: string, review?: Omit<Review, "command" | "id" | "basis">) => {
    const command = (current: Household) => saveDesign ? saveDesign(current, next, false) : saveGoalEnvelope(current, {
      goalId: goal.id,
      expectedUpdatedAt: current.goals.find((row) => row.id === goal.id)?.updatedAt ?? goal.updatedAt,
      name: goal.name,
      target: goal.targetCents / 100,
      arrivalDate: goal.arrivalDate,
      envelope: { ...envelope, studio: next },
      createdBy: memberId,
    });
    return run(command, message, review ? { id: id(), basis: goal.updatedAt, command, ...review } : undefined);
  };
  const keep = async () => {
    const saved = await saveStudio(studioForSave(), "Clay kept in the bank. Still unfired — change it any time.");
    if (saved) { setDirty(false); setStatus("Kept. The clay is saved with the bank."); }
    return saved;
  };
  /** Take a fired piece back to the wheel. Its paint and shape come with it. */
  const repaint = async (pieceId: string) => {
    const next = reopenKittyPiece(server, pieceId);
    const saved = await saveStudio(next, "Back on the wheel. Change anything, then fire it again.");
    if (saved) {
      setFiring(null);
      undo.current = [];
      redo.current = [];
      setDraftState(next.draft);
      setDirty(false);
      setPreviewFired(false);
      setBench("paint");
      setStatus("Back on the wheel. Repaint it and fire it again whenever you like.");
    }
    return saved;
  };
  const removePiece = async (pieceId: string) => {
    const saved = await saveStudio(removeKittyPiece(server, pieceId), "Taken off the shelf. The bank, its money and its history are untouched.");
    if (saved) { setFiring(null); setStatus("Off the shelf. Nothing else about the bank changed."); if (draft?.id === pieceId) { setDraftState(null); setDirty(false); } }
    return saved;
  };
  const showPiece = async (pieceId: string) => {
    const saved = await saveStudio({ ...studioForSave(), displayId: pieceId }, "That one is on display now.");
    if (saved) setStatus("On display.");
    return saved;
  };
  const reviewFire = () => {
    if (!draft) return;
    const again = (draft.firings ?? 0) > 0;
    setPending({
      id: crypto.randomUUID(),
      title: `${again ? "Fire" : "Fire"} ${goal.name}`,
      body: again
        ? "This puts the clay back in the kiln with the changes you just made."
        : "This puts the clay on the wheel into the kiln and gives it its glaze.",
      extra: "No money moves. You can take it back to the wheel later, throw another, or take it off the shelf.",
      basis: goal.updatedAt,
      command: (current) => saveDesign ? saveDesign(current, studioForSave(), true) : saveGoalEnvelope(current, {
        goalId: goal.id,
        expectedUpdatedAt: current.goals.find((row) => row.id === goal.id)?.updatedAt ?? goal.updatedAt,
        name: goal.name,
        target: goal.targetCents / 100,
        arrivalDate: goal.arrivalDate,
        envelope: { ...envelope, studio: studioForSave() },
        createdBy: memberId,
        fire: true,
      }),
    });
  };
  const confirmFire = async () => {
    const review = pending;
    if (!review) return;
    const saved = await run(review.command, "Fired. Your Kitty Bank came out of the kiln.", review);
    if (saved) {
      setPending(null);
      setDirty(false);
      undo.current = [];
      redo.current = [];
      setDraftState(null);
      setPreviewFired(false);
      setFiring({ phase: reduced() ? "reveal" : "heat", started: performance.now(), skipped: false });
    }
  };
  useEffect(() => {
    if (!firing || firing.phase !== "heat") return;
    const t = setTimeout(() => setFiring((f) => (f ? { ...f, phase: "reveal" } : f)), 3500);
    return () => clearTimeout(t);
  }, [firing]);
  useEffect(() => {
    if (firing?.phase !== "reveal") return;
    const t = setTimeout(() => setFiring(null), reduced() ? 1200 : 4200);
    return () => clearTimeout(t);
  }, [firing?.phase]);
  const displayed = displayedKittyPiece(server);
  const latestFired = server.fired[server.fired.length - 1] ?? null;
  const stagePiece = active ? (firing ? latestFired : draft ?? displayed) : displayed;
  const stageFired = active ? (firing ? true : draft ? previewFired : true) : undefined;
  const mode: KittyStageMode = active && !firing ? (bench === "paint" ? "paint" : bench === "wheel" ? "wheel" : "kiln") : "view";
  const spin = active && !firing && bench === "wheel";
  const stageBrush = active && bench === "paint" && draft
    ? { size: brush.stamp ? Math.max(18, brush.size) : brush.size, color: brush.color, erasing: brush.tool === "eraser" && !brush.stamp }
    : null;
  return {
    bench, setBench, draft, setDraft, dirty, flat, setFlat, undoOnce, redoOnce, canUndo: undo.current.length > 0, canRedo: redo.current.length > 0,
    brush, setBrush, selectedStamp, setSelectedStamp, stageBrush,
    throwAnother, discard, keep, repaint, removePiece, showPiece, reviewFire, confirmFire,
    pendingFire: pending, setPendingFire: setPending, firing, setFiring, previewFired, setPreviewFired, status, setStatus,
    apiRef, onPaintRef, onThrowRef, stagePiece, stageFired, mode, spin, server, latestFired, displayed, readLatest,
  };
}
export type KittyStudioState = ReturnType<typeof useKittyStudio>;

/** Pointer painting: raycast hits → an in-progress stroke → committed stroke on pointer up. */
export function usePaintPointer(state: KittyStudioState) {
  const { brush: tool, selectedStamp } = state;
  const live = useRef<{ stroke: KittyStrokeV1; drawn: number } | null>(null);
  const commit = useCallback(() => {
    const current = live.current;
    live.current = null;
    if (!current) return;
    const stroke = quantizeKittyStroke(current.stroke);
    state.setDraft((piece) => {
      const strokes = [...piece.paint.strokes, stroke];
      const points = strokes.reduce((sum, row) => sum + row.pts.length / 2, 0);
      if (strokes.length > KITTY_STUDIO_LIMITS.strokes || points > KITTY_STUDIO_LIMITS.points) {
        state.setStatus("The clay is full of paint. Wash a little off or fire it as it is.");
        return piece;
      }
      return { ...piece, paint: { ...piece.paint, strokes } };
    });
  }, [state]);
  return useCallback((hit: KittyHit | null, phase: "down" | "move" | "up") => {
    // An armed extra bakes on wherever you tap; with one already selected, a tap moves it there.
    if (tool.stamp || selectedStamp) {
      if (phase !== "down" || !hit) return;
      const anchor = nearestKittyAnchor(hit.part, hit.uv.u, hit.uv.v);
      if (tool.stamp) {
        const stampId = id();
        state.setDraft((piece) => addStamp(piece, tool.stamp!, anchor, hit.part, hit.uv.u, hit.uv.v, tool.color, tool.stampText, stampId));
        state.setSelectedStamp(stampId);
        state.setBrush({ ...tool, stamp: null });
        state.setStatus("Baked on. Drag the sliders to size it, or tap the cat again to move it.");
        return;
      }
      state.setDraft((piece) => ({
        ...piece,
        paint: { ...piece.paint, stamps: piece.paint.stamps.map((row) => (row.id === selectedStamp ? { ...row, anchor, part: hit.part, u: Math.round(hit.uv.u * 1000) / 1000, v: Math.round(hit.uv.v * 1000) / 1000 } : row)) },
      }));
      return;
    }
    if (phase === "down") {
      commit();
      // No hit yet is fine: the first move that lands starts the stroke.
      if (!hit) return;
      live.current = { stroke: { part: hit.part, tool: tool.tool, color: tool.color, size: tool.size, opacity: tool.opacity, mirror: tool.mirror, pts: [hit.uv.u, hit.uv.v] }, drawn: -1 };
      state.apiRef.current?.paintStroke(live.current.stroke, 0);
      live.current.drawn = 0;
      return;
    }
    const current = live.current;
    if (!current) {
      // The stroke began off the clay: start it the moment the brush arrives.
      if (phase === "move" && hit) {
        live.current = { stroke: { part: hit.part, tool: tool.tool, color: tool.color, size: tool.size, opacity: tool.opacity, mirror: tool.mirror, pts: [hit.uv.u, hit.uv.v] }, drawn: -1 };
        state.apiRef.current?.paintStroke(live.current.stroke, 0);
        live.current.drawn = 0;
      }
      return;
    }
    if (phase === "move") {
      // A miss past the clay is not the end of the stroke: the stage hands back
      // the shell's uv, so the line keeps going and comes back on.
      if (!hit || hit.part !== current.stroke.part) {
        commit();
        if (hit) {
          live.current = { stroke: { part: hit.part, tool: tool.tool, color: tool.color, size: tool.size, opacity: tool.opacity, mirror: tool.mirror, pts: [hit.uv.u, hit.uv.v] }, drawn: 0 };
          state.apiRef.current?.paintStroke(live.current.stroke, 0);
        }
        return;
      }
      const pts = current.stroke.pts;
      const lastU = pts[pts.length - 2]!, lastV = pts[pts.length - 1]!;
      if (dist(lastU, lastV, hit.uv.u, hit.uv.v) < 0.003) return;
      if (pts.length / 2 >= 600) { commit(); return; }
      pts.push(hit.uv.u, hit.uv.v);
      state.apiRef.current?.paintStroke(current.stroke, current.drawn);
      current.drawn = pts.length / 2 - 1;
      return;
    }
    commit();
  }, [tool, selectedStamp, commit, state]);
}
function addStamp(piece: KittyPieceV1, kind: KittyStampKind, anchor: KittyAnchor, part: KittyPart, u: number, v: number, color: string, text: string, stampId: string): KittyPieceV1 {
  if (piece.paint.stamps.length >= KITTY_STUDIO_LIMITS.stamps) return piece;
  const stamp: KittyStampV1 = {
    id: stampId,
    anchor,
    part,
    u: Math.round(u * 1000) / 1000,
    v: Math.round(v * 1000) / 1000,
    kind,
    color,
    trim: stampTrim({ color }),
    size: 0.22,
    rotation: 0,
    ...(kind === "initial" ? { text: (text.trim() || "A").slice(0, 2).toUpperCase() } : {}),
  };
  return { ...piece, paint: { ...piece.paint, stamps: [...piece.paint.stamps, stamp] } };
}

function Chips<T extends string>({ label, options, value, onChange, glyph }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; glyph: (v: T) => ReactNode }) {
  return (
    <fieldset className="studio-chips">
      <legend>{label}</legend>
      <div className="studio-chip-row">
        {options.map((option) => (
          <button type="button" key={option} className="studio-chip" aria-pressed={value === option} onClick={() => onChange(option)}>
            {glyph(option)}
            <span>{option}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function StudioBench({ state, goal, busy, step }: { state: KittyStudioState; goal: Goal; busy: boolean; step: number }) {
  const { bench, setBench, draft, setDraft, brush, setBrush, selectedStamp, setSelectedStamp } = state;
  const piece = draft ?? newKittyPiece("preview", nowIso(), goal.envelope?.glaze ?? "cream");
  const [customHex, setCustomHex] = useState("");
  const [dipPart, setDipPart] = useState<KittyPart | "all">("all");
  const [shelf, setShelf] = useState(EXTRA_SHELVES[0]!.id);
  const [wash, setWash] = useState(false);
  const [handle, setHandle] = useState<0 | 1 | 2 | 3>(0);
  const [feature, setFeature] = useState<KittyFeature>("eyes");
  const [pieceAction, setPieceAction] = useState<null | { kind: "repaint" | "remove"; id: string }>(null);
  const hold = useRef<number | null>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const kit = useMemo(() => storyKitFor(goal), [goal.name, goal.envelope?.purpose, goal.envelope?.kind]);
  const onPaint = usePaintPointer(state);
  useEffect(() => { state.onPaintRef.current = onPaint; }, [onPaint, state]);
  useEffect(() => {
    const key = (raw: Event) => {
      const event = raw as globalThis.KeyboardEvent;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (event.key === "1") setBench("wheel");
      else if (event.key === "2") setBench("paint");
      else if (event.key === "3") setBench("kiln");
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) state.redoOnce(); else state.undoOnce(); }
    };
    const root = shelfRef.current?.closest(".kitty-studio");
    root?.addEventListener("keydown", key);
    return () => root?.removeEventListener("keydown", key);
  }, [setBench, state]);
  const nudge = (index: number, delta: number) => setDraft((p) => {
    const profile = [...p.sculpt.profile] as KittySculptV1["profile"];
    profile[index] = Math.round(Math.max(KITTY_STUDIO_LIMITS.profileMin, Math.min(KITTY_STUDIO_LIMITS.profileMax, profile[index]! + delta)) * 1000) / 1000;
    return { ...p, sculpt: { ...p.sculpt, profile } };
  });
  useEffect(() => { state.onThrowRef.current = (dy: number) => nudge(handle, -dy * 0.004); });
  const startHold = (delta: number) => {
    stopHold();
    nudge(handle, delta);
    hold.current = window.setInterval(() => nudge(handle, delta), 90);
  };
  const stopHold = () => { if (hold.current) { clearInterval(hold.current); hold.current = null; } };
  useEffect(() => stopHold, []);
  const setSculpt = <K extends keyof KittySculptV1>(key: K, value: KittySculptV1[K]) => setDraft((p) => ({ ...p, sculpt: { ...p.sculpt, [key]: value } }));
  const setFeatureSize = (value: number) => setDraft((p) => ({ ...p, sculpt: withKittyFeature(p.sculpt, feature, value) }));
  const featureValue = kittyFeature(piece.sculpt, feature);
  const dip = () => setDraft((p) => (dipPart === "all"
    ? { ...p, paint: { ...p.paint, base: brush.color, parts: {} } }
    : { ...p, paint: { ...p.paint, parts: { ...p.paint.parts, [dipPart]: brush.color } } }));
  const current = piece.paint.stamps.find((row) => row.id === selectedStamp) ?? null;
  const editStamp = (patch: Partial<KittyStampV1>) => current && setDraft((p) => ({ ...p, paint: { ...p.paint, stamps: p.paint.stamps.map((row) => (row.id === current.id ? { ...row, ...patch } : row)) } }));
  const nudgeStamp = (du: number, dv: number) => {
    if (!current) return;
    const spot = current.part && typeof current.u === "number" ? { part: current.part, u: current.u, v: current.v! } : KITTY_ANCHOR_UV[current.anchor];
    const u = Math.min(1, Math.max(0, Math.round((spot.u + du) * 1000) / 1000));
    const v = Math.min(1, Math.max(0, Math.round((spot.v + dv) * 1000) / 1000));
    editStamp({ part: spot.part, u, v, anchor: nearestKittyAnchor(spot.part, u, v) });
  };
  const removeStamp = () => { if (current) { setDraft((p) => ({ ...p, paint: { ...p.paint, stamps: p.paint.stamps.filter((row) => row.id !== current.id) } })); setSelectedStamp(null); } };
  const stampKeys = (event: KeyboardEvent) => {
    if (!current) return;
    const map: Record<string, () => void> = {
      ArrowLeft: () => editStamp({ rotation: Math.max(-180, current.rotation - 15) }),
      ArrowRight: () => editStamp({ rotation: Math.min(180, current.rotation + 15) }),
      ArrowUp: () => editStamp({ size: Math.min(KITTY_STUDIO_LIMITS.stampSize[1], Math.round((current.size + 0.04) * 100) / 100) }),
      ArrowDown: () => editStamp({ size: Math.max(KITTY_STUDIO_LIMITS.stampSize[0], Math.round((current.size - 0.04) * 100) / 100) }),
      Delete: removeStamp,
      Backspace: removeStamp,
    };
    const action = map[event.key];
    if (action) { event.preventDefault(); action(); }
  };
  const arm = (kind: KittyStampKind) => {
    setBrush({ ...brush, stamp: brush.stamp === kind ? null : kind });
    setSelectedStamp(null);
    if (brush.stamp !== kind) state.setStatus(`${STAMP_LABELS[kind]} ready — tap the cat wherever you want it.`);
  };
  const firedShelf = state.server.fired;
  const temperature = useKilnTemperature(state.firing);
  const displayedId = state.displayed?.id ?? null;
  return (
    <div className="kitty-studio" data-bench={bench} ref={shelfRef}>
      <div className="studio-head">
        <span className="kitty-eyebrow">The studio</span>
        <h3>{draft ? (draft.firings ? "Back on the wheel." : "Wet clay on the wheel.") : state.latestFired ? "Fired and on the shelf." : "Throw your first piece."}</h3>
        <p className="studio-lede">
          {draft ? "Shape it, paint it, fire it. Nothing here moves money." : state.latestFired ? "Repaint it, swap it, or throw another whenever you like." : "Every bank starts as a lump of clay."}
        </p>
      </div>
      <nav className="studio-benches" aria-label="Studio benches">
        {(["wheel", "paint", "kiln"] as const).map((value, index) => (
          <button type="button" key={value} aria-current={bench === value ? "page" : undefined} onClick={() => setBench(value)} title={`${value} · press ${index + 1}`}>
            <b aria-hidden="true">{index + 1}</b>
            <span>{{ wheel: "Shape", paint: "Paint", kiln: "Kiln" }[value]}</span>
          </button>
        ))}
      </nav>
      {state.status && <p className="studio-status" role="status">{state.status}</p>}
      {!draft && bench !== "kiln" && (
        <div className="studio-empty">
          <p>{state.latestFired ? "The wheel is empty. Take a piece off the shelf to change it, or start fresh." : "The wheel is waiting."}</p>
          <button type="button" className="kitty-primary" onClick={state.throwAnother} disabled={busy}>{state.latestFired ? "Throw another" : "Throw a piece"}</button>
        </div>
      )}
      {draft && bench === "wheel" && (
        <section className="studio-wheel" aria-label="Shape">
          <Chips label="Body" options={KITTY_BODIES} value={piece.sculpt.body} onChange={(v) => setSculpt("body", v)} glyph={(v) => <BodyGlyph value={v} />} />
          <Chips label="Head" options={KITTY_HEADS} value={piece.sculpt.head} onChange={(v) => setSculpt("head", v)} glyph={(v) => <HeadGlyph value={v} />} />
          <Chips label="Ears" options={KITTY_EARS} value={piece.sculpt.ears} onChange={(v) => setSculpt("ears", v)} glyph={(v) => <EarsGlyph value={v} />} />
          <Chips label="Eyes" options={KITTY_EYES} value={piece.sculpt.eyes} onChange={(v) => setSculpt("eyes", v)} glyph={(v) => <EyesGlyph value={v} />} />
          <Chips label="Mouth" options={KITTY_MOUTHS} value={piece.sculpt.mouth} onChange={(v) => setSculpt("mouth", v)} glyph={(v) => <MouthGlyph value={v} />} />
          <Chips label="Tail" options={KITTY_TAILS} value={piece.sculpt.tail} onChange={(v) => setSculpt("tail", v)} glyph={(v) => <TailGlyph value={v} />} />
          <fieldset className="studio-chips studio-sizes">
            <legend>Bigger or smaller</legend>
            <div className="studio-chip-row studio-size-picker">
              {KITTY_FEATURES.map((name) => (
                <button type="button" key={name} className="studio-chip studio-chip-plain" aria-pressed={feature === name} onClick={() => setFeature(name)}>
                  <span>{FEATURE_LABELS[name]}</span>
                  <small>{Math.round(kittyFeature(piece.sculpt, name) * 100)}%</small>
                </button>
              ))}
            </div>
            <div className="studio-size-row">
              <button type="button" aria-label={`Smaller ${FEATURE_LABELS[feature].toLowerCase()}`} onClick={() => setFeatureSize(featureValue - 0.1)}>－</button>
              <label>
                <span className="sr-only">{FEATURE_LABELS[feature]} size</span>
                <input
                  type="range"
                  min={KITTY_STUDIO_LIMITS.featureMin}
                  max={KITTY_STUDIO_LIMITS.featureMax}
                  step={0.05}
                  value={featureValue}
                  onChange={(event) => setFeatureSize(Number(event.target.value))}
                />
              </label>
              <button type="button" aria-label={`Bigger ${FEATURE_LABELS[feature].toLowerCase()}`} onClick={() => setFeatureSize(featureValue + 0.1)}>＋</button>
              <output>{FEATURE_LABELS[feature]} {Math.round(featureValue * 100)}%</output>
            </div>
          </fieldset>
          <details className="studio-more">
            <summary>More shaping</summary>
            <div className="studio-throw">
              <div className="studio-throw-handles" role="group" aria-label="Profile handle to throw">
                {HANDLES.map((row) => (
                  <button type="button" key={row.index} aria-pressed={handle === row.index} onClick={() => setHandle(row.index)}>{row.label}</button>
                ))}
              </div>
              <div className="studio-throw-pads">
                <button type="button" className="studio-pad" onPointerDown={() => startHold(-0.01)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nudge(handle, -0.02); } }} aria-label={`Push the ${HANDLES[handle].label.toLowerCase()} in`}>
                  ⤓ Push in
                </button>
                <button type="button" className="studio-pad" onPointerDown={() => startHold(0.01)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nudge(handle, 0.02); } }} aria-label={`Pull the ${HANDLES[handle].label.toLowerCase()} out`}>
                  ⤒ Pull out
                </button>
              </div>
              <p className="studio-hint">Hold to throw, or drag up and down on the wheel.</p>
            </div>
            <div className="studio-sliders">
              {HANDLES.map((row) => (
                <label key={row.index}>
                  <span>{row.label} <output>{Math.round(piece.sculpt.profile[row.index] * 100)}%</output></span>
                  <input type="range" min={KITTY_STUDIO_LIMITS.profileMin} max={KITTY_STUDIO_LIMITS.profileMax} step={0.01} value={piece.sculpt.profile[row.index]} onChange={(e) => nudge(row.index, Number(e.target.value) - piece.sculpt.profile[row.index]!)} onFocus={() => setHandle(row.index)} />
                </label>
              ))}
            </div>
            <Chips label="Nose" options={KITTY_NOSES} value={piece.sculpt.nose} onChange={(v) => setSculpt("nose", v)} glyph={(v) => <NoseGlyph value={v} />} />
            <Chips label="Whiskers" options={KITTY_WHISKERS} value={piece.sculpt.whiskers} onChange={(v) => setSculpt("whiskers", v)} glyph={(v) => <WhiskersGlyph value={v} />} />
          </details>
          <div className="studio-row">
            <button type="button" onClick={() => setDraft((p) => ({ ...p, sculpt: randomSculpt() }))}>Shuffle clay</button>
            <button type="button" onClick={() => setDraft((p) => ({ ...p, sculpt: defaultKittySculpt() }))}>Plain lump</button>
          </div>
        </section>
      )}
      {draft && bench === "paint" && (
        <section className="studio-paint" aria-label="Paint">
          {state.flat && <p className="studio-hint studio-limit">Paint directly on this simple view. The same marks appear in 3D.</p>}
          <div className="studio-tools" role="group" aria-label="Tools">
            {(["brush", "marker", "sponge", "eraser"] as const).map((value) => (
              <button type="button" key={value} className="studio-chip" aria-pressed={brush.tool === value && !brush.stamp} onClick={() => { setBrush({ ...brush, tool: value, stamp: null }); setSelectedStamp(null); }}>
                <ToolGlyph value={value} /><span>{value}</span>
              </button>
            ))}
            <button type="button" className="studio-chip" aria-pressed={brush.mirror} onClick={() => setBrush({ ...brush, mirror: !brush.mirror })}>
              <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4v32" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" /><path d="M6 30l10-8-10-8Z M34 30l-10-8 10-8Z" fill="var(--studio-clay)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
              <span>Mirror</span>
            </button>
          </div>
          <div className="studio-sliders studio-sliders-inline">
            <label>
              <span>Brush <output>{brush.size}</output></span>
              <input type="range" min={KITTY_STUDIO_LIMITS.strokeSize[0]} max={KITTY_STUDIO_LIMITS.strokeSize[1]} value={brush.size} onChange={(e) => setBrush({ ...brush, size: Number(e.target.value) })} />
            </label>
            <label>
              <span>Opacity <output>{Math.round(brush.opacity * 100)}%</output></span>
              <input type="range" min={0.1} max={1} step={0.05} value={brush.opacity} onChange={(e) => setBrush({ ...brush, opacity: Number(e.target.value) })} />
            </label>
          </div>
          <p className="studio-hint">The ring on the cat is the size of the mark. Paint past the edge — it still lands.</p>
          <fieldset className="studio-palette">
            <legend>Glazes</legend>
            <div className="studio-swatches">
              {STUDIO_PALETTE.map((row) => (
                <button type="button" key={row.id} className="studio-swatch" aria-label={`${row.name}${row.legacy ? " · classic glaze" : ""}`} aria-pressed={brush.color === row.hex} title={row.name} style={{ "--swatch": row.hex } as CSSProperties} onClick={() => setBrush({ ...brush, color: row.hex })} data-legacy={row.legacy ? "true" : undefined} />
              ))}
            </div>
            <div className="studio-dip">
              <label>
                <span>Dip</span>
                <select value={dipPart} onChange={(e) => setDipPart(e.target.value as KittyPart | "all")}>
                  <option value="all">The whole cat</option>
                  {KITTY_PARTS.map((part) => <option key={part} value={part}>{PART_LABELS[part]}</option>)}
                </select>
              </label>
              <button type="button" onClick={dip}><ToolGlyph value="dip" /> Dip it</button>
            </div>
            <details className="studio-more">
              <summary>Mix your own</summary>
              <label className="studio-hex">
                <span>Custom hex</span>
                <input value={customHex} placeholder={brush.color} maxLength={7} onChange={(e) => { const v = e.target.value.trim().toLowerCase(); setCustomHex(v); if (isStudioHex(v)) setBrush({ ...brush, color: v }); }} />
              </label>
              <p className="studio-hint">Chosen: <b className="studio-swatch-inline" style={{ "--swatch": brush.color } as CSSProperties} aria-hidden="true" /> {STUDIO_PALETTE.find((row) => row.hex === brush.color)?.name ?? brush.color}</p>
            </details>
          </fieldset>
          <section className="studio-extras" aria-label="Little extras">
            <div className="studio-kit">
              <span className="kitty-eyebrow">{kit.label}</span>
              <p className="studio-hint">{kit.blurb}</p>
              <div className="studio-chip-row">
                {kit.kinds.map((kind) => (
                  <button type="button" key={`kit-${kind}`} className="studio-chip" aria-pressed={brush.stamp === kind} onClick={() => arm(kind)}>
                    <StampGlyph value={kind} text={brush.stampText} /><span>{STAMP_LABELS[kind]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="studio-shelf-tabs" role="group" aria-label="Extras drawer">
              {EXTRA_SHELVES.map((row) => (
                <button type="button" key={row.id} aria-pressed={shelf === row.id} onClick={() => setShelf(row.id)}>{row.label}</button>
              ))}
            </div>
            <div className="studio-chip-row">
              {EXTRA_SHELVES.find((row) => row.id === shelf)!.kinds.map((kind) => (
                <button type="button" key={kind} className="studio-chip" aria-pressed={brush.stamp === kind} onClick={() => arm(kind)}>
                  <StampGlyph value={kind} text={brush.stampText} /><span>{STAMP_LABELS[kind]}</span>
                </button>
              ))}
            </div>
            {brush.stamp === "initial" && (
              <label className="studio-hex"><span>Letters (1–2)</span><input value={brush.stampText} maxLength={2} onChange={(e) => setBrush({ ...brush, stampText: e.target.value })} /></label>
            )}
            {brush.stamp && (
              <div className="studio-anchors">
                <p className="studio-hint" role="status">Tap the cat anywhere to bake the {STAMP_LABELS[brush.stamp].toLowerCase()} on — or pick a spot:</p>
                <div className="studio-chip-row">
                  {KITTY_ANCHORS.map((anchor) => (
                    <button
                      type="button"
                      key={anchor}
                      onClick={() => {
                        const spot = KITTY_ANCHOR_UV[anchor];
                        const stampId = id();
                        setDraft((p) => addStamp(p, brush.stamp!, anchor, spot.part, spot.u, spot.v, brush.color, brush.stampText, stampId));
                        setSelectedStamp(stampId);
                        setBrush({ ...brush, stamp: null });
                      }}
                    >
                      {ANCHOR_LABELS[anchor]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {piece.paint.stamps.length > 0 && (
              <ul className="studio-stamp-list" aria-label="Baked-on pieces">
                {piece.paint.stamps.map((row) => (
                  <li key={row.id}>
                    <button type="button" aria-pressed={selectedStamp === row.id} onClick={() => { setSelectedStamp(selectedStamp === row.id ? null : row.id); setBrush({ ...brush, stamp: null }); }} onKeyDown={stampKeys}>
                      <StampGlyph value={row.kind} text={row.text} /> {STAMP_LABELS[row.kind]} · {ANCHOR_LABELS[row.anchor]} · {Math.round(row.size * 100)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {current && (
              <div className="studio-stamp-edit">
                <p className="studio-hint">{STAMP_LABELS[current.kind]} selected. Tap the cat to move it.</p>
                <label>
                  <span>Size <output>{Math.round(current.size * 100)}</output></span>
                  <input type="range" min={KITTY_STUDIO_LIMITS.stampSize[0]} max={KITTY_STUDIO_LIMITS.stampSize[1]} step={0.01} value={current.size} onChange={(e) => editStamp({ size: Number(e.target.value) })} />
                </label>
                <label>
                  <span>Turn <output>{current.rotation}°</output></span>
                  <input type="range" min={-180} max={180} step={5} value={current.rotation} onChange={(e) => editStamp({ rotation: Number(e.target.value) })} />
                </label>
                <div className="studio-row studio-nudge" role="group" aria-label="Move the piece">
                  <button type="button" aria-label="Move it left" onClick={() => nudgeStamp(-0.03, 0)}>←</button>
                  <button type="button" aria-label="Move it right" onClick={() => nudgeStamp(0.03, 0)}>→</button>
                  <button type="button" aria-label="Move it up" onClick={() => nudgeStamp(0, 0.03)}>↑</button>
                  <button type="button" aria-label="Move it down" onClick={() => nudgeStamp(0, -0.03)}>↓</button>
                  <label className="studio-move-to">
                    <span>Move to</span>
                    <select
                      value=""
                      onChange={(event) => {
                        const anchor = event.target.value as KittyAnchor;
                        if (!anchor) return;
                        const spot = KITTY_ANCHOR_UV[anchor];
                        editStamp({ anchor, part: spot.part, u: spot.u, v: spot.v });
                      }}
                    >
                      <option value="">Pick a spot…</option>
                      {KITTY_ANCHORS.map((anchor) => <option key={anchor} value={anchor}>{ANCHOR_LABELS[anchor]}</option>)}
                    </select>
                  </label>
                </div>
                <div className="studio-row">
                  <button type="button" onClick={() => editStamp({ color: brush.color, trim: stampTrim({ color: brush.color }) })}>Recolour</button>
                  <button type="button" onClick={() => editStamp({ trim: brush.color })}>Trim in this</button>
                  <button type="button" onClick={removeStamp}>Take it off</button>
                </div>
              </div>
            )}
          </section>
          <div className="studio-row">
            <button type="button" onClick={state.undoOnce} disabled={!state.canUndo}>Undo</button>
            <button type="button" onClick={state.redoOnce} disabled={!state.canRedo}>Redo</button>
            {!wash ? (
              <button type="button" onClick={() => setWash(true)}>Wash it off</button>
            ) : (
              <span className="studio-wash">
                Wash every stroke and piece off?
                <button type="button" onClick={() => { setDraft((p) => ({ ...p, paint: { ...p.paint, strokes: [], stamps: [], parts: {} } })); setWash(false); setSelectedStamp(null); }}>Yes, wash it</button>
                <button type="button" onClick={() => setWash(false)}>Keep it</button>
              </span>
            )}
          </div>
          <p className="studio-hint">{piece.paint.strokes.length} strokes · {piece.paint.stamps.length} pieces. Colours look chalky until the kiln.</p>
        </section>
      )}
      {bench === "kiln" && (
        <section className="studio-kiln" aria-label="Kiln">
          <Kiln firing={state.firing} temperature={temperature} piece={state.firing ? state.latestFired : draft ?? state.displayed} fired={Boolean(state.firing) || !draft || state.previewFired} step={step} />
          {state.firing ? (
            <div className="studio-row">
              <p role="status" aria-live="polite">{state.firing.phase === "heat" ? `Firing… ${temperature} °C` : "Out of the kiln. Look at that shine."}</p>
              {state.firing.phase === "heat" ? (
                <button type="button" onClick={() => state.setFiring({ ...state.firing!, phase: "reveal", skipped: true })}>Skip</button>
              ) : (
                <button type="button" className="kitty-primary" onClick={() => { state.setFiring(null); state.throwAnother(); }} disabled={busy}>Throw another</button>
              )}
            </div>
          ) : draft ? (
            <>
              <div className="studio-row">
                <button type="button" aria-pressed={state.previewFired} onClick={() => state.setPreviewFired(!state.previewFired)}>{state.previewFired ? "Show the raw clay" : "Preview the glaze"}</button>
                <button type="button" className="kitty-primary" disabled={busy} onClick={state.reviewFire}>{draft.firings ? "Fire it again" : "Fire it"}</button>
              </div>
              <p className="studio-hint">The kiln saves the clay first, then bakes it in. You can bring it back to the wheel later.</p>
            </>
          ) : (
            <div className="studio-row">
              <button type="button" className="kitty-primary" onClick={state.throwAnother} disabled={busy}>Throw another</button>
            </div>
          )}
        </section>
      )}
      {firedShelf.length > 0 && (
        <section className="studio-shelf" aria-label="Fired shelf">
          <span className="kitty-eyebrow">Shelf · {firedShelf.length} of {KITTY_STUDIO_LIMITS.fired}</span>
          <div className="studio-shelf-row">
            {firedShelf.map((row) => (
              <figure key={row.id} className="studio-shelf-piece" data-newest={row.id === displayedId ? "true" : undefined}>
                <KittyFlat piece={row} fired step={0} title={`Kitty Bank fired ${new Date(row.firedAt ?? row.createdAt).toISOString().slice(0, 10)}`} />
                <figcaption>
                  {new Date(row.firedAt ?? row.createdAt).toISOString().slice(0, 10)}
                  {row.id === displayedId ? " · on display" : ""}
                  {(row.firings ?? 1) > 1 ? ` · fired ${row.firings}×` : ""}
                </figcaption>
                <div className="studio-shelf-actions">
                  <button type="button" disabled={busy || row.id === displayedId} onClick={() => void state.showPiece(row.id)}>Show this one</button>
                  <button type="button" disabled={busy} onClick={() => setPieceAction({ kind: "repaint", id: row.id })}>Repaint</button>
                  <button type="button" disabled={busy} onClick={() => setPieceAction({ kind: "remove", id: row.id })}>Throw away</button>
                </div>
              </figure>
            ))}
          </div>
        </section>
      )}
      {draft && (
        <div className="studio-keep">
          <button type="button" className="kitty-primary" disabled={busy || !state.dirty} onClick={() => void state.keep()}>Keep the clay</button>
          <button type="button" disabled={busy || !state.dirty} onClick={state.discard}>Discard changes</button>
          <small>{state.dirty ? "Unsaved changes stay in this browser until you keep them." : "Saved with the bank. Unfired clay can still change."}</small>
        </div>
      )}
      {pieceAction && (
        <ConfirmSheet
          title={pieceAction.kind === "repaint" ? "Back to the wheel" : "Take it off the shelf"}
          body={pieceAction.kind === "repaint"
            ? "This piece becomes the clay on the wheel again, with its shape and paint intact. Fire it again when you like."
            : "This piece goes for good. The bank keeps its name, its money and its history."}
          extra={pieceAction.kind === "repaint" && state.dirty ? "The unsaved clay currently on the wheel is replaced." : "No money moves either way."}
          confirmLabel={pieceAction.kind === "repaint" ? "Bring it back" : "Throw it away"}
          busy={busy}
          onCancel={() => setPieceAction(null)}
          onConfirm={() => {
            const action = pieceAction;
            setPieceAction(null);
            void (action.kind === "repaint" ? state.repaint(action.id) : state.removePiece(action.id));
          }}
        />
      )}
      {state.pendingFire && (
        <ConfirmSheet
          title={state.pendingFire.title}
          body={state.pendingFire.body}
          extra={state.pendingFire.extra}
          confirmLabel="Fire it"
          busy={busy}
          onCancel={() => state.setPendingFire(null)}
          onConfirm={() => void state.confirmFire()}
        />
      )}
    </div>
  );
}
function useKilnTemperature(firing: KittyStudioState["firing"]) {
  const [temp, setTemp] = useState(0);
  useEffect(() => {
    if (!firing) { setTemp(0); return; }
    if (firing.phase === "reveal") { setTemp(1000); return; }
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - firing.started) / 3500);
      setTemp(Math.round(1000 * (1 - Math.pow(1 - t, 2))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [firing]);
  return temp;
}
function Kiln({ firing, temperature, piece, fired, step }: { firing: KittyStudioState["firing"]; temperature: number; piece: KittyPieceV1 | null; fired: boolean; step: number }) {
  const heat = firing?.phase === "heat" ? temperature / 1000 : 0;
  const open = !firing || firing.phase === "reveal";
  return (
    <div className="studio-kiln-box" data-phase={firing?.phase ?? "idle"} style={{ "--heat": heat } as CSSProperties}>
      <svg viewBox="0 0 320 240" className="studio-kiln-art" aria-hidden="true">
        <rect x="20" y="20" width="280" height="200" rx="18" fill="var(--studio-bench)" stroke="currentColor" strokeWidth="3" />
        <rect x="46" y="40" width="228" height="150" rx="10" fill="var(--studio-kiln-chamber)" stroke="currentColor" strokeWidth="2" />
        <rect x="46" y="40" width="228" height="150" rx="10" fill="var(--studio-kiln-glow)" style={{ opacity: heat }} />
        <g className="studio-kiln-door" data-open={open ? "true" : "false"}>
          <rect x="46" y="40" width="228" height="150" rx="10" fill="var(--studio-bench)" stroke="currentColor" strokeWidth="3" />
          <circle cx="160" cy="115" r="22" fill="var(--studio-kiln-glow)" style={{ opacity: 0.25 + heat * 0.75 }} stroke="currentColor" strokeWidth="2" />
          <rect x="236" y="100" width="10" height="30" rx="4" fill="currentColor" />
        </g>
        <rect x="120" y="196" width="80" height="12" rx="4" fill="currentColor" opacity="0.6" />
        <text x="160" y="232" textAnchor="middle" fontFamily="Georgia, serif" fontSize="14" fill="currentColor">{firing ? `${temperature} °C` : "Cold kiln · ready"}</text>
      </svg>
      <div className="studio-kiln-piece" data-open={open ? "true" : "false"}>
        <KittyFlat piece={piece} fired={fired} step={step} />
      </div>
    </div>
  );
}
