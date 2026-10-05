/**
 * `layoutYear(board)` (Horizon Clock Year, L3; PURE — no three, no DOM).
 *
 * The year as a ring of twelve clay minis (one per chapter in `board.window`), each at its calendar month's place on
 * the ring (January at north, clockwise — the same way the Month clock turns). Each mini carries ONE stack on the Year
 * ruler ($1,000 a ring, `ringsFor(…, "year")`): what the map's commitments come to that month (ruling 5: "bills and
 * planned costs on the map, not all spending"). The stack is two columns side by side — solid = recorded
 * (`outRecordedCents`), see-through = not recorded (`outOpenCents`) — never one on top of the other as if it were the
 * same money. Unknown amounts add nothing (they are counted on `YearChapter.unknownAmounts`).
 *
 * Treatments: "empty" (no stops on the map that month: pale plinth, dashed road), "future" (a later month: whitened
 * land, plain road), "kept" (a closed Chapter: a small flag), otherwise "past" / "open" (today's month).
 */
import {
  ringsFor, isToCheck, type ChapterId, type JourneyBoard, type Point2, type StackRings, type Stop, type YearChapter,
} from "../contracts.ts";
import { isRecorded } from "../model/money.ts";
import { polar, slotAngle } from "./geo.ts";

/** Ring radius of the minis around the shrunken Month diorama (diorama units, prototype `RY`). */
export const YEAR_RING_DU = 10.5;
/** A mini's island scale against the full diorama (prototype `MS`). */
export const YEAR_MINI_SCALE = 0.26;
/** Where a mini's stack stands (mini-local polar: angle, radius). */
export const YEAR_STACK_AT = { angle: 2.5, radius: 0.78 } as const;
/** The mini's own road ring radius (mini-local units). */
export const YEAR_MINI_ROAD = 1.33;

export type YearTreatment = "empty" | "future" | "open" | "past";
export type YearStackColumn = { cents: number; rings: StackRings; fill: "solid" | "see-through" };
export type YearDot = { stopId: string; day: number; at: Point2; kind: "check" | "open" | "recorded" };
export type YearMini = {
  chapterId: ChapterId;
  /** 1…12, calendar month. */
  month: number;
  angle: number;
  /** Diorama plan (x, z), ring of radius `YEAR_RING_DU`. */
  at: Point2;
  treatment: YearTreatment;
  kept: boolean;
  /** Stops on the map this month. */
  stops: number;
  toCheck: number;
  unknownAmounts: number;
  /** Solid then see-through, each only when its figure is above zero. */
  stack: YearStackColumn[];
  /** One dot per stop on the mini's road at its day slot (same date → same slot as the Month clock). */
  dots: YearDot[];
  /** Today's mini carries the bus. */
  today: boolean;
};
export type YearLayout = { minis: YearMini[] };

export function layoutYear(board: JourneyBoard): YearLayout {
  const rows = new Map((board.year ?? []).map((y) => [y.chapterId, y] as const));
  const byChapter = new Map<ChapterId, Stop[]>();
  for (const s of board.stops) (byChapter.get(s.chapterId) ?? byChapter.set(s.chapterId, []).get(s.chapterId)!).push(s);
  const minis = board.chapters.map((chapter): YearMini => {
    const month = Number(chapter.id.slice(5, 7));
    const angle = ((month - 1) / 12) * Math.PI * 2;
    const row: YearChapter = rows.get(chapter.id) ?? {
      chapterId: chapter.id, outRecordedCents: 0, outOpenCents: 0, inRecordedCents: 0, inOpenCents: 0, unknownAmounts: 0, toCheck: 0, kept: false,
    };
    const stops = byChapter.get(chapter.id) ?? [];
    const stack: YearStackColumn[] = [];
    const solid = row.outRecordedCents > 0 ? ringsFor(row.outRecordedCents, "year") : null;
    const open = row.outOpenCents > 0 ? ringsFor(row.outOpenCents, "year") : null;
    if (solid) stack.push({ cents: row.outRecordedCents, rings: solid, fill: "solid" });
    if (open) stack.push({ cents: row.outOpenCents, rings: open, fill: "see-through" });
    const empty = stops.length === 0;
    return {
      chapterId: chapter.id, month, angle, at: polar(angle, YEAR_RING_DU),
      treatment: empty ? "empty" : chapter.state === "upcoming" ? "future" : chapter.state === "open" ? "open" : "past",
      kept: row.kept, stops: stops.length, toCheck: row.toCheck, unknownAmounts: row.unknownAmounts, stack,
      dots: stops.map((s) => {
        const day = Number(s.date.slice(8, 10));
        return { stopId: s.id, day, at: polar(slotAngle(day), YEAR_MINI_ROAD), kind: isToCheck(s) ? "check" : isRecorded(s) ? "recorded" : "open" };
      }),
      today: chapter.id === board.currentChapterId,
    };
  });
  return { minis };
}
