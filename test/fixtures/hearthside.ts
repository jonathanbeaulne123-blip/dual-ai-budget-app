import { catalogHousehold, addGoal, configureHouseholdFund, proposeHouseholdFundContribution, confirmHouseholdFundContribution, allocateHouseholdFundSurplus, type Household } from '../../src/core/index.ts';
import { fundContributionReviewDigest } from '../../src/core/fundContributionSources.ts';
import { commitHearthside, type HearthsideOperation } from '../../src/hearthside/commands.ts';
import { clearCapturedIntent } from '../../src/ledgerSync/capture.ts';

export type HearthsideFixture = 'empty' | 'paid' | 'free' | 'interrupted' | 'difficult-month' | 'dense';
/** In-memory Development specimens only. No Auth, persistence or network is involved. */
export function hearthsideFixture(kind:HearthsideFixture):Household {
  let h=catalogHousehold();
  h.householdId=`HH-hearthside-${kind}`;
  h.members=h.members.map((m,i)=>({...m,name:i?'Sam (fictional)':'Alex (fictional)'}));
  const apply=(operation:HearthsideOperation,memberId='MEM-001')=>{clearCapturedIntent(h);h=commitHearthside(h,{version:1,id:crypto.randomUUID(),scope:{environment:h.environment,householdId:h.householdId,memberId},operation}).household;};
  if(kind==='empty')return h;
  let bank:string|undefined;
  if(kind==='paid'||kind==='dense') {
    h=configureHouseholdFund(h,{custodianMemberId:'MEM-001',openedOn:'2026-09-01',createdBy:'MEM-001'}).household;
    const offered=proposeHouseholdFundContribution(h,{memberId:'MEM-002',contributorMemberId:'MEM-002',date:'2026-09-12',amount:'250',source:{version:1,kind:'external-received',explanation:'Synthetic fixture savings; no connected account.'}});
    h=confirmHouseholdFundContribution(offered.household,{memberId:'MEM-001',proposalEventId:offered.postedIds[0]!,received:true,expectedProposalDigest:fundContributionReviewDigest(offered.household,offered.postedIds[0]!)}).household;
    const created=addGoal(h,{name:'A weekend by the sea',target:'400',shared:true});h=created.household;bank=created.postedIds[0]!;
    h=allocateHouseholdFundSurplus(h,{memberId:'MEM-001',date:'2026-09-12',allocations:[{goalId:bank,amount:'150'}]}).household;
  }
  const titles=kind==='dense'?['An evening at home','A weekend by the sea','The shelf we want to build','A birthday in our own way','A wish that can wait','A walk with no camera']: [kind==='paid'?'A weekend by the sea':kind==='difficult-month'?'Something gentle for this week':'An evening at home'];
  titles.forEach((title,i)=>apply({kind:'experience.save',expectedRevision:0,value:{version:1,id:`EXP-specimen-${i}`,revision:1,title,intention:i===5?'We can remember it in words.':kind==='difficult-month'?'Soup, a blanket, and no need to make more plans.':'A little time that feels like us.',state:kind==='difficult-month'||i===4?'paused':kind==='interrupted'?'preparing':'dreaming',horizon:i===4?'someday':i===1?'season':'tonight',createdBy:'MEM-001',references:bank&&i===0?[{kind:'bank',id:bank}]:[]}}));
  apply({kind:'note.save',expectedRevision:0,value:{version:1,id:'NOTE-specimen',revision:1,authorId:'MEM-002',text:'I put the good mugs out. See you at our table.',room:'common',experienceId:'EXP-specimen-0',archived:false}},'MEM-002');
  apply({kind:'memory.compose',expectedRevision:0,value:{version:1,id:'MEMORY-specimen',revision:1,title:'The rain and the record',date:'2026-09-12',experienceId:'EXP-specimen-0',media:[],designs:[],recollections:[{memberId:'MEM-001',text:'You turned the record over just as the rain started.'}],hideAmounts:true,approvals:[],withdrawn:false}});
  apply({kind:'memory.compose',expectedRevision:1,value:{...h.hearthside!.memories[0]!,revision:2,recollections:[...h.hearthside!.memories[0]!.recollections,{memberId:'MEM-002',text:'I remember that we let the washing-up wait.'}],approvals:[]}},'MEM-002');
  if(kind!=='interrupted')for(const member of ['MEM-001','MEM-002'])apply({kind:'memory.keep',expectedRevision:2,id:'MEMORY-specimen'},member);
  clearCapturedIntent(h);return h;
}
