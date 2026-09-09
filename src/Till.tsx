import type { KitchenCommand } from "./kitchenCommand.ts";
import { type ReactNode } from "react";
import { FundContributionMotionCard } from "./HouseholdFundPanel.tsx";
import {
  SWIPE_COPY,
  countable,
  formatCad,
  monthKeyFromDateKey,
  monthSummary,
  swipeBelongsOnSharedHome,
  tillActionableMotions,
  type DateKey,
  type Household,
} from "./core/index.ts";
import {activeHouseholdFundEvents,householdFundOperatingDelta} from "./core/householdFund.ts";
import "./till.css";

export const TILL_COPY = {
  waiting: "Waiting on you",
  nothingMoved: "Nothing has moved.",
  spent: (amount: string) => `The house has spent ${amount} so far.`,
  empty: "Nothing yet. When you spend on the house, tap the button and I'll write it down.",
  offline: "Saved here. It'll sync when you're back.",
  seeEverything: "see everything",
  homeDoor: "Till",
} as const;

export const TILL_HOME_HASH = "#till";
export const TILL_DESK_HASH = "#home";

export function Till({
  household,
  memberId,
  today,
  busy,
  showSwipe,
  offlinePending,
  homeHref = TILL_DESK_HASH,
  strip,
  onOpenSwipe,
  onSeeEverything,
  onCommand,
}: {
  household: Household;
  memberId: string;
  today: DateKey;
  busy: boolean;
  showSwipe: boolean;
  offlinePending: boolean;
  homeHref?: string;
  strip?: ReactNode;
  onOpenSwipe: () => void;
  onSeeEverything: () => void;
  onCommand: KitchenCommand;
}) {
  const isCustodian = swipeBelongsOnSharedHome(memberId, household.householdFund?.custodianMemberId);
  const motions = tillActionableMotions(household, memberId);
  const month = monthKeyFromDateKey(today);
  const hasActivity = household.transactions.some(tx => countable(tx) && tx.date.slice(0, 7) === month)
    || activeHouseholdFundEvents(household,household.householdFund?.id).some(event=>event.date.slice(0,7)===month&&householdFundOperatingDelta(event)!==0);
  const spentCents = monthSummary(household, month).expenseActualCents;
  const spentLine = TILL_COPY.spent(formatCad(spentCents));

  return (
    <section className="till" aria-label="Till" data-till="surface">
      {strip}
      {showSwipe ? (
        <button
          type="button"
          className="swipe-open"
          data-till="swipe"
          disabled={busy}
          onClick={onOpenSwipe}
        >
          {SWIPE_COPY.action}
        </button>
      ) : null}
      {motions.length > 0 ? (
        <section className="till-waiting" data-till="waiting" aria-label={TILL_COPY.waiting}>
          <h2>{TILL_COPY.waiting}</h2>
          {motions.map((motion) => (
            <FundContributionMotionCard
              key={motion.proposal.id}
              motion={motion}
              household={household}
              memberId={memberId}
              isCustodian={isCustodian}
              onCommand={onCommand}
            />
          ))}
        </section>
      ) : null}
      {!hasActivity && <p className="till-custody" data-till="custody">{TILL_COPY.nothingMoved}</p>}
      <p className="till-spend" data-till="spend">{spentLine}</p>
      {!hasActivity ? (
        <p className="till-empty" data-till="empty">{TILL_COPY.empty}</p>
      ) : null}
      {offlinePending ? (
        <p className="till-offline" data-till="offline">{TILL_COPY.offline}</p>
      ) : null}
      <a
        className="till-see-everything"
        data-till="desk"
        href={homeHref}
        onClick={(event) => {
          event.preventDefault();
          onSeeEverything();
        }}
      >
        {TILL_COPY.seeEverything}
      </a>
    </section>
  );
}
