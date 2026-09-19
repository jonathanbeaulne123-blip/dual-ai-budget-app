import { addDays, monthKeyFromDateKey, type DateKey } from './calendar.ts';
import { projectHouseholdFundAsOf } from './householdFund.ts';
import { projectKittyNest } from './kittyNest.ts';
import type { FundPulseFreshness } from './fundPulse.ts';
import type { Household } from './types.ts';

export type HouseCondition = { state: 'checking' | 'settled' | 'growing' | 'wilting' | 'weathered'; days: number; words: string };
/** Presentation bands only: seven consecutive dated deficits wilt; thirty weather the structure. */
export function houseConditionFromDays(input: { certain: boolean; growing: boolean; deficitsNewestFirst: readonly boolean[] }): HouseCondition {
  if (!input.certain) return { state: 'checking', days: 0, words: 'The house is waiting for a verified shared picture.' };
  let days = 0;
  for (const short of input.deficitsNewestFirst) { if (!short) break; days++; }
  if (days >= 30) return { state: 'weathered', days, words: 'The house shows wear after a month of uncovered, recorded Fund purchases. Review the shared plan when you are ready.' };
  if (days >= 7) return { state: 'wilting', days, words: 'The vine is resting after a week of uncovered, recorded Fund purchases. A smaller next step is welcome.' };
  return { state: input.growing ? 'growing' : 'settled', days, words: input.growing ? 'The house is growing with your shared work.' : 'The house is settled. Paying bills, using the buffer and enjoying a goal are part of living here.' };
}
/**
 * Accepted, dated shared facts only. Future obligations, expected income, a low balance,
 * partner activity and private books never cause damage. Successful spending that remains
 * covered is transformation. Unverified/offline/backing-unavailable pictures stay neutral.
 * No stored score, history mutation, financial writer or provider disclosure.
 */
export function deriveHouseCondition(h: Household, input: { memberId: string; today: DateKey; freshness: FundPulseFreshness; growing?: boolean; backingAvailable?: boolean }): HouseCondition {
  const read = (date: DateKey) => projectHouseholdFundAsOf(h, { anchor: date, period: monthKeyFromDateKey(date), asOf: date });
  const current = read(input.today);
  const backingAvailable = input.backingAvailable ?? projectKittyNest(h, input.memberId, 'household', input.today).categories.every(bank => bank.amountCents !== null);
  const certain = input.freshness === 'current' && current.configured && current.reconciliationTied === true && backingAvailable;
  const deficits: boolean[] = [];
  if (certain) for (let back = 0; back < 30; back++) {
    const date = addDays(input.today, -back);
    if (!h.householdFund || date < h.householdFund.openedOn) break;
    const p = back === 0 ? current : read(date);
    // Owed-back purchases are actual accepted obligations; future reserve/buffer targets are excluded.
    const short = p.operatingBalanceCents - p.transferDueCents + p.transferCreditCents < 0;
    deficits.push(short);
    if (!short) break;
  }
  return houseConditionFromDays({ certain, growing: input.growing === true && deficits[0] !== true, deficitsNewestFirst: deficits });
}
