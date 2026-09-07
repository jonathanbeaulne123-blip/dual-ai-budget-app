import { describe, expect, it } from 'vitest';
import { evaluateLedgerTrial, percentiles } from '../scripts/lib/ledger-acceptance.mjs';

function trial() {
  const clock = { before: { at: 0, offsetMs: 0, uncertaintyMs: 1 }, after: { at: 10000, offsetMs: 0, uncertaintyMs: 1 } };
  return { requestedSamples: 100, transactionCount: 5056, release: 'test', url: 'https://example.invalid', condition: 'warm',
    participants: [{id:"a",memberHash:"a".repeat(64),subjectHash:"1".repeat(64)},{id:"b",memberHash:"b".repeat(64),subjectHash:"2".repeat(64)}], concurrentCommandIds:["sample-0","sample-1"],
    clocks: { a: clock, b: clock }, coldOpenMs: [300, 350], conflictDialogs: 0, lostOperations: 0,
    duplicatedOperations: 0, privacyLeaks: 0, concurrentPairs: 1, maxPairWindowMs: 100,
    samples: Array.from({ length: 100 }, (_, i) => ({ id: `sample-${i}`, author: i===1?'b':'a', partner: i===1?'a':'b', confirmAt: 1000,
      authorPaintAt: 1010, ackAt: 1100, savedPaintAt: 1110, partnerPaintAt: 1090, bytes: 1400, visibleRowMatches: 1, receiptMatches: 1 })) };
}
describe('commission latency evaluator', () => {
  it('allows partner paint before sender ACK and reports nearest-rank p99', () => {
    expect(evaluateLedgerTrial(trial()).pass).toBe(true);
    expect(percentiles(Array.from({length: 100}, (_, i) => i + 1))).toEqual({p50: 50, p95: 95, p99: 99, max: 100});
  });
  it('fails a fast wire ACK when Saved is painted late', () => {
    const data = trial(); for (const sample of data.samples) sample.savedPaintAt = 1400;
    expect(evaluateLedgerTrial(data).failures).toContain('Saved paint max budget missed.');
  });
  it('fails the previously reported 329ms partner result', () => {
    const data = trial(); for (const s of data.samples) s.partnerPaintAt = 1329;
    expect(evaluateLedgerTrial(data).failures).toContain('partner p95 budget missed.');
  });
  it('includes clock uncertainty rather than hiding it beneath the target', () => {
    const data = trial(); for (const s of data.samples) s.partnerPaintAt = 1249;
    expect(evaluateLedgerTrial(data).pass).toBe(false);
  });
  it('keeps measured ACK diagnostics when a row never paints, while refusing the trial', () => {
    const data = trial(); (data.samples[0] as any).partnerPaintAt = null;
    const result = evaluateLedgerTrial(data);
    expect(result.pass).toBe(false);
    expect(result.measuredSamples.ack).toBe(100);
    expect(result.measuredSamples.partner).toBe(99);
  });
  it('rejects Saved before durability, clock drift, and even one author-budget breach', () => {
    for (const mutate of [
      (d: ReturnType<typeof trial>) => { d.samples[0]!.savedPaintAt = 1090; },
      (d: ReturnType<typeof trial>) => { d.clocks.b.after.offsetMs = 101; },
      (d: ReturnType<typeof trial>) => { d.samples[0]!.authorPaintAt = 1017; },
    ]) { const data = trial(); mutate(data); expect(evaluateLedgerTrial(data).pass).toBe(false); }
  });
  it.each(['privacyLeaks','conflictDialogs','lostOperations','duplicatedOperations'] as const)('requires %s evidence', key => {
    const data = trial(); data[key] = 1; expect(evaluateLedgerTrial(data).pass).toBe(false);
  });
  it('rejects missing samples, duplicate identities, expired calibration, empty fixtures and shell-only startup', () => {
    for (const mutate of [
      (d: ReturnType<typeof trial>) => { d.samples.pop(); },
      (d: ReturnType<typeof trial>) => { d.samples[1]!.id = d.samples[0]!.id; },
      (d: ReturnType<typeof trial>) => { d.clocks.b.after.at = 1050; },
      (d: ReturnType<typeof trial>) => { d.transactionCount = 0; },
      (d: ReturnType<typeof trial>) => { d.coldOpenMs = []; },
      (d: ReturnType<typeof trial>) => { d.samples[0]!.visibleRowMatches = 0; },
    ]) { const data = trial(); mutate(data); expect(evaluateLedgerTrial(data).pass).toBe(false); }
  });
});
