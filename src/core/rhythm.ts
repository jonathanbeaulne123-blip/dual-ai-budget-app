import { addDays, calendarDaysBetween, type DateKey } from "./calendar.ts";
import { jointSplit } from "./splits.ts";
import { advanceCadence, inferRecurrenceKind, nextOnOrAfter } from "./recurrence.ts";
import type { Household, Recurrence, RecurrenceCadence, RecurrenceKind, Split, Transaction } from "./types.ts";

export type RhythmStatus = "suggested" | "tracked" | "paused" | "dismissed";

export type Rhythm = {
  key: string;
  type: "expense" | "income";
  kind: RecurrenceKind;
  cadence: RecurrenceCadence;
  subcategoryId: string;
  subcategoryName: string;
  note: string;
  normalizedNote: string;
  amountCents: number;
  amountCv: number;
  intervalDays: number;
  count: number;
  lastDate: DateKey;
  nextDate: DateKey;
  accountId: string;
  splits: Split[];
  confidence: number;
  status: RhythmStatus;
  matchedRecurrenceId: string | null;
  dates: DateKey[];
};

const NOISY_SUBCATEGORIES = new Set([
  "SUB-FOOD-GROCERIES",
  "SUB-FOOD-COFFEE",
  "SUB-TRANSPORT-FUEL",
  "SUB-TRANSPORT-TRANSIT",
  "SUB-INCOME-WAGES",
  "SUB-INCOME-TIPS",
]);

export function normalizeRhythmNote(note: string): string {
  return note
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rhythmKey(type: "expense" | "income", subcategoryId: string, note: string): string {
  return `${type}:${subcategoryId}:${normalizeRhythmNote(note) || "_"}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

function cadenceFromMedian(days: number): RecurrenceCadence | null {
  if (days >= 6 && days <= 9) return "weekly";
  if (days >= 12 && days <= 18) return "biweekly";
  if (days >= 26 && days <= 35) return "monthly";
  return null;
}

function mode<T>(items: T[], keyFn: (item: T) => string): T {
  const counts = new Map<string, { item: T; count: number }>();
  for (const item of items) {
    const key = keyFn(item);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { item, count: 1 });
  }
  return [...counts.values()].sort((left, right) => right.count - left.count)[0]!.item;
}

function usableTransactions(household: Household): Transaction[] {
  return household.transactions.filter((tx) => {
    if (tx.isDuplicate) return false;
    if (tx.source === "visit") return false;
    if (tx.type !== "expense" && tx.type !== "income") return false;
    if (!tx.subcategoryId) return false;
    return true;
  });
}

function groupKey(tx: Transaction, fine: boolean): string {
  const type = tx.type as "expense" | "income";
  if (!fine) return `${type}:${tx.subcategoryId}:*`;
  return rhythmKey(type, tx.subcategoryId!, tx.note);
}

function analyzeGroup(household: Household, txs: Transaction[], today: DateKey, fine: boolean): Rhythm | null {
  if (txs.length < 3) return null;
  const sorted = [...txs].sort((left, right) => left.date.localeCompare(right.date));
  const dates = sorted.map((tx) => tx.date);
  const intervals = dates.slice(1).map((date, index) => calendarDaysBetween(dates[index]!, date));
  if (intervals.length < 2) return null;
  const intervalDays = Math.round(median(intervals));
  const cadence = cadenceFromMedian(intervalDays);
  if (!cadence) return null;
  const intervalCv = coefficientOfVariation(intervals);
  if (intervalCv > 0.35) return null;

  const amounts = sorted.map((tx) => tx.amountCents);
  const amountCents = Math.round(median(amounts));
  const amountCv = coefficientOfVariation(amounts);
  const sample = sorted[0]!;
  const subcategory = household.categories.find((item) => item.id === sample.subcategoryId);
  if (!subcategory) return null;

  if (NOISY_SUBCATEGORIES.has(subcategory.id)) return null;
  if (subcategory.id === "SUB-LIFE-FUN" && amountCv > 0.05) return null;
  if (sample.type === "expense" && amountCv > 0.45) return null;

  const note = fine ? mode(sorted, (tx) => normalizeRhythmNote(tx.note) || "_").note : subcategory.name;
  const kind = inferRecurrenceKind({
    type: sample.type as "expense" | "income",
    note,
    subcategoryName: subcategory.name,
  });
  if (kind === "subscription" && amountCv > 0.12) return null;

  let confidence = 0.42;
  if (sorted.length >= 4) confidence += 0.14;
  if (sorted.length >= 6) confidence += 0.1;
  if (intervalCv < 0.12) confidence += 0.14;
  if (amountCv < 0.08) confidence += 0.14;
  if (amountCv < 0.03) confidence += 0.06;
  if (subcategory.essential || subcategory.incomeStability === "fixed") confidence += 0.05;
  confidence = Math.min(0.99, confidence);
  if (confidence < 0.55) return null;

  const lastDate = dates[dates.length - 1]!;
  const nextDate = nextOnOrAfter(advanceCadence(lastDate, cadence), cadence, today);
  const accountId = mode(sorted, (tx) => tx.accountId).accountId;
  const splits = structuredClone(mode(sorted, (tx) => JSON.stringify(tx.splits)).splits);
  const scaled = splits.some((split) => split.amountCents !== 0)
    ? scaleSplits(splits, amountCents)
    : jointSplit(amountCents);

  return {
    key: fine
      ? rhythmKey(sample.type as "expense" | "income", subcategory.id, note)
      : `${sample.type}:${subcategory.id}:*`,
    type: sample.type as "expense" | "income",
    kind,
    cadence,
    subcategoryId: subcategory.id,
    subcategoryName: subcategory.name,
    note: note.trim() || subcategory.name,
    normalizedNote: normalizeRhythmNote(note),
    amountCents,
    amountCv,
    intervalDays,
    count: sorted.length,
    lastDate,
    nextDate,
    accountId,
    splits: scaled,
    confidence,
    status: "suggested",
    matchedRecurrenceId: null,
    dates,
  };
}

function scaleSplits(splits: Split[], amountCents: number): Split[] {
  const total = splits.reduce((sum, split) => sum + split.amountCents, 0);
  if (total === amountCents) return splits;
  if (total <= 0) return jointSplit(amountCents);
  const scaled = splits.map((split, index) => {
    if (index === splits.length - 1) return split;
    return { ...split, amountCents: Math.round((split.amountCents / total) * amountCents) };
  });
  const used = scaled.slice(0, -1).reduce((sum, split) => sum + split.amountCents, 0);
  scaled[scaled.length - 1] = { ...scaled[scaled.length - 1]!, amountCents: amountCents - used };
  return scaled;
}

function matchRecurrence(rhythm: Rhythm, recurrences: Recurrence[]): Recurrence | undefined {
  return recurrences.find((item) => {
    if (item.subcategoryId !== rhythm.subcategoryId) return false;
    if (item.type !== rhythm.type) return false;
    const recNote = normalizeRhythmNote(item.note);
    const noteClose = recNote === rhythm.normalizedNote
      || (!!recNote && rhythm.normalizedNote.includes(recNote))
      || (!!rhythm.normalizedNote && recNote.includes(rhythm.normalizedNote));
    if (noteClose) return true;
    const amountDelta = Math.abs(item.amountCents - rhythm.amountCents) / Math.max(item.amountCents, rhythm.amountCents, 1);
    return item.cadence === rhythm.cadence && amountDelta <= 0.2;
  });
}

export function detectRhythms(household: Household, today: DateKey): Rhythm[] {
  const txs = usableTransactions(household);
  const dismissed = new Set(household.calendar?.dismissedRhythmKeys ?? []);
  const fineGroups = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = groupKey(tx, true);
    const list = fineGroups.get(key) ?? [];
    list.push(tx);
    fineGroups.set(key, list);
  }

  const accepted: Rhythm[] = [];
  const claimed = new Set<string>();
  for (const group of fineGroups.values()) {
    const rhythm = analyzeGroup(household, group, today, true);
    if (!rhythm) continue;
    accepted.push(rhythm);
    for (const tx of group) claimed.add(tx.id);
  }

  const coarseGroups = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (claimed.has(tx.id)) continue;
    const key = groupKey(tx, false);
    const list = coarseGroups.get(key) ?? [];
    list.push(tx);
    coarseGroups.set(key, list);
  }
  for (const group of coarseGroups.values()) {
    const rhythm = analyzeGroup(household, group, today, false);
    if (!rhythm) continue;
    if (accepted.some((item) => item.subcategoryId === rhythm.subcategoryId && item.type === rhythm.type)) continue;
    accepted.push(rhythm);
  }

  return accepted
    .map((rhythm) => {
      const matched = matchRecurrence(rhythm, household.recurrences);
      let status: RhythmStatus = "suggested";
      if (matched?.active) status = "tracked";
      else if (matched && !matched.active) status = "paused";
      else if (dismissed.has(rhythm.key)) status = "dismissed";
      return {
        ...rhythm,
        status,
        matchedRecurrenceId: matched?.id ?? null,
      };
    })
    .sort((left, right) => right.confidence - left.confidence || left.nextDate.localeCompare(right.nextDate));
}

export function suggestedRhythms(household: Household, today: DateKey): Rhythm[] {
  return detectRhythms(household, today).filter((item) => item.status === "suggested");
}

/** Same-merchant, same-amount, frequent, irregular. Bills stay on detectRhythms (D-058). */
export type Habit = {
  key: string;
  type: "expense" | "income";
  subcategoryId: string;
  subcategoryName: string;
  note: string;
  normalizedNote: string;
  amountCents: number;
  amountCv: number;
  intervalCv: number;
  count: number;
  lastDate: DateKey;
  accountId: string;
  splits: Split[];
  confidence: number;
};

const HABIT_SKIP_SUBCATEGORIES = new Set(["SUB-INCOME-WAGES", "SUB-INCOME-TIPS"]);
const HABIT_LOOKBACK_DAYS = 62;
const HABIT_MIN_COUNT = 4;
const HABIT_AMOUNT_CV = 0.08;
const HABIT_BILL_INTERVAL_CV = 0.35;

export function habitKey(
  type: "expense" | "income",
  subcategoryId: string,
  note: string,
  amountCents: number,
): string {
  return `preset:${type}:${subcategoryId}:${normalizeRhythmNote(note) || "_"}:${amountCents}`;
}

function habitTransactions(household: Household, today: DateKey): Transaction[] {
  const from = addDays(today, -HABIT_LOOKBACK_DAYS);
  return household.transactions.filter((tx) => {
    if (tx.isDuplicate) return false;
    if (tx.source === "visit") return false;
    if (tx.type !== "expense" && tx.type !== "income") return false;
    if (!tx.subcategoryId) return false;
    if (HABIT_SKIP_SUBCATEGORIES.has(tx.subcategoryId)) return false;
    if (tx.date < from || tx.date > today) return false;
    return true;
  });
}

function matchingPreset(household: Household, habit: Pick<Habit, "key" | "type" | "subcategoryId" | "normalizedNote" | "amountCents">): boolean {
  return (household.presets ?? []).some((preset) => {
    if (!preset.active) return false;
    if (preset.detectionKey === habit.key) return true;
    return preset.type === habit.type
      && preset.subcategoryId === habit.subcategoryId
      && normalizeRhythmNote(preset.note) === habit.normalizedNote
      && preset.amountCents === habit.amountCents;
  });
}

function matchingBill(household: Household, habit: Habit): boolean {
  return household.recurrences.some((item) => {
    if (!item.active) return false;
    if (item.subcategoryId !== habit.subcategoryId) return false;
    if (item.type !== habit.type) return false;
    const recNote = normalizeRhythmNote(item.note);
    return recNote === habit.normalizedNote
      || (!!recNote && habit.normalizedNote.includes(recNote))
      || (!!habit.normalizedNote && recNote.includes(habit.normalizedNote));
  });
}

export function detectHabits(household: Household, today: DateKey): Habit[] {
  const txs = habitTransactions(household, today);
  const groups = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const type = tx.type as "expense" | "income";
    const key = habitKey(type, tx.subcategoryId!, tx.note, tx.amountCents);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const habits: Habit[] = [];
  for (const group of groups.values()) {
    if (group.length < HABIT_MIN_COUNT) continue;
    const sorted = [...group].sort((left, right) => left.date.localeCompare(right.date));
    const amounts = sorted.map((tx) => tx.amountCents);
    const amountCv = coefficientOfVariation(amounts);
    if (amountCv > HABIT_AMOUNT_CV) continue;
    const dates = sorted.map((tx) => tx.date);
    const intervals = dates.slice(1).map((date, index) => calendarDaysBetween(dates[index]!, date));
    const intervalDays = intervals.length ? Math.round(median(intervals)) : 0;
    const cadence = intervals.length >= 2 ? cadenceFromMedian(intervalDays) : null;
    const intervalCv = intervals.length >= 2 ? coefficientOfVariation(intervals) : 1;
    if (cadence && intervalCv <= HABIT_BILL_INTERVAL_CV) continue;

    const sample = sorted[0]!;
    const subcategory = household.categories.find((item) => item.id === sample.subcategoryId);
    if (!subcategory) continue;
    const note = mode(sorted, (tx) => normalizeRhythmNote(tx.note) || "_").note;
    const amountCents = Math.round(median(amounts));
    const type = sample.type as "expense" | "income";
    const accountId = mode(sorted, (tx) => tx.accountId).accountId;
    const splits = structuredClone(mode(sorted, (tx) => JSON.stringify(tx.splits)).splits);
    const scaled = splits.some((split) => split.amountCents !== 0)
      ? scaleSplits(splits, amountCents)
      : [];
    let confidence = 0.4;
    if (sorted.length >= 6) confidence += 0.16;
    if (sorted.length >= 8) confidence += 0.1;
    if (amountCv < 0.03) confidence += 0.14;
    if (intervalCv > 0.35) confidence += 0.08;
    confidence = Math.min(0.98, confidence);

    const habit: Habit = {
      key: habitKey(type, subcategory.id, note, amountCents),
      type,
      subcategoryId: subcategory.id,
      subcategoryName: subcategory.name,
      note: note.trim() || subcategory.name,
      normalizedNote: normalizeRhythmNote(note),
      amountCents,
      amountCv,
      intervalCv,
      count: sorted.length,
      lastDate: dates[dates.length - 1]!,
      accountId,
      splits: scaled,
      confidence,
    };
    if (matchingPreset(household, habit)) continue;
    if (matchingBill(household, habit)) continue;
    habits.push(habit);
  }

  return habits.sort((left, right) => right.confidence - left.confidence || right.count - left.count);
}

export function suggestedHabits(household: Household, today: DateKey): Habit[] {
  const dismissed = new Set(household.calendar?.dismissedNoticeKeys ?? []);
  return detectHabits(household, today).filter((item) => !dismissed.has(item.key));
}
