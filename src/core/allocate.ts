import { sumCents } from "./money.ts";
import { ValidationError } from "./types.ts";

export type AllocationMode = "weight" | "percent" | "fixed";
export type AllocationKind = "account" | "goal";

export type AllocationSlice = {
  id: string;
  label: string;
  kind: AllocationKind;
  targetId: string;
  mode: AllocationMode;
  value: number;
};

export type AllocationLine = AllocationSlice & {
  cents: number;
  share: string;
};

export type AllocationResult = {
  leftoverCents: number;
  lines: AllocationLine[];
  remainderCents: number;
  overAllocatedCents: number;
  allocatedCents: number;
  ok: boolean;
  reason: string;
};

/** Same last-party remainder as `percentSplits`: round all but the last, give the rest to the last so cents are exact. */
export function lastRemainderSplit(parts: number[], poolCents: number): number[] {
  if (parts.length === 0) return [];
  const total = parts.reduce((sum, part) => sum + part, 0);
  if (total <= 0 || poolCents === 0) return parts.map(() => 0);
  const allocated = parts.slice(0, -1).map((part) => Math.round((poolCents * part) / total));
  const used = sumCents(allocated);
  return [...allocated, poolCents - used];
}

function shareLabel(slice: AllocationSlice, group: AllocationSlice[]): string {
  if (slice.mode === "fixed") return "fixed";
  if (slice.mode === "percent") return `${slice.value}%`;
  const total = group.filter((item) => item.mode === "weight").reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return "0";
  return `${slice.value}/${total}`;
}

export function allocateLeftover(leftoverCents: number, slices: AllocationSlice[]): AllocationResult {
  if (!Number.isInteger(leftoverCents)) throw new ValidationError("Leftover must be whole cents.");
  const poolStart = Math.max(0, leftoverCents);
  const lines: AllocationLine[] = slices.map((slice) => ({
    ...slice,
    cents: 0,
    share: shareLabel(slice, slices),
  }));
  const empty: AllocationResult = {
    leftoverCents: poolStart,
    lines,
    remainderCents: poolStart,
    overAllocatedCents: 0,
    allocatedCents: 0,
    ok: true,
    reason: poolStart === 0 ? "Nothing to move." : "No slices yet.",
  };
  if (!slices.length) return empty;

  const fixed = lines.filter((line) => line.mode === "fixed");
  const rest = lines.filter((line) => line.mode !== "fixed");
  const fixedTotal = sumCents(fixed.map((line) => {
    if (!Number.isInteger(line.value) || line.value < 0) {
      throw new ValidationError("Fixed amounts must be whole cents.");
    }
    return line.value;
  }));

  if (fixedTotal > poolStart) {
    for (const line of fixed) line.cents = line.value;
    return {
      leftoverCents: poolStart,
      lines,
      remainderCents: 0,
      overAllocatedCents: fixedTotal - poolStart,
      allocatedCents: 0,
      ok: false,
      reason: `Fixed amounts ${fixedTotal}¢ exceed leftover ${poolStart}¢. Nothing moves until the plan fits.`,
    };
  }

  for (const line of fixed) line.cents = line.value;
  let pool = poolStart - fixedTotal;

  if (!rest.length) {
    const allocatedCents = sumCents(lines.map((line) => line.cents));
    return {
      leftoverCents: poolStart,
      lines,
      remainderCents: pool,
      overAllocatedCents: 0,
      allocatedCents,
      ok: true,
      reason: pool ? `${pool}¢ stays unassigned.` : "Fixed amounts take the leftover exactly.",
    };
  }

  const allPercent = rest.every((line) => line.mode === "percent");
  if (allPercent) {
    const percentTotal = rest.reduce((sum, line) => sum + line.value, 0);
    if (percentTotal > 100.0001) {
      return {
        leftoverCents: poolStart,
        lines,
        remainderCents: pool,
        overAllocatedCents: Math.round((percentTotal - 100) * pool / 100),
        allocatedCents: sumCents(lines.map((line) => line.cents)),
        ok: false,
        reason: `Percentages add to ${percentTotal}, not 100. Nothing moves until they fit.`,
      };
    }
    const percentPool = Math.round((pool * Math.min(percentTotal, 100)) / 100);
    const split = lastRemainderSplit(rest.map((line) => line.value), percentPool);
    rest.forEach((line, index) => {
      line.cents = split[index] ?? 0;
    });
  } else {
    const mixed = rest.some((line) => line.mode === "percent") && rest.some((line) => line.mode === "weight");
    const parts = rest.map((line) => (line.mode === "percent" && !mixed ? line.value : line.value));
    const split = lastRemainderSplit(parts, pool);
    rest.forEach((line, index) => {
      line.cents = split[index] ?? 0;
    });
    if (mixed) {
      for (const line of rest) {
        if (line.mode === "percent") line.share = `${line.value}% as weight`;
      }
    }
  }

  const allocatedCents = sumCents(lines.map((line) => line.cents));
  const remainderCents = poolStart - allocatedCents;
  return {
    leftoverCents: poolStart,
    lines,
    remainderCents,
    overAllocatedCents: 0,
    allocatedCents,
    ok: allocatedCents >= 0 && allocatedCents <= poolStart,
    reason: remainderCents
      ? `${remainderCents}¢ stays unassigned.`
      : "The plan uses the leftover to the cent.",
  };
}
