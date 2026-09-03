import { useId, type Ref } from "react";
import { FundContributionMotionCard } from "./HouseholdFundPanel.tsx";
import {
  formatCad,
  formatDateLabel,
  householdFundContributionMotions,
  monthKeyFromDateKey,
  motionConsequence,
  type CommitResult,
  type DateKey,
  type Household,
  type HouseholdFundContributionMotion,
} from "./core/index.ts";

/**
 * Every open and held contribution motion, what confirming each would
 * actually do (for the one member who can confirm), and what was recently
 * decided. The consequence is read-only preview text next to a card that
 * already carries its own Confirm/Hold/Release/Withdraw commands — this
 * stage adds nothing new that moves money.
 */

const RECENT_DECISIONS_LIMIT = 6;

function memberName(household: Household, memberId: string | null | undefined): string {
  return household.members.find((row) => row.id === memberId)?.name ?? "A member";
}

function MotionRow({
  motion, household, memberId, isCustodian, monthKey, today, onKitchen,
}: {
  motion: HouseholdFundContributionMotion;
  household: Household;
  memberId: string;
  isCustodian: boolean;
  monthKey: ReturnType<typeof monthKeyFromDateKey>;
  today: DateKey;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
}) {
  // A preview only ever shows on the card of the member who could act on
  // it — never on the raiser's side, where it would read as pressure.
  const consequence = isCustodian ? motionConsequence(household, monthKey, today, motion.proposal.id) : null;
  return (
    <div className="waiting-stage-row">
      {consequence ? <p className="desk-plate-detail waiting-consequence">{consequence.copy}</p> : null}
      <FundContributionMotionCard
        motion={motion}
        household={household}
        memberId={memberId}
        isCustodian={isCustodian}
        onCommand={onKitchen}
      />
    </div>
  );
}

export function WaitingStage({
  household, memberId, today, onKitchen, headingRef,
}: {
  household: Household;
  memberId: string;
  today: DateKey;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const headingId = useId();
  const isCustodian = household.householdFund?.custodianMemberId === memberId;
  const monthKey = monthKeyFromDateKey(today);
  const motions = householdFundContributionMotions(household);
  const open = motions.filter((row) => row.status === "open");
  const held = motions.filter((row) => row.status === "held");
  const decided = motions
    .filter((row) => row.status === "confirmed" || row.status === "withdrawn")
    .slice(0, RECENT_DECISIONS_LIMIT);

  return (
    <section className="waiting-stage" aria-labelledby={headingId}>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="fund-stage-heading">
        {isCustodian ? "Waiting on you" : "Contribution motions"}
      </h2>
      {open.length === 0 && held.length === 0 ? (
        <p className="desk-plate-empty">Nothing has moved.</p>
      ) : (
        <div className="household-fund-panel">
          {open.map((motion) => (
            <MotionRow
              key={motion.proposal.id}
              motion={motion}
              household={household}
              memberId={memberId}
              isCustodian={isCustodian}
              monthKey={monthKey}
              today={today}
              onKitchen={onKitchen}
            />
          ))}
          {held.length > 0 ? (
            <>
              <p className="desk-plate-kicker waiting-stage-kicker">Held</p>
              {held.map((motion) => (
                <MotionRow
                  key={motion.proposal.id}
                  motion={motion}
                  household={household}
                  memberId={memberId}
                  isCustodian={isCustodian}
                  monthKey={monthKey}
                  today={today}
                  onKitchen={onKitchen}
                />
              ))}
            </>
          ) : null}
        </div>
      )}
      {decided.length > 0 ? (
        <>
          <p className="desk-plate-kicker waiting-stage-kicker">Recent decisions</p>
          <ul className="waiting-decisions">
            {decided.map((motion) => (
              <li key={motion.proposal.id} className="waiting-decision">
                <span>
                  {memberName(household, motion.proposal.contributorMemberId ?? motion.proposal.createdBy)}
                  {" · "}
                  {formatCad(motion.proposal.amountCents)}
                </span>
                <span className="muted">
                  {motion.status === "confirmed" && motion.confirmation
                    ? `Confirmed ${formatDateLabel(motion.confirmation.date)}`
                    : motion.status === "withdrawn" && motion.withdrawal
                      ? `Withdrawn ${formatDateLabel(motion.withdrawal.date)}`
                      : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
