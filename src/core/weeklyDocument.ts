import { lastWeekBounds, monthKeyFromDateKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import { askAlternatives, householdAsk, type AskAlternative, type HouseholdAsk } from "./ask.ts";
import {
  ASK_EVERY_ROUTE_OVER_CEILING_COPY,
  ASK_ROUTES_HEADER_COPY,
  askRouteCopy,
  askRoutes,
  everyRouteOverCeiling,
  type AskRoutesResult,
} from "./askRoutes.ts";
import { clerkReading, type ClerkReading } from "./clerkReading.ts";
import { contributionRegister, type ContributionRegister } from "./contributionRegister.ts";
import { kettlePhase } from "./hercules.ts";
import {
  HOUSEHOLD_FUND_HOLD_COPY,
  householdFundContributionMotions,
  type HouseholdFundContributionMotionStatus,
} from "./householdFund.ts";
import { formatCad } from "./money.ts";
import type { Household, Member } from "./types.ts";
import {
  weeklyDocumentIsComplete,
  weeklyDocumentStampLines,
  type WeeklyDocumentStampLine,
} from "./weeklyDocumentStamp.ts";

export const WEEKLY_DOCUMENT_COPY = {
  title: "This week's page",
  act0: "The reading",
  act1: "The month so far",
  act2: "The ask",
  act3: "What we're doing",
  stamp: "stamp",
  otherDoorNote: "This is another way the month could look. It does not move a goal.",
  emptyMotions: "Nothing raised yet.",
  registerUntied: "These rows don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.",
  loading: "The page is still gathering.",
  error: "This page could not be shown. The last accepted copy is still here.",
  offline: "Saved here. It'll sync when you're back.",
  routesHeader: ASK_ROUTES_HEADER_COPY,
} as const;

export type WeeklyDocumentOfferReason =
  | "offered"
  | "cadence-none"
  | "no-charter"
  | "wrong-weekday"
  | "unsupported-cadence";

export type WeeklyDocumentMotionStatus = HouseholdFundContributionMotionStatus;

export type WeeklyDocumentMotion = {
  id: string;
  kind: "fund" | "charter";
  status: WeeklyDocumentMotionStatus;
  label: string;
};

export type WeeklyDocumentView = {
  offered: boolean;
  offerReason: WeeklyDocumentOfferReason;
  kettleSunday: boolean;
  viewerMemberId: string;
  askOwnerMemberId: string | null;
  canStampOwnLine: boolean;
  complete: boolean;
  stampLines: WeeklyDocumentStampLine[];
  reading: ClerkReading;
  register: ContributionRegister;
  ask: HouseholdAsk | null;
  otherDoors: AskAlternative[];
  motions: WeeklyDocumentMotion[];
  routes?: AskRoutesResult;
  ceilingCopy?: string;
};

export type WeeklyDocumentInput = {
  viewerMemberId: string;
  today: DateKey;
  hour?: number;
};

function emptyRegister(today: DateKey): ContributionRegister {
  return {
    monthKey: monthKeyFromDateKey(today),
    sources: [],
    rows: [],
    carriedCents: 0,
    byMember: [],
    owedCents: 0,
    unfundedCents: 0,
    tiesToProjection: false,
  };
}

function emptyReading(today: DateKey): ClerkReading {
  const since = lastWeekBounds(today).end;
  return { since, today, sentences: [], tiesToProjection: false };
}

function uniqueAskOwnerMemberId(household: Household): string | null {
  const charter = household.charter;
  if (!charter) return null;
  const custodianId = charter.custodianMemberId;
  const eligible = household.members.filter((member) => member.active && member.id !== custodianId);
  return eligible.length === 1 ? eligible[0]!.id : null;
}

function offerReason(household: Household, today: DateKey): WeeklyDocumentOfferReason {
  const charter = household.charter;
  if (!charter) return "no-charter";
  if (charter.cadence === "none") return "cadence-none";
  if (charter.cadence === "biweekly" || charter.cadence === "monthly") return "unsupported-cadence";
  return weekdaySunday0(today) === charter.cadenceWeekday ? "offered" : "wrong-weekday";
}

function fundMotionLabel(household: Household, memberId: string | null, amountCents: number, purpose: string): string {
  const name = household.members.find((member) => member.id === memberId)?.name ?? "Household";
  const note = purpose.trim();
  return note ? `${name} · ${weeklyCad(amountCents)} · ${note}` : `${name} · ${weeklyCad(amountCents)}`;
}

function existingMotions(household: Household): WeeklyDocumentMotion[] {
  const fund = householdFundContributionMotions(household).map((motion) => ({
    id: motion.proposal.id,
    kind: "fund" as const,
    status: motion.status,
    label: fundMotionLabel(
      household,
      motion.proposal.contributorMemberId ?? motion.proposal.createdBy,
      motion.proposal.amountCents,
      motion.proposal.purpose,
    ),
  }));
  const charter = (household.charter?.amendments ?? []).map((amendment) => {
    const status: WeeklyDocumentMotionStatus = amendment.confirmedByMemberId
      ? "confirmed"
      : amendment.heldByMemberId
        ? "held"
        : "open";
    return {
      id: amendment.id,
      kind: "charter" as const,
      status,
      label: amendment.field,
    };
  });
  return [...fund, ...charter].sort((left, right) => left.id.localeCompare(right.id));
}

function ownerRoutes(
  household: Household,
  ask: HouseholdAsk,
  askOwnerMemberId: string,
  today: DateKey,
): AskRoutesResult | undefined {
  if (ask.throughDate < today) return undefined;
  return askRoutes(household, {
    askCents: ask.askCents,
    memberId: askOwnerMemberId,
    from: today,
    to: ask.throughDate,
  });
}

/** Format CAD with thousands separators for the weekly page only. */
export function weeklyCad(cents: number): string {
  return formatCad(cents).replace(/(\d)(?=(\d{3})+\.)/g, "$1,");
}

export function weeklyMotionStatusCopy(status: WeeklyDocumentMotionStatus): string {
  if (status === "held") return HOUSEHOLD_FUND_HOLD_COPY.status;
  return status;
}

export function weeklyRouteCaption(route: Parameters<typeof askRouteCopy>[0], askCents: number): string {
  return askRouteCopy(route, askCents);
}

export function weeklyMemberName(
  members: readonly Pick<Member, "id" | "name">[],
  memberId: string,
): string {
  return members.find((member) => member.id === memberId)?.name ?? memberId;
}

/**
 * Viewer-specific weekly page. Routes are computed only for the unique
 * active non-custodian, and only attached to that person's projection.
 */
export function weeklyDocument(household: Household, input: WeeklyDocumentInput): WeeklyDocumentView {
  const { viewerMemberId, today } = input;
  const hour = input.hour ?? 12;
  const reason = offerReason(household, today);
  const offered = reason === "offered";
  const stampLines = weeklyDocumentStampLines(household, today);
  const complete = weeklyDocumentIsComplete(household, today);
  const ownLine = stampLines.find((line) => line.memberId === viewerMemberId) ?? null;
  const charter = household.charter;
  const kettleSunday = Boolean(
    offered
    && charter
    && charter.cadenceWeekday === 0
    && kettlePhase(today, hour) === "sunday",
  );
  const since = lastWeekBounds(today).end;
  const askOwnerMemberId = uniqueAskOwnerMemberId(household);
  const canStampOwnLine = offered
    && Boolean(household.members.find((member) => member.id === viewerMemberId && member.active))
    && ownLine?.stamp == null;

  if (!offered) {
    return {
      offered: false,
      offerReason: reason,
      kettleSunday: false,
      viewerMemberId,
      askOwnerMemberId,
      canStampOwnLine: false,
      complete,
      stampLines,
      reading: emptyReading(today),
      register: emptyRegister(today),
      ask: null,
      otherDoors: [],
      motions: [],
    };
  }

  const register = contributionRegister(household, monthKeyFromDateKey(today), today);
  const ask = householdAsk(household, today);
  const otherDoors = askAlternatives(ask);
  const view: WeeklyDocumentView = {
    offered: true,
    offerReason: reason,
    kettleSunday,
    viewerMemberId,
    askOwnerMemberId,
    canStampOwnLine,
    complete,
    stampLines,
    reading: clerkReading(household, since, today),
    register,
    ask,
    otherDoors,
    motions: existingMotions(household),
  };
  if (askOwnerMemberId && viewerMemberId === askOwnerMemberId) {
    const routes = ownerRoutes(household, ask, askOwnerMemberId, today);
    if (routes) {
      view.routes = routes;
      if (everyRouteOverCeiling(routes)) view.ceilingCopy = ASK_EVERY_ROUTE_OVER_CEILING_COPY;
    }
  }
  return view;
}
