import { shiftMonthKey } from "../core/calendar.ts";
import type { PathEraProgress, PathEraView } from "../core/pathEras.ts";
import type { PathEraRow, PathEraSpec } from "../core/pathWorld.ts";

/**
 * The Journey of Life on the page (D-268): pure helpers the island and the
 * planner share. Words only; an era never carries an amount.
 */

/** "Sep 2026" for a `YYYY-MM` key. */
export function eraMonthLabel(key: string | null | undefined): string {
  if (!key) return "";
  const d = new Date(`${key}-15T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Where each era floats relative to the current one: past eras −n…−1 (the nearest is −1),
 * future eras +1…+n in journey order, then sketched eras after the last future one.
 * The current era is the main island (no offset).
 */
export function eraOffsets(eras: PathEraView[]): Map<string, number> {
  const out = new Map<string, number>();
  const past = eras.filter((era) => era.state === "past");
  past.forEach((era, i) => out.set(era.id, i - past.length));
  let next = 1;
  for (const era of eras) if (era.state === "future") out.set(era.id, next++);
  for (const era of eras) if (era.state === "sketched") out.set(era.id, next++);
  return out;
}

/** The first era after the current one (the far side of the bridge), if any. */
export function nextEraAfterCurrent(eras: PathEraView[]): PathEraView | null {
  return eras.find((era) => era.state === "future") ?? null;
}

/** The gate's small line: "3 of 8 lit" or "Ready to cross". */
export function gateSub(progress: PathEraProgress, crossing: boolean): string {
  if (crossing) return "Crossing · waiting for both of you";
  if (progress.met) return "Ready to cross";
  const lit = progress.lanterns.filter((row) => row.lit).length;
  return `${lit} of ${progress.lanterns.length} lit`;
}

/** A crossing is waiting when the pending suggestion on the current era sets `crossedOn`. */
export function eraCrossingPending(era: PathEraView | null): boolean {
  return Boolean(era && era.state === "current" && era.pending?.crossedOn);
}

export type EraFinishKind = PathEraSpec["finish"]["kind"];
export const ERA_FINISH_LABELS: Record<EraFinishKind, string> = {
  agree: "When we both say so",
  survive: "Get through some months without going broke",
  banks: "When these Kitty Banks are full or bought",
};
export function eraFinishWords(spec: Pick<PathEraSpec, "finish">, bankName: (goalId: string) => string): string {
  const finish = spec.finish;
  if (finish.kind === "agree") return "Finished when you both say so.";
  if (finish.kind === "survive") return `Finished after ${finish.months} month${finish.months === 1 ? "" : "s"} without going broke.`;
  return `Finished when ${finish.goalIds.map(bankName).join(", ")} ${finish.goalIds.length === 1 ? "is" : "are"} full or bought.`;
}

/** An era being drafted in the planner (the command fills `crossedOn` and `retired`). */
export type EraDraft = Omit<PathEraSpec, "crossedOn">;

/**
 * Sensible defaults for a new era: after the last era on the journey (agreed or suggested),
 * starting the month after the previous era's "by" (or a year after its start), in the same home,
 * finished when both say so. With no journey yet it starts this month.
 */
export function newEraDraft(eras: PathEraView[], nowMonth: string): EraDraft {
  const specs = eras.flatMap((era) => [era.spec, ...(era.pending ? [era.pending] : [])]).filter((spec) => !spec.retired);
  const order = specs.reduce((max, spec) => Math.max(max, spec.order), 0) + 1;
  const previous = [...specs].sort((a, b) => a.order - b.order).at(-1) ?? null;
  const from = previous ? (previous.by ? shiftMonthKey(previous.by, 1) : shiftMonthKey(previous.from, 12)) : nowMonth;
  return { order: Math.min(99, order), name: "", finishLine: "", from, by: null, home: previous?.home ?? "flat", finish: { kind: "agree" }, plans: [], retired: false };
}

/** The draft for an existing era: the suggestion that is waiting when nothing is agreed, else the agreed era. */
export function eraDraftOf(era: PathEraView): EraDraft {
  // The read-model's spec carries the start the bridge set; a change must keep the stored start, so read the row.
  const stored = era.state === "sketched" ? era.pending ?? era.spec : era.row.pending && !era.pending ? era.row.pending : era.row.active ?? era.spec;
  return {
    order: stored.order, name: stored.name, finishLine: stored.finishLine, from: stored.from, by: stored.by, home: stored.home,
    finish: stored.finish.kind === "banks" ? { kind: "banks", goalIds: [...stored.finish.goalIds] } : { ...stored.finish },
    plans: stored.plans.map((plan) => ({ ...plan })), retired: stored.retired,
  };
}

/** How an era suggestion reads in "Waiting for both of you" (words only). */
export function eraProposalTitle(row: PathEraRow, nameOf: (id: string | null | undefined) => string): string {
  const spec = row.pending as PathEraSpec;
  const active = row.active;
  const who = nameOf(row.pendingBy);
  if (!active) return `${who} suggested the era “${spec.name}”`;
  if (spec.crossedOn && !active.crossedOn) return `${who} suggested crossing out of “${active.name}”`;
  if (spec.retired && !active.retired) return `${who} suggested taking “${active.name}” off the journey`;
  const { plans: nextPlans, ...nextRest } = spec;
  const { plans: priorPlans, ...priorRest } = active;
  if (JSON.stringify(nextRest) === JSON.stringify(priorRest)) {
    const added = nextPlans.filter((plan) => !priorPlans.some((p) => p.id === plan.id));
    const removed = priorPlans.filter((plan) => !nextPlans.some((p) => p.id === plan.id));
    if (added.length === 1 && !removed.length) return `${who} suggested a plan “${added[0]!.label}” in “${spec.name}”`;
    if (removed.length === 1 && !added.length) return `${who} suggested taking the plan “${removed[0]!.label}” off “${spec.name}”`;
  }
  return `${who} suggested a change to “${spec.name}”`;
}
