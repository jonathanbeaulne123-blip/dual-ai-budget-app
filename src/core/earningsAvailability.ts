import type { DateKey } from "./calendar.ts";
import type { ScenarioBasis, ScenarioRefusal } from "./fundScenario.ts";

/** Source evidence and an election are separate. A receipt alone proves no remaining cash. */
export type ScenarioSourceRef = Readonly<{
  kind: "accepted-account" | "accepted-receivable" | "named-route" | "member-assumption";
  id: string;
  ownerMemberId: string;
  factsDigest: string;
}>;
export type AvailableTranche = Readonly<{
  id: string;
  source: ScenarioSourceRef;
  component: "cash-tips" | "card-tips" | "wages" | "cash" | "net-tips";
  availableOn: DateKey;
  /** Both paths use one supported date; a range of dates requires a later policy. */
  lowerCents: number;
  expectedCents: number;
  capacityGroupId: string;
  evidence: "accepted-remaining-cash" | "recorded-payout-assumption" | "member-assumption" | "forecast-availability";
  deductions: readonly Readonly<{
    sourceRuleId: string;
    timing: "immediate" | "withheld" | "deferred";
    lowerCents: number;
    expectedCents: number;
    /** Net forecast tips have already deducted tip-out; do not deduct them again. */
    alreadyIncluded: boolean;
  }>[];
}>;

/** Constructed by the accepted-source resolver, never from unverified UI amount arrays. */
export type EarningsAvailability =
  | Readonly<{ kind: "unavailable"; reasons: readonly ScenarioRefusal[] }>
  | Readonly<{
      kind: "available";
      basis: ScenarioBasis;
      modelVersion: string;
      tranches: readonly AvailableTranche[];
      /** Several tranches may draw from one fungible pool; its total cap applies once. */
      capacityGroups: readonly Readonly<{ id: string; lowerCents: number; expectedCents: number }>[];
      assumptions: readonly string[];
    }>;

export type CashAvailabilityAssumption = Readonly<{
  accountId: string;
  reviewedFactsDigest: string;
  chosenByMemberId: string;
  availableCents: number;
  /** Exact acknowledgement: after earlier contributions, spending, goals and other commitments. */
  acknowledgesUnattributedCommitments: true;
}>;
