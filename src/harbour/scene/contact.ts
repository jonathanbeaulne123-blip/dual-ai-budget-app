import * as THREE from "three";

/**
 * Contact shadows — the soft disc under anything that stands on a surface, so
 * it touches it rather than floating above it. Extracted from the Court
 * (`court/CourtScene.ts`) when the Tower needed the same helper; both places
 * use this one module so a model-village object sits the same way everywhere.
 *
 * One radial-gradient texture is shared by every disc; each disc owns a
 * material so its opacity can differ. Without a 2D context (jsdom, a starved
 * tab) `disc()` returns null and the scene still builds — the shadow is a
 * nicety, never information.
 */

export type ContactShadowOptions = {
  /** The ink the gradient is drawn in; default is the court's warm soot. */
  ink?: string;
  /** Opacity at the centre of the disc, before the per-disc multiplier. */
  strength?: number;
  /** Texture resolution; 128 is plenty for a blurred blob. */
  size?: number;
};

export type ContactShadows = {
  /**
   * Lays a disc of radius `radius` at (x, z) in `parent`'s local space, a
   * hair above y = 0 so it never z-fights the floor it sits on. Returns the
   * mesh, or null when the page has no 2D canvas.
   */
  disc(x: number, z: number, radius: number, opacity?: number, parent?: THREE.Object3D, y?: number): THREE.Mesh | null;
  /** True once a texture has been drawn (false when the page has no 2D canvas). */
  readonly available: () => boolean;
  dispose(): void;
};

export const CONTACT_Y = 0.014;

/** A shared radial-gradient texture plus the discs cut from it. Owns everything it makes. */
export function createContactShadows(options: ContactShadowOptions = {}): ContactShadows {
  const ink = options.ink ?? "20,16,10";
  const strength = options.strength ?? 0.42;
  const size = options.size ?? 128;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let texture: THREE.CanvasTexture | null = null;
  let tried = false;

  const rgb = (hex: string): string => {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return ink;
    const n = parseInt(match[1]!, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };
  const tone = options.ink && options.ink.startsWith("#") ? rgb(options.ink) : ink;

  const ensure = (): THREE.CanvasTexture | null => {
    if (texture || tried) return texture;
    tried = true;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const half = size / 2;
      const gradient = ctx.createRadialGradient(half, half, size / 16, half, half, half);
      gradient.addColorStop(0, `rgba(${tone},${strength})`);
      gradient.addColorStop(0.55, `rgba(${tone},${strength * 0.43})`);
      gradient.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
    } catch {
      texture = null;
    }
    return texture;
  };

  return {
    disc(x, z, radius, opacity = 1, parent, y = CONTACT_Y) {
      const map = ensure();
      if (!map) return null;
      const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity });
      materials.push(material);
      const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.renderOrder = 2;
      mesh.name = "contact";
      parent?.add(mesh);
      return mesh;
    },
    available: () => ensure() !== null,
    dispose() {
      for (const geometry of geometries.splice(0)) geometry.dispose();
      for (const material of materials.splice(0)) material.dispose();
      texture?.dispose();
      texture = null;
    },
  };
}
