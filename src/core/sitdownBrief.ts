import type { DateKey } from "./calendar.ts";
import { monthKeyFromDateKey } from "./calendar.ts";
import type { Household } from "./types.ts";
import { householdFundContributionMotions, shapeHouseholdFundConfig } from "./householdFund.ts";
import { currentPlanVersion, evaluatePlanDrift, planAcknowledgementState } from "./planSystem.ts";
import { movesForChapter, openChapterFor, ritualsForChapter } from "./chapters.ts";

/**
 * The Sitdown brief (Vision v2 §6): what changed, what is already settled, and
 * the smallest set of items that genuinely need both people. Assembled from
 * household-visible accepted evidence only — never from private preparation.
 * Pure read; posts nothing; names no amounts beyond what each item already shows.
 */
export type SitdownBriefItem = { id: string; text: string; destination: "fund" | "path" | "together" | "plan" };

export type SitdownBrief = {
  changed: SitdownBriefItem[];
  settled: SitdownBriefItem[];
  needsBoth: SitdownBriefItem[];
  chapter: { title: string; ritualsHeld: number; movesDone: number; movesOpen: number } | null;
  /** Under pressure (critical drift) the Sitdown shortens and defers teaching. */
  underPressure: boolean;
};

export function sitdownBrief(household: Household, options: { memberId: string; today: DateKey }): SitdownBrief {
  const monthKey = monthKeyFromDateKey(options.today);
  const changed: SitdownBriefItem[] = [];
  const settled: SitdownBriefItem[] = [];
  const needsBoth: SitdownBriefItem[] = [];
  let underPressure = false;

  const version = currentPlanVersion(household, "household", monthKey);
  if (version) {
    const ack = planAcknowledgementState(household, version);
    if (!ack.complete) needsBoth.push({ id: `ack:${version.id}`, text: `The ${monthKey} Plan is waiting for ${ack.requiredMemberIds.length - ack.acknowledgedMemberIds.length === 2 ? "both acknowledgments" : "one acknowledgment"}.`, destination: "plan" });
    else settled.push({ id: `ack:${version.id}`, text: `The ${monthKey} Plan is acknowledged by both of you.`, destination: "plan" });
    if (version.state === "active" || version.state === "scheduled") {
      for (const finding of evaluatePlanDrift(household, version, options.today)) {
        if (finding.severity === "critical") underPressure = true;
        if (finding.severity !== "gentle") changed.push({ id: `drift:${finding.id}`, text: finding.explanation, destination: "plan" });
      }
    }
  }

  for (const decision of household.planBridgeDecisions ?? []) {
    if (decision.monthKey !== monthKey) continue;
    if (decision.state === "proposed" || decision.state === "held") {
      needsBoth.push({ id: `bridge:${decision.id}`, text: `A Bridge proposal is waiting: ${decision.label}.`, destination: "together" });
    } else if (decision.state === "accepted") {
      settled.push({ id: `bridge:${decision.id}`, text: `Agreed across the Bridge: ${decision.label}.`, destination: "together" });
    }
  }

  const config = shapeHouseholdFundConfig(household.householdFund);
  if (config) {
    for (const motion of householdFundContributionMotions(household, config.id)) {
      if (motion.status === "open" || motion.status === "held") {
        needsBoth.push({ id: `motion:${motion.proposal.id}`, text: `A contribution is waiting for the custodian to confirm it was received.`, destination: "fund" });
      } else if (motion.status === "confirmed" && motion.confirmation && monthKeyFromDateKey(motion.confirmation.date) === monthKey) {
        settled.push({ id: `motion:${motion.proposal.id}`, text: `A contribution was confirmed received this month.`, destination: "fund" });
      }
    }
  }

  const chapter = openChapterFor(household);
  let chapterSummary: SitdownBrief["chapter"] = null;
  if (chapter) {
    const rituals = ritualsForChapter(household, chapter.id);
    const moves = movesForChapter(household, chapter.id);
    const ritualsHeld = rituals.reduce((sum, row) => sum + row.heldOn.length, 0);
    const movesDone = moves.filter((row) => row.state === "done").length;
    const movesOpen = moves.filter((row) => row.state === "offered" || row.state === "accepted").length;
    chapterSummary = { title: chapter.title, ritualsHeld, movesDone, movesOpen };
    for (const ritual of rituals) {
      const held = ritual.heldOn.length;
      if (held > 0) settled.push({ id: `ritual:${ritual.id}:held`, text: `"${ritual.title}" held ${held} ${held === 1 ? "time" : "times"} this Chapter.`, destination: "path" });
    }
    for (const move of moves) {
      if (move.needsAcknowledgment && move.state !== "done" && move.state !== "declined") {
        needsBoth.push({ id: `move:${move.id}`, text: `A Move needs both of you: ${move.text}`, destination: "path" });
      }
    }
  }

  return { changed, settled, needsBoth, chapter: chapterSummary, underPressure };
}
