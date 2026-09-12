import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../workers/ledgerRoom.ts', () => ({LedgerRoom:class{}}));
vi.mock('../workers/geminiFree.js', async original => ({...await original<typeof import('../workers/geminiFree.js')>(),generateFreeGemini:vi.fn()}));
import worker from '../workers/site.js';
import { generateFreeGemini } from '../workers/geminiFree.js';
import { resetChatRateMemory } from '../workers/herculesGuard.js';
const origin='https://hearth-books.jonathan-beaulne123.workers.dev';
const request=(path:string,body:unknown)=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const env=()=>({HERCULES_GEMINI_FREE_ONLY:'true',HERCULES_ALLOW_EXTERNAL_PROVIDERS:'true',HERCULES_EXTERNAL_DATA_CLASSIFICATION:'synthetic',HERCULES_ALLOW_PAID_PROVIDERS:'true',DOCUMENT_SCAN_ALLOW_PAID:'true',GEMINI_API_KEY:'synthetic',OPENAI_API_KEY:'synthetic',GROQ_API_KEY:'synthetic',ANTHROPIC_API_KEY:'synthetic',AI:{run:vi.fn()},ASSETS:{fetch:vi.fn()}});
beforeEach(()=>{resetChatRateMemory();vi.mocked(generateFreeGemini).mockReset();vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>vi.unstubAllGlobals());
it.each(['/hercules/chat','/hercules/plan','/documents/scan'])('never falls through to another provider after free quota refusal: %s',async path=>{
  const e=env();vi.mocked(generateFreeGemini).mockRejectedValue(Error('GEMINI_FREE_DAILY_LIMIT'));
  await worker.fetch(request(path,{message:'How are the books?',briefing:'Synthetic books',grounded:{spoken:'A fictional example.'},figures:[],imageDataUrl:'data:image/jpeg;base64,AA=='}),e);
  expect(generateFreeGemini).toHaveBeenCalledOnce();expect(fetch).not.toHaveBeenCalled();expect(e.AI.run).not.toHaveBeenCalled();
});
it('retains shift-camera recovery when free Gemini misclassifies a usable tip sheet',async()=>{
  vi.mocked(generateFreeGemini).mockResolvedValue({candidates:[{content:{parts:[{text:JSON.stringify({documentKind:'receipt',currency:'CAD',rows:[],shiftDraft:{date:'2026-09-12',workedHours:6,salesCents:90000,foodSalesCents:70000,alcoholSalesCents:20000,cashTipsCents:1000,cardTipsCents:8000},ocrText:'EMPLOYEE SHIFT REPORT\nNet Sales 900.00\nTotal Paid Hours 6\nTip Summary Debit Tips 80.00 Cash Tips 10.00'})}]}}]});
  const response=await worker.fetch(request('/documents/scan',{imageDataUrl:'data:image/jpeg;base64,AA==',documentHint:'shift-report'}),env());
  const body=await response.json();expect(response.status).toBe(200);expect(body.provider).toBe('gemini');expect(body.result.documentKind).toBe('shift-report');expect(body.result.shiftDraft.salesCents).toBe(90000);
});
