import { expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { assertHorizonArtifact, serializeHorizonJson } from '../scripts/horizon/artifacts.mjs';

it('exports the observed Node 22 and Node 24 Crown coordinates identically', () => {
  const node22 = { positions: [123.31573154261511, 125.09744799217444, 137.82421636953356, 142.78873475000375] };
  const node24 = { positions: [123.3157315426151, 125.09744799217442, 137.8242163695336, 142.78873475000378] };
  const bytes = serializeHorizonJson(node22);
  expect(bytes).toEqual(serializeHorizonJson(node24));
  const exported = JSON.parse(bytes.toString()).positions as number[];
  exported.forEach((value, i) => expect(Math.abs(value - node22.positions[i]!)).toBeLessThanOrEqual(0.5e-9));
});

it('retains integers, IDs, nulls and omitted optional fields', () => {
  const asset = { id: 'horizon-geo-1', indices: [0, 1, 2], limit: Number.MAX_SAFE_INTEGER, missing: undefined, unavailable: null };
  expect(serializeHorizonJson(asset).toString()).toBe(JSON.stringify(asset));
});

it('still rejects actual geometry and topology changes', () => {
  const stored = serializeHorizonJson({ positions: [123.3157315426151], indices: [0, 1, 2] });
  for (const changed of [
    { positions: [123.3157325426151], indices: [0, 1, 2] },
    { positions: [123.3157315426151], indices: [0, 2, 1] },
  ]) expect(() => assertHorizonArtifact('world', stored, serializeHorizonJson(changed))).toThrow('Stale Horizon world asset');
});

it('compares gzip payloads across compression settings and rejects stale or corrupt streams', () => {
  const definition = serializeHorizonJson({ id: 'horizon-geo-1', positions: Array(100).fill(12.3456789) });
  const fast = gzipSync(definition, { level: 1 }), compact = gzipSync(definition, { level: 9 });
  expect(fast.equals(compact)).toBe(false);
  expect(() => assertHorizonArtifact('compressed', fast, compact)).not.toThrow();
  expect(() => assertHorizonArtifact('compressed', gzipSync(Buffer.from('{}')), compact)).toThrow('Stale Horizon compressed asset');
  const corrupt = Buffer.from(compact); corrupt[corrupt.length - 8]! ^= 1;
  expect(() => assertHorizonArtifact('compressed', corrupt, compact)).toThrow();
});

it('keeps the terrain binary comparison exact', () => {
  expect(() => assertHorizonArtifact('terrain', Buffer.from([1, 2, 3]), Buffer.from([1, 2, 4]))).toThrow('Stale Horizon terrain asset');
});
