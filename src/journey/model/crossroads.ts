/**
 * Crossroads: only real, existing choices. Differences come from the records themselves (the era row's agreed and
 * pending specs, `planVersionDiff`, the two home layouts); nothing is estimated or invented. "Confirm" opens the
 * surface that owns the choice, which keeps its own named Confirm:
 * - eraProposal: an era suggestion waiting on agreement (`pathEras` rows with `pending`) → the Era planner;
 * - homeBlueprint: the viewer's saved future-home blueprint (`HomeState.future`) → the HomeBook;
 * - planFork: a proposed or scheduled household Plan for this month or next vs the active one → the Plan Studio.
 * No fork is manufactured from transactions or from goals that can run side by side.
 */
import { monthStartKey, shiftMonthKey, type MonthKey } from "../../core/calendar.ts";
import { formatCadGrouped as formatCad } from "../../core/money.ts";
import { pathEras, type PathEraView } from "../../core/pathEras.ts";
import { currentPlanVersion, planVersionDiff, type PlanLine, type PlanVersion } from "../../core/planSystem.ts";
import { BLUEPRINTS } from "../../home/catalogue.ts";
import { allowedFamilies, type HomeLayout } from "../../home/model.ts";
import { journeyIds, type Crossroads, type CrossroadsPreview } from "../contracts.ts";
import type { ViewerHome } from "./milestones.ts";
import { monthLabel } from "./words.ts";
import type { DeriveContext } from "./window.ts";

type EraSpec = PathEraView["spec"];

function eraField(spec: EraSpec | null, field: "name" | "finishLine" | "by" | "home" | "finish" | "plans"): string | null {
  if (!spec) return null;
  switch (field) {
    case "name": return spec.name;
    case "finishLine": return spec.finishLine;
    case "by": return spec.by ? monthLabel(spec.by) : "Open-ended";
    case "home": return spec.home;
    case "finish": return spec.finish.kind === "survive" ? `${spec.finish.months} months` : spec.finish.kind === "banks" ? `${spec.finish.goalIds.length} Kitty Banks` : "We agree";
    case "plans": return spec.plans.map(plan => plan.label).join(", ") || null;
  }
}

function eraCrossroads(ctx: DeriveContext, nameOf: (id: string) => string): Crossroads[] {
  let views: PathEraView[] = [];
  try { views = pathEras(ctx.household, ctx.today); } catch { views = []; }
  const out: Crossroads[] = [];
  for (const view of views) {
    if (!view.pending) continue;
    const agreed = view.state === "sketched" ? null : view.spec;
    const fields = ["name", "finishLine", "by", "home", "finish", "plans"] as const;
    const changes = fields.map(field => ({ field, before: eraField(agreed, field), after: eraField(view.pending, field) })).filter(row => row.before !== row.after);
    const waitingOn = ctx.activeMemberIds.filter(id => !view.row.agreedByMemberIds.includes(id));
    const by = view.pendingBy ? nameOf(view.pendingBy) : null;
    const id = journeyIds.crossroadsEra(view.row.id);
    out.push({
      id, kind: "eraProposal", chapterId: ctx.current, date: ctx.today,
      label: agreed ? `A change to “${agreed.name}”` : `A new era: “${view.pending.name}”`,
      question: agreed ? `Keep “${agreed.name}” as agreed, or take up the suggested change?` : `Add “${view.pending.name}” to our journey?`,
      alternatives: [
        { id: `${id}#agreed`, label: agreed ? "As agreed now" : "Not on the journey yet", description: agreed ? `“${agreed.name}” stays as it is.` : "Nothing changes until both of you agree.", isCurrent: true, preview: { kind: "era", changes: [] } },
        { id: `${id}#pending`, label: by ? `${by}’s suggestion` : "The suggestion", description: `${changes.length} ${changes.length === 1 ? "thing changes" : "things change"} if both of you agree.`, isCurrent: false, preview: { kind: "era", changes } },
      ],
      reversible: true, reversibleNote: "An era can be changed again later in the Era planner; each change needs both of you.",
      confirm: { callback: "openEraPlanner", call: { name: "openEraPlanner", eraId: view.row.id }, label: "Continue in the Era planner…" },
      waitingOn, sourceRefs: [{ kind: "pathEra", id: view.row.id }],
    });
  }
  return out;
}

function roomNames(layout: HomeLayout): Map<string, string> {
  return new Map(layout.rooms.filter(room => !room.stored).map(room => [room.id, room.name]));
}

function homeCrossroads(ctx: DeriveContext, viewer: ViewerHome): Crossroads[] {
  if (!ctx.viewerActive || viewer.home === null || !viewer.saved || !viewer.home.future) return [];
  const home = viewer.home, future = home.future!;
  const now = roomNames(home.layout), next = roomNames(future);
  const allowed = allowedFamilies(home);
  const lockedFamilies = [...new Set(future.rooms.filter(room => !room.stored).map(room => BLUEPRINTS.find(row => row.id === room.blueprintId)?.family).filter((family): family is NonNullable<typeof family> => !!family && !allowed.has(family)))].sort();
  const id = journeyIds.crossroadsHome(ctx.memberId);
  const preview = (layout: HomeLayout, added: string[], removed: string[], locked: string[]): CrossroadsPreview => ({ kind: "home", layout, roomsAdded: added, roomsRemoved: removed, lockedFamilies: locked });
  return [{
    id, kind: "homeBlueprint", chapterId: ctx.current, date: ctx.today,
    label: "Your future-home blueprint", question: "Keep your home as it is, or place the blueprint you saved?",
    alternatives: [
      { id: `${id}#current`, label: "Your home now", description: "The home you last saved.", isCurrent: true, preview: preview(home.layout, [], [], []) },
      { id: `${id}#future`, label: "Your saved blueprint", description: lockedFamilies.length ? "Some rooms in it are still locked; they stay in the blueprint until unlocked." : "Every room in it is unlocked.", isCurrent: false,
        preview: preview(future, [...next].filter(([room]) => !now.has(room)).map(([, name]) => name), [...now].filter(([room]) => !next.has(room)).map(([, name]) => name), lockedFamilies) },
    ],
    reversible: true, reversibleNote: "Rooms are stored, never deleted: a placed room can be stored again in the HomeBook.",
    confirm: { callback: "openHomeBook", call: { name: "openHomeBook", memberId: ctx.memberId }, label: "Continue in the HomeBook…" },
    waitingOn: [], placeRef: { kind: "reserve", id: viewer.plotId }, sourceRefs: [],
  }];
}

const lineRow = (line: PlanLine) => ({ label: line.labelSnapshot, amountCents: Number.isFinite(line.amountCents) ? line.amountCents : null });

function planCrossroads(ctx: DeriveContext): Crossroads[] {
  const versions = ctx.household.planVersions ?? [];
  const out: Crossroads[] = [];
  for (const month of [ctx.current, shiftMonthKey(ctx.current, 1)] as MonthKey[]) {
    if (!ctx.monthSet.has(month)) continue;
    const proposals = versions.filter(row => row.scope === "household" && row.monthKey === month && (row.state === "proposed" || row.state === "scheduled"));
    if (!proposals.length) continue;
    const active = currentPlanVersion({ planVersions: versions.filter(row => row.state === "active") }, "household", month);
    const proposal = [...proposals].sort((a, b) => b.sequence - a.sequence || b.createdAt.localeCompare(a.createdAt))[0]!;
    out.push(planFork(ctx, month, active, proposal));
  }
  return out;
}

function planFork(ctx: DeriveContext, month: MonthKey, active: PlanVersion | null, proposal: PlanVersion): Crossroads {
  const diff = planVersionDiff(active, proposal);
  const changed = diff.changed.flatMap(({ before, after }) => {
    if (before.amountCents !== after.amountCents) return [{ label: after.labelSnapshot, field: "amount", before: formatCad(before.amountCents), after: formatCad(after.amountCents) }];
    if (before.labelSnapshot !== after.labelSnapshot) return [{ label: after.labelSnapshot, field: "name", before: before.labelSnapshot, after: after.labelSnapshot }];
    if (before.cadence !== after.cadence) return [{ label: after.labelSnapshot, field: "cadence", before: before.cadence, after: after.cadence }];
    return [{ label: after.labelSnapshot, field: "details", before: "as agreed", after: "changed" }];
  });
  const id = journeyIds.crossroadsPlan(proposal.id);
  const date = month === ctx.current ? ctx.today : monthStartKey(month);
  return {
    id, kind: "planFork", chapterId: month, date,
    label: `A proposed ${monthLabel(month)} plan`, question: active ? "Keep the plan we agreed, or take up the proposed version?" : "Take up the proposed plan for this month?",
    alternatives: [
      { id: `${id}#active`, label: active ? "As agreed now" : "No plan agreed yet", description: active ? "The active plan stays as it is." : "Nothing changes until the plan is agreed.", isCurrent: true, preview: { kind: "plan", added: [], removed: [], changed: [] } },
      { id: `${id}#proposed`, label: "The proposed version", description: proposal.reason || "A proposed plan.", isCurrent: false,
        preview: { kind: "plan", added: diff.added.map(lineRow), removed: diff.removed.map(lineRow), changed } },
    ],
    reversible: true, reversibleNote: "A plan can be revised again at the kitchen table.",
    confirm: { callback: "openPlace", call: { name: "openPlace", target: "plan-studio" }, label: "Continue at the kitchen table…" },
    waitingOn: [], sourceRefs: [{ kind: "planVersion", id: proposal.id }, ...(active ? [{ kind: "planVersion" as const, id: active.id }] : [])],
  };
}

export function crossroadsFor(ctx: DeriveContext, viewer: ViewerHome): Crossroads[] {
  const nameOf = (id: string) => ctx.household.members.find(member => member.id === id)?.name ?? "One of you";
  return [...eraCrossroads(ctx, nameOf), ...homeCrossroads(ctx, viewer), ...planCrossroads(ctx)]
    .filter(row => ctx.monthSet.has(row.chapterId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
