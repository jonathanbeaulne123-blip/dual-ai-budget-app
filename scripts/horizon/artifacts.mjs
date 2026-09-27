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
  const index = { ...world, geometry: { ...world.geometry, solids: [] }, chunks: chunks.map(c => ({ districtId: c.districtId, url: `/horizon/world/${c.path}`, bytes: c.json.byteLength, sha256: sha256(c.json), solids: groups.get(c.districtId).length, footprint: chunkFootprint(groups.get(c.districtId)) })) };
  return { index: serializeHorizonJson(index), chunks };
}
/** Wave 6: the plan-view cells (HORIZON_CHUNK_CELL eu) a chunk's solids touch — every triangle's xz box, conservative. The
 * runtime's chunk gate reads it: the body never steps into a cell whose chunks (collision) are not resident, and a walk plan
 * requests the chunks its path crosses. Flattened [cx, cz, cx, cz, …], sorted, unique. */
export const HORIZON_CHUNK_CELL = 32;
/** @param {{positions:number[];indices:number[]}[]} solids */
export function chunkFootprint(solids) {
  const cells = new Set();
  for (const s of solids) {
    const p = s.positions, ix = s.indices;
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      const x0 = Math.floor(Math.min(p[a], p[b], p[c]) / HORIZON_CHUNK_CELL), x1 = Math.floor(Math.max(p[a], p[b], p[c]) / HORIZON_CHUNK_CELL);
      const z0 = Math.floor(Math.min(p[a + 2], p[b + 2], p[c + 2]) / HORIZON_CHUNK_CELL), z1 = Math.floor(Math.max(p[a + 2], p[b + 2], p[c + 2]) / HORIZON_CHUNK_CELL);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) cells.add(x * 4096 + z);
    }
  }
  const keys = [...cells].sort((m, n) => m - n), out = [];
  for (const k of keys) { const x = Math.round(k / 4096), z = k - x * 4096; out.push(x, z); }
  return { cell: HORIZON_CHUNK_CELL, cells: out };
}
