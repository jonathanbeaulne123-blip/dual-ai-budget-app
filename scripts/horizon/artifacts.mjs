import { gunzipSync } from 'node:zlib';

// One nanometre in the approved metre-based world. This removes differences in
// the last floating-point bits across Node/V8 versions, far below the terrain's
// centimetre encoding and the geometry's millimetre error bounds.
export const HORIZON_JSON_DECIMALS = 9;

/** @param {unknown} value */
export function serializeHorizonJson(value) {
  const json = JSON.stringify(value, (_key, item) =>
    typeof item === 'number' && Number.isFinite(item) && !Number.isInteger(item)
      ? Number(item.toFixed(HORIZON_JSON_DECIMALS))
      : item,
  );
  if (json === undefined) throw new TypeError('A Horizon asset must contain JSON data');
  return Buffer.from(json);
}

/**
 * Plain JSON and terrain remain byte-exact. A gzip stream is checked by its
 * decoded payload: compression-library versions and header metadata may differ
 * without changing the asset. Corruption still throws during decompression.
 * @param {string} key
 * @param {Buffer} stored
 * @param {Buffer} generated
 */
export function assertHorizonArtifact(key, stored, generated) {
  const decode = key === 'compressed' ? gunzipSync : value => value;
  if (!decode(stored).equals(decode(generated))) {
    throw new Error(`Stale Horizon ${key} asset; regenerate with pnpm horizon:bake`);
  }
}
