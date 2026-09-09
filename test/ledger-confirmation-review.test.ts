import {describe,it,expect,vi} from 'vitest';
import {LedgerSyncClient} from '../src/ledgerSync/client.ts';
import {catalogHousehold,postEntry,splitForSync,type CommitResult} from '../src/core/index.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import {canonical} from '../src/ledgerSync/patch.ts';
// Unit boundary with the actual client confirm method; transport remains inert.
function fixture(){const h=catalogHousehold(),p=postEntry(h,{createdBy:'MEM-001',type:'income',date:'2026-09-08',amount:'100',accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES'}),client=new LedgerSyncClient({scope:{environment:h.environment,householdId:h.householdId,memberId:'MEM-001',subject:'test'},token:async()=>'',adopt:async()=>{},status:()=>{}});Object.assign(client,{store:{},replica:splitForSync(h,'MEM-001')});return {h,p,client};}
const intent=(p:CommitResult)=>canonical(capturedIntent(p.household)!.steps.map(({kind,args})=>({kind,args})));
describe('client confirmation review identity',()=>{
 it('refuses changed input before returning a cached accepted receipt',async()=>{const {h,p,client}=fixture(),id=crypto.randomUUID();Object.assign(client,{accepted:new Map([[id,p]]),confirmationIntents:new Map([[id,intent(p)]])});expect(await client.confirm(p.household,id)).toBe(p);const changed=postEntry(h,{createdBy:'MEM-001',type:'income',date:'2026-09-08',amount:'200',accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES'});await expect(client.confirm(changed.household,id)).rejects.toThrow('CONFIRMATION_REVIEW_CHANGED');});
 it('deduplicates simultaneous retries while keeping every caller attached to its receipt',async()=>{const {p,client}=fixture(),id=crypto.randomUUID();let accept!:(r:CommitResult)=>void;const queued=new Promise<CommitResult>(resolve=>accept=resolve),send=vi.fn(()=>queued);Object.assign(client,{queueConfirmation:send});const first=client.confirm(p.household,id),second=client.confirm(p.household,id);await Promise.resolve();expect(send).toHaveBeenCalledTimes(1);accept(p);expect(await first).toBe(p);expect(await second).toBe(p);});
});
