import{it,expect}from'vitest';import{catalogHousehold}from'../src/core/seed.ts';import{splitForSync}from'../src/core/sync.ts';import{prepareAction}from'../src/core/herculesActions.ts';import{executeHerculesAction}from'../src/core/herculesExecution.ts';import{commitCompanion,companionFor}from'../src/core/herculesCompanion.ts';import{capturedIntent}from'../src/ledgerSync/capture.ts';import{commandFromCapture,type Scope}from'../src/ledgerSync/protocol.ts';import{prepareCommand}from'../src/ledgerSync/authority.ts';
it('rejects compound claim-and-execute before it can bypass the current workspace review',async()=>{
 const h=catalogHousehold(),memberId='MEM-001',view='household',today='2026-09-10',submissionId=crypto.randomUUID();
 const scope:Scope={environment:h.environment,householdId:h.householdId,memberId,subject:'local:MEM-001',role:'owner',expires:Date.now()+60000,aclEpoch:1};
 const one=splitForSync(h,memberId),two=splitForSync(h,'MEM-002'),state={sequence:h.revision,shared:one.shared,personal:new Map([[memberId,one.personal],['MEM-002',two.personal]])};
 const review=prepareAction({household:h,memberId,view,today},'expense',{amount:'24',date:today,accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',split:memberId,note:'Synthetic compound probe'});
 const claimed=commitCompanion(h,{version:1,id:crypto.randomUUID(),scope:companionFor(h,memberId).scope,operation:{kind:'workflow.set',workflowId:'task-household',expectedRevision:0,view,generation:0,value:{version:1,actionId:'expense',view,generation:0,workspaceConfirmationId:submissionId,values:review.values,updatedAt:new Date().toISOString(),submission:{id:submissionId,review:JSON.stringify(review)}}}}).household;
 const result=executeHerculesAction(claimed,{memberId,view,today,submissionId,review});
 const command=await commandFromCapture(capturedIntent(result.household)!,{environment:h.environment,householdId:h.householdId},submissionId);
 expect(command.steps.map(s=>s.kind)).toEqual(['commitCompanion','executeHerculesAction']);
 await expect(prepareCommand(state,command,scope,()=>{})).rejects.toThrow('HERCULES_SINGLE_OPERATION_REQUIRED');
 expect(state.sequence).toBe(h.revision);
});
