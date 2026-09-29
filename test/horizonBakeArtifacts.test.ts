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

it('splits the definition into an index and one chunk per district, deterministically (R1-72)', async () => {
  const { splitHorizonDefinition } = await import('../scripts/horizon/artifacts.mjs');
  const { createHash } = await import('node:crypto');
  const solid = (id: string, districtId: string) => ({ id, districtId, positions: [0, 0, 0, 1, 0, 0, 0, 0, 1], indices: [0, 1, 2] });
  const world = { id: 'horizon', geographyRevision: 'horizon-geo-1', districts: [{ id: 'harbour', solidIds: ['a@harbour', 'b@harbour'] }, { id: 'crown', solidIds: ['c@crown'], children: [{ id: 'undercroft', solidIds: ['d@undercroft'] }] }], geometry: { solids: [solid('a@harbour', 'harbour'), solid('c@crown', 'crown'), solid('d@undercroft', 'crown'), solid('b@harbour', 'harbour')], sourceMap: {} }, pathGraph: { nodes: [], edges: [] } };
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex'), first = splitHorizonDefinition(world, sha), second = splitHorizonDefinition(structuredClone(world), sha);
  expect(first.index.equals(second.index)).toBe(true); expect(first.chunks.map(c => c.json.equals(second.chunks.find(d => d.districtId === c.districtId)!.json))).toEqual([true, true, true]);
  const index = JSON.parse(first.index.toString());
  expect(index.geometry.solids).toEqual([]); expect(index.pathGraph).toEqual(world.pathGraph);
  expect(index.chunks.map((c: { districtId: string; url: string; solids: number }) => [c.districtId, c.url, c.solids])).toEqual([['crown', '/horizon/world/horizon-geo-1/crown.json.gz', 1], ['harbour', '/horizon/world/horizon-geo-1/harbour.json.gz', 2], ['undercroft', '/horizon/world/horizon-geo-1/undercroft.json.gz', 1]]);
  for (const c of first.chunks) { const ref = index.chunks.find((r: { districtId: string }) => r.districtId === c.districtId); expect(ref.sha256).toBe(sha(c.json)); expect(ref.bytes).toBe(c.json.byteLength); }
  expect(JSON.parse(first.chunks.find(c => c.districtId === 'harbour')!.json.toString()).solids.map((s: { id: string }) => s.id)).toEqual(['a@harbour', 'b@harbour']);
});

it('keeps the slim Journey land in step with the served index and terrain (REVIEW M2; bake-terrain.mjs --check holds the bytes)', async () => {
  const { readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const { createHash } = await import('node:crypto');
  const { parseHorizonIndex } = await import('../src/house/world/horizonAssets.ts');
  const { decodeTerrainAsset } = await import('../src/harbour/horizon/land/terrain/asset.ts');
  const { extractJourneyLand } = await import('../src/journey/land/extract.ts');
  const { encodeJourneyLandSlim, JOURNEY_LAND_SLIM_URL } = await import('../src/journey/land/slim.ts');
  const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  const indexJson = gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz')), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const stored = readFileSync(`public${JOURNEY_LAND_SLIM_URL}`), sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const expected = serializeHorizonJson(encodeJourneyLandSlim(extractJourneyLand(parseHorizonIndex(ab(indexJson)), decodeTerrainAsset(ab(terrain), 'journey')), { index: '/horizon/world/horizon-geo-1.index.json.gz', indexSha256: sha(indexJson), terrainSha256: sha(terrain) }));
  expect(() => assertHorizonArtifact('compressed', stored, gzipSync(expected, { level: 9 }))).not.toThrow();
  expect(stored.byteLength).toBeLessThanOrEqual(120 * 1024);
});
