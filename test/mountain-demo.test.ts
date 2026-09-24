import {describe,it,expect} from 'vitest';
import {createMountainDemo,mountainDemoIdentity} from './fixtures/mountainDemo.ts';
import {deriveHouseCondition} from '../src/core/houseCondition.ts';
import {confirmHouseholdFundContribution,projectHouseholdFund} from '../src/core/index.ts';
import {fundContributionReviewDigest} from '../src/core/fundContributionSources.ts';
import {buildBasinReading,createBasinView} from '../src/harbour/mountain/basin.ts';
const today='2026-09-24';
// Full accepted-ledger fixture generation takes ~25s alone and more under the four-worker gate.
// The gate retains its normal five-minute budget; these tests need time to assert their result.
describe('fictional mountain rehearsal',()=>{
  it('offers dated strain then ordinary accepted recovery without a presentation override',async()=>{
    const {household:h,proposalId}=await createMountainDemo(today,'weathered','test-one');
    const condition=deriveHouseCondition(h,{memberId:'MEM-001',today,freshness:'current'});
    expect(condition.state).toBe('weathered');expect(condition.days).toBe(30);
    const view=createBasinView(),before=buildBasinReading(h,today,'current');
    expect(before.pendingCents).toBe(200_000);expect(view(before).newFlows).toHaveLength(0);
    const committed=confirmHouseholdFundContribution(h,{memberId:'MEM-001',proposalEventId:proposalId,received:true,expectedProposalDigest:fundContributionReviewDigest(h,proposalId)}).household;
    // The loopback authority assigns the accepted shared revision after the ordinary command.
    const confirmed={...committed,revision:h.revision+1};
    expect(projectHouseholdFund(confirmed,today).operatingBalanceCents-before.balanceCents!).toBe(200_000);
    expect(deriveHouseCondition(confirmed,{memberId:'MEM-001',today,freshness:'current'}).state).toBe('settled');
    const next=view(buildBasinReading(confirmed,today,'current'));expect(next.newFlows).toHaveLength(1);expect(next.newFlows[0]!.kind).toBe('inlet');
    expect(view(buildBasinReading(confirmed,today,'current')).newFlows).toHaveLength(0);
  },60_000);
  it('keeps the healthy pending contribution out of accepted water and isolates new rehearsals',async()=>{
    const {household:h}=await createMountainDemo(today,'growing','test-two');
    expect(deriveHouseCondition(h,{memberId:'MEM-001',today,freshness:'current',growing:true}).state).toBe('growing');
    const p=projectHouseholdFund(h,today);expect(p.pendingContributionsCents).toBe(25_000);expect(p.operatingBalanceCents).toBe(760_000);
    expect(h.householdId).not.toBe(mountainDemoIdentity('weathered','test-two'));
    expect(()=>mountainDemoIdentity('growing','../../other')).toThrow();
  },60_000);
});
