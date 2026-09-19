import {expect,it} from 'vitest';
import {experiencePlanProjections} from '../src/hearthside/FutureLandscape.tsx';
import {acknowledgeHouseholdPlan} from '../src/core/index.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import {planLifeFixture} from './fixtures/plan-life.ts';
import type {SharedExperience} from '../src/hearthside/contracts.ts';
const intention:SharedExperience={version:1,id:'EXP-future',revision:1,title:'A slower week',intention:'Time to see what is around us.',state:'dreaming',horizon:'season',createdBy:'MEM-001',references:[]};
it('allows a free possibility without creating a Plan, date, Task or bank',async()=>{
 const h=planLifeFixture('household'),before=structuredClone(h),money=await financialAuditHash(h);
 expect(experiencePlanProjections(h,'MEM-001',intention,'2026-09-12')).toEqual([]);
 expect(h).toEqual(before);expect(await financialAuditHash(h)).toBe(money);
});
it('uses exact shared Plan acknowledgements and preserves a clear unavailable state for private or changed agreements',()=>{
 let h=planLifeFixture('household');const version=h.planVersions!.at(-1)!;
 const linked={...intention,references:[{kind:'plan-line' as const,id:'life-trip',planVersionId:version.id}]};
 expect(experiencePlanProjections(h,'MEM-001',linked,'2026-09-12')[0]!.projection).toBeNull();
 for(const memberId of ['MEM-001','MEM-002'])h=acknowledgeHouseholdPlan(h,{memberId,planVersionId:version.id,expectedDigest:version.digest,createdBy:memberId}).household;
 const projected=experiencePlanProjections(h,'MEM-001',linked,'2026-09-12')[0]!;
 expect(projected.projection?.kind).toBe('ready');expect(projected.projection?.through).toBe('2026-12-11');
 expect(projected.projection?.lines.find(row=>row.line.id==='life-trip')?.intendedCents).toBe(20000);
 expect(projected.projection?.lines.find(row=>row.line.id==='life-trip')?.line.decision?.targetCents).toBe(200000);
 const someday=experiencePlanProjections(h,'MEM-001',{...linked,horizon:'someday'},'2026-09-12')[0]!;expect(someday.projection?.through).toBe('2027-09-12');
 const changed={...h,planAcknowledgements:[]};expect(experiencePlanProjections(changed,'MEM-001',linked,'2026-09-12')[0]!.projection).toBeNull();
 const personal=planLifeFixture('personal'),privateId=personal.planVersions!.at(-1)!.id;
 const hidden=experiencePlanProjections(personal,'MEM-002',{...linked,references:[{kind:'plan-line',id:'life-trip',planVersionId:privateId}]},'2026-09-12')[0]!;
 expect(hidden.projection).toBeNull();expect(JSON.stringify(hidden)).not.toContain('A slower week away');
});
