import * as THREE from 'three';

// r185 draws transparent DoubleSide meshes BackSide, then FrontSide. Keep those
// two shader/culling states and that object's stable sort position. Only a face
// with a certain side is omitted from the pass where the rasterizer culls it.
// Near-plane/grazing uncertainty stays in BOTH original-order pass lists.
const FLOAT_GUARD = 32 * 2 ** -23;
export type ContactShadePassMaterials = {back: THREE.MeshBasicMaterial; front: THREE.MeshBasicMaterial};
type Counts = {source: number; back: number; front: number; clipped: number; nearPlane: number; grazing: number; degenerate: number; unsupported: boolean};

export function orderContactShade(mesh: THREE.Mesh, passes: ContactShadePassMaterials): () => void {
  const geometry = mesh.geometry, position = geometry.getAttribute('position'), originalMaterial = mesh.material;
  if (!position || position.itemSize !== 3 || (position as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute || geometry.groups.length) throw new Error('Contact shade needs owned, ungrouped ordinary geometry');
  if (passes.back === passes.front || passes.back.side !== THREE.BackSide || passes.front.side !== THREE.FrontSide) throw new Error('Contact shade needs distinct BackSide/FrontSide materials');
  const sourceIndex = geometry.index, source = Uint32Array.from({length: sourceIndex?.count ?? position.count}, (_, i) => sourceIndex ? sourceIndex.getX(i) : i);
  const index = new THREE.BufferAttribute(source.slice(), 1).setUsage(THREE.DynamicDrawUsage);
  const sides = new Uint8Array(Math.ceil(source.length / 3)); // 0 back, 1 front, 2 uncertain/both.
  const inverse = new THREE.Matrix4(), view = new THREE.Matrix4(), eye = new THREE.Vector3(), towardEye = new THREE.Vector3();
  const before = mesh.onBeforeRender, after = mesh.onAfterRender, positionVersion = (position as THREE.BufferAttribute).version;
  const materials = [passes.back, passes.front];
  let disposed = false;
  geometry.setIndex(index);
  geometry.addGroup(0, source.length, 0); geometry.addGroup(0, source.length, 1);
  // r185 render-list entries keep these same group objects by reference. Never
  // replace them during a render: the callback narrows the current live range.
  const backGroup = geometry.groups[0]!, frontGroup = geometry.groups[1]!;
  mesh.material = materials;

  function classify(camera: THREE.Camera): Counts {
    const counts: Counts = {source: 0, back: 0, front: 0, clipped: 0, nearPlane: 0, grazing: 0, degenerate: 0, unsupported: false};
    const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
    const orthographic = (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
    const near = (camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).near;
    const start = geometry.drawRange.start, count = Math.min(source.length - start, geometry.drawRange.count);
    const supported = (perspective || orthographic) && Number.isFinite(near) && near >= 0 &&
      geometry.groups.length === 2 && geometry.groups[0] === backGroup && geometry.groups[1] === frontGroup &&
      (position as THREE.BufferAttribute).version === positionVersion && geometry.index === index && mesh.material === materials &&
      Number.isInteger(start) && start >= 0 && start % 3 === 0 && Number.isInteger(count) && count >= 0 && count % 3 === 0 &&
      Math.abs(mesh.matrixWorld.determinant()) >= 1e-12 && !(mesh as THREE.InstancedMesh).isInstancedMesh && !geometry.morphAttributes.position &&
      materials.every((m, i) => m.isMeshBasicMaterial && m.transparent && !m.depthWrite && !m.envMap && m.side === (i ? THREE.FrontSide : THREE.BackSide));
    sides.fill(2);
    if (!supported) { counts.unsupported = true; counts.source = Number.isFinite(count) ? Math.max(0, count / 3) : 0; return counts; }
    inverse.copy(mesh.matrixWorld).invert(); view.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
    towardEye.set(0, 0, 1).transformDirection(camera.matrixWorld).transformDirection(inverse);
    const e = view.elements;
    for (let offset = start; offset < start + count; offset += 3) {
      counts.source++;
      const ia = source[offset]!, ib = source[offset + 1]!, ic = source[offset + 2]!;
      const ax = position.getX(ia), ay = position.getY(ia), az = position.getZ(ia);
      const ux = position.getX(ib) - ax, uy = position.getY(ib) - ay, uz = position.getZ(ib) - az;
      const vx = position.getX(ic) - ax, vy = position.getY(ic) - ay, vz = position.getZ(ic) - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, length = Math.hypot(nx, ny, nz);
      if (!length) { counts.degenerate++; continue; }
      let behind = 0, inFront = 0;
      for (let corner = 0; corner < 3; corner++) {
        const vertex = source[offset + corner]!, x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
        const depth = -(e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) - near;
        const error = FLOAT_GUARD * (Math.abs(e[2]! * x) + Math.abs(e[6]! * y) + Math.abs(e[10]! * z) + Math.abs(e[14]!) + near + 1);
        if (depth + error < 0) behind++; else if (depth - error > 0) inFront++;
      }
      // Fully near-clipped triangles cannot produce fragments. Retain one copy.
      if (behind === 3) { counts.clipped++; sides[offset / 3] = 0; continue; }
      if (inFront !== 3) { counts.nearPlane++; continue; }
      const dx = perspective ? eye.x - ax : towardEye.x, dy = perspective ? eye.y - ay : towardEye.y, dz = perspective ? eye.z - az : towardEye.z;
      const facing = nx * dx + ny * dy + nz * dz;
      const scale = perspective ? Math.max(1, Math.abs(eye.x), Math.abs(eye.y), Math.abs(eye.z), Math.abs(ax), Math.abs(ay), Math.abs(az)) : 1;
      if (!Number.isFinite(facing) || Math.abs(facing) <= FLOAT_GUARD * scale * length) { counts.grazing++; continue; }
      sides[offset / 3] = facing > 0 ? 1 : 0; counts[facing > 0 ? 'front' : 'back']++;
    }
    return counts;
  }
  function reset() {
    index.array.set(source); index.needsUpdate = true;
    backGroup.start = frontGroup.start = 0; backGroup.count = frontGroup.count = source.length;
  }
  mesh.onBeforeRender = function(...args) {
    before.apply(mesh, args); reset();
    // r185 supplies a GeometryGroup here; installed @types declares a scene Group.
    const group = args[5] as unknown as THREE.BufferGeometry['groups'][number] | null, side = group === backGroup ? 0 : group === frontGroup ? 1 : -1;
    const counts = classify(args[2]);
    if (group && side >= 0 && !counts.unsupported) {
      const start = geometry.drawRange.start, count = Math.min(source.length - start, geometry.drawRange.count); let write = start;
      for (let offset = start; offset < start + count; offset += 3) if (sides[offset / 3] === side || sides[offset / 3] === 2) {
        for (let k = 0; k < 3; k++) index.array[write++] = source[offset + k]!;
      }
      // Keep drawRange intact. Both passes reuse this same index window; r185
      // uploads it after each callback and reads this group's bounds then.
      group.start = start; group.count = write - start;
    }
    mesh.userData.contactShadePass = counts.unsupported || side < 0 ? 'unsupported' : counts.nearPlane || counts.grazing || counts.degenerate ? 'partial' : 'partitioned';
    mesh.userData.contactShadeCounts = counts;
    index.needsUpdate = true;
  };
  mesh.onAfterRender = function(...args) { try { after.apply(mesh, args); } finally { reset(); } };
  const installedBefore = mesh.onBeforeRender, installedAfter = mesh.onAfterRender;
  function dispose() {
    if (disposed) return; disposed = true; reset();
    if (mesh.onBeforeRender === installedBefore) mesh.onBeforeRender = before;
    if (mesh.onAfterRender === installedAfter) mesh.onAfterRender = after;
    if (mesh.material === materials) mesh.material = originalMaterial;
    geometry.clearGroups(); geometry.removeEventListener('dispose', dispose);
    // Keep the owned index attached so WebGLGeometries' disposal listener frees
    // its GPU buffer. Shared pass materials are disposed once by CorridorArt.
  }
  geometry.addEventListener('dispose', dispose);
  return dispose;
}
