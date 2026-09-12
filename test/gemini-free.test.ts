import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { conversationModel, FLASH_LITE_MODEL, FLASH_MODEL, generateFreeGemini, nextPacificDay, pacificDay, quotaDecision, readFreeQuotaConfig, requestDigest } from '../workers/geminiFree.js';
const now = Date.parse('2026-09-12T18:00:00Z');
const config = { version: 1, tier: 'free', exclusive: true, projectId: 'hearth-test', keySha256: 'a'.repeat(64), verifiedAt: new Date(now-1000).toISOString(), expiresAt: '2026-09-30T00:00:00Z',
  models: { [FLASH_LITE_MODEL]: { rpm: 15, tpm: 250000, rpd: 500, usedOnVerificationDay: 0 }, [FLASH_MODEL]: { rpm: 5, tpm: 250000, rpd: 20, usedOnVerificationDay: 0 } } };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('uses Lite for everyday conversation and Flash for larger work', () => {
  expect(conversationModel('How are you?')).toBe(FLASH_LITE_MODEL);
  expect(conversationModel('Compare three vacation options')).toBe(FLASH_MODEL);
  expect(conversationModel('Help me', true)).toBe(FLASH_MODEL);
});
it('leaves 20% daily and minute headroom and seeds pre-activation usage', () => {
  expect(quotaDecision(config, FLASH_MODEL, 100, [], 15, now).ok).toBe(true);
  expect(quotaDecision(config, FLASH_MODEL, 100, [], 16, now).code).toBe('GEMINI_FREE_DAILY_LIMIT');
  expect(quotaDecision(config, FLASH_MODEL, 100, Array.from({length:4}, (_,i) => ({at:now-i,tokens:1})), 4, now).code).toBe('GEMINI_FREE_MINUTE_LIMIT');
  expect(quotaDecision(config, FLASH_LITE_MODEL, 200001, [], 0, now).ok).toBe(false);
  const seeded = structuredClone(config); seeded.models[FLASH_MODEL].usedOnVerificationDay=16;
  expect(quotaDecision(seeded, FLASH_MODEL, 10, [], 0, now).ok).toBe(false);
  expect(quotaDecision(seeded, FLASH_MODEL, 10, [], 0, now+86400000).ok).toBe(true);
});
it('uses Pacific midnight with daylight saving rather than UTC or Toronto', () => {
  expect(pacificDay(Date.parse('2026-09-13T06:59:00Z'))).toBe('2026-09-12');
  expect(nextPacificDay(Date.parse('2026-03-08T08:00:00Z'))).toBe(Date.parse('2026-03-09T07:00:00Z'));
  expect(nextPacificDay(Date.parse('2026-11-01T07:00:00Z'))).toBe(Date.parse('2026-11-02T08:00:00Z'));
});
it('fails closed on missing, stale, paid, shared or malformed quota attestation', () => {
  for (const bad of [{}, {...config,tier:'paid'}, {...config,exclusive:false}, {...config,expiresAt:'invalid'}, {...config,expiresAt:'2026-01-01'}, {...config,models:{}}])
    expect(() => readFreeQuotaConfig({HERCULES_GEMINI_FREE_QUOTAS:JSON.stringify(bad)},now)).toThrow('GEMINI_FREE_CONFIGURATION_REQUIRED');
});
async function fixture() {
  const calls: any[] = [], reserve = vi.fn(async(request) => {calls.push(request); return {ok:true};}), pauseUntilReset=vi.fn();
  const env = {HERCULES_GEMINI_FREE_ONLY:'true',HERCULES_GEMINI_FREE_KEY:'synthetic-key',HERCULES_GEMINI_FREE_QUOTAS:JSON.stringify({...config,keySha256:await requestDigest('synthetic-key')}),HERCULES_GEMINI_QUOTA:{idFromName:vi.fn(name=>name),get:()=>({reserve,pauseUntilReset,begin:async()=>({ok:true,attempt:crypto.randomUUID()}),release:async()=>{}})}};
  const body={contents:[{role:'user',parts:[{text:'A fictional lesson'}]}],generationConfig:{maxOutputTokens:1000}};
  const fetcher=vi.fn(async (url:string, _init?: RequestInit) => new Response(JSON.stringify(url.endsWith(':countTokens')?{totalTokens:100}:{candidates:[{content:{parts:[{text:'Ready',thoughtSignature:'preserved'}]}}]})));
  vi.stubGlobal('fetch',fetcher);
  return {env,body,fetcher,reserve,pauseUntilReset,calls};
}
it('admits count and generation separately with the complete native envelope and no hidden retry', async () => {
  const f=await fixture();const reserveRun=vi.fn();const result=await generateFreeGemini(f.env,FLASH_LITE_MODEL,f.body,reserveRun,'run/step');
  expect(f.env.HERCULES_GEMINI_QUOTA.idFromName).toHaveBeenCalledWith('hearth-test');
  expect(f.calls.map(c=>[c.id.split(':').at(-1),c.tokens])).toEqual([['count',0],['generate',169]]);
  expect(reserveRun).toHaveBeenCalledWith(100,1000);expect(f.fetcher).toHaveBeenCalledTimes(2);
  expect(result.candidates[0].content.parts[0].thoughtSignature).toBe('preserved');
});
it.each(['count', 'generate'])('rejects %s redirects with the Workers-compatible manual policy and no retry', async phase => {
  const f=await fixture();
  if (phase === 'generate') f.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({totalTokens:100})));
  f.fetcher.mockResolvedValueOnce(new Response(null,{status:302,headers:{Location:'https://untrusted.example/collect'}}));
  await expect(generateFreeGemini(f.env,FLASH_LITE_MODEL,f.body,undefined,'redirect')).rejects.toThrow('GEMINI_FREE_PROVIDER_UNAVAILABLE');
  expect(f.fetcher).toHaveBeenCalledTimes(phase === 'count' ? 1 : 2);
  for (const [url,init] of f.fetcher.mock.calls) {
    expect(new URL(url).origin).toBe('https://generativelanguage.googleapis.com');
    expect(init?.redirect).toBe('manual');
  }
});
it('makes zero provider requests for a quota or key refusal', async () => {
  const f=await fixture();f.reserve.mockResolvedValueOnce({ok:false,code:'GEMINI_FREE_DAILY_LIMIT'} as any);
  await expect(generateFreeGemini(f.env,FLASH_MODEL,f.body,undefined,'step')).rejects.toThrow('GEMINI_FREE_DAILY_LIMIT');expect(f.fetcher).not.toHaveBeenCalled();
  await expect(generateFreeGemini({...f.env,HERCULES_GEMINI_FREE_KEY:'changed'},FLASH_MODEL,f.body,undefined,'other')).rejects.toThrow('GEMINI_FREE_KEY_CHANGED');expect(f.fetcher).not.toHaveBeenCalled();
});
it('never generates after missing count or run-budget refusal', async () => {
  const f=await fixture();f.fetcher.mockResolvedValueOnce(new Response('{}'));
  await expect(generateFreeGemini(f.env,FLASH_MODEL,f.body,undefined,'bad-count')).rejects.toThrow('TOKEN_COUNT_UNAVAILABLE');
  await expect(generateFreeGemini(f.env,FLASH_MODEL,f.body,async()=>{throw Error('RUN_BUDGET_EXCEEDED');},'budget')).rejects.toThrow('RUN_BUDGET_EXCEEDED');
  expect(f.fetcher.mock.calls.every(([url])=>url.endsWith(':countTokens'))).toBe(true);
});
it('debits uncertain calls and stops the project on upstream quota exhaustion', async () => {
  const f=await fixture();f.fetcher.mockRejectedValueOnce(Error('timeout'));
  await expect(generateFreeGemini(f.env,FLASH_MODEL,f.body,undefined,'timeout')).rejects.toThrow('timeout');expect(f.calls).toHaveLength(1);
  f.fetcher.mockResolvedValueOnce(new Response('{}',{status:429}));
  await expect(generateFreeGemini(f.env,FLASH_MODEL,f.body,undefined,'limited')).rejects.toThrow('GEMINI_FREE_PROVIDER_LIMIT');expect(f.pauseUntilReset).toHaveBeenCalledOnce();expect(f.fetcher).toHaveBeenCalledTimes(2);
});
