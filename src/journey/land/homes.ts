/**
 * Member homes at map scale (T2). The viewer's committed modular home is drawn with the shared projection
 * `buildHomeArt(layout, {detail: "map", season})` on its reserve plot (`homeSite`, the same placement Horizon uses),
 * then flattened: every box is baked into world space and merged into ONE vertex-coloured mesh for opaque parts and
 * one for glass (BufferGeometryUtils), so a home costs at most two draw calls whatever its size. A provisional
 * (future, not yet saved) layout is one translucent mesh plus a dashed outline — it never looks built.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { JourneyHome, JourneyLandData } from "../contracts.ts";
import { compressHeight, HEIGHT_COMPRESSION } from "../contracts.ts";
import { buildHomeArt } from "../../home/geometry.ts";
import { homeSite } from "../../home/site.ts";
import type { Reserve } from "../../harbour/horizon/world/definition.ts";
import type { LandSurface } from "./surface.ts";

export type Season = "spring" | "summer" | "autumn" | "winter";
const PROVISIONAL_OPACITY = 0.42;

/** The data's reserves in the shape `homeSite` reads (outline, door xy, door height from the baked ground). */
export function reservesForHomes(data: JourneyLandData, surface: LandSurface): Reserve[] {
  return data.reserves.map((r) => ({
    id: r.id, placeId: r.id, outline: r.outline, rotationDegrees: 0,
    door: { id: `${r.id}.door`, xy: r.door, height: surface.rawHeightAt(r.door[0], r.door[1]) },
  }));
}

/** Bake a home group into world-space geometry: position + normal + colour, non-indexed, split opaque / glass. */
function flatten(group: THREE.Object3D): { opaque: THREE.BufferGeometry[]; glass: THREE.BufferGeometry[] } {
  group.updateMatrixWorld(true);
  const opaque: THREE.BufferGeometry[] = [], glass: THREE.BufferGeometry[] = [];
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !node.visible) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined;
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", source.getAttribute("position").clone());
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count, colour = material?.color ?? new THREE.Color("#cccccc"), colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { colours[i * 3] = colour.r; colours[i * 3 + 1] = colour.g; colours[i * 3 + 2] = colour.b; }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    source.dispose();
    (material?.transparent ? glass : opaque).push(geometry);
  });
  return { opaque, glass };
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!parts.length) return null;
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return out;
}

export type HomeMeshes = { group: THREE.Group; recolour(outline: string): void; dispose(): void };

export function buildHomes(homes: readonly JourneyHome[], data: JourneyLandData, surface: LandSurface, outlineColour: string, season: Season = "summer"): HomeMeshes {
  const group = new THREE.Group();
  group.name = "journey-land:homes";
  const owned: { dispose(): void }[] = [];
  const outlines: THREE.LineDashedMaterial[] = [];
  const reserves = reservesForHomes(data, surface);
  for (const home of homes) {
    const site = homeSite(reserves, home.plotId);
    if (!site) continue;
    const art = buildHomeArt(home.layout, { detail: "map", season });
    art.group.position.set(site.x, compressHeight(site.y), site.z);
    art.group.rotation.y = site.yaw;
    art.group.scale.set(1, HEIGHT_COMPRESSION.buildingScale, 1);
    const { opaque, glass } = flatten(art.group);
    art.dispose();
    const tag = `${home.memberId}@${home.plotId}`;
    if (home.provisional) {
      const geometry = merged([...opaque, ...glass]);
      if (!geometry) continue;
      const material = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: PROVISIONAL_OPACITY, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `journey-land:home:provisional:${tag}`;
      mesh.renderOrder = 3;
      const edges = new THREE.EdgesGeometry(geometry, 30);
      const outlineMaterial = new THREE.LineDashedMaterial({ color: outlineColour, dashSize: 1.2, gapSize: 0.8 });
      const outline = new THREE.LineSegments(edges, outlineMaterial);
      outline.computeLineDistances();
      outline.name = `journey-land:home:provisional-outline:${tag}`;
      outline.renderOrder = 3;
      mesh.userData.provisional = true; outline.userData.provisional = true;
      group.add(mesh, outline);
      owned.push(geometry, material, edges, outlineMaterial);
      outlines.push(outlineMaterial);
      continue;
    }
    const solid = merged(opaque), clear = merged(glass);
    if (solid) {
      const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(solid, material);
      mesh.name = `journey-land:home:${tag}`;
      group.add(mesh); owned.push(solid, material);
    }
    if (clear) {
      const material = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(clear, material);
      mesh.name = `journey-land:home-glass:${tag}`;
      mesh.renderOrder = 3;
      group.add(mesh); owned.push(clear, material);
    }
  }
  return {
    group,
    // A home keeps its own finishes in every theme; only the provisional outline takes the theme's ink.
    recolour(outline) { for (const m of outlines) m.color.set(outline); },
    dispose() { group.removeFromParent(); for (const o of owned) o.dispose(); },
  };
}
