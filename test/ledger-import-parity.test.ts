import { expect, it } from 'vitest';
import { seedDemoHousehold, splitForSync } from '../src/core/index.ts';
import { compareImportParity, IMPORT_FIELD_POLICY } from '../src/ledgerSync/importParity.ts';
import { difference, project } from '../src/ledgerSync/patch.ts';
import { encodeMessage, MessageReader } from '../src/ledgerSync/wire.ts';
const fixture = (memberId='MEM-001') => {
  const h=seedDemoHousehold({today:'2026-08-21'});
  h.commandReceipts=[{confirmationId:crypto.randomUUID(),identityHash:'legacy',auditHash:'hash',commandKind:'postEntry',postedIds:[h.transactions[0]!.id],revision:h.revision,acceptedAt:'2026-08-21T12:00:00Z'}];
  const source=splitForSync(h,memberId);
  return {h,source,target:{shared:{...source.shared,commandReceipts:[]},personal:source.personal},importedReceipts:h.commandReceipts,reserved:async()=>true,manifestCount:1,manifestExact:true,today:'2026-09-07' as const};
};
it('proves full scoped fields, cents, journal, Fund and read models for both members through binary transport',async()=>{
  for(const member of ['MEM-001','MEM-002']){
    const input=fixture(member), reader=new MessageReader();let target:any;
    for(const frame of await encodeMessage(input.target))target=await reader.accept(frame)??target;
    const report=await compareImportParity({...input,target});
    expect(report.differences).toEqual([]);expect(report.pass).toBe(true);expect(report.financial).toHaveLength(8);
    expect(report.fields.filter(row=>row.field.startsWith('household.'))).toHaveLength(Object.keys(IMPORT_FIELD_POLICY).length);
    const others=input.h.transactions.filter(row=>row.visibility==='personal'&&row.createdBy!==member).map(row=>row.id);
    for(const id of others) expect(JSON.stringify(target)).not.toContain(id);
    expect(JSON.stringify(report)).not.toContain(input.h.transactions[0]!.note);
  }
});
it('detects mutation or loss of every persisted envelope field, order and receipt relocation',async()=>{
  const input=fixture();
  for(const scope of ['shared','personal'] as const)for(const field of Object.keys(input.target[scope])){
    if(field==='commandReceipts')continue;
    const target=structuredClone(input.target);if ((target[scope] as any)[field] === undefined) (target[scope] as any)[field]=null; else delete (target[scope] as any)[field];
    // Scope corruption may make assembly reject outright, which is also fail-closed.
    let rejected=false;try{rejected=!(await compareImportParity({...input,target})).pass;}catch{rejected=true;}
    expect(rejected,`${scope}.${field}`).toBe(true);
  }
  const reversed=structuredClone(input.target);reversed.shared.transactions.reverse();
  expect((await compareImportParity({...input,target:reversed})).pass).toBe(false);
  expect((await compareImportParity({...input,importedReceipts:[]})).pass).toBe(false);
  expect((await compareImportParity({...input,reserved:async()=>false})).pass).toBe(false);
  expect((await compareImportParity({...input,manifestExact:false})).pass).toBe(false);
},30000);
it('detects cross-member Personal rows and row-patch loss',async()=>{
  const input=fixture(), target=structuredClone(input.target);
  target.personal.transactions.push(...splitForSync(input.h,'MEM-002').personal.transactions);
  expect((await compareImportParity({...input,target})).pass).toBe(false);
  const removed={...input.target.shared,transactions:input.target.shared.transactions.slice(1)};
  const patched=project(input.target.shared,difference(input.target.shared,removed));
  expect((await compareImportParity({...input,target:{...input.target,shared:patched}})).pass).toBe(false);
});
it('reports normalization loss across the entire frozen-source decoder, including omitted legacy conflicts',async()=>{
  const {vi}=await import('vitest');const {importLegacy}=await import('../workers/ledgerSyncAuth.ts');
  const input=fixture();const raw={...input.source.shared,conflicts:[{id:'legacy-conflict',field:'transactions',resolved:false}]};
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({shared:JSON.stringify(raw),personal:JSON.stringify(input.source.personal)}),{status:200})));
  let differences:string[]=[];
  try{await importLegacy({SUPABASE_URL:'https://test.invalid',SUPABASE_PUBLISHABLE_KEY:'test'}, {environment:input.h.environment,householdId:input.h.householdId,memberId:'MEM-001',subject:'test',role:'owner',expires:Date.now()+60000,aclEpoch:1},'test',crypto.randomUUID(),value=>{differences=value;});
    expect(differences).toContain('assembled.conflicts');
  }finally{vi.unstubAllGlobals();}
});
it('normal hosted decoder has no unexplained loss and refuses duplicate or colliding row identities',async()=>{
  const {vi}=await import('vitest');const {importLegacy}=await import('../workers/ledgerSyncAuth.ts');const input=fixture();
  let rawShared:any=input.source.shared,rawPersonal:any=input.source.personal;
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({shared:JSON.stringify(rawShared),personal:JSON.stringify(rawPersonal)}),{status:200})));
  const load=async()=>{let differences:string[]=[];await importLegacy({SUPABASE_URL:'https://test.invalid',SUPABASE_PUBLISHABLE_KEY:'test'},{environment:input.h.environment,householdId:input.h.householdId,memberId:'MEM-001',subject:'test',role:'owner',expires:Date.now()+60000,aclEpoch:1},'test',crypto.randomUUID(),value=>{differences=value;});return differences;};
  try{
    expect(await load()).toEqual([]);
    rawShared={...input.source.shared,transactions:[...input.source.shared.transactions,input.source.shared.transactions[0]]};
    await expect(load()).rejects.toThrow('IMPORT_ROW_ID_COLLISION');
    rawShared=input.source.shared;rawPersonal={...input.source.personal,transactions:[...input.source.personal.transactions,{...input.source.shared.transactions[0],visibility:'personal',createdBy:'MEM-001'}]};
    await expect(load()).rejects.toThrow('IMPORT_ROW_ID_COLLISION');
  }finally{vi.unstubAllGlobals();}
});
