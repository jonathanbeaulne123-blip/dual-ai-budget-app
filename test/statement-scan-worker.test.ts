import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../workers/ledgerRoom.ts',()=>({LedgerRoom: class {}}));
vi.mock('../workers/ledgerSync.ts',()=>({handleLedgerSync:async()=>null}));
import worker from '../workers/site.js';
import { resetChatRateMemory } from '../workers/herculesGuard.js';
const origin='https://hearth-books.jonathan-beaulne123.workers.dev';
beforeEach(()=>resetChatRateMemory());
afterEach(()=>vi.unstubAllGlobals());
function row(date='2026-07-02') {return {date,amountCents:1200,direction:'debit',typeHint:'expense',merchant:'Cafe',description:'Payment',reference:'ref',confidence:90};}
async function scan(value:unknown) {
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({choices:[{message:{content:JSON.stringify(value)}}]})));
 return worker.fetch(new Request(origin+'/documents/scan',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mimeType:'image/jpeg',imageDataUrl:'data:image/jpeg;base64,AA==',documentHint:'bank-statement'})}),{OPENAI_API_KEY:'test',HERCULES_ALLOW_PAID_PROVIDERS:'true',ASSETS:{fetch:vi.fn()}});
}
it('preserves signed balances and explicit zero, but refuses invented dates and accounts beyond last four',async()=>{
 const response=await scan({documentKind:'credit-card-statement',currency:'CAD',accountLast4:'1111222233334444',rows:[row()],warnings:[],statement:{periodStart:'2026-07-01',periodEnd:'2026-07-31',openingDate:'2026-06-30',openingBalanceCents:0,closingDate:'2026-07-31',closingBalanceCents:-1200,complete:true,omittedRows:0}});
 const body=await response.json();
 expect(response.status).toBe(200);expect(body.result.accountLast4).toBe('4444');
 expect(body.result.statement).toMatchObject({openingBalanceCents:0,closingBalanceCents:-1200,complete:true});
});
it('reports dropped invalid rows as incomplete and keeps balances missing rather than zero',async()=>{
 const response=await scan({documentKind:'bank-statement',currency:'CAD',rows:[row(),row('unreadable')],warnings:[],statement:{periodStart:'2026-99-99',openingBalanceCents:null,complete:true,omittedRows:1}});
 const body=await response.json();
 expect(body.result.statement).toMatchObject({periodStart:null,openingBalanceCents:null,complete:false,omittedRows:2});
});
it('never returns a truncated 250-row prefix as a successful complete statement',async()=>{
 const response=await scan({documentKind:'bank-statement',currency:'CAD',rows:Array.from({length:251},()=>row()),warnings:[],statement:{complete:true,omittedRows:0}});
 expect(response.status).not.toBe(200);
});
