import { splitReading } from "./splitDraft.ts";
import type { Split } from "./types.ts";

export type CategorySplit = { secondSubcategoryId: string; firstPercent: number };

/** The Cut's allocation kernel is shared by the preview and the accepted command. */
export function categorySplitAmounts(firstId: string, split: CategorySplit, totalCents: number): [number, number] {
  if (!split || !split.secondSubcategoryId || firstId === split.secondSubcategoryId
    || !Number.isFinite(split.firstPercent) || split.firstPercent < 0 || split.firstPercent > 100) {
    throw new Error("Choose two different categories and review their amounts.");
  }
  const secondPercent = Math.round((100 - split.firstPercent) * 100) / 100;
  const reading = splitReading([firstId, split.secondSubcategoryId],
    { [firstId]: split.firstPercent, [split.secondSubcategoryId]: secondPercent }, totalCents);
  return [reading.cents[firstId]!, reading.cents[split.secondSubcategoryId]!];
}

/** Largest remainders preserve both category totals AND each person's reviewed cents. */
export function partitionCategoryOwnership(splits: Split[], firstCents: number, totalCents: number): [Split[], Split[]] {
  const total = BigInt(totalCents), first = BigInt(firstCents);
  const parts = splits.map((split, index) => {
    const product = BigInt(split.amountCents) * first;
    return { ...split, index, allocated: Number(product / total), remainder: product % total };
  });
  let remaining = firstCents - parts.reduce((sum, part) => sum + part.allocated, 0);
  for (const part of [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) {
    if (remaining <= 0) break;
    part.allocated++; remaining--;
  }
  return [parts.map(p => ({party: p.party, amountCents: p.allocated})).filter(p => p.amountCents > 0),
    parts.map(p => ({party: p.party, amountCents: p.amountCents - p.allocated})).filter(p => p.amountCents > 0)];
}
