import {readFile} from 'node:fs/promises';
import {expect,it,vi} from 'vitest';

const macroHeight=vi.hoisted(()=>vi.fn());
vi.mock('../src/harbour/mountain/natural.ts',async importOriginal=>{
  const natural=await importOriginal<typeof import('../src/harbour/mountain/natural.ts')>();
  return {...natural,macroHeight};
});

it('loads a revision-keyed binary within budget and rejects stale geography',async()=>{
  const {decodeTerrainAsset,terrainAssetUrl}=await import('../src/harbour/mountain/terrainAsset.ts');
  expect(terrainAssetUrl).toContain('hearth-mountain-geo-2.bin');
  const bytes=await readFile(new URL('../public/mountain/terrain/hearth-mountain-geo-2.bin',import.meta.url));
  expect(bytes.byteLength).toBeLessThanOrEqual(2_500_000);
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
  expect(decodeTerrainAsset(buffer).revision).toBe('hearth-mountain-geo-2');
  expect(()=>decodeTerrainAsset(buffer,'hearth-mountain-geo-1')).toThrow('Stale mountain terrain asset');
});

it('does no authored terrain bake when imported at runtime',async()=>{
  delete process.env.HEARTH_REBAKE;
  const {BASE_GRID}=await import('../src/harbour/mountain/terrainBase.ts');
  expect(BASE_GRID.data.length).toBe(147_167);
  expect(macroHeight).not.toHaveBeenCalled();
});
