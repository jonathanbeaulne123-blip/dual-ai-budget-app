const encoder = new TextEncoder(),
  decoder = new TextDecoder("utf-8", { fatal: true });
export const WIRE_LIMIT = 32 * 1024 * 1024,
  PART = 60 * 1024,
  WINDOW = 256 * 1024;
export async function encodeMessage(value: unknown): Promise<ArrayBuffer[]> {
  const data = encoder.encode(JSON.stringify(value));
  if (data.length > WIRE_LIMIT) throw new Error("MESSAGE_TOO_LARGE");
  const id = encoder.encode(crypto.randomUUID());
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const frames: ArrayBuffer[] = [];
  for (let at = 0; at < data.length; at += PART) {
    const bytes = new Uint8Array(78 + Math.min(PART, data.length - at)),
      view = new DataView(bytes.buffer);
    bytes[0] = 2;
    bytes[1] = 1;
    bytes.set(id, 2);
    view.setUint32(38, at / PART);
    view.setUint32(42, data.length);
    bytes.set(hash, 46);
    bytes.set(data.subarray(at, at + PART), 78);
    frames.push(bytes.buffer);
  }
  return frames;
}
export class MessageReader {
  constructor(private readonly limit = WIRE_LIMIT) {}
  private pending?: {
    id: string;
    length: number;
    hash: Uint8Array;
    parts: Uint8Array[];
    count: number;
    at: number;
  };
  async accept(buffer: ArrayBuffer): Promise<unknown | undefined> {
    if (buffer.byteLength < 79 || buffer.byteLength > PART + 78)
      throw new Error("INVALID_FRAME");
    const b = new Uint8Array(buffer),
      v = new DataView(buffer);
    if (b[0] !== 2 || b[1] !== 1) throw new Error("PROTOCOL_VERSION");
    const id = decoder.decode(b.subarray(2, 38)),
      index = v.getUint32(38),
      length = v.getUint32(42),
      hash = b.slice(46, 78),
      part = b.slice(78);
    if (
      !/^[a-f0-9-]{36}$/.test(id) ||
      length < 1 ||
      length > this.limit ||
      index >= Math.ceil(length / PART) ||
      part.length !== Math.min(PART, length - index * PART)
    )
      throw new Error("INVALID_FRAME");
    if (index === 0)
      this.pending = { id, length, hash, parts: [], count: 0, at: Date.now() };
    const p = this.pending;
    if (
      !p ||
      p.id !== id ||
      index !== p.parts.length ||
      p.length !== length ||
      hash.some((x, i) => x !== p.hash[i]) ||
      Date.now() - p.at > 60_000
    )
      throw new Error("TRANSFER_RESTART");
    p.parts.push(part);
    p.count += part.length;
    if (p.count < length) return;
    this.pending = undefined;
    const full = new Uint8Array(length);
    let at = 0;
    for (const row of p.parts) {
      full.set(row, at);
      at += row.length;
    }
    const actual = new Uint8Array(await crypto.subtle.digest("SHA-256", full));
    if (actual.some((x, i) => x !== hash[i])) throw new Error("CHECKSUM");
    return JSON.parse(decoder.decode(full));
  }
}
export function retryDelay(attempt: number) {
  return Math.random() * Math.min(30_000, 500 * 2 ** Math.min(16, attempt));
}
