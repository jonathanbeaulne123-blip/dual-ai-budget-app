// @vitest-environment jsdom
import { expect,it,vi } from 'vitest';
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { LedgerSyncClient } from '../src/ledgerSync/client.ts';
import { LedgerPage } from '../src/Ledger.tsx';
import { catalogHousehold, postEntry,splitForSync } from '../src/core/index.ts';
import { difference } from '../src/ledgerSync/patch.ts';
import { type PendingPreview } from '../src/ledgerSync/optimistic.ts';
const entry=(note:string)=>({type:'expense' as const,date:'2026-09-07',amount:'1.23',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true,note});
async function setup(fail=false){
  Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
  const h=catalogHousehold(),split=splitForSync(h,'MEM-001');
  let preview:PendingPreview[]=[];const adoptions:any[]=[];let committed=false;
  const client=new LedgerSyncClient({scope:{environment:h.environment,householdId:h.householdId,memberId:'MEM-001',subject:'test'},token:async()=>'test',status:()=>{},pendingChanged:rows=>{preview=rows;},adopt:async(h,_status,rows)=>{adoptions.push({h,rows});}});
  const state=client as any;
  state.replica={sequence:h.revision,...split};
  state.store={enqueue:vi.fn(async()=>{if(fail)throw new Error('LOCAL_SAVE_FAILED');committed=true;}),save:vi.fn(async()=>{}),acknowledge:vi.fn(),close:()=>{},reject:vi.fn()};
  await state.household(state.replica);
  return {h,client,state,adoptions,get preview(){return preview;},get committed(){return committed;}};
}
it('shows durable validated pending rows without accepting balances; canonical correlation removes exactly once before ACK',async()=>{
  const f=await setup(), candidate=postEntry(f.h,entry('pending milk')),id=crypto.randomUUID();let resolved=false,queued=false;
  const promise=f.client.confirm(candidate.household,id,()=>{expect(f.committed).toBe(true);queued=true;}).then(()=>{resolved=true;}).catch(()=>{});
  await vi.waitFor(()=>expect(queued).toBe(true));
  expect(f.preview[0]!.rows[0]!.note).toBe('pending milk');expect(f.state.replica.shared.transactions).toHaveLength(f.h.transactions.length);expect(resolved).toBe(false);
  const remote=postEntry(f.h,{...entry('partner bread'),createdBy:'MEM-002'}).household;const r=splitForSync(remote,'MEM-001');
  await f.state.event({sequence:f.h.revision+1,shared:difference(f.state.replica.shared,r.shared),acceptedAt:'now'});
  expect(f.adoptions.at(-1).rows).toHaveLength(1);expect(resolved).toBe(false);
  const canonical=postEntry(remote,entry('pending milk'));const next=splitForSync(canonical.household,'MEM-001');
  await f.state.event({sequence:f.h.revision+2,shared:difference(r.shared,next.shared),personal:difference(r.personal,next.personal),memberId:'MEM-001',acceptedAt:'now',confirmation:{commandId:id,idMap:{[candidate.postedIds[0]!]:canonical.postedIds[0]!}}});
  expect(f.adoptions.at(-1).rows).toHaveLength(0);expect(f.adoptions.at(-1).h.transactions.filter((row:any)=>row.note==='pending milk')).toHaveLength(1);
  expect(f.state.store.save).toHaveBeenLastCalledWith(expect.objectContaining({sequence:f.h.revision+2}),[id]);
  expect(f.state.pending.has(id)).toBe(true);expect(resolved).toBe(false);
  await f.client.destroy();await promise;
});
it('failed local durability and invalid accounting never expose pending rows',async()=>{
  const f=await setup(true),candidate=postEntry(f.h,entry('failed'));
  await expect(f.client.confirm(candidate.household,crypto.randomUUID())).rejects.toThrow('LOCAL_SAVE_FAILED');expect(f.preview).toEqual([]);
  candidate.household.transactions.at(-1)!.amountCents++;
  await expect(f.client.confirm(candidate.household,crypto.randomUUID())).rejects.toThrow();expect(f.preview).toEqual([]);await f.client.destroy();
});
it('snapshot catchup resolves queued UUIDs rather than guessing from notes or amounts',async()=>{
  const f=await setup(), candidate=postEntry(f.h,entry('same note')),id=crypto.randomUUID();const promise=f.client.confirm(candidate.household,id).catch(()=>{});
  await vi.waitFor(()=>expect(f.preview).toHaveLength(1));
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({version:2,receipt:{id,actor:'MEM-001',sequence:1}}),{status:200})));
  expect(await f.state.resolveSnapshotPreviews({...f.state.replica,sequence:1})).toEqual([id]);
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'UNAUTHENTICATED'}),{status:401})));
  await expect(f.state.resolveSnapshotPreviews({...f.state.replica,sequence:1})).rejects.toThrow('UNAUTHENTICATED');
  expect(f.state.pending.has(id)).toBe(true);vi.unstubAllGlobals();await f.client.destroy();await promise;
});
it('renders pending amounts with no money actions and isolates Personal rows',async()=>{
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
  const h=catalogHousehold(),row=postEntry(h,entry('private pending')).household.transactions.at(-1)!;
  const pendingRows=[{commandId:crypto.randomUUID(),submittedAt:'now',rows:[{...row,visibility:'personal' as const}]}];
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const props={household:h,memberId:'MEM-001',view:'personal' as const,pendingRows,sourceFocus:null,onClearSource:()=>{},onChange:()=>{},onRemove:()=>{}};
  try{
    await act(async()=>root.render(createElement(LedgerPage,props)));
    expect(host.querySelector('[data-ledger-phase="pending"]')?.textContent).toContain('$1.23');
    expect(host.querySelector('[aria-label="Pending entries"] button')).toBeNull();
    await act(async()=>root.render(createElement(LedgerPage,{...props,memberId:'MEM-002'})));
    expect(host.querySelector('[data-ledger-phase="pending"]')).toBeNull();
    await act(async()=>root.render(createElement(LedgerPage,{...props,view:'household'})));
    expect(host.querySelector('[data-ledger-phase="pending"]')).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();}
});
