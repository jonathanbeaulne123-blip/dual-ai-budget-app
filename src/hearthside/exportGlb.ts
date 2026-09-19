import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { ExportMaterial, ExportMesh } from './exportTypes.ts';

/** glTF 2.0 GLB, meters and Y-up. PNGs are embedded; no external fetches. */
export function writeGlb(meshes: ExportMesh[], materials: ExportMaterial[], name: string): Uint8Array {
  const buffers: Uint8Array[] = [], bufferViews: object[] = [], accessors: object[] = []; let length = 0;
  const buffer = (data: Uint8Array, target?: number) => {
    const padded = new Uint8Array(Math.ceil(data.length / 4) * 4); padded.set(data); buffers.push(padded);
    const id = bufferViews.length; bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length, ...(target ? { target } : {}) }); length += padded.length; return id;
  };
  const accessor = (array: Float32Array | Uint32Array, components: number, type: string, target: number, bounds?: boolean) => {
    const id = accessors.length, min = Array.from({ length: components }, (_, n) => array[n]!), max = [...min];
    if (bounds) for (let i = 0; i < array.length; i++) { min[i % components] = Math.min(min[i % components]!, array[i]!); max[i % components] = Math.max(max[i % components]!, array[i]!); }
    accessors.push({ bufferView: buffer(new Uint8Array(array.buffer), target), componentType: array instanceof Float32Array ? 5126 : 5125, count: array.length / components, type, ...(bounds ? { min, max } : {}) }); return id;
  };
  const images: object[] = [], textures: object[] = [];
  const glMaterials = materials.map(m => {
    let texture: number | undefined;
    if (m.png) { texture = textures.length; textures.push({ source: images.length, sampler: 0 }); images.push({ bufferView: buffer(m.png), mimeType: 'image/png', name: m.name }); }
    return { name: m.name, pbrMetallicRoughness: { baseColorFactor: m.color, roughnessFactor: 0.25, metallicFactor: 0, ...(texture !== undefined ? { baseColorTexture: { index: texture } } : {}) }, doubleSided: true };
  });
  const primitives = meshes.map(m => {
    const positions = new Float32Array(m.positions.map(n => n / 1000)), uvs = new Float32Array(m.uv.map((n, i) => i % 2 ? 1 - n : n));
    const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(positions, 3)); geo.setIndex(m.indices); geo.computeVertexNormals();
    const normals = new Float32Array(geo.getAttribute('normal').array); geo.dispose();
    // A source-exact decorative mesh may contain zero-area triangles; glTF still requires unit normals.
    for (let i = 0; i < normals.length; i += 3) if (Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) < 1e-12) normals[i + 1] = 1;
    return { attributes: { POSITION: accessor(positions, 3, 'VEC3', 34962, true), NORMAL: accessor(normals, 3, 'VEC3', 34962), TEXCOORD_0: accessor(uvs, 2, 'VEC2', 34962) }, indices: accessor(new Uint32Array(m.indices), 1, 'SCALAR', 34963), material: m.material, mode: 4 };
  });
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0', generator: 'Hearthside production export v1' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name, mesh: 0 }], meshes: [{ primitives }], materials: glMaterials, ...(images.length ? { images, textures, samplers: [{ wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9729 }] } : {}), buffers: [{ byteLength: length }], bufferViews, accessors }));
  const jsonLength = Math.ceil(json.length / 4) * 4, out = new Uint8Array(12 + 8 + jsonLength + 8 + length), view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, out.length, true); view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true);
  out.fill(32, 20, 20 + jsonLength); out.set(json, 20); view.setUint32(20 + jsonLength, length, true); view.setUint32(24 + jsonLength, 0x004e4942, true);
  let offset = 28 + jsonLength; for (const part of buffers) { out.set(part, offset); offset += part.length; }
  return out;
}
