import {decodeNestAppearance} from './nestDesignBinding.ts';
import * as THREE from 'three';
import { createKittySculpture } from '../kitty/sculpture.ts';
import { shapeKittyPiece } from '../core/kittyStudio.ts';
import type { ExportCapture, ExportMaterial, ExportMesh, ExportSelection } from './exportTypes.ts';

/** Fresh isolated sculpture: no call to setFill/update, no financial or animated transforms. */
export function captureAuthoredKitty(selection: ExportSelection): ExportCapture {
  if (typeof document === 'undefined') throw Error('EXPORT_CANVAS_REQUIRED: Capture the authored sculpture in a browser or supplied Canvas host.');
  const piece = shapeKittyPiece(structuredClone(selection.piece));
  const appearance=selection.appearance===undefined?undefined:decodeNestAppearance(selection.appearance);
  const sculpture = createKittySculpture(piece, { brass: '#b68a50', wood: '#6b4630', fired: true, reducedMotion: true, ornament:appearance });
  try {
    sculpture.setOpen(false);
    sculpture.setExpression(piece.sculpt.eyes);
    // The first child is the clay group; its first group is the authored sculpture.
    // The fixed turntable and sparkle pool are outside this subtree.
    const clay = sculpture.group.children[0];
    const sculpt = clay?.children.find(child => child.type === 'Group');
    if (!clay || !sculpt || !sculpture.paintables.every(mesh => { let p: THREE.Object3D | null = mesh; while (p && p !== sculpt) p = p.parent; return p === sculpt; })) throw Error('EXPORT_SCULPTURE_LAYOUT_CHANGED');
    sculpture.group.updateMatrixWorld(true);
    const visible: THREE.Mesh[] = [];
    const ornaments=clay.children.filter(child=>child.name.startsWith('nest-prop:'));
    if(appearance&&ornaments.length!==1)throw Error('EXPORT_NEST_LAYOUT_CHANGED');
    for(const root of [sculpt,...(appearance?ornaments:[])])root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if (Array.isArray(object.material)) throw Error('EXPORT_MULTIMATERIAL_LAYOUT_CHANGED');
      if (!object.material.colorWrite || object.material.opacity === 0) return; // paint hit shells
      visible.push(object);
    });
    const bounds = new THREE.Box3();
    for (const mesh of visible) bounds.expandByObject(mesh, true);
    const height = bounds.max.y - bounds.min.y;
    if (!height || !Number.isFinite(selection.heightMm) || selection.heightMm < 30 || selection.heightMm > 1000) throw Error('EXPORT_HEIGHT_RANGE_30_1000_MM');
    const scale = selection.heightMm / height, centerX = (bounds.min.x + bounds.max.x) / 2, centerZ = (bounds.min.z + bounds.max.z) / 2;
    const materials: ExportMaterial[] = [], materialIds = new Map<THREE.Material, number>();
    const meshes: ExportMesh[] = [];
    let crownY = 0; const headBounds = new THREE.Box3(), bodyBounds = new THREE.Box3();
    for (const [i, mesh] of visible.entries()) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.userData.part === 'head') headBounds.expandByObject(mesh, true);
      if (mesh.userData.part === 'body') bodyBounds.expandByObject(mesh, true);
      if (!materialIds.has(material)) {
        const texture = material.map?.image as HTMLCanvasElement | undefined;
        let png: Uint8Array | undefined;
        if (texture) {
          if (typeof texture.toDataURL !== 'function') throw Error('EXPORT_TEXTURE_NOT_CANVAS');
          const url = texture.toDataURL('image/png');
          if (!url.startsWith('data:image/png;base64,')) throw Error('EXPORT_TEXTURE_ENCODING');
          png = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.charCodeAt(0));
        }
        const color = material.color ?? new THREE.Color(1, 1, 1);
        materialIds.set(material, materials.length);
        materials.push({ name: String(mesh.userData.part ?? `detail-${materials.length}`), color: [color.r, color.g, color.b, material.opacity], ...(png ? { png } : {}) });
      }
      const geometry = mesh.geometry, p = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
      const positions: number[] = [], texcoords: number[] = [];
      for (let n = 0; n < p.count; n++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, n).applyMatrix4(mesh.matrixWorld);
        positions.push((v.x - centerX) * scale, (v.y - bounds.min.y) * scale, (v.z - centerZ) * scale);
        texcoords.push(uv?.getX(n) ?? 0, uv?.getY(n) ?? 0);
        if (mesh.userData.part === 'head') crownY = Math.max(crownY, (v.y - bounds.min.y) * scale);
      }
      meshes.push({ name: `${mesh.userData.part ?? geometry.type}-${i}`, positions, uv: texcoords, indices: geometry.index ? Array.from(geometry.index.array) : Array.from({ length: p.count }, (_, n) => n), material: materialIds.get(material)! });
    }
    const headCenter = headBounds.getCenter(new THREE.Vector3()), bodyCenter = bodyBounds.getCenter(new THREE.Vector3());
    return { meshes, materials, crownY, baseY: 0, crownCenter: [(headCenter.x - centerX) * scale, (headCenter.z - centerZ) * scale], baseCenter: [(bodyCenter.x - centerX) * scale, (bodyCenter.z - centerZ) * scale], source: appearance?'authored-kitty-nest-v1':'authored-kitty-sculpture-v1' };
  } finally { sculpture.dispose(); }
}
