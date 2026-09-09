import { describe, expect, it } from 'vitest';
import { catalogHousehold, configureHouseholdFund, proposeHouseholdFundContribution, confirmHouseholdFundContribution, recordHouseholdFundReconciliation, projectHouseholdFund } from '../src/core/index.ts';
import { fundContributionReviewDigest } from '../src/core/fundContributionSources.ts';
import { recentFundMovement, fundRecordReading, fundMinuteBook } from '../src/core/fundLibraryReadings.ts';
import { OFFICE_INSTRUMENT_PURPOSE } from '../src/core/widgetPurpose.ts';
import { INSTRUMENT_IDS } from '../src/core/officeLayout.ts';
import { wideDrawerIds } from '../src/core/officeWide.ts';

function fixture(){return configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',createdBy:'MEM-001',openedOn:'2026-09-01'}).household;}
it('describes every real Office instrument',()=>{expect(Object.keys(OFFICE_INSTRUMENT_PURPOSE).sort()).toEqual([...INSTRUMENT_IDS].sort());for(const purpose of Object.values(OFFICE_INSTRUMENT_PURPOSE))expect(purpose.length).toBeGreaterThan(15);});
it('keeps Wallet, Shifts and Health discoverable outside the Paper mosaic',()=>{const ids=wideDrawerIds(['mail','claims','jars']);expect(ids).toEqual(expect.arrayContaining(['wallet','timesheet','lamp']));});
describe('Fund library accepted readings',()=>{
 it('excludes pending proposals and reconciles seven civil days to the accepted Fund balance',()=>{
  const h=fixture();const p=proposeHouseholdFundContribution(h,{memberId:'MEM-002',contributorMemberId:'MEM-002',amount:'100',date:'2026-09-03',source:{version:1,kind:'external-received',explanation:'Synthetic savings contribution.'}});
  expect(recentFundMovement(p.household,'2026-09-08').closingCents).toBe(0);
  const c=confirmHouseholdFundContribution(p.household,{memberId:'MEM-001',proposalEventId:p.postedIds[0]!,received:true,expectedProposalDigest:fundContributionReviewDigest(p.household,p.postedIds[0]!)}).household;
  const result=recentFundMovement(c,'2026-09-08');expect(result.start).toBe('2026-09-02');expect(result.days).toHaveLength(7);expect(result.days[1]?.cents).toBe(10000);
  expect(result.closingCents).toBe(projectHouseholdFund(c,'2026-09-08').operatingBalanceCents);
 });
 it('shows latest accepted activity and unchecked reconciliation without private totals',()=>{
  const h=recordHouseholdFundReconciliation(fixture(),{memberId:'MEM-001',date:'2026-09-07',bankTotal:'923.17'}).household;
  expect(fundRecordReading(h,'2026-09-08')).toMatchObject({latest:{kind:'reconciliation-recorded'},reconciliation:'Not independently checked'});
  expect(JSON.stringify(fundRecordReading(h,'2026-09-08'))).not.toContain('92317');expect(fundMinuteBook(h)).toEqual([]);
 });
});
