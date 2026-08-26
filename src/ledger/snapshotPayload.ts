/**
 * Hosted snapshot / personal envelope wire codec (D-145).
 *
 * Plain JSON remains valid forever (legacy rows + tiny payloads).
 * Large payloads use a versioned gzip envelope so PostgREST still stores TEXT
 * while the wire and browser outbox shrink dramatically.
 */
export const SNAPSHOT_PAYLOAD_VERSION = 1 as const;
export const SNAPSHOT_PAYLOAD_CODEC = "gzip-base64" as const;

/** Skip compression under this UTF-8 size — envelope overhead is not worth it. */
export const SNAPSHOT_COMPRESS_MIN_BYTES = 2_048;

/** Keep plain JSON unless gzip saves at least this fraction. */
export const SNAPSHOT_COMPRESS_MIN_RATIO = 0.9;

export type SnapshotPayloadEnvelope = {
  hearthPayload: typeof SNAPSHOT_PAYLOAD_VERSION;
  codec: typeof SNAPSHOT_PAYLOAD_CODEC;
  /** Uncompressed UTF-8 byte length of the JSON body. */
  bytes: number;
  body: string;
};

export function isSnapshotPayloadEnvelope(value: unknown): value is SnapshotPayloadEnvelope {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.hearthPayload === SNAPSHOT_PAYLOAD_VERSION
    && row.codec === SNAPSHOT_PAYLOAD_CODEC
    && typeof row.bytes === "number"
    && typeof row.body === "string"
    && row.body.length > 0
  );
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "function") {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  }
  const zlib = await import("node:zlib");
  return zlib.gzipSync(bytes);
}

async function gunzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "function") {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  }
  const zlib = await import("node:zlib");
  return zlib.gunzipSync(bytes);
}

/**
 * Encode an arbitrary JSON-serializable value for hosted TEXT columns.
 * Returns legacy plain JSON for small or poorly-compressible values.
 *
 * Shared household snapshots that live SQL inspects (`payload_is_shared`,
 * create identity checks) must stay plain — use {@link encodeSharedSnapshotPayload}.
 */
export async function encodeJsonPayload(value: unknown): Promise<{
  text: string;
  codec: "plain" | typeof SNAPSHOT_PAYLOAD_CODEC;
  rawBytes: number;
  wireBytes: number;
}> {
  const raw = JSON.stringify(value);
  const rawBytes = utf8Bytes(raw).byteLength;
  if (rawBytes < SNAPSHOT_COMPRESS_MIN_BYTES) {
    return { text: raw, codec: "plain", rawBytes, wireBytes: rawBytes };
  }
  try {
    const compressed = await gzipBytes(utf8Bytes(raw));
    const envelope: SnapshotPayloadEnvelope = {
      hearthPayload: SNAPSHOT_PAYLOAD_VERSION,
      codec: SNAPSHOT_PAYLOAD_CODEC,
      bytes: rawBytes,
      body: bytesToBase64(compressed),
    };
    const text = JSON.stringify(envelope);
    const wireBytes = utf8Bytes(text).byteLength;
    if (wireBytes >= rawBytes * SNAPSHOT_COMPRESS_MIN_RATIO) {
      return { text: raw, codec: "plain", rawBytes, wireBytes: rawBytes };
    }
    return { text, codec: SNAPSHOT_PAYLOAD_CODEC, rawBytes, wireBytes };
  } catch {
    return { text: raw, codec: "plain", rawBytes, wireBytes: rawBytes };
  }
}

/** Decode a hosted TEXT payload (plain JSON or D-145 gzip envelope). */
export async function decodeJsonPayload(raw: string | object): Promise<unknown> {
  if (typeof raw !== "string") {
    if (isSnapshotPayloadEnvelope(raw)) {
      const inflated = await gunzipBytes(base64ToBytes(raw.body));
      const text = new TextDecoder().decode(inflated);
      if (raw.bytes > 0 && utf8Bytes(text).byteLength !== raw.bytes) {
        throw new Error("Hosted snapshot envelope byte length mismatch.");
      }
      return JSON.parse(text);
    }
    return raw;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isSnapshotPayloadEnvelope(parsed)) return parsed;
  const inflated = await gunzipBytes(base64ToBytes(parsed.body));
  const text = new TextDecoder().decode(inflated);
  if (parsed.bytes > 0 && utf8Bytes(text).byteLength !== parsed.bytes) {
    throw new Error("Hosted snapshot envelope byte length mismatch.");
  }
  return JSON.parse(text);
}

/**
 * Shared cloud household payload — always plain JSON so live CAS / create RPCs
 * can inspect householdId, members, and visibility (006 `payload_is_shared`).
 */
export async function encodeSharedSnapshotPayload(household: unknown): Promise<string> {
  const raw = JSON.stringify(household);
  return raw;
}

/** Personal / opaque envelopes may gzip; server does not cast them as shared household JSON. */
export async function encodeHouseholdPayload(household: unknown): Promise<string> {
  return (await encodeJsonPayload(household)).text;
}

export async function decodeHouseholdPayload(raw: string | object): Promise<unknown> {
  return decodeJsonPayload(raw);
}
