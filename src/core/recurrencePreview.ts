import type { DateKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import type { Household, Recurrence } from "./types.ts";

export type DueRecurrencePreviewRow = {
  recurrenceId: string;
  title: string;
  amountCents: number;
  nextDate: DateKey;
  type: Recurrence["type"];
  summary: string;
};

function recurrenceTitle(household: Household, item: Recurrence): string {
  const category = household.categories.find((row) => row.id === item.subcategoryId);
  return item.note.trim() || category?.name || "Repeating item";
}

/** Read-only projection for the due-on-open reminder. It never advances or posts a recurrence. */
export function dueRecurrencePreview(household: Household, today: DateKey): DueRecurrencePreviewRow[] {
  return household.recurrences
    .filter((item) => item.active && item.nextDate <= today)
    .sort((left, right) => left.nextDate.localeCompare(right.nextDate) || left.id.localeCompare(right.id))
    .map((item) => {
      const title = recurrenceTitle(household, item);
      return {
        recurrenceId: item.id,
        title,
        amountCents: item.amountCents,
        nextDate: item.nextDate,
        type: item.type,
        summary: `${title} · ${formatCad(item.amountCents)}`,
      };
    });
}

export function duePreviewSummary(rows: DueRecurrencePreviewRow[]): string {
  if (!rows.length) return "";
  if (rows.length === 1) {
    return `${rows[0]!.summary} is due. This reminder is not a ledger write.`;
  }
  const head = rows.slice(0, 3).map((row) => row.summary).join("; ");
  const tail = rows.length > 3 ? `; and ${rows.length - 3} more` : "";
  return `${rows.length} repeating items are due: ${head}${tail}. This reminder is not a ledger write.`;
}
