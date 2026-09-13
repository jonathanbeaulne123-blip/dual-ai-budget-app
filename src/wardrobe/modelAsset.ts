import { Capacitor } from '@capacitor/core';

/** Android packages the raw models: its asset merger aliases `.glb.gz` to `.glb`. */
export async function readWardrobeModel(url: string, signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Closed', 'AbortError');
  const compressed = Capacitor.getPlatform() !== 'android' && typeof DecompressionStream !== 'undefined';
  const response = await fetch(url + (compressed ? '.gz' : ''), { signal });
  if (!response.ok) throw new Error('Wardrobe asset unavailable');
  let bytes = await response.arrayBuffer();
  const transferBytes = bytes.byteLength;
  // A web host may already have decoded the optional gzip response.
  const header = new Uint8Array(bytes);
  if (compressed && header[0] === 0x1f && header[1] === 0x8b) {
    bytes = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  if (signal.aborted) throw new DOMException('Closed', 'AbortError');
  return { bytes, transferBytes };
}
