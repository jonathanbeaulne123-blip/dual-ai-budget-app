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

/**
 * R1-72: split a baked definition into a small index (every whole-island thing; `geometry.solids` empty) and one chunk per
 * district (that district's solids, as listed in `districts[*].solidIds` and their children's). The index lists every chunk
 * with its URL (keyed by the geography revision), its serialized byte length, SHA-256 and solid count. Deterministic: chunks
 * sorted by district id, solids in definition order, the same number serialization as the monolith.
 * @param {any} world
 * @param {(buffer: Buffer) => string} sha256
 */
export function splitHorizonDefinition(world, sha256) {
  const revision = world.geographyRevision, owner = new Map();
  for (const district of world.districts.flatMap(d => [d, ...(d.children ?? [])])) for (const id of district.solidIds ?? []) owner.set(id, district.id);
  const groups = new Map();
  for (const solid of world.geometry.solids) {
    const id = owner.get(solid.id) ?? solid.districtId;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(solid);
  }
  const chunks = [...groups.keys()].sort().map(districtId => ({ districtId, path: `${revision}/${districtId}.json.gz`, json: serializeHorizonJson({ id: 'horizon-chunk', geographyRevision: revision, districtId, solids: groups.get(districtId) }) }));
  const index = { ...world, geometry: { ...world.geometry, solids: [] }, chunks: chunks.map(c => ({ districtId: c.districtId, url: `/horizon/world/${c.path}`, bytes: c.json.byteLength, sha256: sha256(c.json), solids: groups.get(c.districtId).length })) };
  return { index: serializeHorizonJson(index), chunks };
}
