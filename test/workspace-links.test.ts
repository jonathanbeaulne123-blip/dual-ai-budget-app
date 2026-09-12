import{it,expect}from'vitest';import{planLifeFixture}from'./fixtures/plan-life.ts';import{createWorkspaceProject}from'../src/workspace/contracts.ts';import{workspaceRecordOptions,projectMonthlyImplications}from'../src/workspace/links.ts';
it.each(['personal','household'] as const)('reads %s commitments from the current Plan once and keeps project estimates outside accounting',scope=>{
 const h=planLifeFixture(scope),before=JSON.stringify(h),p=createWorkspaceProject('life','Our next trip','MEM-001','2026-09-12T12:00:00Z');
 const link=workspaceRecordOptions(h,'MEM-001').find(l=>l.kind==='plan-line'&&l.recordId==='life-trip')!;expect(link).toBeTruthy();p.links=[link,{...link,id:'duplicate-reference'}];p.decisions=['Hypothetical full project cost: $9,999'];
 const info=projectMonthlyImplications(p,h,'MEM-001',scope,'2026-09','2026-09-12')!;expect(info.contributionCents).toBe(20000);expect(info.backedCents!+info.estimatedCents!).toBeLessThanOrEqual(20000);expect(JSON.stringify(h)).toBe(before);
 expect(projectMonthlyImplications(p,h,'MEM-001',scope,'2026-10','2026-09-12')?.contributionCents).toBeNull();expect(projectMonthlyImplications(p,h,'MEM-002',scope,'2026-09','2026-09-12')).toBeNull();
});
