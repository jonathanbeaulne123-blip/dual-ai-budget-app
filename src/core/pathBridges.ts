import type { DateKey } from "./calendar.ts";
import { pathLabel } from "./pathStones.ts";
import type { PlanBridgeDecision } from "./planSystem.ts";
import type { Household } from "./types.ts";

/**
 * Our Path bridges (Jonathan's step 6): "'Share with Our Home' builds a bridge
 * stage by stage." Pure and derived on read; nothing here is stored or synced.
 *
 * - Stage 1: my own private Bridge draft (`planBridgeDrafts`, `ownerMemberId === memberId`).
 *   Only its owner ever sees this plank; the partner's drafts never reach this device,
 *   and the owner filter keeps them out of a full in-memory snapshot too.
 * - Stage 2: a shared decision that is `proposed` or `held` (both of you see it).
 * - Stage 3: `accepted` with `acceptedInPlanVersionId` (built into an agreed Plan).
 * - Stage 0: `declined` or `withdrawn` — kept as two stumps, because both of you
 *   already see that history in the Plan Studio and an honest stump is kinder than
 *   a bridge that silently vanishes. `superseded` rows are dropped: a newer accepted
 *   offer stands in their place, so a stump there would say something untrue.
 *
 * Amounts are never read: drafts and decisions carry `amountCents`/ranges, and none
 * of them is copied here.
 */

export type PathBridgeStage = 0 | 1 | 2 | 3;
export type PathBridge = {
  id: string;
  label: string;
  /** YYYY-MM the offer is for. */
  month: string;
  kind: PlanBridgeDecision["kind"];
  stage: PathBridgeStage;
  stageWords: string;
  offeredByMe: boolean;
  why: string;
};

export const PATH_BRIDGE_LIMIT = 12;
export const PATH_BRIDGE_WORDS = {
  draft: "A plank laid, only you can see it",
  proposed: "Offered to Our Home — waiting",
  held: "Held for now",
  accepted: "Built — part of the Plan",
  declined: "Not built — set aside",
  withdrawn: "Taken back — not built",
} as const;

const KIND_WORDS: Record<PathBridge["kind"], string> = {
  contribution: "a contribution",
  responsibility: "a responsibility",
  "fund-target": "a Fund target",
  "shared-goal": "a shared goal",
  constraint: "a constraint to respect",
};

export function pathBridges(household: Household, memberId: string, today: DateKey): PathBridge[] {
  void today;
  if (!memberId) return [];
  const names = new Map(household.members.map((member) => [member.id, member.name]));
  const who = (id: string | undefined) => (id === memberId ? "You" : (id && names.get(id)) || "Your partner");
  const rows: (PathBridge & { at: string })[] = [];
  for (const draft of household.planBridgeDrafts ?? []) {
    if (draft.ownerMemberId !== memberId) continue;
    rows.push({
      id: draft.id, label: pathLabel(draft.label, "An offer"), month: draft.monthKey, kind: draft.kind, stage: 1,
      stageWords: PATH_BRIDGE_WORDS.draft, offeredByMe: true, at: draft.updatedAt,
      why: `Saved privately as ${KIND_WORDS[draft.kind] ?? "an offer"}. Share it with Our Home to lay the next planks.`,
    });
  }
  for (const row of household.planBridgeDecisions ?? []) {
    const mine = row.offeredByMemberId === memberId;
    const offered = `${who(row.offeredByMemberId)} offered ${KIND_WORDS[row.kind] ?? "this"} to Our Home`;
    let stage: PathBridgeStage, stageWords: string, why: string;
    if (row.state === "proposed") { stage = 2; stageWords = PATH_BRIDGE_WORDS.proposed; why = `${offered}. It waits for the Plan.`; }
    else if (row.state === "held") { stage = 2; stageWords = PATH_BRIDGE_WORDS.held; why = `${offered}. ${who(row.heldByMemberId)} held it for the Sitdown.`; }
    else if (row.state === "accepted" && row.acceptedInPlanVersionId) { stage = 3; stageWords = PATH_BRIDGE_WORDS.accepted; why = `${offered}. Both of you agreed it in the Plan.`; }
    else if (row.state === "declined") { stage = 0; stageWords = PATH_BRIDGE_WORDS.declined; why = `${offered}. It was set aside; the reason lives in the Plan Studio.`; }
    else if (row.state === "withdrawn") { stage = 0; stageWords = PATH_BRIDGE_WORDS.withdrawn; why = `${offered}, then took it back.`; }
    else continue;
    rows.push({ id: row.id, label: pathLabel(row.label, "An offer"), month: row.monthKey, kind: row.kind, stage, stageWords, offeredByMe: mine, why, at: row.updatedAt });
  }
  return rows
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    .slice(0, PATH_BRIDGE_LIMIT)
    .map(({ at: _at, ...bridge }) => bridge);
}
