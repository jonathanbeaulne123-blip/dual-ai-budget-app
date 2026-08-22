import { formatCad, CLAIMS_EMPTY, claimsTraySentence, claimPublicLabel, claimRemainingCents, formatClaimStatus } from "../core/index.ts";
import type { Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";

export function ClaimsGlance({ household }: { household: Household; today: DateKey }) {
  const remaining = (household.claims ?? []).reduce((sum, claim) => sum + claimRemainingCents(claim), 0);
  if (!remaining) return <span>clear</span>;
  return <span>{formatCad(remaining)} owing</span>;
}

export function ClaimsBody({
  household,
  today,
  busy,
  onAskSettle,
  onCalendar,
}: {
  household: Household;
  today: DateKey;
  busy: boolean;
  onAskSettle: (claimId: string, summary: string) => void;
  onCalendar: () => void;
}) {
  const rows = (household.claims ?? [])
    .filter((claim) => claimRemainingCents(claim) > 0)
    .sort((left, right) => claimRemainingCents(right) - claimRemainingCents(left));
  if (!rows.length) {
    return (
      <>
        <p className="muted">{CLAIMS_EMPTY}</p>
        <button type="button" className="cabinet-handle" onClick={onCalendar}>Appointments</button>
      </>
    );
  }
  return (
    <>
      <p className="muted">{claimsTraySentence(household, today)} Transfer when it lands. Never income.</p>
      {rows.slice(0, 4).map((claim) => (
        <div className="row" key={claim.id}>
          <span>{claimPublicLabel(household, claim, "card")} · {formatClaimStatus(claim.status)}</span>
          <span>{formatCad(claimRemainingCents(claim))}</span>
        </div>
      ))}
      {rows.slice(0, 2).map((claim) => (
        <button
          key={`land-${claim.id}`}
          type="button"
          className="chip"
          disabled={busy}
          onClick={() => onAskSettle(claim.id, `This transfers ${formatCad(claimRemainingCents(claim))} from Benefits owing into chequing. Not income.`)}
        >
          Landed
        </button>
      ))}
      <button type="button" className="cabinet-handle" onClick={onCalendar}>Appointments</button>
    </>
  );
}
