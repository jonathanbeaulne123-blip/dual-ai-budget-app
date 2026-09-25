import { build } from 'esbuild';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const argument = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
export async function mapInputs() {
  const root = resolve(argument('--root', process.cwd()));
  const out = resolve(argument('--output', resolve(root, 'evidence/maps')));
  const assetPath = resolve(root, argument('--asset', 'public/horizon/terrain/horizon-geo-1.bin'));
  const bytes = await readFile(assetPath), world = JSON.parse(await readFile(resolve(root, 'public/horizon/world/horizon-geo-1.json'), 'utf8'));
  const result = await build({ stdin: { contents: [
    `export * from './src/harbour/horizon/land/terrain/index.ts';`,
    `export * from './src/harbour/horizon/land/terrain/asset.ts';`,
    `export * from './src/harbour/horizon/land/terrain/geometry.ts';`,
    `export * from './src/harbour/horizon/land/coast/index.ts';`,
    `export * from './src/harbour/horizon/land/water/index.ts';`,
    `export * from './src/harbour/horizon/sun/solar.ts';`,
  ].join('\n'), resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
  const api = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  const field = api.decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const manifest = JSON.parse(await readFile(resolve(root, 'src/harbour/horizon/world/MANIFEST.json'), 'utf8'));
  const cuts = { ...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics };
  await mkdir(out, { recursive: true });
  return { root, out, api, field, world, cuts, manifest, sha256: createHash('sha256').update(bytes).digest('hex'), assetPath };
}
export function rgb(hex) { return [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)); }
export async function saveMap({ out, field, sha256 }, name, pixels, width, height, title, subtitle, legend, overlay = '') {
  const map = await sharp(pixels, { raw: { width, height, channels: 3 } }).resize(1000, 900, { kernel: 'nearest' }).png().toBuffer();
  const base64 = map.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1100"><rect width="1120" height="1100" fill="#f5f0e6"/><g font-family="Arial, sans-serif" fill="#30251f"><text x="60" y="36" font-size="24">${title}</text><text x="60" y="61" font-size="13">${subtitle}</text><image href="data:image/png;base64,${base64}" x="60" y="80" width="1000" height="900"/>${overlay}<text x="1040" y="111" font-size="20">N↑</text><text x="60" y="1005" font-size="14">${legend}</text><text x="60" y="1032" font-size="12">${field.revision} · lattice ${field.columns} × ${field.rows} at ${field.step} eu · north is −z</text><text x="60" y="1054" font-size="10">Terrain SHA-256 ${sha256}</text><text x="60" y="1075" font-size="11">Actual baked terrain; maps are builder evidence, not physical-device acceptance.</text></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(resolve(out, name));
}
export async function bandReport(input) {
  const { api, field, manifest, cuts, sha256 } = input, bands = [];
  for (const band of manifest.landforms) if (band.poly && Array.isArray(band.h)) {
    const poly = band.poly.map(([x, z]) => [x * manifest.scale.factor, z * manifest.scale.factor]);
    const minX = Math.min(...poly.map(p => p[0])), maxX = Math.max(...poly.map(p => p[0])), minZ = Math.min(...poly.map(p => p[1])), maxZ = Math.max(...poly.map(p => p[1]));
    let eligible = 0, passing = 0, raw = 0, rawPassing = 0; const exclusions = {};
    for (let z = minZ + 2.5; z < maxZ; z += 5) for (let x = minX + 2.5; x < maxX; x += 5) if (api.contains(poly, x, z)) {
      const height = api.sampleTerrain(field, x, z), pass = height >= band.h[0] * manifest.scale.factor - 0.02 && height <= band.h[1] * manifest.scale.factor + 0.02;
      raw++; rawPassing += Number(pass);
      const excluded = api.bandProbeEligibility(band.id, x, z, cuts);
      if (excluded) exclusions[excluded] = (exclusions[excluded] ?? 0) + 1; else { eligible++; passing += Number(pass); }
    }
    const centre = api.polygonCentre(poly), mid = (band.h[0] + band.h[1]) / 2 * manifest.scale.factor, above = api.sampleTerrain(field, ...centre) >= mid;
    const rays = [], maxProbe = Math.hypot(field.width, field.depth);
    for (let i = 0; i < 32; i++) {
      const bearing = i * Math.PI / 16;
      let d = 0, found = false;
      for (; d < maxProbe; d += 2.5) {
        const x = centre[0] + d * Math.cos(bearing), z = centre[1] + d * Math.sin(bearing);
        if (x < 0 || z < 0 || x > field.width || z > field.depth) break;
        if ((api.sampleTerrain(field, x, z) >= mid) !== above) { found = true; break; }
      }
      rays.push({ bearingDegrees: i * 11.25, distance: found ? d : null });
    }
    const measured = rays.flatMap(r => r.distance === null ? [] : [r.distance]);
    const variation = measured.length ? (Math.max(...measured) - Math.min(...measured)) / (measured.reduce((a, b) => a + b, 0) / measured.length) : null;
    bands.push({ id: band.id, rawProbes: raw, rawCoverage: rawPassing / raw, effectiveExposedProbes: eligible, coverage: eligible ? passing / eligible : null, passesBand: eligible > 0 && passing / eligible >= 0.9, exclusions, contour: { threshold: mid, variation, rays, closed: measured.length === 32, passesFullCompass: measured.length === 32 && variation >= 0.25 } });
  }
  return { revision: field.revision, terrainSha256: sha256, probeSpacingEu: 5, toleranceEu: 0.02, exclusionRule: 'Clip to shoreline and exclude its 12 m stroke; higher-band precedence and 60 m blends; named water/banks and Notch; actual graded pads and bed blends; named mouths. Exclusions are never passing probes.', contourRule: 'First actual mid-band crossing along each compass ray from polygon centroid; null means an open contour. Only 32 measured rays can pass the full-compass condition.', bands };
}
export async function slopeMap() {
  const input = await mapInputs(), { api, field, cuts, out, sha256 } = input;
  const width = 800, height = 720, pixels = Buffer.alloc(width * height * 3), counts = { water: 0, walkable: 0, nonWalkable: 0 };
  const colors = { water: rgb('#80a5b7'), walkable: rgb('#c4ce9a'), nonWalkable: rgb('#956c53') };
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = (i + 0.5) / width * field.width, z = (j + 0.5) / height * field.depth, h = api.sampleTerrain(field, x, z), normal = api.terrainNormal(field, x, z);
    const wet = cuts.waters.some(w => { if (w.underground || w.kind === 'dry') return false; const level = api.waterHeightAt(w, x, z); return level !== null && h <= level; });
    const key = wet ? 'water' : api.isWalkableSlope(Math.hypot(normal[0], normal[2]) / normal[1]) ? 'walkable' : 'nonWalkable';
    counts[key]++; pixels.set(colors[key], (j * width + i) * 3);
  }
  const segments = [], gradeCounts = [0, 0, 0, 0];
  for (const bed of cuts.beds) {
    if (bed.kind === 'cable' || bed.kind === 'cave') continue;
    for (let i = 1; i < bed.points.length; i++) {
      const a = bed.points[i - 1], b = bed.points[i], length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (!length) continue;
      const grade = Math.abs(b[1] - a[1]) / length, level = grade <= 0.06 ? 0 : grade <= 0.08 ? 1 : grade <= 0.12 ? 2 : 3;
      gradeCounts[level]++;
      segments.push(`<path d="M${60 + a[0] / field.width * 1000},${80 + a[2] / field.depth * 900} L${60 + b[0] / field.width * 1000},${80 + b[2] / field.depth * 900}" fill="none" stroke="${['#1e7145', '#168898', '#cf912e', '#c33239'][level]}" stroke-width="${Math.max(1.2, bed.width / field.width * 1000)}"/>`);
    }
  }
  await saveMap(input, 'slope.png', pixels, width, height, 'The Horizon · actual slope map', 'Open ground: green ≤40°; brown &gt;40°. Route strokes use each authored segment’s measured rise/run.', 'Beds: dark green ≤6% · teal 6–8% · ochre 8–12% · red &gt;12% · water blue', segments.join(''));
  const probes = await bandReport(input), probeDir = resolve(out, '../probes'); await mkdir(probeDir, { recursive: true });
  await writeFile(resolve(probeDir, 'horizon-landforms.json'), JSON.stringify(probes, null, 2));
  await writeFile(resolve(probeDir, 'horizon-slope.json'), JSON.stringify({ revision: field.revision, terrainSha256: sha256, walkableDegrees: 40, pixels: counts, bedSegments: gradeCounts, gradeClasses: ['<=6%', '6–8%', '8–12%', '>12%'] }, null, 2));
  console.log(JSON.stringify({ map: resolve(out, 'slope.png'), probes: resolve(probeDir, 'horizon-landforms.json'), bandsPassing: probes.bands.filter(b => b.passesBand).length, bands: probes.bands.length, contoursPassingFullCompass: probes.bands.filter(b => b.contour.passesFullCompass).length }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await slopeMap();
