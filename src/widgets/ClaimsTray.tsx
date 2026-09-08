import {RowReveal} from "../RowReveal.tsx";
import { formatCad, CLAIMS_EMPTY, claimsTraySentence, claimPublicLabel, claimRemainingCents, formatClaimStatus } from "../core/index.ts";
import type { Household } from "../core/types.ts";
import type { DateKey } from "../core/calendar.ts";

export function ClaimsGlance({ household }: { household: Household; today: DateKey }) {
  const remaining = (household.claims ?? []).reduce((sum, claim) => sum + claimRemainingCents(claim), 0);
  if (!remaining) return <span>clear</span>;
  return <span>{formatCad(remaining)} owing</span>;
}

export function ClaimsBody({
  memberId,view,
  household,
  today,
  busy,
  onAskSettle,
  onCalendar,
}: {
  household: Household;
  memberId:string;view:"household"|"personal";
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
      <div data-claim-focus tabIndex={-1}>
        <p className="muted">{CLAIMS_EMPTY}</p>
        <button type="button" className="cabinet-handle" onClick={onCalendar}>Appointments</button>
      </div>
    );
  }
  return (
    <div data-claim-focus tabIndex={-1}>
      <p className="muted">{claimsTraySentence(household, today)} Transfer when it lands. Never income.</p>
      {rows.slice(0,4).map(claim=><RowReveal key={JSON.stringify([household.environment,household.householdId,memberId,view,claim.id,claim.updatedAt,claimRemainingCents(claim)])} label={claimPublicLabel(household,claim,'card')} busy={busy} right={<button type='button' className='ghost' disabled={busy} aria-label={`Review transfer for ${claimPublicLabel(household,claim,'card')}`} onClick={()=>onAskSettle(claim.id,'')}>Landed · Review transfer</button>}>
        <div className='row'><span>{claimPublicLabel(household,claim,'card')} · {formatClaimStatus(claim.status)}</span><span>{formatCad(claimRemainingCents(claim))}</span></div>
      </RowReveal>)}
      <button type="button" className="cabinet-handle" onClick={onCalendar}>Appointments</button>
    </div>
  );
}
