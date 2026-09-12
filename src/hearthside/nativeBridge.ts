import { Capacitor, registerPlugin } from '@capacitor/core';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { shapeKittyPiece } from '../core/kittyStudio.ts';
import { captureAuthoredKitty } from './exportCapture.ts';
import { writeGlb } from './exportGlb.ts';
import type { ExportCapture, ExportSelection } from './exportTypes.ts';
import { validateNativeIdentity, validateNativeScene, type NativeBacking, type NativeMesh, type NativePlugin, type NativeScene } from './native.ts';
import type { DesignSurfaceSelection } from './designSurfaceContracts.ts';

let registered: NativePlugin | null = null;
export function hearthsideNativePlugin(): NativePlugin | null {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('HearthsideNative')) return null;
  registered ??= registerPlugin<NativePlugin>('HearthsideNative'); return registered;
}
export function nativeBytesBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return btoa(chunks.join(''));
}
export const NATIVE_AUTHORED_HEIGHT_MM = 160;
/** Same authored capture as production GLB, before manufacturing repairs and
 * without any goal, backing scale, animated transform, or camera input. */
export function nativeSceneFromDesign(selection: DesignSurfaceSelection, backing: NativeBacking, returnPath: string, capture: (selection: ExportSelection) => ExportCapture = captureAuthoredKitty): NativeScene {
  const identity = validateNativeIdentity(selection.identity), piece = shapeKittyPiece(structuredClone(selection.piece));
  if (piece.id !== identity.pieceId) throw Error('NATIVE_DESIGN_IDENTITY_MISMATCH');
  const authored = capture({ version: 1, documentId: identity.designId, revision: identity.revision, piece, heightMm: NATIVE_AUTHORED_HEIGHT_MM, construction: 'solid' });
  const byMaterial = new Map<number, NativeMesh>();
  const meshes: NativeMesh[] = [];
  for (const mesh of authored.meshes) {
    const material = authored.materials[mesh.material]; if (!material) throw Error('NATIVE_MATERIAL_MISSING');
    let merged = byMaterial.get(mesh.material);
    if (!merged || merged.positions.length + mesh.positions.length > 150_000 || merged.indices.length + mesh.indices.length > 300_000) {
      merged = { name: `material-${mesh.material}-${meshes.length}`, positions: [], normals: [], uvs: [], indices: [], color: [...material.color], texturePng: material.png ? nativeBytesBase64(material.png) : '' }; byMaterial.set(mesh.material, merged); meshes.push(merged);
    }
    const offset = merged.positions.length / 3, metres = mesh.positions.map(n => n / 1000);
    const geometry = new BufferGeometry();
    try {
      geometry.setAttribute('position', new Float32BufferAttribute(metres, 3)); geometry.setIndex(mesh.indices); geometry.computeVertexNormals();
      const normals = Array.from(geometry.getAttribute('normal').array);
      for (let i = 0; i < normals.length; i += 3) if (Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) < 1e-12) normals[i + 1] = 1;
      for (const value of metres) merged.positions.push(value);
      for (const value of normals) merged.normals.push(value);
      // Match the embedded glTF texture coordinates on both native adapters.
      for (let i = 0; i < mesh.uv.length; ++i) merged.uvs.push(i % 2 ? 1 - mesh.uv[i]! : mesh.uv[i]!);
      for (const index of mesh.indices) merged.indices.push(index + offset);
    } finally { geometry.dispose(); }
  }
  return validateNativeScene({ version: 1, identity, meshes, glbBase64: nativeBytesBase64(writeGlb(authored.meshes, authored.materials, identity.pieceId)), backing, returnPath });
}
