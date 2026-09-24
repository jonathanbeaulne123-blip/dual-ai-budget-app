import {generateDemoSuite} from '../../src/core/demoSuite.ts';
import {reopenBooksMonth,postEntry,projectHouseholdFund,proposeHouseholdFundContribution,recordHouseholdFundReconciliation} from '../../src/core/index.ts';
import {addDays,type DateKey} from '../../src/core/calendar.ts';
import {clearCapturedIntent} from '../../src/ledgerSync/capture.ts';
import type {Household} from '../../src/core/types.ts';

export type MountainDemoStory='growing'|'weathered';
export function mountainDemoIdentity(story:MountainDemoStory,run:string){
  if(!/^[a-z0-9-]{1,40}$/.test(run))throw Error('Invalid fictional rehearsal ID');
  return `HH-MOUNTAIN-${story.toUpperCase()}-${run}`;
}
/** Loopback review fixture only. Later contributions still use the ordinary Fund review/confirmation. */
export async function createMountainDemo(today:DateKey,story:MountainDemoStory,run:string){
  const fixture=await generateDemoSuite({today,profile:'habitat-well',seed:4242,buildSha:'mountain-rehearsal'});
  let household:Household={...fixture.household,householdId:mountainDemoIdentity(story,run),name:`Hearth Mountain · fictional ${story==='growing'?'shared life':'recorded strain'}`,linked:true,commandReceipts:[]};
  if(story==='weathered'){
    household=reopenBooksMonth(household,addDays(today,-35).slice(0,7)).household;
    const balance=projectHouseholdFund(household,today).operatingBalanceCents;
    household=postEntry(household,{type:'expense',date:addDays(today,-35),amount:(balance+100_000)/100,accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',visibility:'household',note:'Fictional recorded shared purchases for the mountain rehearsal',confirmDuplicate:true,funding:{fundId:household.householdFund!.id,fundedCents:balance+100_000,destinationAccountId:'ACC-VISA'}}).household;
  }
  const held=projectHouseholdFund(household,today);
  household=recordHouseholdFundReconciliation(household,{memberId:'MEM-001',date:today,bankTotal:(held.operatingBalanceCents+held.kittyCents)/100,personalRemainder:0,note:'Fictional current bank check for the mountain rehearsal'}).household;
  const contribution=proposeHouseholdFundContribution(household,{memberId:'MEM-002',contributorMemberId:'MEM-002',date:today,amount:story==='weathered'?2000:250,source:{version:1,kind:'external-received',explanation:'Fictional rehearsal money; no connected account or real transfer'}});
  household=contribution.household;clearCapturedIntent(household);
  return {household,proposalId:contribution.postedIds[0]!,story,run,today};
}
