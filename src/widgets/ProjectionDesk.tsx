import { formatCad } from "../core/money.ts";
import { leftoverProjection } from "../core/sitDown.ts";
import type { AuditOpinion } from "../core/statements.ts";
import type { Household } from "../core/types.ts";
import type { SillOverview } from "../core/sillOverview.ts";

export function OpinionGlance({ opinion }: { opinion: AuditOpinion }) {
  return <span>{opinion.kind}</span>;
}

export function OpinionBody({ opinion }: { opinion: AuditOpinion }) {
  return (
    <>
      <p className="blotter-net">{opinion.kind}</p>
      <p>{opinion.hercules}</p>
      <p className="muted">{opinion.cpa}</p>
    </>
  );
}

export function LeftoverGlance({ household, today }: { household: Household; today: string }) {
  const leftover = leftoverProjection(household, today);
  return <span>{formatCad(leftover.leftoverCents)}</span>;
}

export function LeftoverBody({ household, today, onSitDown }: { household: Household; today: string; onSitDown: () => void }) {
  const leftover = leftoverProjection(household, today);
  return (
    <>
      <p className="blotter-net">{formatCad(leftover.leftoverCents)}</p>
      <p className="muted">{leftover.formula}</p>
      {leftover.shortfallCents > 0 && <p className="muted">Shortfall {formatCad(leftover.shortfallCents)}. Do not invent CAD.</p>}
      <button type="button" className="chip" onClick={onSitDown}>Open sit-down</button>
    </>
  );
}

export function NextDueGlance({ sill }: { sill: SillOverview }) {
  const bill = sill.figures.find((row) => row.id === "bill");
  return <span>{bill?.value ?? "clear"}</span>;
}

export function NextDueBody({ sill, onCalendar }: { sill: SillOverview; onCalendar: () => void }) {
  const bill = sill.figures.find((row) => row.id === "bill");
  const visit = sill.figures.find((row) => row.id === "visit");
  return (
    <>
      <p>Next bill · {bill?.value ?? "clear"}</p>
      <p className="muted">Next visit · {visit?.value ?? "none"}</p>
      <button type="button" className="chip" onClick={onCalendar}>Calendar</button>
    </>
  );
}

export function SyncGlance({ household }: { household: Household }) {
  if (household.sharing.lastError) return <span>retry</span>;
  if (household.sharing.pending) return <span>sending</span>;
  if (household.sharing.linked) return <span>linked</span>;
  return <span>this phone</span>;
}

export function SyncBody({ household }: { household: Household }) {
  return (
    <>
      <p>{household.sharing.linked ? "Linked household." : "This phone only."}</p>
      <p className="muted">
        {household.sharing.lastError
          ? household.sharing.lastError
          : household.sharing.pending
            ? "A write is still travelling."
            : household.sharing.lastTransportAt
              ? `Last cloud touch ${household.sharing.lastTransportAt.slice(0, 16)}.`
              : "No cloud touch yet."}
      </p>
    </>
  );
}
