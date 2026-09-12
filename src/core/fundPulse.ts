import type { DateKey } from "./calendar.ts";
import { monthKeyFromDateKey } from "./calendar.ts";
import type { Household } from "./types.ts";
import {
  householdFundContributionMotions,
  projectHouseholdFund,
  shapeHouseholdFundConfig,
} from "./householdFund.ts";
import { currentPlanVersion, evaluatePlanDrift, planAcknowledgementState } from "./planSystem.ts";

/**
 * The Fund pulse (Vision v2 §4.3): one calm sentence about the state of the
 * shared plan, never about the relationship.
 *
 * This module is a pure projector. It reads accepted books and existing
 * projections, composes one state with an explicit precedence, and returns
 * plain text plus the single amount that matters. It posts nothing, grades
 * nobody, and never compares partners.
 *
 * Precedence (first match wins):
 *   checking  — evidence stale, offline, or the Fund's reconciliation does not tie
 *   reset     — critical Plan drift: the accepted plan no longer matches reality
 *   needs-us  — something is waiting on this person, the custodian, or both partners
 *   covered   — protected lines are supported through the horizon
 *   building  — covered, and a Chapter is actively progressing
 */
export type FundPulseState = "checking" | "reset" | "needs-us" | "covered" | "building";

export type FundPulseFreshness = "current" | "stale" | "offline";

export type FundPulseInput = {
  /** The Fund has a configured custodian and terms. */
  configured: boolean;
  /** From the sync/freshness layer; the pulse never claims confidence over stale evidence. */
  freshness: FundPulseFreshness;
  /** `null` when no reconciliation has been recorded yet. */
  reconciliationTied: boolean | null;
  /** Plan drift findings by severity for the current household Plan. */
  criticalDrift: number;
  attentionDrift: number;
  /** Items waiting on the signed-in person (acknowledge, confirm, review). */
  awaitingMe: number;
  /** Items waiting on the partner. Shown as presence, never as a score. */
  awaitingPartner: number;
  /** Near-term top-up the Fund needs to cover its planned obligations; 0 when covered. */
  topUpNeededCents: number;
  /** A Chapter is open and has recorded progress this cycle. Absent until the Chapter system lands. */
  activeChapter: boolean;
  /** The single gap or amount the current state is about, when one exists. */
  gapCents?: number;
};

export type FundPulseDestination = "fund" | "together" | "path" | "status";

export type FundPulse = {
  state: FundPulseState;
  /** Plain-language headline. Non-colour glyph so meaning never depends on theme colour. */
  glyph: string;
  headline: string;
  detail: string;
  amountCents: number | null;
  destination: FundPulseDestination;
};

export function fundPulse(input: FundPulseInput): FundPulse {
  if (!input.configured) {
    return {
      state: "checking",
      glyph: "○",
      headline: "The Fund is not set up yet.",
      detail: "Agree on who holds it and how contributions work, then the pulse can speak.",
      amountCents: null,
      destination: "fund",
    };
  }
  if (input.freshness !== "current" || input.reconciliationTied === false) {
    return {
      state: "checking",
      glyph: "○",
      headline: "Checking.",
      detail: input.freshness === "offline"
        ? "This device is offline. The shared picture may have changed elsewhere."
        : input.freshness === "stale"
          ? "The shared picture has not refreshed recently, so nothing here is certain yet."
          : "The Fund's last reconciliation did not tie. Review it before trusting the balance.",
      amountCents: null,
      destination: input.freshness === "current" ? "fund" : "status",
    };
  }
  if (input.criticalDrift > 0) {
    return {
      state: "reset",
      glyph: "↺",
      headline: "Time to reset.",
      detail: input.criticalDrift === 1
        ? "One protected promise no longer fits what the books show. Revise the plan together."
        : `${input.criticalDrift} protected promises no longer fit what the books show. Revise the plan together.`,
      amountCents: input.gapCents ?? (input.topUpNeededCents > 0 ? input.topUpNeededCents : null),
      destination: "path",
    };
  }
  if (input.awaitingMe > 0 || input.awaitingPartner > 0) {
    const mine = input.awaitingMe;
    const theirs = input.awaitingPartner;
    const detail = mine > 0 && theirs > 0
      ? "Something is waiting on each of you. Decide together when you are both ready."
      : mine > 0
        ? mine === 1 ? "One item is waiting for you to review." : `${mine} items are waiting for you to review.`
        : theirs === 1 ? "One item is waiting on your partner." : `${theirs} items are waiting on your partner.`;
    return {
      state: "needs-us",
      glyph: "◆",
      headline: mine + theirs === 1 ? "One thing needs us." : "A few things need us.",
      detail,
      amountCents: input.gapCents ?? null,
      destination: "together",
    };
  }
  if (input.topUpNeededCents > 0) {
    return {
      state: "needs-us",
      glyph: "◆",
      headline: "One thing needs us.",
      detail: "The Fund needs a top-up before its next planned obligation.",
      amountCents: input.topUpNeededCents,
      destination: "fund",
    };
  }
  if (input.activeChapter) {
    return {
      state: "building",
      glyph: "▲",
      headline: "Building.",
      detail: input.attentionDrift > 0
        ? "The essentials are covered and this Chapter is moving. One pace is worth a look."
        : "The essentials are covered and this Chapter is moving.",
      amountCents: null,
      destination: "path",
    };
  }
  return {
    state: "covered",
    glyph: "●",
    headline: "Covered.",
    detail: input.attentionDrift > 0
      ? "Near-term shared obligations are supported by current evidence. One pace is worth a look."
      : "Near-term shared obligations are supported by current evidence.",
    amountCents: null,
    destination: "fund",
  };
}

/**
 * Compose the pulse input from accepted books. Freshness comes from the app's
 * sync layer because core has no transport knowledge.
 */
export function deriveFundPulseInput(
  household: Household,
  options: { memberId: string; today: DateKey; freshness: FundPulseFreshness; activeChapter?: boolean },
): FundPulseInput {
  const config = shapeHouseholdFundConfig(household.householdFund);
  const projection = projectHouseholdFund(household, options.today);
  const monthKey = monthKeyFromDateKey(options.today);
  const partnerIds = household.members.filter((member) => member.active && member.id !== options.memberId).map((member) => member.id);

  let awaitingMe = 0;
  let awaitingPartner = 0;
  let criticalDrift = 0;
  let attentionDrift = 0;
  let gapCents: number | undefined;

  // Contribution motions: an open or held proposal waits on the custodian to confirm.
  if (config) {
    for (const motion of householdFundContributionMotions(household, config.id)) {
      if (motion.status !== "open" && motion.status !== "held") continue;
      if (config.custodianMemberId === options.memberId) awaitingMe += 1;
      else if (partnerIds.includes(config.custodianMemberId)) awaitingPartner += 1;
    }
  }

  // Bridge proposals: a pending proposal waits on the person who did not offer it.
  for (const decision of household.planBridgeDecisions ?? []) {
    if (decision.monthKey !== monthKey) continue;
    if (decision.state !== "proposed" && decision.state !== "held") continue;
    if (decision.offeredByMemberId === options.memberId) awaitingPartner += 1;
    else awaitingMe += 1;
  }

  // The current household Plan: acknowledgment and drift.
  const version = currentPlanVersion(household, "household", monthKey);
  if (version) {
    const ack = planAcknowledgementState(household, version);
    if (!ack.complete && ack.requiredMemberIds.includes(options.memberId)) {
      if (!ack.acknowledgedMemberIds.includes(options.memberId)) awaitingMe += 1;
      else awaitingPartner += ack.requiredMemberIds.filter((id) => id !== options.memberId && !ack.acknowledgedMemberIds.includes(id)).length;
    }
    if (version.state === "active" || version.state === "scheduled") {
      const findings = evaluatePlanDrift(household, version, options.today);
      criticalDrift = findings.filter((finding) => finding.severity === "critical").length;
      attentionDrift = findings.filter((finding) => finding.severity === "attention").length;
    }
  }

  if (projection.configured && projection.topUpNeededCents > 0) gapCents = projection.topUpNeededCents;

  return {
    configured: Boolean(config) && projection.configured,
    freshness: options.freshness,
    reconciliationTied: projection.configured ? projection.reconciliationTied : null,
    criticalDrift,
    attentionDrift,
    awaitingMe,
    awaitingPartner,
    topUpNeededCents: projection.configured ? Math.max(0, projection.topUpNeededCents) : 0,
    activeChapter: options.activeChapter ?? false,
    ...(gapCents !== undefined ? { gapCents } : {}),
  };
}

/**
 * Partner presence (Vision v2 §4.4): what each person has completed, proposed,
 * or is waiting on — composed only from shared-scope facts. Never counts money,
 * never totals contributions, never ranks.
 */
export type PresenceLine = { id: string; text: string; waitingOn: "me" | "partner" | null };

export function presenceLines(household: Household, options: { memberId: string; today: DateKey }): PresenceLine[] {
  const lines: PresenceLine[] = [];
  const monthKey = monthKeyFromDateKey(options.today);
  const name = (id: string | null | undefined) => household.members.find((m) => m.id === id)?.name ?? "Your partner";
  const partner = household.members.find((m) => m.active && m.id !== options.memberId);

  const version = currentPlanVersion(household, "household", monthKey);
  if (version) {
    const ack = planAcknowledgementState(household, version);
    for (const id of ack.requiredMemberIds) {
      if (ack.acknowledgedMemberIds.includes(id)) {
        lines.push({ id: `ack:${id}`, text: id === options.memberId ? `You acknowledged the ${monthKey} Plan.` : `${name(id)} acknowledged the ${monthKey} Plan.`, waitingOn: null });
      } else {
        lines.push({ id: `ack:${id}`, text: id === options.memberId ? `The ${monthKey} Plan is waiting for you.` : `The ${monthKey} Plan is waiting on ${name(id)}.`, waitingOn: id === options.memberId ? "me" : "partner" });
      }
    }
  }
  for (const decision of household.planBridgeDecisions ?? []) {
    if (decision.monthKey !== monthKey || (decision.state !== "proposed" && decision.state !== "held")) continue;
    const mine = decision.offeredByMemberId === options.memberId;
    lines.push({ id: `bridge:${decision.id}`, text: mine ? `Your Bridge proposal "${decision.label}" is waiting on ${partner?.name ?? "your partner"}.` : `${name(decision.offeredByMemberId)}'s Bridge proposal "${decision.label}" is waiting for you.`, waitingOn: mine ? "partner" : "me" });
  }
  const config = shapeHouseholdFundConfig(household.householdFund);
  if (config) {
    for (const motion of householdFundContributionMotions(household, config.id)) {
      if (motion.status !== "open" && motion.status !== "held") continue;
      const custodianIsMe = config.custodianMemberId === options.memberId;
      lines.push({ id: `motion:${motion.proposal.id}`, text: custodianIsMe ? `A contribution from ${name(motion.proposal.contributorMemberId)} is waiting for you to confirm.` : `A contribution is waiting for ${name(config.custodianMemberId)} to confirm.`, waitingOn: custodianIsMe ? "me" : "partner" });
    }
  }
  return lines.slice(0, 4);
}
