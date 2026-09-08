import { BoardMediaError, DISPLAY_MAX_BYTES, DISPLAY_MAX_DIMENSION, SOURCE_MAX_BYTES } from './types';

const invalid = () => new BoardMediaError('INVALID_IMAGE', 'Choose a valid JPEG, PNG or WebP photo.');
export function sourceImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** Bounded JPEG structure/dimension check. Reject ancillary metadata and trailing payloads.
 * Browser decoding before canvas reencoding is the pixel-level validity check. */
export function displayJpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  const { width, height } = inspectDisplayJpeg(bytes);
  return { width, height };
}
function inspectDisplayJpeg(bytes: Uint8Array, removeMetadata = false): { width: number; height: number; removed: Array<[number, number]> } {
  const removed: Array<[number, number]> = [];
  if (bytes.length > DISPLAY_MAX_BYTES) throw new BoardMediaError('DISPLAY_TOO_LARGE', 'Prepared photo must be at most 2 MiB.');
  if (sourceImageType(bytes) !== 'image/jpeg') throw invalid();
  let p = 2, width = 0, height = 0, scanned = false, quantized = false, huffman = false;
  while (p < bytes.length) {
    const markerStart = p;
    if (bytes[p++] !== 255) throw invalid();
    while (bytes[p] === 255) p++;
    const marker = bytes[p++];
    if (marker === 217) {
      if (p !== bytes.length || !scanned || !width || !quantized || !huffman) throw invalid();
      return { width, height, removed };
    }
    if (marker === undefined || marker === 216 || marker === 0 || (marker >= 208 && marker <= 215)) throw invalid();
    const size = (bytes[p]! << 8) | bytes[p + 1]!;
    if (size < 2 || p + size > bytes.length) throw invalid();
    if (marker >= 224 && marker <= 239 || marker === 254) {
      // Canvas-produced JFIF's fixed header carries no user metadata or thumbnail.
      if (removeMetadata) removed.push([markerStart, p + size]);
      else if (marker !== 224 || size !== 16 || String.fromCharCode(...bytes.slice(p + 2, p + 7)) !== 'JFIF\0' || bytes[p + 14] !== 0 || bytes[p + 15] !== 0)
        throw new BoardMediaError('IMAGE_METADATA', 'Photo must be prepared again to remove embedded metadata.');
    } else if (marker === 192 || marker === 194) {
      if (width || size < 11 || bytes[p + 2] !== 8) throw invalid();
      height = (bytes[p + 3]! << 8) | bytes[p + 4]!;
      width = (bytes[p + 5]! << 8) | bytes[p + 6]!;
      if (!width || !height || Math.max(width, height) > DISPLAY_MAX_DIMENSION)
        throw new BoardMediaError('IMAGE_DIMENSIONS', 'Prepared photo must fit within 1600 pixels.');
    } else if (![196, 219, 221, 218].includes(marker)) throw invalid();
    if (marker === 219) quantized = true;
    if (marker === 196) huffman = true;
    p += size;
    if (marker === 218) {
      if (!width || !quantized || !huffman) throw invalid();
      const start = p;
      while (p < bytes.length) {
        if (bytes[p] !== 255) { p++; continue; }
        const next = bytes[p + 1];
        if (next === 0 || (next !== undefined && next >= 208 && next <= 215)) { p += 2; continue; }
        break;
      }
      if (p === start) throw invalid();
      scanned = true;
    }
  }
  throw invalid();
}

export interface PreparedBoardPhoto { blob: Blob; width: number; height: number }
/** Decode locally; draw pixels into a fresh canvas so EXIF/IPTC/XMP and originals never upload. */
export async function prepareBoardPhoto(file: Blob): Promise<PreparedBoardPhoto> {
  if (file.size === 0 || file.size > SOURCE_MAX_BYTES)
    throw new BoardMediaError('SOURCE_TOO_LARGE', 'Choose a nonempty photo no larger than 10 MiB.');
  const type = sourceImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!type || file.type.toLowerCase() !== type)
    throw new BoardMediaError('UNSUPPORTED_IMAGE', 'Only JPEG, PNG and WebP photos are supported. Convert this file first.');
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined')
    throw new BoardMediaError('IMAGE_PROCESSING_UNAVAILABLE', 'This browser cannot prepare photos. Try an updated browser.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw invalid(); }
  try {
    if (!bitmap.width || !bitmap.height) throw invalid();
    const scale = Math.min(1, DISPLAY_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new BoardMediaError('IMAGE_PROCESSING_UNAVAILABLE', 'This browser cannot prepare photos.');
    // Transparent PNG/WebP becomes an intentional white JPEG background.
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const quality of [0.88, 0.78, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.type === 'image/jpeg' && blob.size > 0 && blob.size <= DISPLAY_MAX_BYTES) {
        // Browsers can add ICC APP2 markers themselves. Remove every ancillary marker,
        // then validate the exact metadata-free bytes the service will receive.
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const inspected = inspectDisplayJpeg(bytes, true);
        const pieces: Uint8Array<ArrayBuffer>[] = [];
        let offset = 0;
        for (const [start, end] of inspected.removed) { pieces.push(bytes.slice(offset, start)); offset = end; }
        pieces.push(bytes.slice(offset));
        const clean = new Blob(pieces, { type: 'image/jpeg' });
        const dimensions = displayJpegDimensions(new Uint8Array(await clean.arrayBuffer()));
        if (dimensions.width !== width || dimensions.height !== height) throw invalid();
        return { blob: clean, width, height };
      }
    }
    throw new BoardMediaError('DISPLAY_TOO_LARGE', 'This photo could not fit within 2 MiB. Choose a smaller photo.');
  } finally { bitmap.close(); }
}
