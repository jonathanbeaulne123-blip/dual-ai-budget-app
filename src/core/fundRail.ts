/**
 * Member-owned Fund rail arrangement.
 *
 * This module arranges presentation only. It never posts, moves, or allocates
 * money. The sixteen ids are the library contract; the desk renders the plate
 * models that exist today and later slices can add the remaining models.
 */

import { askBelongsOnDesk } from "./askView.ts";
import { ValidationError, type FundWidgetId, type Household, type MemberRail } from "./types.ts";

export type { FundWidgetId, MemberRail } from "./types.ts";

export const RAIL_SLOTS_DESK = 8;
export const RAIL_SLOTS_PHONE = 6;

export const FUND_WIDGETS = [
  "level", "swipe", "contribute", "waiting", "next-out", "spoken-for", "week", "shape",
  "streams", "seven-days", "shelf", "record", "minutes", "ask", "accounts", "settle",
] as const satisfies readonly FundWidgetId[];

export const RETIRED_FUND_WIDGET_IDS = {
  due: "next-out",
  saving: "shelf",
  coming: "week",
  trust: "record",
  cards: "accounts",
  owed: "settle",
  "fund-level": "level",
} as const satisfies Readonly<Record<string, FundWidgetId>>;

export const DEFAULT_RAIL_CUSTODIAN = [
  "level", "swipe", "waiting", "settle", "next-out", "spoken-for", "week", "accounts",
] as const satisfies readonly FundWidgetId[];

export const DEFAULT_RAIL_CONTRIBUTOR = [
  "level", "contribute", "waiting", "ask", "next-out", "streams", "shape", "week",
] as const satisfies readonly FundWidgetId[];

const FUND_WIDGET_SET = new Set<string>(FUND_WIDGETS);

export function isFundWidgetId(value: unknown): value is FundWidgetId {
  return typeof value === "string" && FUND_WIDGET_SET.has(value);
}

export function canonicalFundWidgetId(value: unknown): FundWidgetId | null {
  if (isFundWidgetId(value)) return value;
  if (typeof value !== "string") return null;
  return RETIRED_FUND_WIDGET_IDS[value as keyof typeof RETIRED_FUND_WIDGET_IDS] ?? null;
}

export function defaultRailFor(household: Household, memberId: string): FundWidgetId[] {
  return [...(household.householdFund?.custodianMemberId === memberId
    ? DEFAULT_RAIL_CUSTODIAN
    : DEFAULT_RAIL_CONTRIBUTOR)];
}

export function widgetAllowedFor(id: FundWidgetId, household: Household, memberId: string): boolean {
  return id !== "ask" || askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId);
}

function validStoredRail(household: Household, memberId: string): FundWidgetId[] | null {
  const member = household.members.find((row) => row.id === memberId);
  if (!member?.fundRail || member.fundRail.memberId !== memberId || !Array.isArray(member.fundRail.slots)) return null;
  const slots = member.fundRail.slots.map(canonicalFundWidgetId);
  if (slots.length !== RAIL_SLOTS_DESK || slots.some((slot): slot is null => slot === null)) return null;
  const typed = slots as FundWidgetId[];
  if (typed[0] !== "level" || new Set(typed).size !== RAIL_SLOTS_DESK) return null;
  if (typed.some((id) => !widgetAllowedFor(id, household, memberId))) return null;
  return typed;
}

export function railFor(household: Household, memberId: string): FundWidgetId[] {
  return validStoredRail(household, memberId) ?? defaultRailFor(household, memberId);
}

export function phoneRail(slots: readonly FundWidgetId[]): FundWidgetId[] {
  return slots.slice(0, RAIL_SLOTS_PHONE);
}

export function drawerFor(household: Household, memberId: string): Array<{
  id: FundWidgetId;
  onRail: boolean;
  allowed: boolean;
}> {
  const rail = new Set(railFor(household, memberId));
  return FUND_WIDGETS.map((id) => ({
    id,
    onRail: rail.has(id),
    allowed: widgetAllowedFor(id, household, memberId),
  }));
}

/** Map the current plate model ids onto the stable library ids. */
export function fundWidgetIdForPlateId(plateId: string): FundWidgetId | null {
  if (plateId === "saving") return "shelf";
  return canonicalFundWidgetId(plateId);
}

export function requireFundRail(slots: readonly unknown[], household: Household, memberId: string): FundWidgetId[] {
  const canonical = slots.map(canonicalFundWidgetId);
  if (canonical.length !== RAIL_SLOTS_DESK || canonical.some((slot): slot is null => slot === null)) {
    throw new ValidationError("The Fund board has exactly eight places.");
  }
  const typed = canonical as FundWidgetId[];
  if (typed[0] !== "level") throw new ValidationError("The Fund stays at the top of the board.");
  if (new Set(typed).size !== RAIL_SLOTS_DESK) throw new ValidationError("Each Fund widget can appear only once.");
  if (typed.some((id) => !widgetAllowedFor(id, household, memberId))) {
    throw new ValidationError("That one only belongs on your own desk.");
  }
  return typed;
}

/** Structural Personal-envelope guard. Membership-specific Ask scope is checked by railFor. */
export function shapeMemberRail(value: unknown, memberId: string): MemberRail | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<MemberRail>;
  if (row.memberId !== memberId || typeof row.updatedAt !== "string" || !row.updatedAt) return null;
  const slots = Array.isArray(row.slots) ? row.slots.map(canonicalFundWidgetId) : [];
  if (slots.length !== RAIL_SLOTS_DESK || slots.some((slot): slot is null => slot === null)) return null;
  const typed = slots as FundWidgetId[];
  if (typed[0] !== "level" || new Set(typed).size !== RAIL_SLOTS_DESK) return null;
  return { memberId, slots: typed, updatedAt: row.updatedAt };
}

/** Fail closed unless the only household difference is this member's valid rail. */
export function fundRailPreferenceUpdateAllowed(current: Household, next: Household, memberId: string): boolean {
  if (current.environment !== next.environment || current.householdId !== next.householdId || current.revision !== next.revision) {
    return false;
  }
  const currentMember = current.members.find((member) => member.id === memberId && member.active);
  const nextMember = next.members.find((member) => member.id === memberId && member.active);
  const rail = shapeMemberRail(nextMember?.fundRail, memberId);
  if (!currentMember || !nextMember || !rail || rail.slots.some((id) => !widgetAllowedFor(id, next, memberId))) return false;

  const normalized = structuredClone(next);
  normalized.members = normalized.members.map((member) => member.id === memberId
    ? { ...member, fundRail: currentMember.fundRail }
    : member);
  return JSON.stringify(normalized) === JSON.stringify(current);
}
