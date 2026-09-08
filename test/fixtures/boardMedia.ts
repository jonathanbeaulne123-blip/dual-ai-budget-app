import sharp from 'sharp';
export const mediaId = 'BM-a3b6c16d-73a1-4d2e-9c15-e6af8485d39e';
/** Synthetic solid pixels only; no actual household images. */
export async function jpeg(width = 12, height = 8, color = '#aabbcc'): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = await sharp({ create: { width, height, channels: 3, background: color } }).jpeg().toBuffer();
  return new Uint8Array(bytes);
}
