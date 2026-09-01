// One shared Fund provenance drawing. Geometry is assertable: every row
// uses the same dollar-to-pixel scale, and no second allocator lives here.

import { formatMonthLabel, parseDateKey, shiftMonthKey, type MonthKey } from "./calendar.ts";
import type { ContributionRegister, RegisterRow, RegisterSource } from "./contributionRegister.ts";
import { formatCad } from "./money.ts";

export const REGISTER_VIEW = {
  width: 900,
  barLeft: 250,
  barRight: 810,
  rowHeight: 30,
  barHeight: 13,
  labelLeft: 0,
  dateLeft: 152,
  valueRight: 890,
} as const;

const BAR_SPAN = REGISTER_VIEW.barRight - REGISTER_VIEW.barLeft;
const MONTH_ABBREV = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export type RegisterTone = "hers" | "his";

export type RegisterMemberView = {
  memberId: string;
  displayName: string;
  tone: RegisterTone;
};

export type RegisterPresentation = "ready" | "loading" | "error" | "offline";

export const REGISTER_UNTIED_LINE =
  "These rows don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.";
export const REGISTER_EMPTY_LINE = "Nothing owed this month yet.";
export const REGISTER_OFFLINE_LINE = "This drawing uses the books already on this device.";
export const REGISTER_ERROR_LINE = "I couldn't draw the register from these books.";

/** Cents → pixels for the whole register. Zero/invalid maxima produce a finite zero. */
export function registerScale(maxRowCents: number): number {
  if (!Number.isFinite(maxRowCents) || maxRowCents <= 0) return 0;
  const scale = BAR_SPAN / maxRowCents;
  return Number.isFinite(scale) && scale > 0 ? scale : 0;
}

/** One segment's width under the shared scale. Invalid or negative inputs collapse to zero. */
export function segmentWidth(cents: number, scale: number): number {
  if (!Number.isFinite(cents) || !Number.isFinite(scale) || cents <= 0 || scale <= 0) return 0;
  const width = cents * scale;
  return Number.isFinite(width) && width > 0 ? width : 0;
}

export function registerMaxRowCents(rows: readonly Pick<RegisterRow, "amountCents">[]): number {
  return rows.reduce((max, row) => Math.max(max, row.amountCents), 0);
}

export function registerCad(cents: number): string {
  return formatCad(cents).replace(/(\d)(?=(\d{3})+\.)/g, "$1,");
}

export function registerDateLabel(dateKey: string): string {
  const { month, day } = parseDateKey(dateKey);
  return `${String(day).padStart(2, "0")} ${MONTH_ABBREV[month - 1]}`;
}

export function registerTitle(monthKey: string): string {
  return `${formatMonthLabel(monthKey as MonthKey)} · the register`;
}

export function registerPreviousMonthName(monthKey: string): string {
  return formatMonthLabel(shiftMonthKey(monthKey as MonthKey, -1)).replace(/\s\d{4}$/, "");
}

export function memberViewById(members: readonly RegisterMemberView[]): Map<string, RegisterMemberView> {
  return new Map(members.map((member) => [member.memberId, member]));
}

export function registerMembersDraw(
  register: ContributionRegister,
  members: readonly RegisterMemberView[],
): boolean {
  const byId = memberViewById(members);
  const mapped = (memberId: string | null): boolean => {
    if (!memberId) return false;
    const member = byId.get(memberId);
    return Boolean(member && member.displayName.trim() && (member.tone === "hers" || member.tone === "his"));
  };
  const sourceOk = register.sources.every((source) => source.kind === "carried" || mapped(source.memberId));
  const totalsOk = register.byMember.every((row) => mapped(row.memberId));
  const segmentsOk = register.rows.every((row) => row.segments.every((segment) => {
    const source = register.sources[segment.sourceIndex];
    if (!source) return false;
    return source.kind === "carried" || mapped(source.memberId);
  }));
  return sourceOk && totalsOk && segmentsOk;
}

export function sourceTone(
  source: RegisterSource,
  members: ReadonlyMap<string, RegisterMemberView>,
): "carried" | RegisterTone | null {
  if (source.kind === "carried") return "carried";
  const member = source.memberId ? members.get(source.memberId) : undefined;
  return member?.tone ?? null;
}

export function contributionCountFor(register: ContributionRegister, memberId: string): number {
  return register.sources.filter((source) => source.kind === "contribution" && source.memberId === memberId).length;
}

export function contributionCountPhrase(count: number): string {
  if (count === 1) return "one contribution";
  if (count === 2) return "two contributions";
  return `${count} contributions`;
}

export function registerFigureLabel(
  register: ContributionRegister,
  members: readonly RegisterMemberView[],
): string {
  const byId = memberViewById(members);
  const memberTotals = register.byMember
    .map((row) => {
      const name = byId.get(row.memberId)?.displayName ?? "Member";
      return `${name} ${registerCad(row.amountCents)}`;
    })
    .join(". ");
  return [
    registerTitle(register.monthKey),
    `The month owes ${registerCad(register.owedCents)}.`,
    memberTotals ? `${memberTotals}.` : "",
    `Carried in ${registerCad(register.carriedCents)}.`,
    `Unfunded ${registerCad(register.unfundedCents)}.`,
  ].filter(Boolean).join(" ");
}
