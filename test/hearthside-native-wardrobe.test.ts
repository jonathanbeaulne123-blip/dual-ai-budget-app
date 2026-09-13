import { afterEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { readWardrobeModel } from '../src/wardrobe/modelAsset.ts';
import { readWardrobeAsset } from '../src/wardrobe/collectionLoader.ts';

const root = 'public/hercules-wardrobe/';
const url = '/hercules-wardrobe/hercules-cozy.v1.glb';
const bytes = (path: string) => new Uint8Array(readFileSync('public' + path));
const hash = (value: Uint8Array | ArrayBuffer) => createHash('sha256').update((value instanceof Uint8Array ? value : new Uint8Array(value))).digest('hex');
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('packaged native wardrobe assets', () => {
  it('loads every actual Android base and collection model without asking for excluded gzip twins', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    const fetcher = vi.fn(async (asset: string) => asset.endsWith('.gz')
      ? new Response('Not packaged', { status: 404 })
      : new Response(bytes(asset)));
    vi.stubGlobal('fetch', fetcher);
    const models = readdirSync(root).filter(file => file.endsWith('.glb'));
    expect(models).toHaveLength(11);
    for (const model of models) {
      const asset = '/hercules-wardrobe/' + model;
      const actual = await readWardrobeAsset(asset, new AbortController().signal);
      expect(hash(actual), model).toBe(hash(bytes(asset)));
      expect(new TextDecoder().decode(actual.slice(0, 4))).toBe('glTF');
    }
    expect(fetcher).toHaveBeenCalledTimes(models.length);
    expect(fetcher.mock.calls.every(([asset]) => asset.endsWith('.glb'))).toBe(true);
  });

  it.each(['web', 'ios'])('keeps %s gzip loading, actual model bytes and transfer measurement', async platform => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    const compressed = bytes(url + '.gz');
    const fetcher = vi.fn(async () => new Response(compressed));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    const result = await readWardrobeModel(url, signal);
    expect(fetcher).toHaveBeenCalledWith(url + '.gz', { signal });
    expect(hash(result.bytes)).toBe(hash(bytes(url)));
    expect(result.transferBytes).toBe(compressed.byteLength);
  });

  it('keeps browsers without decompression usable and accepts already decoded CDN bytes', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    const fetcher = vi.fn(async () => new Response(bytes(url)));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    expect(hash((await readWardrobeModel(url, signal)).bytes)).toBe(hash(bytes(url)));
    expect(fetcher).toHaveBeenLastCalledWith(url + '.gz', { signal });
    vi.stubGlobal('DecompressionStream', undefined);
    expect(hash((await readWardrobeModel(url, signal)).bytes)).toBe(hash(bytes(url)));
    expect(fetcher).toHaveBeenLastCalledWith(url, { signal });
  });

  it('does not publish late bytes after scope cancellation and reports unavailable assets', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    const controller = new AbortController();
    let finish!: (value: ArrayBuffer) => void;
    const decoding = new Promise<ArrayBuffer>(resolve => { finish = resolve; });
    const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: () => decoding }) as Response);
    vi.stubGlobal('fetch', fetcher);
    const result = readWardrobeModel(url, controller.signal);
    controller.abort();
    finish(new ArrayBuffer(4));
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await expect(readWardrobeModel(url, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockResolvedValue(new Response('', { status: 404 }));
    await expect(readWardrobeModel(url, new AbortController().signal)).rejects.toThrow('Wardrobe asset unavailable');
  });
});
