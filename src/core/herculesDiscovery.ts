import { registerMembersDraw } from "./registerView.ts";
import { contributionRegister } from "./contributionRegister.ts";
import { formatCad } from "./money.ts";
import { duplicateContrastPairs } from "./duplicate.ts";
import type { Household, LedgerView } from "./types.ts";
import type { HearthTab } from "./hercules.ts";
import { HERCULES_CAPABILITIES, type HerculesCapabilityId } from "./herculesCapabilities.ts";
import { companionFor } from "./herculesCompanion.ts";
import type { CompanionSuggestionState } from "./herculesCompanionContracts.ts";
import { householdForHerculesContext } from "./visibility.ts";
import { activeOpenShift } from "./shiftClock.ts";
import { runHealthCheck } from "./health.ts";
import { monthStartKey, monthEndKey, shiftMonthKey, monthKeyFromDateKey, calendarDaysBetween, isValidDateKey } from "./calendar.ts";
import { countable } from "./budget.ts";
import { executeHerculesReadToolPlan, type HerculesReadToolCall } from "./herculesTools.ts";
import type { HerculesNumberSource, HerculesGroundedFact } from "./herculesProvenance.ts";

export type DiscoveryInput = { household: Household; memberId: string; view: LedgerView; tab: HearthTab; today: string; now?: number; accountId?: string | null; fund?: DiscoveryFund | null; payday?: string; lastShown?: ReadonlyMap<string, number> };
export type DiscoveryFund = { scope: string; today: string; rows: Array<{ obligationId: string; label: string; date: string; amountCents: number; unfundedCents: number }> };
/** Same accepted-book projection as Register; only already-public row fields leave it. */
export function buildDiscoveryFund(household: Household, memberId: string, view: LedgerView, today: string): DiscoveryFund | null {
  if (view !== "household" || !household.householdFund || !household.members.some(row => row.id === memberId && row.active)) return null;
  const register = contributionRegister(household,monthKeyFromDateKey(today),today);
  const members = household.members.filter(row => row.active).map(row => ({ memberId: row.id, displayName: row.name, tone: row.id === household.householdFund?.custodianMemberId ? "hers" as const : "his" as const }));
  if (!register.tiesToProjection || !registerMembersDraw(register,members)) return null;
  return { scope: discoveryScope({ household,memberId,view,today,tab: "home" }), today, rows: register.rows.map(({ obligationId,label,date,amountCents,unfundedCents }) => ({ obligationId,label,date,amountCents,unfundedCents })) };
}
function fundFor(input: DiscoveryInput) {
  if (input.fund !== undefined) return input.fund?.scope === discoveryScope(input) && input.fund.today === input.today ? input.fund : null;
  return buildDiscoveryFund(householdForHerculesContext(input.household,input.memberId,input.view),input.memberId,input.view,input.today);
}
export type DiscoveryCandidate = { issueId: string; capabilityId: HerculesCapabilityId; title: string; why: string; source: string; action: string; targetId: string; tier: number; due: string | null; dedupe: string };
export type DiscoveryDestination = { kind: "source"; source: HerculesNumberSource } | { kind: "entry"; mode: "expense" | "income" | "transfer" } | { kind: "wardrobe" } | { kind: "health" } | { kind: "fund"; targetId?: string } | { kind: "shift"; targetId: string };
export type DiscoveryAnswer = { text: string; facts: HerculesGroundedFact[]; destination?: DiscoveryDestination; action?: string };
const PAGE_COPY: Record<HearthTab, string> = {
  home: "This is your desk: current books, the Household Fund and the things you choose to keep close. Open a tile to inspect it, or use Add to record something.",
  calendar: "Calendar brings dated plans, repeating items and recorded activity together. Open a day or a bill to review its details. A scheduled item is not a posted payment.",
  add: "Choose expense, income or transfer, enter the details, then review. Only your final Confirm records the entry. Paying a card is a transfer.",
  ledger: "Your books show accounts, recorded entries and their sources. Open an account to understand its balance, or the register to inspect individual rows.",
  plan: "Plan brings projections and goals together. Projections depend on the records and assumptions entered here; they are not a guarantee of money available to spend.",
  shift: "Shift holds your current punch and shift review. Continue your own open shift here; review the count before Confirm records it.",
  more: "More holds household settings, appearance, Health and other tools. Open Health to understand a finding, or change your theme without changing the books.",
};
function fingerprint(text: string) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); }
export function discoveryScope(input: DiscoveryInput) { return `${input.household.environment}:${input.household.householdId}:${input.memberId}:${input.view}`; }
export function discoveryCandidates(input: DiscoveryInput): DiscoveryCandidate[] {
  const { household, memberId, view, today, tab } = input;
  if (!household.members.some(row => row.id === memberId && row.active)) return [];
  const visible = householdForHerculesContext(household, memberId, view);
  const rows: DiscoveryCandidate[] = [];
  const add = (capabilityId: HerculesCapabilityId, targetId: string, title: string, why: string, source: string, action: string, tier = 3, due: string | null = null, material = targetId) => {
    const definition = HERCULES_CAPABILITIES.find(row => row.id === capabilityId)!;
    if (!(definition.views as readonly LedgerView[]).includes(view)) return;
    rows.push({ issueId: `${capabilityId}:${fingerprint(`${view}:${material}`)}`, capabilityId, targetId, title, why, source, action, tier, due, dedupe: `${capabilityId}:${targetId}` });
  };
  add("explain-page", tab, "Make sense of this page", "Start with what is in front of you.", "This page and its existing controls", "Explain this page", 2);
  add("guide-entry", "entry", "Walk through one entry", "A little guidance, one step at a time.", "Your existing Add and review flow", "Choose an entry");
  add("dress-hercules", "wardrobe", "Find Hercules something to wear", "I have a small but heartfelt interest in my wardrobe.", "The outfits already available on your desk", "Open Hercules outfits");
  for (const account of visible.accounts.filter(row => row.active)) add("explain-account", account.id, `Understand ${account.name}`, input.accountId === account.id ? "You are looking at this account." : "Trace a balance to its recorded source.", "Current account and journal", "Explain this balance", input.accountId === account.id ? 2 : 3);
  const month = monthKeyFromDateKey(today), previous = shiftMonthKey(month, -1);
  const expenses = visible.transactions.filter(row => countable(row) && (row.type === "expense" || row.type === "refund"));
  const current = expenses.filter(row => row.date >= monthStartKey(month) && row.date <= monthEndKey(month));
  if (current.length) add("explain-spending", month, "Where did recorded spending go?", "There are entries to explore this month.", `${monthStartKey(month)} to ${monthEndKey(month)} · all recorded entries, including future-dated entries`, "Show the breakdown", tab === "ledger" ? 2 : 3);
  if (current.length && expenses.some(row => row.date >= monthStartKey(previous) && row.date <= monthEndKey(previous))) add("compare-periods", month, "Compare this month with last", "Both periods contain recorded entries.", `${monthStartKey(previous)}–${monthEndKey(previous)} and ${monthStartKey(month)}–${monthEndKey(month)}; current month is incomplete and may include future-dated entries`, "Compare recorded periods");
  if (view === "household" && visible.recurrences.some(row => row.active && row.type === "expense")) {
    const next = visible.recurrences.filter(row => row.active && row.type === "expense" && row.nextDate >= today).sort((a,b) => a.nextDate.localeCompare(b.nextDate))[0];
    add("bills-before-payday", "payday", "What is due before payday?", next ? `Next recorded bill date: ${next.nextDate}.` : "Choose a payday to inspect recorded bill dates.", "Payday needed · next scheduled occurrence of each repeating bill", "Choose payday", next && calendarDaysBetween(today, next.nextDate) <= 7 ? 1 : 3, next?.nextDate ?? null, next ? `${next.id}:${next.nextDate}` : "payday");
  }
  if (view === "household" && (current.length || visible.recurrences.some(row => row.active))) add("review-plan", month, "Walk through what is left", "See the assumptions behind the current plan.", "Existing leftover projection · not guaranteed spending money", "Explain the plan", tab === "plan" ? 2 : 3);
  for (const goal of visible.goals.filter(row => row.status === "open")) add("review-goal", goal.id, `Check in on ${goal.name}`, "Review progress and the next action already available.", "Current goal and recorded funding", "Review this goal", tab === "plan" ? 2 : 3, goal.arrivalDate ?? goal.deadline, `${goal.id}:${goal.arrivalDate ?? goal.deadline ?? "open"}`);
  // Health's existing full audit is Shared-only; do not manufacture a partial audit in Personal.
  if (view === "household" && visible.transactions.length) for (const finding of runHealthCheck(visible)) {
    add("review-health", fingerprint(`${finding.section}:${finding.id ?? ""}:${finding.message}`), `Review ${finding.section.toLowerCase()}`, finding.message, "Current deterministic Health finding", "Explain this finding", 0, null, `${finding.section}:${finding.id ?? ""}:${finding.message}`);
    const transaction = visible.transactions.find(row => row.id === finding.id || finding.message.includes(row.id));
    const account = visible.accounts.find(row => row.id === finding.id || finding.message.includes(row.id));
    rows[rows.length - 1]!.dedupe = `health:${transaction?.id ?? account?.id ?? finding.id ?? finding.section}`;
  }
  for (const pair of duplicateContrastPairs(visible.transactions)) {
    const ids = [pair.left.id,pair.right.id].sort();
    add("review-health", `duplicate:${JSON.stringify(ids)}`, "Review a possible duplicate", "Two visible recorded entries may describe the same purchase. Review before deciding.", `Recorded entries dated ${pair.left.date} and ${pair.right.date}`, "Compare these entries", 0, null, `duplicate:${ids.join(":")}`);
    rows[rows.length - 1]!.dedupe = `health:${ids[0]}`;
  }
  const shift = activeOpenShift(visible.kitchen, memberId);
  if (shift) add("resume-shift", shift.id, "Continue your open shift", "Your own shift is still waiting for review or completion.", "Current shift timeline · no count draft is copied", "Open my shift", 0);
  if (view === "household") for (const item of fundFor(input)?.rows ?? []) {
    add("explain-fund", item.obligationId, `Understand ${item.label} in the Fund`, "See the recorded obligation and the funding assigned to it.", `Shared Fund register · ${item.date}; personal backing accounts stay private`, "Explain this Fund item", tab === "home" ? 2 : 3, item.date, `${item.obligationId}:${item.date}`);
  }
  return rows;
}
export function discoverySelection(input: DiscoveryInput) {
  const now = input.now ?? Date.now(), all = discoveryCandidates(input), states = companionFor(input.household, input.memberId).suggestions;
  const disabled = new Set(states.filter(row => row.status === "disabled").map(row => row.capabilityId));
  const eligible = all.filter(row => !disabled.has(row.capabilityId) && !states.some(state => state.view === input.view && state.issueId === row.issueId && state.status === "snoozed" && Date.parse(state.until!) > now));
  eligible.sort((a,b) => a.tier - b.tier || (a.due ?? "9999").localeCompare(b.due ?? "9999") || (input.lastShown?.get(a.issueId) ?? 0) - (input.lastShown?.get(b.issueId) ?? 0) || a.issueId.localeCompare(b.issueId));
  const visible = householdForHerculesContext(input.household, input.memberId, input.view);
  const empty = !visible.transactions.some(countable) && !visible.recurrences.some(row => row.active) && !activeOpenShift(visible.kitchen, input.memberId);
  const forNow = empty ? eligible.filter(row => ["explain-page", "guide-entry", "dress-hercules"].includes(row.capabilityId)) : eligible;
  const seen = new Set<string>(), capabilities = new Set<string>();
  const nowRows = forNow.filter(row => {
    if (seen.has(row.dedupe) || capabilities.has(row.capabilityId)) return false;
    seen.add(row.dedupe); capabilities.add(row.capabilityId); return true;
  }).slice(0,3);
  const resume = states.filter(row => row.view === input.view && row.status === "resume").flatMap(state => { const match = eligible.find(row => row.issueId === state.targetId && row.capabilityId === state.capabilityId); return match ? [match] : []; });
  return { all, now: nowRows, resume, disabled };
}
/** Expired snoozes are retained as CAS tombstones; clearing never resets a resource revision. */
export function discoveryState(input: DiscoveryInput, candidate: DiscoveryCandidate, operation: "snooze" | "disable" | "enable" | "resume" | "clear"): CompanionSuggestionState {
  const capability = operation === "disable" || operation === "enable", bookmark = operation === "resume" || operation === "clear";
  const issueId = capability ? `capability:${candidate.capabilityId}` : bookmark ? `resume:${candidate.capabilityId}` : candidate.issueId;
  const view = capability ? "household" : input.view;
  const old = companionFor(input.household, input.memberId).suggestions.find(row => row.issueId === issueId && row.view === view);
  return { issueId, capabilityId: candidate.capabilityId, view, revision: old?.revision ?? 0, status: operation === "disable" ? "disabled" : operation === "resume" ? "resume" : "snoozed", until: operation === "disable" || operation === "resume" ? null : operation === "snooze" ? new Date((input.now ?? Date.now()) + 86_400_000).toISOString() : "1970-01-01T00:00:00.000Z", targetId: operation === "resume" ? candidate.issueId : null };
}
export function explainDiscovery(input: DiscoveryInput, issueId: string): DiscoveryAnswer | null {
  const candidate = discoveryCandidates(input).find(row => row.issueId === issueId);
  if (!candidate) return null;
  const { capabilityId, targetId } = candidate, { household, memberId, view, today } = input;
  const source = (route: HerculesNumberSource["route"], label: string, extra = {}): DiscoveryDestination => ({ kind: "source", source: { route, view, label, ...extra } });
  const simple = (text: string, destination?: DiscoveryDestination, action?: string): DiscoveryAnswer => ({ text, facts: [], destination, action });
  if (capabilityId === "explain-page") return simple(PAGE_COPY[input.tab]);
  if (capabilityId === "guide-entry") return simple("An expense records money spent. Income records money received. A transfer moves money between accounts, including a card payment. Choose one below; the usual review and Confirm stay in charge.");
  if (capabilityId === "dress-hercules") return simple("The outfits on your desk are ready to explore. Choose an available accessory there; I will handle looking pleased.", { kind: "wardrobe" }, "Open Hercules outfits");
  if (capabilityId === "resume-shift") return simple("This opens your current shift workflow. It will not clock you out or post anything. A count saved on this device stays in its existing workflow.", { kind: "shift", targetId }, "Continue my shift");
  if (capabilityId === "review-health" && targetId.startsWith("duplicate:")) return simple(candidate.why, source("ledger", "Compare these recorded entries", { duplicateTransactionIds: JSON.parse(targetId.slice(10)) as [string,string] }), "Open duplicate comparison");
  if (capabilityId === "review-health") return simple(`${candidate.why} Open Health to review the current finding and its existing recovery steps.`, { kind: "health" }, "Open Health review");
  if (capabilityId === "explain-fund") {
    const item = fundFor(input)?.rows.find(row => row.obligationId === targetId);
    if (!item) return null;
    return simple(`${item.label} · ${item.date}. The recorded obligation is ${formatCad(item.amountCents)}. The register assigns ${formatCad(item.amountCents - item.unfundedCents)} in funding, leaving ${formatCad(item.unfundedCents)} unfunded. Funding assignment does not itself mean the bill was paid.`, { kind: "fund", targetId }, "Open this Fund item");
  }
  const calls: HerculesReadToolCall[] = [];
  const call = (name: HerculesReadToolCall["name"], args: Record<string, unknown> = {}) => calls.push({ id: `discovery-${calls.length}`, name, args });
  let destination: DiscoveryDestination | undefined, action = "Open recorded source", caveat = "";
  if (capabilityId === "explain-account") { call("account_balance", { account: targetId }); call("explain_balance", { account: targetId }); destination = source("ledger", "Open this account", { accountId: targetId }); }
  if (capabilityId === "explain-spending") { call("category_breakdown", { period: "this_month" }); caveat = "This covers recorded entries only; missing imports or entries are not zero spending."; }
  if (capabilityId === "compare-periods") { call("compare_spending", { currentPeriod: "this_month", comparisonPeriod: "last_month" }); caveat = `${candidate.source}. This is a recorded-data comparison, not equal-length or verified-complete coverage.`; }
  if (capabilityId === "review-plan") { call("budget_status"); call("cash_position"); destination = source("plan", "Open the current plan"); caveat = "This is a projection based on current records and assumptions, not guaranteed money available to spend."; }
  if (capabilityId === "review-goal") { call("goal_progress", { goal: targetId }); destination = source("plan", "Open this goal", { goalId: targetId }); action = "Open goal actions"; }
  if (capabilityId === "bills-before-payday") {
    if (!input.payday || !isValidDateKey(input.payday) || input.payday <= today || calendarDaysBetween(today, input.payday) > 90) return simple("Choose your next payday after today, within 90 days. I will show the next recorded occurrence of each repeating bill through that date; this does not expand every repeat or include unrecorded bills.");
    call("bills_due", { horizonDays: calendarDaysBetween(today, input.payday) }); destination = source("calendar", "Open repeating bills", { from: today, to: input.payday }); action = "Open bills calendar";
    caveat = `Through ${input.payday}, inclusive. Next recorded occurrences only; not every repeat or unrecorded bill.`;
  }
  const run = executeHerculesReadToolPlan(household, { calls }, today, { memberId, view });
  const facts = run.results.flatMap(row => row.facts);
  if (!destination && facts[0]) destination = { kind: "source", source: facts[0].source };
  return { text: `${run.results.map(row => row.sentence).join("\n\n")}\n\n${caveat}`.trim(), facts, destination, action };
}
