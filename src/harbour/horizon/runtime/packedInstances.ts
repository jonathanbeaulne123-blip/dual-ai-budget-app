/** Portable heterogeneous batching: one ordinary indexed Mesh, no multi-draw or
 * instancing extension. Source records keep their local prototype vertices and
 * Float32 instance matrices; only the index list selects resident records. */
import * as THREE from 'three';

export type PackedSource = { key: string; mesh: THREE.InstancedMesh; wind?: number };
export type PackedInstances = {
  mesh: THREE.Mesh;
  /** Call after source counts/attributes change, before renderer.render(). */
  sync(): void;
  dispose(): void;
};

/** Use the exact installed Three matrix/normal/color chunks with ordinary
 * per-vertex matrix attributes. This does not turn on renderer instancing. */
export function packedMatrixShader(shader: { vertexShader: string }, colour: boolean): void {
  const declarations = 'attribute mat4 aInstanceMatrix;\n' + (colour ? 'attribute vec3 aInstanceColor;\n' : '');
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + declarations);
  const chunks = ['project_vertex', 'worldpos_vertex', 'defaultnormal_vertex', ...(colour ? ['color_vertex'] : [])] as const;
  for (const key of chunks) {
    const source = THREE.ShaderChunk[key as keyof typeof THREE.ShaderChunk];
    const converted = source.replace(/#ifdef USE_INSTANCING_COLOR/g, colour ? '#if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)' : '#if 0')
      .replace(/#ifdef USE_INSTANCING\b/g, '#if 1')
      .replace(/\binstanceMatrix\b/g, 'aInstanceMatrix').replace(/\binstanceColor\b/g, 'aInstanceColor');
    shader.vertexShader = shader.vertexShader.replace(`#include <${key}>`, converted);
  }
}

/** Unit prototype attributes and matrices stay in GPU-local coordinates. Wind,
 * grain UVs, flat normals and shadow projection therefore keep their old order. */
export function packInstances(sources: readonly PackedSource[], material: THREE.Material, options: { name: string; plant?: boolean; depth?: THREE.Material }): PackedInstances {
  const geometry = new THREE.BufferGeometry();
  const specs = new Map<string, number>();
  let vertices = 0, indices = 0;
  const parts = sources.map(source => {
    const g = source.mesh.geometry, n = g.getAttribute('position').count, cap = source.mesh.instanceMatrix.count;
    for (const [name, a] of Object.entries(g.attributes)) {
      if ((a as THREE.InstancedBufferAttribute).isInstancedBufferAttribute) continue;
      if ((a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) throw new Error(`Packed prototype requires ordinary Float32 ${name}`);
      if (specs.has(name) && specs.get(name) !== a.itemSize) throw new Error(`Incompatible packed attribute ${name}`);
      specs.set(name, a.itemSize);
    }
    const count = g.index?.count ?? n, part = { ...source, vertexStart: vertices, vertices: n, capacity: cap, indexCount: count };
    vertices += n * cap; indices += count * cap; return part;
  });
  specs.set('aInstanceMatrix', 16);
  if (options.plant) for (const [name, size] of [['aFar',1],['aBorn',1],['aWind',2],['aInstanceColor',3],['aTrunk',3],['aPart',1]] as const) specs.set(name, size);
  for (const [name, size] of specs) geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(vertices * size), size));
  const index = new THREE.BufferAttribute(new Uint32Array(indices), 1).setUsage(THREE.DynamicDrawUsage); geometry.setIndex(index);
  const dynamic = new Set(['aInstanceMatrix', 'aFar', 'aBorn', 'aInstanceColor', 'aTrunk']);
  for (const name of dynamic) (geometry.getAttribute(name) as THREE.BufferAttribute | undefined)?.setUsage(THREE.DynamicDrawUsage);
  for (const p of parts) {
    for (const [name, size] of specs) {
      if (dynamic.has(name)) continue;
      const dest = geometry.getAttribute(name).array as Float32Array, src = p.mesh.geometry.getAttribute(name);
      for (let slot = 0; slot < p.capacity; slot++) for (let v = 0; v < p.vertices; v++) {
        const at = (p.vertexStart + slot * p.vertices + v) * size;
        for (let k = 0; k < size; k++) dest[at+k] = name === 'aWind' ? Number(((p.wind ?? 0) * (k === 0 ? 1 : .6)).toFixed(4)) : src ? src.array[v*size+k]! : name === 'color' ? 1 : 0;
      }
    }
  }
  const mesh = new THREE.Mesh(geometry, material); mesh.name = options.name;
  const first = parts[0]?.mesh;
  mesh.castShadow = first?.castShadow ?? false; mesh.receiveShadow = first?.receiveShadow ?? true; mesh.renderOrder = first?.renderOrder ?? 0;
  for (const p of parts) if (p.mesh.castShadow !== mesh.castShadow || p.mesh.receiveShadow !== mesh.receiveShadow || p.mesh.renderOrder !== mesh.renderOrder) throw new Error('Packed render-state mismatch');
  if (options.depth) mesh.customDepthMaterial = options.depth;
  // Keep source logical layers for diagnostics; no prototype is silently dropped.
  mesh.userData.corridorPackedSources = parts.map(p => p.key);
  const sphere = new THREE.Sphere(), bounds = new THREE.Sphere(), box = new THREE.Box3();
  function sync() {
    let count = 0; bounds.makeEmpty(); box.makeEmpty();
    for (const p of parts) {
      const g = p.mesh.geometry, n = p.mesh.count;
      if (n < 0 || n > p.capacity) throw new Error('Packed record count exceeds capacity');
      for (let slot = 0; slot < n; slot++) {
        const start = p.vertexStart + slot * p.vertices;
        for (let v = 0; v < p.vertices; v++) {
          (geometry.getAttribute('aInstanceMatrix').array as Float32Array).set(p.mesh.instanceMatrix.array.subarray(slot*16,slot*16+16), (start+v)*16);
          if (options.plant) for (const name of ['aFar','aBorn','aInstanceColor','aTrunk'] as const) {
            const target = geometry.getAttribute(name), size = target.itemSize;
            const source = name === 'aInstanceColor' ? p.mesh.instanceColor : g.getAttribute(name);
            for (let k = 0; k < size; k++) (target.array as Float32Array)[(start+v)*size+k] = source?.array[slot*size+k] ?? (name === 'aInstanceColor' || name === 'aTrunk' ? 1 : 0);
          }
        }
        for (let k = 0; k < p.indexCount; k++) (index.array as Uint32Array)[count++] = start + (g.index ? g.index.getX(k) : k);
      }
      // The union preserves every old logical layer's conservative frustum bound.
      // It may submit an offscreen source layer beside a visible one; clipping
      // removes it. Residency and per-record distance decisions stay exact.
      if (n) { p.mesh.computeBoundingSphere(); if (p.mesh.boundingSphere) bounds.union(sphere.copy(p.mesh.boundingSphere)); p.mesh.computeBoundingBox(); if (p.mesh.boundingBox) box.union(p.mesh.boundingBox); }
    }
    for (const name of dynamic) { const a = geometry.getAttribute(name); if (a) a.needsUpdate = true; }
    index.needsUpdate = true; geometry.setDrawRange(0, count); geometry.boundingSphere = bounds.clone(); geometry.boundingBox = box.clone(); mesh.visible = count > 0;
  }
  sync();
  return { mesh, sync, dispose() { mesh.removeFromParent(); geometry.dispose(); } };
}
