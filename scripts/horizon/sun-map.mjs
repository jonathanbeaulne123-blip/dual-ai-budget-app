import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { mapInputs, saveMap } from './slope-map.mjs';

const input = await mapInputs(), { api, field, cuts, out, sha256 } = input;
const width = 400, height = 360, maximumHeight = field.heights.reduce((maximum, h) => Math.max(maximum, h), -Infinity) + 0.5;
/** March against the exact rendered triangle interpolation. A receiver facing away
 * from the sun is shaded; an intervening Crown/ledge is a separate cast shadow. */
function occluded(x, y, z, direction) {
  if (direction[1] <= 0) return true;
  const horizontal = Math.hypot(direction[0], direction[2]);
  if (horizontal < 1e-5) return false;
  const dx = direction[0] / horizontal, dz = direction[2] / horizontal, dy = direction[1] / horizontal;
  for (let distance = field.step * 2; distance < 2400; distance += field.step * 2) {
    const px = x + dx * distance, pz = z + dz * distance, py = y + dy * distance;
    if (py > maximumHeight || px < 0 || pz < 0 || px > field.width || pz > field.depth) break;
    if (api.sampleTerrain(field, px, pz) > py + 0.12) return true;
  }
  return false;
}
for (const date of ['2026-06-21', '2026-12-21']) for (const clock of ['09:00', '15:00', '19:00']) {
  const instant = api.solarReviewDate(new Date('2026-09-25T16:00:00Z'), `?date=${date}&sun=${clock}`, { dev: true, timeZone: 'America/Toronto' });
  const sun = api.solarPosition(instant, { timeZone: 'America/Toronto' }), pixels = Buffer.alloc(width * height * 3);
  const counts = { water: 0, lit: 0, backFacing: 0, castShadow: 0, night: 0 };
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = (i + 0.5) / width * field.width, z = (j + 0.5) / height * field.depth, ground = api.sampleTerrain(field, x, z);
    const n = api.terrainNormal(field, x, z), dot = n[0] * sun.direction[0] + n[1] * sun.direction[1] + n[2] * sun.direction[2];
    let color;
    const wet = cuts.waters.some(w => { if (w.underground || w.kind === 'dry') return false; const level = api.waterHeightAt(w, x, z); return level !== null && ground <= level; });
    if (wet) { counts.water++; color = sun.elevation < 0 ? [28, 45, 68] : [122, 162, 184]; }
    else if (sun.geometricElevation <= 0) { counts.night++; color = [48, 57, 79]; }
    else if (dot <= 0) { counts.backFacing++; color = [91, 105, 141]; }
    else if (occluded(x, ground + 0.25, z, sun.direction)) { counts.castShadow++; color = [58, 69, 105]; }
    else { counts.lit++; color = [Math.round(184 + dot * 49), Math.round(171 + dot * 49), Math.round(130 + dot * 44)]; }
    pixels.set(color, (j * width + i) * 3);
  }
  const id = `sun_${date}_${clock.replace(':', '-')}`;
  await saveMap(input, `${id}.png`, pixels, width, height, `The Horizon · sunlight · ${date} ${clock}`, `44° N · America/Toronto standard meridian 75° W · sun elevation ${sun.elevation.toFixed(2)}° · azimuth ${sun.azimuth.toFixed(2)}°`, 'Warm: sunlit · blue: faces away · dark blue: cast terrain shadow · navy: night · water blue');
  const throat = { at: [1300, 119, 300], terrainOccluded: occluded(1300, 119, 300, sun.direction), note: 'Mouth centre probe against terrain only; cave opening/ceiling shadow requires the rendered geometry acceptance.' };
  const probeDir = resolve(out, '../probes'); await mkdir(probeDir, { recursive: true });
  await writeFile(resolve(probeDir, `${id}.json`), JSON.stringify({ revision: field.revision, terrainSha256: sha256, sun, receiverGrid: [width, height], rayStepEu: field.step * 2, terrainOnly: true, counts, throat }, null, 2));
  console.log(JSON.stringify({ map: resolve(out, `${id}.png`), counts, elevation: sun.elevation, throat }));
}
