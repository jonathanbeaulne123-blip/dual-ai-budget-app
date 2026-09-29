/**
 * Commitment stops: bills, planned expenses and visits, read from the Calendar's own pipeline.
 *
 * - Unrecorded bills are the day ledger's slips (`dayLedger`, `isOutgoingBill`, still unposted that day). A slip the
 *   Calendar marks `allowPost:false` ("earlier receipt corrected or excluded · payment status needs review") is
 *   `needs-review`, never paid and never simply overdue.
 * - Visits are the Calendar's appointment rows (`calendarWeight`), which the day ledger does not carry as slips.
 * - Paid is only a recognised posted root: a recurring expense whose `sourceId` is the recurrence (the Calendar's
 *   own "posted" recognition), or a posted visit. A due date passing is never paid; set aside is never paid.
 * - "Mark paid…" (Bill paid at its named Confirm) is offered only when Bill paid can take the occurrence: the
 *   recurrence's next occurrence, on or before today (`billSlipsFor` lists only `due` bills). Before that the bill
 *   offers the Calendar and the bill jars (review MINOR 2).
 * - Two postings for one occurrence stay ONE stop whose status says "2 postings · review in the Books"; the figure
 *   is the first posting's, never the silent sum (review M3).
 */
import { appointmentPublicTitle } from "../../core/appointments.ts";
import type { DateKey } from "../../core/calendar.ts";
import { monthKeyFromDateKey } from "../../core/calendar.ts";
import type { Transaction } from "../../core/types.ts";
import { journeyIds, type CommitmentStatus, type CommitmentStop, type SourceRef, type StopAction } from "../contracts.ts";
import { action, relationOf } from "./stopKit.ts";
import { baseItemId, weightKey, type DeriveContext } from "./window.ts";

/** A commitment this large, or one needing attention, gets a signpost. */
const MAJOR_COMMITMENT_CENTS = 50_000;

/** Bill paid can take this occurrence now: an active recurrence whose next (due) occurrence is this date. */
function billPaidCanTake(ctx: DeriveContext, recurrenceId: string, date: DateKey): boolean {
  if (date > ctx.today) return false;
  const recurrence = (ctx.presented ?? ctx.household).recurrences.find(row => row.id === recurrenceId);
  return Boolean(recurrence && recurrence.active && recurrence.nextDate === date);
}

function commitmentActions(ctx: DeriveContext, id: string, status: CommitmentStatus, recurrenceId: string | null, date: DateKey): StopAction[] {
  if (status === "paid") return [
    action(id, "books", "See it in the Books", { name: "openBooks", ref: { kind: "month", monthKey: monthKeyFromDateKey(date) } }, true),
    action(id, "calendar", "Open the Calendar", { name: "openCalendar", date }),
  ];
  if (status === "needs-review") return [
    action(id, "review", "Review it in the Books", { name: "openBooks", ref: { kind: "register" } }, true),
    action(id, "calendar", "Open the Calendar", { name: "openCalendar", date }),
  ];
  if (recurrenceId) return billPaidCanTake(ctx, recurrenceId, date) ? [
    action(id, "mark-paid", "Mark paid…", { name: "openBillPaid", recurrenceId }, true),
    action(id, "calendar", "Open the Calendar", { name: "openCalendar", date }),
    action(id, "jars", "Open the bill jars", { name: "openPlace", target: "cellar-bills" }),
  ] : [
    // Not due yet: Bill paid lists only due bills, so it is not offered until the day arrives.
    action(id, "jars", "Open the bill jars", { name: "openPlace", target: "cellar-bills" }, true),
    action(id, "calendar", "Open the Calendar", { name: "openCalendar", date }),
  ];
  return [
    action(id, "record", "Record it…", { name: "openRecord", mode: "expense" }, true),
    action(id, "calendar", "Open the Calendar", { name: "openCalendar", date }),
  ];
}

function unpaidStatus(date: DateKey, today: DateKey, reviewFlag: boolean): CommitmentStatus {
  if (reviewFlag) return "needs-review";
  return date < today ? "overdue" : date === today ? "due-today" : "upcoming";
}

function build(ctx: DeriveContext, input: {
  id: string; date: DateKey; label: string; amountCents: number | null; status: CommitmentStatus;
  setAside: CommitmentStop["setAside"]; recurrenceId: string | null; boardKind: string; sourceRefs: SourceRef[];
}): CommitmentStop {
  const { id, date, status } = input;
  const attention = status === "overdue" || status === "needs-review";
  return {
    kind: "commitment", id, date, chapterId: monthKeyFromDateKey(date), label: input.label,
    amountCents: input.amountCents,
    amountBasis: input.amountCents === null ? "unknown" : status === "paid" ? "recorded" : "scheduled",
    sourceRefs: input.sourceRefs,
    major: attention || (input.amountCents !== null && input.amountCents >= MAJOR_COMMITMENT_CENTS),
    relation: relationOf(date, ctx.today),
    actions: commitmentActions(ctx, id, status, input.recurrenceId, date),
    status, setAside: status === "paid" ? null : input.setAside, recurrenceId: input.recurrenceId, boardKind: input.boardKind,
  };
}

function visitAppointmentId(ctx: DeriveContext, tx: Transaction): string | null {
  const household = ctx.presented!;
  for (const appointment of household.appointments ?? []) {
    if (tx.sourceId === appointment.id || tx.id === appointment.lastPostedTransactionId
      || household.claims.some(claim => claim.appointmentId === appointment.id && claim.expenseTransactionId === tx.id)) return appointment.id;
  }
  return null;
}

export function commitmentStops(ctx: DeriveContext): CommitmentStop[] {
  const out: CommitmentStop[] = [];
  const { today } = ctx;
  // Unrecorded bills: the day ledger's slips.
  for (const day of ctx.days.values()) {
    for (const slip of day.slips) {
      const weight = ctx.weight.get(weightKey(slip.id, day.date));
      const status = unpaidStatus(day.date, today, weight?.allowPost === false);
      const id = slip.recurrenceId ? journeyIds.bill(slip.recurrenceId, day.date) : journeyIds.billItem(baseItemId(slip.id, day.date), day.date);
      out.push(build(ctx, {
        id, date: day.date, label: slip.name, amountCents: slip.amountCents, status, setAside: slip.pot,
        recurrenceId: slip.recurrenceId, boardKind: slip.kind,
        sourceRefs: slip.recurrenceId ? [{ kind: "recurrence", id: slip.recurrenceId }] : [{ kind: "boardItem", id: slip.id }],
      }));
    }
  }
  // Visits: the Calendar's appointment rows. One occurrence identity for both states (PR #567 review): a visit is
  // keyed on the day it settles — the App's Post visit posts "today", so an overdue visit (on its own day this month,
  // or carried to today) is keyed on today, the same key its posting takes; due-today and upcoming visits keep their
  // own day. If that appointment also has an occurrence of its own today, the overdue one keeps its scheduled day.
  const visitRows = [...ctx.weight.values()].filter(row => row.item.source === "appointment" && row.item.appointmentId);
  const dueTodayVisit = new Set(visitRows.filter(row => (row.scheduledDate ?? row.date) === today).map(row => row.item.appointmentId!));
  for (const row of visitRows) {
    const appointmentId = row.item.appointmentId!;
    const scheduled = (row.scheduledDate ?? row.date) as DateKey;
    const status = unpaidStatus(scheduled, today, row.allowPost === false);
    const settles = scheduled < today && !dueTodayVisit.has(appointmentId) ? today : scheduled;
    out.push(build(ctx, {
      id: journeyIds.billItem(appointmentId, settles), date: row.date, label: row.item.title,
      amountCents: Number.isFinite(row.item.amountCents) ? row.item.amountCents : null, status, setAside: null,
      recurrenceId: null, boardKind: row.item.kind, sourceRefs: [{ kind: "boardItem", id: row.item.id }],
    }));
  }
  // Paid: recognised posted roots.
  if (ctx.presented) {
    const recurrences = new Map(ctx.presented.recurrences.map(row => [row.id, row]));
    for (const { tx, date } of ctx.recognised) {
      if (tx.type !== "expense") continue;
      if (tx.source === "recurring" && tx.sourceId) {
        const recurrence = recurrences.get(tx.sourceId);
        if (recurrence && recurrence.type !== "expense") continue;
        out.push(build(ctx, {
          id: journeyIds.bill(tx.sourceId, date), date, label: tx.note || recurrence?.note || "Bill", amountCents: tx.amountCents,
          status: "paid", setAside: null, recurrenceId: tx.sourceId, boardKind: recurrence?.kind ?? "bill",
          sourceRefs: [{ kind: "recurrence", id: tx.sourceId }, { kind: "transaction", id: tx.id }],
        }));
      } else if (tx.source === "visit") {
        const appointmentId = visitAppointmentId(ctx, tx);
        if (!appointmentId) continue;
        const appointment = ctx.presented.appointments.find(row => row.id === appointmentId);
        out.push(build(ctx, {
          id: journeyIds.billItem(appointmentId, date), date, label: appointment ? appointmentPublicTitle(appointment, "card") : "Visit", amountCents: tx.amountCents,
          status: "paid", setAside: null, recurrenceId: null, boardKind: "visit",
          sourceRefs: [{ kind: "boardItem", id: `${appointmentId}:${date}` }, { kind: "transaction", id: tx.id }],
        }));
      }
    }
  }
  // One stop per occurrence: a second posting for the same occurrence joins the first as a named source (both
  // transactions in `sourceRefs`; the status words count them). The figure stays the first posting's: a duplicated
  // $118 bill never reads "Paid $236".
  const byId = new Map<string, CommitmentStop>();
  for (const stop of out) {
    if (!ctx.monthSet.has(stop.chapterId)) continue;
    const prior = byId.get(stop.id);
    if (!prior) { byId.set(stop.id, stop); continue; }
    prior.sourceRefs = [...prior.sourceRefs, ...stop.sourceRefs.filter(ref => !prior.sourceRefs.some(seen => JSON.stringify(seen) === JSON.stringify(ref)))];
  }
  for (const stop of byId.values()) {
    // A duplicated posting is a Books question: its first action says where to look.
    if (stop.status === "paid" && stop.sourceRefs.filter(ref => ref.kind === "transaction").length > 1) {
      stop.actions = [action(stop.id, "review", "Review it in the Books", { name: "openBooks", ref: { kind: "register" } }, true), ...stop.actions.map(({ primary: _primary, ...rest }) => rest).filter(row => row.id !== `${stop.id}#books`)];
    }
  }
  return [...byId.values()];
}
