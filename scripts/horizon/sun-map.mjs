import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { Ray, Vector3, Box3 } from 'three';
import { mapInputs, saveMap } from './slope-map.mjs';

const input = await mapInputs(), { api, field, cuts, out, sha256 } = input;
const width = 400, height = 360, maximumHeight = field.heights.reduce((maximum, h) => Math.max(maximum, h), -Infinity) + 0.5;
/** March against the exact rendered triangle interpolation. A receiver facing away
 * from the sun is shaded; an intervening Crown/ledge is a separate cast shadow. */
function occluded(x, y, z, direction, ignoreMouths = false) {
  if (direction[1] <= 0) return true;
  const horizontal = Math.hypot(direction[0], direction[2]);
  if (horizontal < 1e-5) return false;
  const dx = direction[0] / horizontal, dz = direction[2] / horizontal, dy = direction[1] / horizontal;
  for (let distance = field.step * 2; distance < 2400; distance += field.step * 2) {
    const px = x + dx * distance, pz = z + dz * distance, py = y + dy * distance;
    if (py > maximumHeight || px < 0 || pz < 0 || px > field.width || pz > field.depth) break;
    if ((!ignoreMouths || api.terrainTriangleVisible(px, pz, cuts)) && api.sampleTerrain(field, px, pz) > py + 0.12) return true;
  }
  return false;
}
const solids = input.world.geometry.solids;
const solidBounds = solids.map(solid => {
  const box = new Box3(); for (let i = 0; i < solid.positions.length; i += 3) box.expandByPoint(new Vector3(solid.positions[i], solid.positions[i + 1], solid.positions[i + 2]));
  return { solid, box };
});
/** Exact triangle rays for the named mouth, including actual ceilings and jambs. */
function throatSolidShadow(direction) {
  const ray = new Ray(new Vector3(1300, 119, 300), new Vector3(...direction).normalize()), a = new Vector3(), b = new Vector3(), c = new Vector3(), hit = new Vector3();
  let closest = Infinity, source = null;
  for (const { solid, box } of solidBounds) {
    if (!ray.intersectsBox(box)) continue;
    for (let j = 0; j < solid.indices.length; j += 3) {
      a.fromArray(solid.positions, solid.indices[j] * 3); b.fromArray(solid.positions, solid.indices[j + 1] * 3); c.fromArray(solid.positions, solid.indices[j + 2] * 3);
      if (ray.intersectTriangle(a, b, c, false, hit)) {
        const distance = hit.distanceTo(ray.origin);
        if (distance > 0.02 && distance < closest) { closest = distance; source = solid.id; }
      }
    }
  }
  return { occluded: source !== null, solid: source, distanceEu: source ? closest : null };
}
/** A bounded directional depth raster of every baked solid triangle. Terrain still
 * uses exact triangle height rays; this adds the dam, bridges, hosts and cave roofs. */
function solidShadowMap(direction) {
  const size = 1536, depth = new Float32Array(size * size).fill(-Infinity), horizontal = Math.hypot(direction[0], direction[2]);
  const u = [direction[2] / horizontal, 0, -direction[0] / horizontal], v = [-direction[1] * direction[0] / horizontal, horizontal, -direction[1] * direction[2] / horizontal];
  const dot = (p, basis) => p[0] * basis[0] + p[1] * basis[1] + p[2] * basis[2];
  const corners = [[0, -20, 0], [0, maximumHeight, 0], [field.width, -20, 0], [field.width, maximumHeight, 0], [0, -20, field.depth], [0, maximumHeight, field.depth], [field.width, -20, field.depth], [field.width, maximumHeight, field.depth]];
  const minU = Math.min(...corners.map(p => dot(p, u))) - 20, maxU = Math.max(...corners.map(p => dot(p, u))) + 20;
  const minV = Math.min(...corners.map(p => dot(p, v))) - 20, maxV = Math.max(...corners.map(p => dot(p, v))) + 20;
  const project = (x, y, z) => [((x * u[0] + z * u[2]) - minU) / (maxU - minU) * (size - 1), ((x * v[0] + y * v[1] + z * v[2]) - minV) / (maxV - minV) * (size - 1), x * direction[0] + y * direction[1] + z * direction[2]];
  let triangles = 0;
  for (const solid of solids) {
    const projected = [];
    for (let i = 0; i < solid.positions.length; i += 3) projected.push(project(solid.positions[i], solid.positions[i + 1], solid.positions[i + 2]));
    for (let i = 0; i < solid.indices.length; i += 3) {
      const a = projected[solid.indices[i]], b = projected[solid.indices[i + 1]], c = projected[solid.indices[i + 2]];
      const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(area) < 1e-7) continue; triangles++;
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const wa = ((b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])) / area;
        const wb = ((c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])) / area, wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const n = y * size + x; depth[n] = Math.max(depth[n], a[2] * wa + b[2] * wb + c[2] * wc);
      }
    }
  }
  return { size, triangles, biasEu: 0.8, occluded(x, y, z) {
    const p = project(x, y, z), i = Math.floor(p[0]), j = Math.floor(p[1]);
    return i >= 0 && j >= 0 && i < size && j < size && depth[j * size + i] > p[2] + 0.8;
  } };
}
for (const date of ['2026-06-21', '2026-12-21']) for (const clock of ['09:00', '15:00', '19:00']) {
  const instant = api.solarReviewDate(new Date('2026-09-25T16:00:00Z'), `?date=${date}&sun=${clock}`, { dev: true, timeZone: 'America/Toronto' });
  const sun = api.solarPosition(instant, { timeZone: 'America/Toronto' }), pixels = Buffer.alloc(width * height * 3);
  const solidMap = sun.geometricElevation > 0 ? solidShadowMap(sun.direction) : null;
  const counts = { water: 0, lit: 0, backFacing: 0, castShadow: 0, structureShadow: 0, night: 0 };
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = (i + 0.5) / width * field.width, z = (j + 0.5) / height * field.depth, ground = api.sampleTerrain(field, x, z);
    const n = api.terrainNormal(field, x, z), dot = n[0] * sun.direction[0] + n[1] * sun.direction[1] + n[2] * sun.direction[2];
    let color;
    const wet = cuts.waters.some(w => { if (w.underground || w.kind === 'dry') return false; const level = api.waterHeightAt(w, x, z); return level !== null && ground <= level; });
    if (wet) { counts.water++; color = sun.elevation < 0 ? [28, 45, 68] : [122, 162, 184]; }
    else if (sun.geometricElevation <= 0) { counts.night++; color = [48, 57, 79]; }
    else if (dot <= 0) { counts.backFacing++; color = [91, 105, 141]; }
    else if (occluded(x, ground + 0.25, z, sun.direction)) { counts.castShadow++; color = [58, 69, 105]; }
    else if (solidMap?.occluded(x, ground + 0.25, z)) { counts.structureShadow++; color = [89, 66, 105]; }
    else { counts.lit++; color = [Math.round(184 + dot * 49), Math.round(171 + dot * 49), Math.round(130 + dot * 44)]; }
    pixels.set(color, (j * width + i) * 3);
  }
  const id = `sun_${date}_${clock.replace(':', '-')}`;
  await saveMap(input, `${id}.png`, pixels, width, height, `The Horizon · sunlight · ${date} ${clock}`, `44° N · America/Toronto standard meridian 75° W · sun elevation ${sun.elevation.toFixed(2)}° · azimuth ${sun.azimuth.toFixed(2)}°`, 'Warm: sunlit · blue: back face · dark blue: terrain shadow · purple: structure shadow · navy: night');
  const solidHit = sun.geometricElevation > 0 ? throatSolidShadow(sun.direction) : { occluded: false, solid: null, distanceEu: null };
  const terrainOccluded = sun.geometricElevation > 0 && occluded(1300, 119, 300, sun.direction, true);
  const throat = { at: [1300, 119, 300], terrainOccluded, solidHit, inShade: sun.geometricElevation <= 0 || terrainOccluded || solidHit.occluded, note: 'Exact ray against every baked solid triangle at the mouth centre; terrain ray excludes the named mouth masks. Night is reported separately.' };
  const probeDir = resolve(out, '../probes'); await mkdir(probeDir, { recursive: true });
  await writeFile(resolve(probeDir, `${id}.json`), JSON.stringify({ revision: field.revision, terrainSha256: sha256, sun, receiverGrid: [width, height], rayStepEu: field.step * 2, terrainOnly: false, solidShadowRaster: solidMap ? { size: solidMap.size, triangles: solidMap.triangles, biasEu: solidMap.biasEu, limit: 'Thin structures below a light-raster texel may not cast a resolved map shadow; mouth probes use exact triangles.' } : null, counts, throat }, null, 2));
  console.log(JSON.stringify({ map: resolve(out, `${id}.png`), counts, elevation: sun.elevation, throat }));
}
