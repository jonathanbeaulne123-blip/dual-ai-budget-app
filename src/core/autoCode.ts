import { monthEndKey, monthKeyFromDateKey, shiftMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { contextTokens } from "./duplicate.ts";
import { expenseEffect } from "./budget.ts";
import { formatCad, sumCents } from "./money.ts";
import type { Household, Split, Transaction } from "./types.ts";

export type CategoryGuess = {
  subcategoryId: string;
  name: string;
  confidence: number;
  sampleSize: number;
  tokens: string[];
};

export type SplitGuess = {
  splits: Split[];
  label: string;
  confidence: number;
  sampleSize: number;
};

export type CodingAnomaly = {
  id: string;
  subcategoryId: string;
  name: string;
  thisMonthCents: number;
  typicalCents: number;
  ratio: number;
  transactionIds: string[];
  title: string;
  detail: string;
};

export type SitDownForecast = {
  fixedCents: number;
  variableCents: number;
  nextMonth: MonthKey;
  detail: string;
  recurrenceIds: string[];
};

export type MiscodedLook = {
  transactionId: string;
  postedSubcategoryId: string | null;
  guessed: CategoryGuess;
};

const AUTO_APPLY = 0.55;
const MISCODE = 0.7;

function countableExpense(tx: Transaction): boolean {
  return !tx.isDuplicate && (tx.type === "expense" || tx.type === "refund") && Boolean(tx.subcategoryId);
}

function overlap(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((token) => right.has(token));
}

function splitKey(splits: Split[]): string {
  return [...splits]
    .map((split) => `${split.party}:${split.amountCents}`)
    .sort()
    .join("|");
}

function splitPercents(splits: Split[], amountCents: number): string {
  if (!amountCents) return "even";
  return splits
    .map((split) => `${split.party} ${Math.round((split.amountCents / amountCents) * 100)}%`)
    .join(" / ");
}

export function suggestCategory(household: Household, note: string, place = ""): CategoryGuess | null {
  const tokens = contextTokens(note, place);
  if (!tokens.size) return null;
  const votes = new Map<string, number>();
  let sampleSize = 0;
  for (const tx of household.transactions) {
    if (!countableExpense(tx) || tx.type === "refund" || !tx.subcategoryId) continue;
    const hit = overlap(tokens, contextTokens(tx.note, tx.place));
    if (!hit.length) continue;
    sampleSize += 1;
    votes.set(tx.subcategoryId, (votes.get(tx.subcategoryId) ?? 0) + 1);
  }
  if (!sampleSize) return null;
  let topId = "";
  let topCount = 0;
  for (const [id, count] of votes) {
    if (count > topCount) {
      topId = id;
      topCount = count;
    }
  }
  if (!topId) return null;
  const name = household.categories.find((row) => row.id === topId)?.name ?? topId;
  const share = topCount / sampleSize;
  const confidence = Math.round(share * (sampleSize / (sampleSize + 2)) * 1000) / 1000;
  return { subcategoryId: topId, name, confidence, sampleSize, tokens: [...tokens] };
}

export function shouldPrefillCategory(guess: CategoryGuess | null): boolean {
  return Boolean(guess && guess.confidence >= AUTO_APPLY && guess.sampleSize >= 2);
}

export function suggestSplit(household: Household, note: string, place: string, amountCents: number): SplitGuess | null {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;
  const tokens = contextTokens(note, place);
  if (!tokens.size) return null;
  const votes = new Map<string, { count: number; splits: Split[] }>();
  let sampleSize = 0;
  for (const tx of household.transactions) {
    if (!countableExpense(tx) || tx.type === "refund" || tx.splits.length < 2) continue;
    if (!overlap(tokens, contextTokens(tx.note, tx.place)).length) continue;
    sampleSize += 1;
    const key = splitKey(tx.splits.map((split) => ({
      party: split.party,
      amountCents: Math.round((split.amountCents / tx.amountCents) * 1000),
    })));
    const current = votes.get(key);
    if (current) current.count += 1;
    else votes.set(key, { count: 1, splits: tx.splits });
  }
  if (!sampleSize) return null;
  let best: { count: number; splits: Split[] } | null = null;
  for (const row of votes.values()) {
    if (!best || row.count > best.count) best = row;
  }
  if (!best || best.count < 2) return null;
  const confidence = Math.round((best.count / sampleSize) * (sampleSize / (sampleSize + 2)) * 1000) / 1000;
  const scaled: Split[] = best.splits.slice(0, -1).map((split) => ({
    party: split.party,
    amountCents: Math.round(amountCents * (split.amountCents / sumCents(best!.splits.map((item) => item.amountCents)))),
  }));
  const used = sumCents(scaled.map((split) => split.amountCents));
  const last = best.splits[best.splits.length - 1]!;
  scaled.push({ party: last.party, amountCents: amountCents - used });
  return {
    splits: scaled,
    label: splitPercents(scaled, amountCents),
    confidence,
    sampleSize,
  };
}

export function monthExpenseByCategory(household: Household, monthKey: MonthKey): Map<string, { cents: number; ids: string[] }> {
  const start = `${monthKey}-01`;
  const end = monthEndKey(monthKey);
  const map = new Map<string, { cents: number; ids: string[] }>();
  for (const tx of household.transactions) {
    if (tx.date < start || tx.date > end || !countableExpense(tx) || !tx.subcategoryId) continue;
    const cents = expenseEffect(tx);
    if (!cents) continue;
    const row = map.get(tx.subcategoryId) ?? { cents: 0, ids: [] };
    row.cents += cents;
    if (tx.type === "expense") row.ids.push(tx.id);
    map.set(tx.subcategoryId, row);
  }
  return map;
}

export function sitDownAnomalies(household: Household, monthKey: MonthKey): CodingAnomaly[] {
  const current = monthExpenseByCategory(household, monthKey);
  const priors: MonthKey[] = [1, 2, 3].map((offset) => shiftMonthKey(monthKey, -offset));
  const priorMaps = priors.map((key) => monthExpenseByCategory(household, key));
  const out: CodingAnomaly[] = [];
  for (const [subcategoryId, row] of current) {
    const history = priorMaps.map((map) => map.get(subcategoryId)?.cents ?? 0).filter((cents) => cents > 0);
    if (history.length < 2) continue;
    const typicalCents = Math.round(history.reduce((sum, cents) => sum + cents, 0) / history.length);
    if (typicalCents <= 0) continue;
    const ratio = row.cents / typicalCents;
    if (ratio < 1.4) continue;
    const name = household.categories.find((item) => item.id === subcategoryId)?.name ?? subcategoryId;
    out.push({
      id: `anom-${subcategoryId}`,
      subcategoryId,
      name,
      thisMonthCents: row.cents,
      typicalCents,
      ratio,
      transactionIds: row.ids,
      title: `${name} is ${Math.round((ratio - 1) * 100)}% over its own history`,
      detail: `${formatCad(row.cents)} this month vs a ${formatCad(typicalCents)} typical. Tap to the rows. Not a grade.`,
    });
  }
  return out.sort((left, right) => right.thisMonthCents - left.thisMonthCents);
}

export function sitDownForecast(household: Household, today: DateKey): SitDownForecast {
  const nextMonth = shiftMonthKey(monthKeyFromDateKey(today), 1);
  const start = `${nextMonth}-01`;
  const end = monthEndKey(nextMonth);
  const recurrenceIds: string[] = [];
  let fixedCents = 0;
  for (const item of household.recurrences) {
    if (!item.active || item.type !== "expense") continue;
    if (item.kind === "paycheck") continue;
    if (item.nextDate >= start && item.nextDate <= end) {
      fixedCents += item.amountCents;
      recurrenceIds.push(item.id);
    }
  }
  const months: MonthKey[] = [0, 1, 2].map((offset) => shiftMonthKey(monthKeyFromDateKey(today), -offset));
  const variableMonths = months.map((key) => {
    const map = monthExpenseByCategory(household, key);
    let total = 0;
    for (const [subcategoryId, row] of map) {
      const category = household.categories.find((item) => item.id === subcategoryId);
      if (category && !category.essential) total += row.cents;
    }
    return total;
  }).filter((cents) => cents > 0).sort((left, right) => left - right);
  const mid = variableMonths[Math.floor((variableMonths.length - 1) / 2)] ?? 0;
  return {
    fixedCents,
    variableCents: mid,
    nextMonth,
    recurrenceIds,
    detail: `Next month’s repeating outflows ${formatCad(fixedCents)}. Variable spend (trailing median of non-essentials) ${formatCad(mid)}. Not safe-to-spend.`,
  };
}

export function likelyMiscoded(household: Household, monthKey: MonthKey): MiscodedLook[] {
  const start = `${monthKey}-01`;
  const end = monthEndKey(monthKey);
  const out: MiscodedLook[] = [];
  for (const tx of household.transactions) {
    if (tx.date < start || tx.date > end) continue;
    if (tx.isDuplicate || tx.type !== "expense") continue;
    const guessed = suggestCategory(household, tx.note, tx.place);
    if (!guessed || guessed.subcategoryId === tx.subcategoryId) continue;
    if (guessed.confidence < MISCODE || guessed.sampleSize < 3) continue;
    out.push({
      transactionId: tx.id,
      postedSubcategoryId: tx.subcategoryId,
      guessed,
    });
  }
  return out.slice(0, 8);
}
